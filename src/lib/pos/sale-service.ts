import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordSaleJournalEntry } from "@/lib/accounting";
import { calculateTaxForSale } from "@/lib/tax/tax-context";
import { issueTaxDocumentsForSale } from "@/lib/tax/document-service";
import { SyncConflictRecord } from "./offline-db";

export interface ProcessSaleItemPayload {
  productId: string;
  name?: string;
  description?: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  discountAmount?: number;
  taxAmount?: number;
  total?: number;
  warrantyMonths?: number;
  serialNumber?: string | null;
  pricesIncludeTax?: boolean;
}

export interface ProcessPaymentPayload {
  method: string;
  amount: number;
  reference?: string | null;
}

export interface ProcessSaleInput {
  businessId: string;
  branchId: string;
  userId: string;
  deviceId?: string | null;
  customerId?: string | null;
  shiftId?: string | null;
  offlineId?: string | null;
  offlineCreatedAt?: string | Date | null;
  provisionalReceiptNumber?: string | null;
  items: ProcessSaleItemPayload[];
  payments: ProcessPaymentPayload[];
  notes?: string | null;
  invoiceDiscount?: any;
}

export interface ProcessSaleResult {
  status: "SUCCESS" | "ALREADY_PROCESSED" | "FAILED";
  saleId?: string;
  invoiceNumber?: string;
  receiptNumber?: string;
  conflicts?: SyncConflictRecord[];
  error?: string;
  sale?: any;
}

/**
 * Core transactional engine for creating/synchronizing sales with full idempotency,
 * tax calculation, stock deduction, accounting ledger, and conflict auditing.
 */
export async function processSaleTransaction(
  input: ProcessSaleInput,
  txClient?: Prisma.TransactionClient
): Promise<ProcessSaleResult> {
  const {
    businessId,
    branchId,
    userId,
    deviceId,
    customerId,
    shiftId: inputShiftId,
    offlineId,
    offlineCreatedAt,
    items,
    payments,
    notes,
    invoiceDiscount,
  } = input;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return { status: "FAILED", error: "Cart cannot be empty" };
  }

  // 1. Idempotency Check: If offlineId is provided, check if already committed
  if (offlineId) {
    const existing = await prisma.sale.findFirst({
      where: { businessId, offlineId },
      include: {
        items: true,
        payments: true,
        taxDocuments: { include: { lines: true } },
      },
    });

    if (existing) {
      return {
        status: "ALREADY_PROCESSED",
        saleId: existing.id,
        invoiceNumber: existing.invoiceNumber,
        receiptNumber: existing.receiptNumber || existing.invoiceNumber,
        conflicts: (existing.syncConflicts as any) || [],
        sale: existing,
      };
    }
  }

  // 2. Fetch business settings (tax, negative stock allowance)
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      allowNegativeStock: true,
      taxInclusive: true,
    },
  });

  if (!business) {
    return { status: "FAILED", error: "Business not found" };
  }

  // 3. Shift Association: If shiftId not provided or closed, find latest or create sync shift
  let activeShiftId = inputShiftId;
  if (!activeShiftId) {
    const openShift = await prisma.cashierShift.findFirst({
      where: {
        businessId,
        branchId,
        userId,
        status: "OPEN",
      },
    });

    if (openShift) {
      activeShiftId = openShift.id;
    } else {
      // Find latest shift by user or create an automated shift for offline sync
      const latestShift = await prisma.cashierShift.findFirst({
        where: { businessId, branchId, userId },
        orderBy: { openedAt: "desc" },
      });

      if (latestShift) {
        activeShiftId = latestShift.id;
      } else {
        // Create an automated shift to associate sales cleanly
        const autoShift = await prisma.cashierShift.create({
          data: {
            businessId,
            branchId,
            userId,
            openingCash: 0,
            status: "OPEN",
            notes: "Automated POS Offline Sync Shift",
          },
        });
        activeShiftId = autoShift.id;
      }
    }
  }

  // 4. Fetch customer details if provided
  let customer: any = null;
  if (customerId) {
    customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) {
      return { status: "FAILED", error: "Customer not found" };
    }
  }

  // 5. Centralized Sri Lankan Tax Calculation
  const { calculation, taxContext } = await calculateTaxForSale({
    businessId,
    branchId,
    customerId: customerId || undefined,
    supplyDate: offlineCreatedAt ? new Date(offlineCreatedAt) : new Date(),
    invoiceDiscount: invoiceDiscount || null,
    items: items.map((it) => ({
      productId: it.productId,
      description: it.name || it.description || "Item",
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discountAmount ? { type: "FIXED", value: it.discountAmount } : null,
      pricesIncludeTax: it.pricesIncludeTax ?? business.taxInclusive,
      meta: {
        sku: it.sku,
      },
    })),
  });

  const subtotal = Number(calculation.totals.netValue);
  const discountAmount = Number(calculation.totals.discountTotal);
  const taxAmount = Number(calculation.totals.taxTotal);
  const total = Number(calculation.totals.grandTotal);

  // 6. Payment totals and Credit validations
  const creditPayments = (payments || []).filter((p) => p.method === "CREDIT");
  let creditAmount = creditPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paidAmount = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const changeAmount = Math.max(0, paidAmount - total);

  const uncollectedBalance = Math.max(0, total - paidAmount);
  if (uncollectedBalance > 0 && creditAmount === 0) {
    creditAmount = uncollectedBalance;
  }

  if (creditAmount > 0) {
    if (!customer) {
      return {
        status: "FAILED",
        error: "A registered customer is required for credit sales or sales with unpaid balance.",
      };
    }
    const currentBalance = Number(customer.creditBalance || 0);
    const creditLimit = Number(customer.creditLimit || 0);
    if (creditLimit > 0 && currentBalance + creditAmount > creditLimit) {
      return {
        status: "FAILED",
        error: `Credit limit exceeded. Balance: LKR ${currentBalance.toFixed(2)}, Limit: LKR ${creditLimit.toFixed(2)}`,
      };
    }
  }

  // 7. Check for Price & Stock Discrepancies (Conflicts)
  const conflicts: SyncConflictRecord[] = [];
  const productIds = items.map((it) => it.productId);
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId },
    include: { stocks: { where: { branchId } } },
  });

  for (const item of items) {
    const dbProduct = dbProducts.find((p) => p.id === item.productId);
    if (!dbProduct) continue;

    const currentServerPrice = Number(dbProduct.retailPrice);
    if (Math.abs(item.unitPrice - currentServerPrice) > 0.01) {
      conflicts.push({
        type: "PRICE_DISCREPANCY",
        productId: item.productId,
        productName: dbProduct.name,
        chargedPrice: item.unitPrice,
        serverPrice: currentServerPrice,
        difference: Number((item.unitPrice - currentServerPrice).toFixed(2)),
        action: "ACCEPTED_CHARGED_PRICE",
        message: `Offline sale charged Rs. ${item.unitPrice} while current server price is Rs. ${currentServerPrice}. Charged price preserved.`,
        resolvedAt: new Date().toISOString(),
      });
    }

    const currentStockQty = dbProduct.stocks[0]?.quantity || 0;
    if (currentStockQty < item.quantity) {
      conflicts.push({
        type: "STOCK_DEFICIT",
        productId: item.productId,
        productName: dbProduct.name,
        requestedQty: item.quantity,
        availableQty: currentStockQty,
        action: business.allowNegativeStock ? "NEGATIVE_STOCK_PERMITTED" : "STOCK_OVERDRAW_AUDITED",
        message: `Offline sale requested ${item.quantity} units, available stock was ${currentStockQty}. Deducted and logged for audit.`,
        resolvedAt: new Date().toISOString(),
      });
    }
  }

  // 8. Execute Database Transaction
  const executeInTransaction = async (tx: Prisma.TransactionClient) => {
    const tempInvoiceNumber = `PENDING-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const originalOfflineDate = offlineCreatedAt ? new Date(offlineCreatedAt) : new Date();

    // Create Sale Header
    const sale = await tx.sale.create({
      data: {
        businessId,
        branchId,
        shiftId: activeShiftId,
        customerId: customerId || null,
        userId,
        invoiceNumber: tempInvoiceNumber,
        receiptNumber: null,
        status: "COMPLETED",
        type: "POS",
        subtotal,
        discountAmount,
        taxAmount,
        total,
        paidAmount,
        changeAmount,
        creditAmount,
        notes: notes || null,
        isSynced: true,
        offlineId: offlineId || null,
        offlineCreatedAt: originalOfflineDate,
        syncedAt: new Date(),
        deviceId: deviceId || null,
        syncConflicts: conflicts.length > 0 ? (conflicts as any) : Prisma.DbNull,
      },
    });

    // Create Sale Items & Stock Deductions
    const createdItems = [];
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const calcLine = calculation.lines[idx];

      const saleItem = await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          name: item.name || calcLine.description,
          sku: item.sku || null,
          barcode: item.barcode || null,
          quantity: Number(calcLine.quantity),
          unitPrice: Number(calcLine.unitPrice),
          costPrice: item.costPrice || 0,
          discountAmount: Number(calcLine.discountTotal),
          taxAmount: Number(calcLine.taxAmount),
          total: Number(calcLine.lineTotal),
          warrantyMonths: item.warrantyMonths || 0,
          serialNumber: item.serialNumber || null,
        },
      });
      createdItems.push(saleItem);

      // Stock deduction
      let stock = await tx.stock.findFirst({
        where: { branchId, productId: item.productId },
      });

      const currentQty = stock?.quantity || 0;
      const newQty = business.allowNegativeStock
        ? currentQty - Number(item.quantity)
        : Math.max(0, currentQty - Number(item.quantity));

      if (stock) {
        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: newQty },
        });
      } else {
        await tx.stock.create({
          data: {
            businessId,
            branchId,
            productId: item.productId,
            quantity: newQty,
          },
        });
      }

      // Record Stock Movement
      await tx.stockMovement.create({
        data: {
          businessId,
          branchId,
          productId: item.productId,
          type: "SALE",
          quantity: -Number(item.quantity),
          quantityBefore: currentQty,
          quantityAfter: newQty,
          unitCost: item.costPrice || 0,
          referenceType: "Sale",
          referenceId: sale.id,
          notes: offlineId ? `Offline POS Sale (Sync: ${offlineId})` : "POS Sale",
          userId,
        },
      });

      // Serial Number Sold status
      if (item.serialNumber) {
        await tx.serialNumber.upsert({
          where: {
            businessId_serialNumber: {
              businessId,
              serialNumber: item.serialNumber,
            },
          },
          update: {
            status: "SOLD",
            saleId: sale.id,
            customerId: customerId || null,
          },
          create: {
            businessId,
            productId: item.productId,
            serialNumber: item.serialNumber,
            status: "SOLD",
            saleId: sale.id,
            customerId: customerId || null,
          },
        });
      }

      // Warranty record
      if (item.warrantyMonths && item.warrantyMonths > 0) {
        const startDate = originalOfflineDate;
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + Number(item.warrantyMonths));
        const warrantyCode = `WC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

        await tx.warranty.create({
          data: {
            businessId,
            warrantyCode,
            customerId: customerId || null,
            productId: item.productId,
            saleId: sale.id,
            serialNumber: item.serialNumber || null,
            purchaseDate: startDate,
            warrantyMonths: item.warrantyMonths,
            startDate,
            endDate,
            type: "SELLER",
            status: "ACTIVE",
          },
        });
      }
    }

    // Record Payments
    for (const p of payments || []) {
      await tx.payment.create({
        data: {
          businessId,
          saleId: sale.id,
          method: p.method as any,
          amount: p.amount,
          reference: p.reference || null,
          status: "PAID",
        },
      });
    }

    // Issue Authoritative Sri Lankan Tax Documents with Atomic Sequential Numbering
    const primaryPayment = payments && payments.length > 0 ? payments[0].method : "CASH";
    const issuedDocs = await issueTaxDocumentsForSale(tx, taxContext, calculation, {
      businessId,
      branchId,
      saleId: sale.id,
      issueDate: new Date(),
      supplyDate: originalOfflineDate,
      paymentMethod: primaryPayment,
      paidAmount,
      notes,
      createdById: userId,
      saleItemIds: createdItems.map((it) => it.id),
      buyer: customer
        ? {
            id: customer.id,
            name: customer.name,
            tin: customer.tin,
            vatRegistrationNumber: customer.vatRegistrationNumber,
            isVatRegistered: customer.isVatRegistered,
            address: customer.address,
            phone: customer.phone,
          }
        : null,
    });

    // Update Sale header with official sequential number
    const primaryDoc = issuedDocs[0];
    const officialInvoiceNumber = primaryDoc ? primaryDoc.documentNumber : tempInvoiceNumber;
    const officialReceiptNumber =
      issuedDocs.length > 1 ? issuedDocs[1].documentNumber : officialInvoiceNumber;

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        invoiceNumber: officialInvoiceNumber,
        receiptNumber: officialReceiptNumber,
      },
    });

    // Customer credit balance
    if (customerId && creditAmount > 0 && customer) {
      const newCreditBal = Number(customer.creditBalance || 0) + creditAmount;
      await tx.customer.update({
        where: { id: customer.id },
        data: { creditBalance: newCreditBal },
      });

      await tx.creditTransaction.create({
        data: {
          businessId,
          customerId: customer.id,
          saleId: sale.id,
          type: "CREDIT_SALE",
          amount: creditAmount,
          balance: newCreditBal,
          notes: `Credit sale #${officialInvoiceNumber}`,
        },
      });
    }

    // Customer loyalty points
    if (customerId) {
      const loyaltyEarned = Math.floor(Number(total) / 100);
      if (loyaltyEarned > 0) {
        const loyalty = await tx.loyaltyAccount.upsert({
          where: { customerId },
          update: {
            points: { increment: loyaltyEarned },
            lifetimePoints: { increment: loyaltyEarned },
          },
          create: {
            businessId,
            customerId,
            points: loyaltyEarned,
            lifetimePoints: loyaltyEarned,
          },
        });

        await tx.loyaltyTransaction.create({
          data: {
            accountId: loyalty.id,
            type: "EARN",
            points: loyaltyEarned,
            balance: loyalty.points,
            saleId: sale.id,
            notes: `Points from POS Sale #${officialInvoiceNumber}`,
          },
        });
      }
    }

    // Update shift total
    if (activeShiftId) {
      await tx.cashierShift.update({
        where: { id: activeShiftId },
        data: { totalSales: { increment: total } },
      });
    }

    // Double-entry accounting entry
    const totalCost = items.reduce(
      (sum, it) => sum + Number(it.quantity) * Number(it.costPrice || 0),
      0
    );
    await recordSaleJournalEntry({
      tx,
      businessId,
      saleId: sale.id,
      invoiceNumber: officialInvoiceNumber,
      totalAmount: total,
      costAmount: totalCost,
      paymentMethod: primaryPayment as any,
      payments: payments?.map((p) => ({ method: p.method, amount: Number(p.amount) })),
      taxAmount,
    });

    // Audit Log for conflicts if any
    if (conflicts.length > 0) {
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: "UPDATE",
          entity: "Sale",
          entityId: sale.id,
          metadata: {
            conflicts: conflicts as any,
            offlineId,
            officialInvoiceNumber,
            provisionalReceiptNumber: input.provisionalReceiptNumber,
          },
        },
      });
    }

    return {
      status: "SUCCESS" as const,
      saleId: sale.id,
      invoiceNumber: officialInvoiceNumber,
      receiptNumber: officialReceiptNumber,
      conflicts,
      sale: {
        ...sale,
        invoiceNumber: officialInvoiceNumber,
        receiptNumber: officialReceiptNumber,
        items: createdItems,
        taxDocuments: issuedDocs,
      },
    };
  };

  if (txClient) {
    return executeInTransaction(txClient);
  } else {
    return prisma.$transaction(executeInTransaction);
  }
}
