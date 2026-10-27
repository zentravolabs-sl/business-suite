import { Prisma, AccountType } from "@prisma/client";
import Decimal from "decimal.js";
import { allocateJournalEntryNumber } from "./tax/sequence-service";

/**
 * Returns true if the account type has a normal Debit balance (Assets, Expenses, COGS).
 * Returns false if the account type has a normal Credit balance (Liabilities, Equity, Revenue).
 */
export function isNormalDebit(type: AccountType): boolean {
  return type === "ASSET" || type === "EXPENSE" || type === "COGS";
}

/**
 * Generates the next sequential Journal Entry Number for a business
 * (Concurrency-safe row-locked counter).
 */
export async function getNextEntryNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  prefix: string = "JE"
): Promise<string> {
  return allocateJournalEntryNumber(tx, businessId, prefix);
}

/**
 * Finds or retrieves standard Chart of Accounts for a business,
 * with customizable overrides from `TaxAccountMapping`.
 */
export async function getStandardAccounts(
  tx: Prisma.TransactionClient,
  businessId: string
) {
  const accounts = await tx.account.findMany({
    where: { businessId, isActive: true },
  });

  const mappings = await tx.taxAccountMapping.findMany({
    where: { businessId },
  });
  const mapByKey = new Map(mappings.map((m) => [m.key, m.accountId]));

  const byCode = (code: string) => accounts.find((a) => a.code === code);
  const byMappingOrCode = (key: string, code: string) => {
    const accId = mapByKey.get(key);
    if (accId) {
      const match = accounts.find((a) => a.id === accId);
      if (match) return match;
    }
    return byCode(code);
  };

  // Find or lazily create Input VAT account (1400) if missing
  let inputVat = byMappingOrCode("INPUT_VAT", "1400") || accounts.find((a) => a.type === "ASSET" && a.name.includes("Input VAT"));
  if (!inputVat) {
    try {
      inputVat = await tx.account.create({
        data: {
          businessId,
          code: "1400",
          name: "Input VAT (Recoverable)",
          type: "ASSET",
          description: "Recoverable Input VAT paid on purchases and expenses",
          isSystem: true,
          balance: 0,
        },
      });
    } catch {
      inputVat = byCode("1400") || accounts.find((a) => a.type === "ASSET" && a.name.includes("Input VAT"));
    }
  }

  // Find or lazily create Sales Returns (4200) contra-revenue account if missing
  let salesReturns = byMappingOrCode("SALES_RETURNS", "4200") || accounts.find((a) => a.type === "REVENUE" && (a.name.includes("Return") || a.name.includes("Allowance")));
  if (!salesReturns) {
    try {
      salesReturns = await tx.account.create({
        data: {
          businessId,
          code: "4200",
          name: "Sales Returns & Allowances",
          type: "REVENUE",
          description: "Contra-revenue account for sales refunds and credit notes",
          isSystem: true,
          balance: 0,
        },
      });
    } catch {
      salesReturns = byCode("4200");
    }
  }

  return {
    cash: byMappingOrCode("CASH", "1000") || accounts.find((a) => a.type === "ASSET" && !a.isBankAccount),
    cashBranch1: byCode("1010"),
    cashBranch2: byCode("1020"),
    bank: byMappingOrCode("BANK", "1100") || accounts.find((a) => a.isBankAccount),
    receivable: byMappingOrCode("ACCOUNTS_RECEIVABLE", "1200") || accounts.find((a) => a.type === "ASSET" && a.name.includes("Receivable")),
    inventory: byMappingOrCode("INVENTORY", "1300") || accounts.find((a) => a.type === "ASSET" && a.name.includes("Inventory")),
    inputVat,
    payable: byMappingOrCode("ACCOUNTS_PAYABLE", "2000") || accounts.find((a) => a.type === "LIABILITY" && a.name.includes("Payable")),
    vatPayable: byMappingOrCode("OUTPUT_VAT", "2100") || accounts.find((a) => a.type === "LIABILITY" && a.name.includes("VAT")),
    equity: byCode("3000") || accounts.find((a) => a.type === "EQUITY"),
    salesRevenue: byMappingOrCode("SALES_REVENUE", "4000") || accounts.find((a) => a.type === "REVENUE"),
    serviceRevenue: byMappingOrCode("SERVICE_REVENUE", "4100"),
    salesReturns,
    cogs: byMappingOrCode("COGS", "5000") || accounts.find((a) => a.type === "COGS"),
    operatingExpense: byMappingOrCode("OPERATING_EXPENSE", "6000") || accounts.find((a) => a.type === "EXPENSE"),
  };
}

export interface LegItem {
  accountId: string;
  amount: number | string | Decimal;
  description?: string;
}

/**
 * Matches an arbitrary list of Debit Legs with an arbitrary list of Credit Legs
 * so each generated JournalLine has a debitAccountId, creditAccountId, and amount,
 * guaranteeing mathematical balance down to the exact cent.
 */
export function pairLegs(
  debits: LegItem[],
  credits: LegItem[]
): { debitAccountId: string; creditAccountId: string; amount: Decimal; description?: string }[] {
  const dList = debits
    .map((d) => ({ accountId: d.accountId, amount: new Decimal(d.amount), description: d.description }))
    .filter((d) => d.amount.gt(0));
  const cList = credits
    .map((c) => ({ accountId: c.accountId, amount: new Decimal(c.amount), description: c.description }))
    .filter((c) => c.amount.gt(0));

  const pairs: { debitAccountId: string; creditAccountId: string; amount: Decimal; description?: string }[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < dList.length && cIdx < cList.length) {
    const d = dList[dIdx];
    const c = cList[cIdx];

    const matchAmount = Decimal.min(d.amount, c.amount);
    if (matchAmount.gt(0)) {
      pairs.push({
        debitAccountId: d.accountId,
        creditAccountId: c.accountId,
        amount: matchAmount.toDecimalPlaces(2),
        description: d.description || c.description,
      });
      d.amount = d.amount.minus(matchAmount);
      c.amount = c.amount.minus(matchAmount);
    }

    if (d.amount.lte(0.0001)) dIdx++;
    if (c.amount.lte(0.0001)) cIdx++;
  }

  return pairs;
}

/**
 * Creates paired journal lines for an entry and updates account balances atomically.
 */
async function postPairedLines(
  tx: Prisma.TransactionClient,
  entryId: string,
  debits: LegItem[],
  credits: LegItem[]
) {
  const pairs = pairLegs(debits, credits);
  for (const pair of pairs) {
    await tx.journalLine.create({
      data: {
        entryId,
        debitAccountId: pair.debitAccountId,
        creditAccountId: pair.creditAccountId,
        amount: new Prisma.Decimal(pair.amount.toString()),
        description: pair.description,
      },
    });
    await updateAccountBalance(tx, pair.debitAccountId, pair.amount.toNumber(), "DEBIT");
    await updateAccountBalance(tx, pair.creditAccountId, pair.amount.toNumber(), "CREDIT");
  }
}

/**
 * Automatically creates balanced double-entry journal lines for a POS Sale,
 * handling split payments, credit sales, partial payments, and output VAT.
 */
export async function recordSaleJournalEntry({
  tx,
  businessId,
  saleId,
  invoiceNumber,
  totalAmount,
  costAmount = 0,
  paymentMethod,
  payments,
  taxAmount = 0,
}: {
  tx: Prisma.TransactionClient;
  businessId: string;
  saleId?: string | null;
  invoiceNumber: string;
  totalAmount: number;
  costAmount?: number;
  paymentMethod?: string;
  payments?: { method: string; amount: number }[];
  taxAmount?: number;
}) {
  const std = await getStandardAccounts(tx, businessId);
  if (!std.salesRevenue) return null;

  const totalDec = new Decimal(totalAmount);
  const taxDec = new Decimal(Math.max(0, taxAmount));
  const netRevenueDec = Decimal.max(0, totalDec.minus(taxDec));

  // Determine Debit Legs (Cash / Bank / AR)
  const debitLegs: LegItem[] = [];

  const resolveAccountForMethod = (method: string) => {
    switch (method) {
      case "BANK_TRANSFER":
      case "CARD":
      case "QR_CODE":
      case "ONLINE":
      case "CHEQUE":
        return std.bank || std.cash;
      case "CREDIT":
        return std.receivable || std.cash;
      default:
        return std.cash;
    }
  };

  if (Array.isArray(payments) && payments.length > 0) {
    let allocatedTotal = new Decimal(0);
    for (const p of payments) {
      const pAmt = new Decimal(p.amount);
      if (pAmt.gt(0)) {
        const acc = resolveAccountForMethod(p.method);
        if (acc) {
          debitLegs.push({
            accountId: acc.id,
            amount: pAmt,
            description: `Payment via ${p.method} for ${invoiceNumber}`,
          });
          allocatedTotal = allocatedTotal.plus(pAmt);
        }
      }
    }
    // Any uncollected remainder goes to Accounts Receivable
    const shortfall = totalDec.minus(allocatedTotal);
    if (shortfall.gt(0) && std.receivable) {
      debitLegs.push({
        accountId: std.receivable.id,
        amount: shortfall,
        description: `Uncollected balance on ${invoiceNumber} (AR)`,
      });
    }
  } else {
    // Single payment method or credit
    const acc = resolveAccountForMethod(paymentMethod || "CASH");
    if (acc) {
      debitLegs.push({
        accountId: acc.id,
        amount: totalDec,
        description: `Sale receipt for ${invoiceNumber} (${paymentMethod || "CASH"})`,
      });
    }
  }

  // Credit Legs: Sales Revenue + Output VAT
  const creditLegs: LegItem[] = [];
  if (netRevenueDec.gt(0)) {
    creditLegs.push({
      accountId: std.salesRevenue.id,
      amount: netRevenueDec,
      description: `Revenue from ${invoiceNumber}`,
    });
  }
  if (taxDec.gt(0) && std.vatPayable) {
    creditLegs.push({
      accountId: std.vatPayable.id,
      amount: taxDec,
      description: `Output VAT on ${invoiceNumber}`,
    });
  } else if (taxDec.gt(0) && !std.vatPayable) {
    // If no VAT liability account is mapped, record as general revenue
    creditLegs.push({
      accountId: std.salesRevenue.id,
      amount: taxDec,
      description: `Gross tax component from ${invoiceNumber}`,
    });
  }

  const entryNumber = await getNextEntryNumber(tx, businessId, "SAL");
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

  // Post revenue and cash/AR pairs
  await postPairedLines(tx, entry.id, debitLegs, creditLegs);

  // COGS and Inventory leg
  if (costAmount > 0 && std.cogs && std.inventory) {
    const costDec = new Decimal(costAmount);
    await tx.journalLine.create({
      data: {
        entryId: entry.id,
        debitAccountId: std.cogs.id,
        creditAccountId: std.inventory.id,
        amount: new Prisma.Decimal(costDec.toFixed(2)),
        description: `Cost of goods sold for ${invoiceNumber}`,
      },
    });
    await updateAccountBalance(tx, std.cogs.id, costAmount, "DEBIT");
    await updateAccountBalance(tx, std.inventory.id, costAmount, "CREDIT");
  }

  return entry;
}

/**
 * Creates balanced double-entry journal lines for a Sales Refund / Credit Note.
 * Reverses revenue, output VAT liability, and returns stock to inventory.
 */
export async function recordCreditNoteJournalEntry({
  tx,
  businessId,
  refundId,
  creditNoteNumber,
  taxableAmount,
  taxAmount,
  totalAmount,
  costAmount = 0,
  paymentMethod = "CASH",
}: {
  tx: Prisma.TransactionClient;
  businessId: string;
  refundId?: string | null;
  creditNoteNumber: string;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  costAmount?: number;
  paymentMethod?: string;
}) {
  const std = await getStandardAccounts(tx, businessId);
  const revenueAccount = std.salesReturns || std.salesRevenue;
  if (!revenueAccount) return null;

  const creditTargetAcc =
    paymentMethod === "BANK_TRANSFER" || paymentMethod === "CARD" || paymentMethod === "ONLINE"
      ? std.bank || std.cash
      : paymentMethod === "CREDIT"
      ? std.receivable || std.cash
      : std.cash;

  if (!creditTargetAcc) return null;

  const entryNumber = await getNextEntryNumber(tx, businessId, "CRN");
  const entry = await tx.journalEntry.create({
    data: {
      businessId,
      entryNumber,
      description: `Credit Note / Refund ${creditNoteNumber}`,
      reference: creditNoteNumber,
      referenceType: "Refund",
      referenceId: refundId || null,
      isPosted: true,
      postedAt: new Date(),
    },
  });

  const taxableDec = new Decimal(Math.max(0, taxableAmount));
  const taxDec = new Decimal(Math.max(0, taxAmount));

  // Debit Legs: Sales Returns (or Revenue reversal) + Output VAT reversal
  const debitLegs: LegItem[] = [];
  if (taxableDec.gt(0)) {
    debitLegs.push({
      accountId: revenueAccount.id,
      amount: taxableDec,
      description: `Sales reversal for ${creditNoteNumber}`,
    });
  }
  if (taxDec.gt(0) && std.vatPayable) {
    debitLegs.push({
      accountId: std.vatPayable.id,
      amount: taxDec,
      description: `Output VAT reversal for ${creditNoteNumber}`,
    });
  } else if (taxDec.gt(0) && !std.vatPayable) {
    debitLegs.push({
      accountId: revenueAccount.id,
      amount: taxDec,
      description: `Gross tax reversal for ${creditNoteNumber}`,
    });
  }

  // Credit Leg: Cash / Bank / Customer Account reduction
  const creditLegs: LegItem[] = [
    {
      accountId: creditTargetAcc.id,
      amount: new Decimal(totalAmount),
      description: `Refund payout / AR reduction (${paymentMethod})`,
    },
  ];

  await postPairedLines(tx, entry.id, debitLegs, creditLegs);

  // Restock Inventory (Debit Inventory, Credit COGS)
  if (costAmount > 0 && std.cogs && std.inventory) {
    const costDec = new Decimal(costAmount);
    await tx.journalLine.create({
      data: {
        entryId: entry.id,
        debitAccountId: std.inventory.id,
        creditAccountId: std.cogs.id,
        amount: new Prisma.Decimal(costDec.toFixed(2)),
        description: `Restock inventory from return ${creditNoteNumber}`,
      },
    });
    await updateAccountBalance(tx, std.inventory.id, costAmount, "DEBIT");
    await updateAccountBalance(tx, std.cogs.id, costAmount, "CREDIT");
  }

  return entry;
}

/**
 * Creates balanced double-entry journal lines for a customer Debit Note
 * (supplementary invoice / debit adjustment).
 */
export async function recordDebitNoteJournalEntry({
  tx,
  businessId,
  debitNoteNumber,
  taxableAmount,
  taxAmount,
  totalAmount,
  paymentMethod = "CREDIT",
  referenceId,
}: {
  tx: Prisma.TransactionClient;
  businessId: string;
  debitNoteNumber: string;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod?: string;
  referenceId?: string | null;
}) {
  const std = await getStandardAccounts(tx, businessId);
  if (!std.salesRevenue) return null;

  const debitAcc =
    paymentMethod === "CREDIT"
      ? std.receivable || std.cash
      : paymentMethod === "BANK_TRANSFER" || paymentMethod === "CARD"
      ? std.bank || std.cash
      : std.cash;

  if (!debitAcc) return null;

  const entryNumber = await getNextEntryNumber(tx, businessId, "DBN");
  const entry = await tx.journalEntry.create({
    data: {
      businessId,
      entryNumber,
      description: `Customer Debit Note ${debitNoteNumber}`,
      reference: debitNoteNumber,
      referenceType: "DebitNote",
      referenceId: referenceId || null,
      isPosted: true,
      postedAt: new Date(),
    },
  });

  const taxableDec = new Decimal(Math.max(0, taxableAmount));
  const taxDec = new Decimal(Math.max(0, taxAmount));

  const debitLegs: LegItem[] = [
    {
      accountId: debitAcc.id,
      amount: new Decimal(totalAmount),
      description: `Debit adjustment for ${debitNoteNumber}`,
    },
  ];

  const creditLegs: LegItem[] = [];
  if (taxableDec.gt(0)) {
    creditLegs.push({
      accountId: std.salesRevenue.id,
      amount: taxableDec,
      description: `Additional revenue for ${debitNoteNumber}`,
    });
  }
  if (taxDec.gt(0) && std.vatPayable) {
    creditLegs.push({
      accountId: std.vatPayable.id,
      amount: taxDec,
      description: `Output VAT on debit note ${debitNoteNumber}`,
    });
  }

  await postPairedLines(tx, entry.id, debitLegs, creditLegs);
  return entry;
}

/**
 * Automatically creates balanced double-entry journal lines for a GRN Purchase,
 * with proper Input VAT accounting.
 */
export async function recordPurchaseJournalEntry({
  tx,
  businessId,
  purchaseId,
  grnNumber,
  totalAmount,
  taxAmount = 0,
  paidAmount = 0,
  paymentMethod,
  inputVatEligible = false,
}: {
  tx: Prisma.TransactionClient;
  businessId: string;
  purchaseId?: string | null;
  grnNumber: string;
  totalAmount: number;
  taxAmount?: number;
  paidAmount: number;
  paymentMethod?: string;
  inputVatEligible?: boolean;
}) {
  const std = await getStandardAccounts(tx, businessId);
  if (!std.inventory) return null;

  const entryNumber = await getNextEntryNumber(tx, businessId, "PUR");
  const totalDec = new Decimal(totalAmount);
  const paidDec = new Decimal(paidAmount);
  const taxDec = new Decimal(Math.max(0, taxAmount));
  const balanceDec = Decimal.max(0, totalDec.minus(paidDec));

  const isVatEligible = inputVatEligible && taxDec.gt(0) && !!std.inputVat;
  const netInventoryDec = isVatEligible ? Decimal.max(0, totalDec.minus(taxDec)) : totalDec;

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

  // Debit Legs: Inventory + Input VAT (if eligible)
  const debitLegs: LegItem[] = [];
  if (netInventoryDec.gt(0)) {
    debitLegs.push({
      accountId: std.inventory.id,
      amount: netInventoryDec,
      description: `Inventory receipt for ${grnNumber}`,
    });
  }
  if (isVatEligible && std.inputVat) {
    debitLegs.push({
      accountId: std.inputVat.id,
      amount: taxDec,
      description: `Input VAT claimable on ${grnNumber}`,
    });
  }

  // Credit Legs: Accounts Payable (for balance) and Cash/Bank (for immediate payment)
  const creditLegs: LegItem[] = [];
  const payAcc =
    paymentMethod === "BANK_TRANSFER" || paymentMethod === "CHEQUE" || paymentMethod === "CARD"
      ? std.bank || std.cash
      : std.cash;

  if (balanceDec.gt(0) && std.payable) {
    creditLegs.push({
      accountId: std.payable.id,
      amount: balanceDec,
      description: `Accounts payable for ${grnNumber}`,
    });
  }
  if (paidDec.gt(0) && payAcc) {
    creditLegs.push({
      accountId: payAcc.id,
      amount: paidDec,
      description: `Immediate payment on ${grnNumber} (${paymentMethod || "CASH"})`,
    });
  } else if (balanceDec.isZero() && paidDec.isZero() && std.payable) {
    creditLegs.push({
      accountId: std.payable.id,
      amount: totalDec,
      description: `Accounts payable for ${grnNumber}`,
    });
  }

  await postPairedLines(tx, entry.id, debitLegs, creditLegs);
  return entry;
}

/**
 * Creates balanced journal entries for supplier credit or debit adjustments.
 */
export async function recordSupplierCreditDebitNoteEntry({
  tx,
  businessId,
  adjustmentNumber,
  type, // "CREDIT_NOTE" (vendor credits us) | "DEBIT_NOTE" (vendor charges us extra)
  netAmount,
  taxAmount = 0,
  totalAmount,
  inputVatEligible = false,
  paymentMethod = "CREDIT", // "CREDIT" reduces AP, or "CASH"/"BANK" if refunded
  referenceId,
}: {
  tx: Prisma.TransactionClient;
  businessId: string;
  adjustmentNumber: string;
  type: "CREDIT_NOTE" | "DEBIT_NOTE";
  netAmount: number;
  taxAmount?: number;
  totalAmount: number;
  inputVatEligible?: boolean;
  paymentMethod?: string;
  referenceId?: string | null;
}) {
  const std = await getStandardAccounts(tx, businessId);
  if (!std.inventory || !std.payable) return null;

  const totalDec = new Decimal(totalAmount);
  const netDec = new Decimal(netAmount);
  const taxDec = new Decimal(Math.max(0, taxAmount));
  const isVatEligible = inputVatEligible && taxDec.gt(0) && !!std.inputVat;

  const targetAcc =
    paymentMethod === "BANK_TRANSFER" || paymentMethod === "CARD"
      ? std.bank || std.cash
      : paymentMethod === "CASH"
      ? std.cash
      : std.payable;

  if (!targetAcc) return null;

  const entryNumber = await getNextEntryNumber(tx, businessId, type === "CREDIT_NOTE" ? "SCN" : "SDN");
  const entry = await tx.journalEntry.create({
    data: {
      businessId,
      entryNumber,
      description: `Supplier ${type === "CREDIT_NOTE" ? "Credit" : "Debit"} Note ${adjustmentNumber}`,
      reference: adjustmentNumber,
      referenceType: "PurchaseAdjustment",
      referenceId: referenceId || null,
      isPosted: true,
      postedAt: new Date(),
    },
  });

  if (type === "CREDIT_NOTE") {
    // Vendor credits us: Debit AP / Cash, Credit Inventory, Credit Input VAT (reversal)
    const debitLegs: LegItem[] = [
      {
        accountId: targetAcc.id,
        amount: totalDec,
        description: `AP reduction / refund from vendor for ${adjustmentNumber}`,
      },
    ];
    const creditLegs: LegItem[] = [];
    const invCredit = isVatEligible ? netDec : totalDec;
    if (invCredit.gt(0)) {
      creditLegs.push({
        accountId: std.inventory.id,
        amount: invCredit,
        description: `Inventory reduction for return/rebate ${adjustmentNumber}`,
      });
    }
    if (isVatEligible && std.inputVat) {
      creditLegs.push({
        accountId: std.inputVat.id,
        amount: taxDec,
        description: `Input VAT reversal for supplier credit ${adjustmentNumber}`,
      });
    }
    await postPairedLines(tx, entry.id, debitLegs, creditLegs);
  } else {
    // Supplier debit note: Debit Inventory, Debit Input VAT, Credit AP / Cash
    const debitLegs: LegItem[] = [];
    const invDebit = isVatEligible ? netDec : totalDec;
    if (invDebit.gt(0)) {
      debitLegs.push({
        accountId: std.inventory.id,
        amount: invDebit,
        description: `Inventory addition for surcharge ${adjustmentNumber}`,
      });
    }
    if (isVatEligible && std.inputVat) {
      debitLegs.push({
        accountId: std.inputVat.id,
        amount: taxDec,
        description: `Input VAT addition for surcharge ${adjustmentNumber}`,
      });
    }
    const creditLegs: LegItem[] = [
      {
        accountId: targetAcc.id,
        amount: totalDec,
        description: `AP addition / charge from vendor for ${adjustmentNumber}`,
      },
    ];
    await postPairedLines(tx, entry.id, debitLegs, creditLegs);
  }

  return entry;
}

/**
 * Reclassifies Input VAT when review changes eligibility post-facto.
 */
export async function recordInputVatReclassificationEntry({
  tx,
  businessId,
  documentNumber,
  taxAmount,
  toEligible,
  isInventory = true,
}: {
  tx: Prisma.TransactionClient;
  businessId: string;
  documentNumber: string;
  taxAmount: number;
  toEligible: boolean;
  isInventory?: boolean;
}) {
  const std = await getStandardAccounts(tx, businessId);
  if (!std.inputVat) return null;
  const expenseOrInvAcc = isInventory ? std.inventory : std.operatingExpense;
  if (!expenseOrInvAcc) return null;

  const taxDec = new Decimal(taxAmount);
  if (taxDec.lte(0)) return null;

  const entryNumber = await getNextEntryNumber(tx, businessId, "VAT");
  const entry = await tx.journalEntry.create({
    data: {
      businessId,
      entryNumber,
      description: `Input VAT eligibility reclassification for ${documentNumber}`,
      reference: documentNumber,
      referenceType: "TaxReview",
      isPosted: true,
      postedAt: new Date(),
    },
  });

  const debitLegs: LegItem[] = [];
  const creditLegs: LegItem[] = [];

  if (toEligible) {
    // Moving from expense/inventory -> Input VAT asset
    debitLegs.push({
      accountId: std.inputVat.id,
      amount: taxDec,
      description: `Input VAT recognized on review (${documentNumber})`,
    });
    creditLegs.push({
      accountId: expenseOrInvAcc.id,
      amount: taxDec,
      description: `Cost adjustment for claimed Input VAT (${documentNumber})`,
    });
  } else {
    // Moving from Input VAT asset -> expense/inventory
    debitLegs.push({
      accountId: expenseOrInvAcc.id,
      amount: taxDec,
      description: `Disallowed Input VAT capitalized to cost (${documentNumber})`,
    });
    creditLegs.push({
      accountId: std.inputVat.id,
      amount: taxDec,
      description: `Input VAT reversal on review (${documentNumber})`,
    });
  }

  await postPairedLines(tx, entry.id, debitLegs, creditLegs);
  return entry;
}

/**
 * Automatically creates balanced double-entry journal lines for a Supplier Settlement Payment.
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
 * Updates an account's running balance based on its normal debit/credit orientation.
 */
export async function updateAccountBalance(
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
 * Automatically creates balanced double-entry journal lines for an Expense,
 * with Input VAT support. Can participate in an existing Prisma transaction.
 */
export async function createExpenseEntry({
  businessId,
  expenseId,
  amount,
  taxAmount = 0,
  inputVatEligible = false,
  description,
  method,
  tx: externalTx,
}: {
  businessId: string;
  expenseId: string;
  amount: number;
  taxAmount?: number;
  inputVatEligible?: boolean;
  description: string;
  method: string;
  tx?: Prisma.TransactionClient;
}) {
  const run = async (tx: Prisma.TransactionClient) => {
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

    const isVatClaimable = inputVatEligible && taxAmount > 0 && !!std.inputVat;
    const netExpenseAmount = isVatClaimable ? Math.max(0, amount - taxAmount) : amount;

    const debitLegs: LegItem[] = [];
    if (netExpenseAmount > 0) {
      debitLegs.push({
        accountId: std.operatingExpense.id,
        amount: netExpenseAmount,
        description: `Expense payment via ${method}: ${description}`,
      });
    }
    if (isVatClaimable && std.inputVat) {
      debitLegs.push({
        accountId: std.inputVat.id,
        amount: taxAmount,
        description: `Input VAT claimable on expense: ${description}`,
      });
    }

    const creditLegs: LegItem[] = [
      {
        accountId: creditAcc.id,
        amount,
        description: `Disbursement for expense: ${description}`,
      },
    ];

    await postPairedLines(tx, entry.id, debitLegs, creditLegs);
    return entry;
  };

  if (externalTx) {
    return run(externalTx);
  }

  const { prisma } = await import("@/lib/db");
  return prisma.$transaction(run);
}
