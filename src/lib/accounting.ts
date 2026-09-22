import { Prisma, AccountType } from "@prisma/client";

/**
 * Returns true if the account type has a normal Debit balance (Assets, Expenses, COGS).
 * Returns false if the account type has a normal Credit balance (Liabilities, Equity, Revenue).
 */
export function isNormalDebit(type: AccountType): boolean {
  return type === "ASSET" || type === "EXPENSE" || type === "COGS";
}

/**
 * Generates the next sequential Journal Entry Number for a business
 */
export async function getNextEntryNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  prefix: string = "JE"
): Promise<string> {
  const count = await tx.journalEntry.count({
    where: { businessId },
  });
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${(count + 1).toString().padStart(5, "0")}`;
}

/**
 * Finds or retrieves standard Chart of Accounts for a business
 */
export async function getStandardAccounts(
  tx: Prisma.TransactionClient,
  businessId: string
) {
  const accounts = await tx.account.findMany({
    where: { businessId, isActive: true },
  });

  const byCode = (code: string) => accounts.find((a) => a.code === code);

  return {
    cash: byCode("1000") || accounts.find((a) => a.type === "ASSET" && !a.isBankAccount),
    cashBranch1: byCode("1010"),
    cashBranch2: byCode("1020"),
    bank: byCode("1100") || accounts.find((a) => a.isBankAccount),
    receivable: byCode("1200") || accounts.find((a) => a.type === "ASSET" && a.name.includes("Receivable")),
    inventory: byCode("1300") || accounts.find((a) => a.type === "ASSET" && a.name.includes("Inventory")),
    payable: byCode("2000") || accounts.find((a) => a.type === "LIABILITY" && a.name.includes("Payable")),
    vatPayable: byCode("2100") || accounts.find((a) => a.type === "LIABILITY" && a.name.includes("VAT")),
    equity: byCode("3000") || accounts.find((a) => a.type === "EQUITY"),
    salesRevenue: byCode("4000") || accounts.find((a) => a.type === "REVENUE"),
    serviceRevenue: byCode("4100"),
    cogs: byCode("5000") || accounts.find((a) => a.type === "COGS"),
    operatingExpense: byCode("6000") || accounts.find((a) => a.type === "EXPENSE"),
  };
}

/**
 * Automatically creates balanced double-entry journal lines for a POS Sale
 */
export async function recordSaleJournalEntry({
  tx,
  businessId,
  saleId,
  invoiceNumber,
  totalAmount,
  costAmount,
  paymentMethod,
  taxAmount = 0,
}: {
  tx: Prisma.TransactionClient;
  businessId: string;
  saleId?: string | null;
  invoiceNumber: string;
  totalAmount: number;
  costAmount: number;
  paymentMethod: string;
  taxAmount?: number;
}) {
  const std = await getStandardAccounts(tx, businessId);
  if (!std.salesRevenue) return null;

  // Debit Account (Cash / Bank / Receivable)
  const debitAcc =
    paymentMethod === "BANK_TRANSFER" || paymentMethod === "CARD" || paymentMethod === "QR_CODE"
      ? std.bank || std.cash
      : paymentMethod === "CREDIT"
      ? std.receivable || std.cash
      : std.cash;

  if (!debitAcc) return null;

  const entryNumber = await getNextEntryNumber(tx, businessId, "SAL");
  const netRevenue = Math.max(0, totalAmount - taxAmount);

  // Create Header
  const entry = await tx.journalEntry.create({
    data: {
      businessId,
      entryNumber,
      description: `Sales Invoice ${invoiceNumber}`,
      reference: invoiceNumber,
      referenceType: "Sale",
      referenceId: saleId || null,
      saleId: saleId || null,
      isPosted: true,
      postedAt: new Date(),
    },
  });

  // Line 1: Debit Cash/Bank/AR for Total Amount, Credit Sales Revenue for Net Revenue
  await tx.journalLine.create({
    data: {
      entryId: entry.id,
      debitAccountId: debitAcc.id,
      creditAccountId: std.salesRevenue.id,
      amount: new Prisma.Decimal(netRevenue),
      description: `Revenue from ${invoiceNumber}`,
    },
  });

  // Update Account Balances
  await updateAccountBalance(tx, debitAcc.id, netRevenue, "DEBIT");
  await updateAccountBalance(tx, std.salesRevenue.id, netRevenue, "CREDIT");

  // Line 2: If VAT / Tax exists, Debit Cash/Bank, Credit VAT Payable
  if (taxAmount > 0 && std.vatPayable) {
    await tx.journalLine.create({
      data: {
        entryId: entry.id,
        debitAccountId: debitAcc.id,
        creditAccountId: std.vatPayable.id,
        amount: new Prisma.Decimal(taxAmount),
        description: `VAT output on ${invoiceNumber}`,
      },
    });
    await updateAccountBalance(tx, debitAcc.id, taxAmount, "DEBIT");
    await updateAccountBalance(tx, std.vatPayable.id, taxAmount, "CREDIT");
  }

  // Line 3: Cost of Goods Sold (Debit COGS, Credit Inventory)
  if (costAmount > 0 && std.cogs && std.inventory) {
    await tx.journalLine.create({
      data: {
        entryId: entry.id,
        debitAccountId: std.cogs.id,
        creditAccountId: std.inventory.id,
        amount: new Prisma.Decimal(costAmount),
        description: `Cost of goods sold for ${invoiceNumber}`,
      },
    });
    await updateAccountBalance(tx, std.cogs.id, costAmount, "DEBIT");
    await updateAccountBalance(tx, std.inventory.id, costAmount, "CREDIT");
  }

  return entry;
}

/**
 * Automatically creates balanced double-entry journal lines for a GRN Purchase
 */
export async function recordPurchaseJournalEntry({
  tx,
  businessId,
  purchaseId,
  grnNumber,
  totalAmount,
  paidAmount,
  paymentMethod,
}: {
  tx: Prisma.TransactionClient;
  businessId: string;
  purchaseId?: string | null;
  grnNumber: string;
  totalAmount: number;
  paidAmount: number;
  paymentMethod?: string;
}) {
  const std = await getStandardAccounts(tx, businessId);
  if (!std.inventory) return null;

  const entryNumber = await getNextEntryNumber(tx, businessId, "PUR");
  const balanceAmount = Math.max(0, totalAmount - paidAmount);

  const entry = await tx.journalEntry.create({
    data: {
      businessId,
      entryNumber,
      description: `Goods Received Note ${grnNumber}`,
      reference: grnNumber,
      referenceType: "Purchase",
      referenceId: purchaseId || null,
      purchaseId: purchaseId || null,
      isPosted: true,
      postedAt: new Date(),
    },
  });

  // If unpaid balance exists: Debit Inventory, Credit Accounts Payable
  if (balanceAmount > 0 && std.payable) {
    await tx.journalLine.create({
      data: {
        entryId: entry.id,
        debitAccountId: std.inventory.id,
        creditAccountId: std.payable.id,
        amount: new Prisma.Decimal(balanceAmount),
        description: `Payable for ${grnNumber}`,
      },
    });
    await updateAccountBalance(tx, std.inventory.id, balanceAmount, "DEBIT");
    await updateAccountBalance(tx, std.payable.id, balanceAmount, "CREDIT");
  }

  // If immediate payment was made on receipt: Debit Inventory, Credit Bank/Cash
  if (paidAmount > 0) {
    const creditAcc =
      paymentMethod === "BANK_TRANSFER" || paymentMethod === "CHEQUE"
        ? std.bank || std.cash
        : std.cash;

    if (creditAcc) {
      await tx.journalLine.create({
        data: {
          entryId: entry.id,
          debitAccountId: std.inventory.id,
          creditAccountId: creditAcc.id,
          amount: new Prisma.Decimal(paidAmount),
          description: `Disbursement on receipt of ${grnNumber}`,
        },
      });
      await updateAccountBalance(tx, std.inventory.id, paidAmount, "DEBIT");
      await updateAccountBalance(tx, creditAcc.id, paidAmount, "CREDIT");
    }
  }

  return entry;
}

/**
 * Automatically creates balanced double-entry journal lines for a Supplier Settlement Payment
 */
export async function recordSupplierPaymentJournalEntry({
  tx,
  businessId,
  payableId,
  grnNumber,
  amount,
  method,
  reference,
}: {
  tx: Prisma.TransactionClient;
  businessId: string;
  payableId: string;
  grnNumber?: string;
  amount: number;
  method: string;
  reference?: string | null;
}) {
  const std = await getStandardAccounts(tx, businessId);
  if (!std.payable) return null;

  const creditAcc =
    method === "BANK_TRANSFER" || method === "CHEQUE" || method === "CARD"
      ? std.bank || std.cash
      : std.cash;

  if (!creditAcc) return null;

  const entryNumber = await getNextEntryNumber(tx, businessId, "PMT");

  const entry = await tx.journalEntry.create({
    data: {
      businessId,
      entryNumber,
      description: `Supplier payment for ${grnNumber || "invoice"} (${method})`,
      reference: reference || grnNumber || null,
      referenceType: "Payment",
      referenceId: payableId,
      isPosted: true,
      postedAt: new Date(),
    },
  });

  // Debit Accounts Payable, Credit Bank / Cash
  await tx.journalLine.create({
    data: {
      entryId: entry.id,
      debitAccountId: std.payable.id,
      creditAccountId: creditAcc.id,
      amount: new Prisma.Decimal(amount),
      description: `Disbursement to vendor via ${method} ${reference ? `(Ref: ${reference})` : ""}`,
    },
  });

  await updateAccountBalance(tx, std.payable.id, amount, "DEBIT");
  await updateAccountBalance(tx, creditAcc.id, amount, "CREDIT");

  return entry;
}

/**
 * Updates an account's running balance based on its normal debit/credit orientation
 */
async function updateAccountBalance(
  tx: Prisma.TransactionClient,
  accountId: string,
  amount: number,
  action: "DEBIT" | "CREDIT"
) {
  const account = await tx.account.findUnique({
    where: { id: accountId },
    select: { type: true },
  });

  if (!account) return;

  const isDebitNormal = isNormalDebit(account.type);

  // If Debit normal: Debit adds, Credit subtracts
  // If Credit normal: Credit adds, Debit subtracts
  let delta = 0;
  if (isDebitNormal) {
    delta = action === "DEBIT" ? amount : -amount;
  } else {
    delta = action === "CREDIT" ? amount : -amount;
  }

  await tx.account.update({
    where: { id: accountId },
    data: { balance: { increment: new Prisma.Decimal(delta) } },
  });
}

/**
 * Automatically creates balanced double-entry journal lines for an Expense
 */
export async function createExpenseEntry({
  businessId,
  expenseId,
  amount,
  description,
  method,
}: {
  businessId: string;
  expenseId: string;
  amount: number;
  description: string;
  method: string;
}) {
  const { prisma } = await import("@/lib/db");
  return prisma.$transaction(async (tx) => {
    const std = await getStandardAccounts(tx, businessId);
    if (!std.operatingExpense) return null;

    const creditAcc =
      method === "BANK_TRANSFER" || method === "CHEQUE" || method === "CARD"
        ? std.bank || std.cash
        : std.cash;
    if (!creditAcc) return null;

    const entryNumber = await getNextEntryNumber(tx, businessId, "EXP");
    const entry = await tx.journalEntry.create({
      data: {
        businessId,
        entryNumber,
        description: `Expense: ${description}`,
        reference: expenseId,
        referenceType: "Expense",
        referenceId: expenseId,
        isPosted: true,
        postedAt: new Date(),
      },
    });

    await tx.journalLine.create({
      data: {
        entryId: entry.id,
        debitAccountId: std.operatingExpense.id,
        creditAccountId: creditAcc.id,
        amount: new Prisma.Decimal(amount),
        description: `Expense payment via ${method}: ${description}`,
      },
    });

    await updateAccountBalance(tx, std.operatingExpense.id, amount, "DEBIT");
    await updateAccountBalance(tx, creditAcc.id, amount, "CREDIT");

    return entry;
  });
}

