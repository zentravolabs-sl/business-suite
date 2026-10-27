/**
 * ADVISOR DATA LAYER
 * ==================
 *
 * Tenant-scoped data loader that reads verified database records from Prisma
 * and produces clean calculation models and the complete AdvisorSnapshot.
 * Strict multi-tenant isolation is enforced on every query.
 */

import { prisma } from "@/lib/db";
import type {
  ExpenseRec,
  InventoryProductRow,
  RefundRec,
  SaleItemRec,
  SaleRec,
} from "./types";
import {
  COUNTED_SALE_STATUSES,
  buildDailySeries,
  computeCashFlow,
  computeInventory,
  computePayables,
  computeProductMargins,
  computeProfitability,
  computeReceivables,
  computeRepeatCustomers,
  weekdayAverages,
  type ProfitabilityInput,
} from "./calculations";
import {
  addDays,
  dayBounds,
  daysBetween,
  firstOfMonth,
  firstOfPreviousMonth,
  localDateString,
  rangeBounds,
  resolveTimezone,
  weekdayOf,
} from "./timezone";
import {
  DEFAULT_THRESHOLDS,
  type ModuleFlags,
  type Thresholds,
  effectiveThresholds,
} from "./config";
import type { AdvisorSnapshot } from "./rules";

export interface LoadSnapshotOptions {
  /** Override the current evaluation timestamp (useful for reproducible tests & daily report cron) */
  asOfDate?: Date;
}

export async function loadAdvisorSnapshot(
  businessId: string,
  opts: LoadSnapshotOptions = {}
): Promise<AdvisorSnapshot> {
  const now = opts.asOfDate ?? new Date();

  // 1. Load Business and Advisor Preferences
  const [business, preference] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        category: true,
        currency: true,
        timezone: true,
        ordersEnabled: true,
        ecommerceEnabled: true,
        warrantyEnabled: true,
        serviceEnabled: true,
        loyaltyEnabled: true,
      },
    }),
    prisma.advisorPreference.findUnique({
      where: { businessId },
    }),
  ]);

  if (!business) {
    throw new Error(`Business not found: ${businessId}`);
  }

  const tz = resolveTimezone(preference?.timezone, business.timezone);
  const currency = business.currency || "LKR";
  const thresholds: Thresholds = effectiveThresholds(business.category, preference?.thresholds);

  // 2. Module detection
  const [hasBatches, hasSerials, hasVariants] = await Promise.all([
    prisma.product.count({
      where: { businessId, isBatchTracked: true, isActive: true, deletedAt: null },
    }).then((c) => c > 0),
    prisma.product.count({
      where: { businessId, isSerialTracked: true, isActive: true, deletedAt: null },
    }).then((c) => c > 0),
    prisma.product.count({
      where: { businessId, hasVariants: true, isActive: true, deletedAt: null },
    }).then((c) => c > 0),
  ]);

  const modules: ModuleFlags = {
    warranty: business.warrantyEnabled,
    service: business.serviceEnabled,
    ecommerce: business.ecommerceEnabled,
    loyalty: business.loyaltyEnabled,
    batchTracking: hasBatches,
    serialTracking: hasSerials,
    variants: hasVariants,
  };

  // 3. Calendar dates in the business timezone
  const todayStr = localDateString(now, tz);
  const last30StartStr = addDays(todayStr, -29);
  const prev30EndStr = addDays(todayStr, -30);
  const prev30StartStr = addDays(todayStr, -59);
  const mtdStartStr = firstOfMonth(todayStr);

  // Previous MTD: same relative day in the prior calendar month
  const prevMonthStartStr = firstOfPreviousMonth(todayStr);
  const daysIntoMtd = daysBetween(mtdStartStr, todayStr);
  const prevMtdEndStr = addDays(prevMonthStartStr, daysIntoMtd);

  // Query lookback window: 120 days covers 4 x 30-day windows for expense baseline analysis
  const lookbackDays = 120;
  const lookbackStartStr = addDays(todayStr, -(lookbackDays - 1));
  const queryStart = rangeBounds(lookbackStartStr, todayStr, tz).start;

  // 4. Earliest sale for history determination
  const firstSale = await prisma.sale.findFirst({
    where: {
      businessId,
      status: { in: COUNTED_SALE_STATUSES as unknown as any },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const historyDays = firstSale ? Math.max(1, Math.floor((now.getTime() - firstSale.createdAt.getTime()) / 86_400_000)) : null;

  // 5. Query Sales, Refunds, and Expenses
  const [salesRaw, refundsRaw, expensesRaw, overdueRecurringCount, purchasePaymentsRaw, creditPaymentsRaw] = await Promise.all([
    prisma.sale.findMany({
      where: {
        businessId,
        createdAt: { gte: queryStart },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        userId: true,
        customerId: true,
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        serviceCharge: true,
        total: true,
        creditAmount: true,
        payments: {
          select: { method: true, amount: true, status: true, createdAt: true },
        },
        items: {
          select: {
            productId: true,
            name: true,
            quantity: true,
            unitPrice: true,
            costPrice: true,
            discountAmount: true,
            taxAmount: true,
            total: true,
            product: { select: { costPrice: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.refund.findMany({
      where: {
        businessId,
        createdAt: { gte: queryStart },
      },
      select: {
        id: true,
        saleId: true,
        createdAt: true,
        totalAmount: true,
        subtotal: true,
        taxAmount: true,
        paymentMethod: true,
        userId: true,
        items: {
          select: {
            productId: true,
            quantity: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expense.findMany({
      where: {
        businessId,
        expenseDate: { gte: queryStart },
      },
      select: {
        id: true,
        amount: true,
        taxAmount: true,
        inputVatEligibility: true,
        status: true,
        expenseDate: true,
        category: { select: { name: true } },
      },
      orderBy: { expenseDate: "asc" },
    }),
    prisma.recurringExpense.count({
      where: {
        businessId,
        isActive: true,
        nextDueDate: { lt: now },
      },
    }),
    prisma.purchasePayment.findMany({
      where: {
        businessId,
        paidAt: { gte: queryStart },
      },
      select: {
        amount: true,
        paidAt: true,
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.creditTransaction.findMany({
      where: {
        businessId,
        type: "PAYMENT",
        createdAt: { gte: queryStart },
      },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const supplierPayments = purchasePaymentsRaw.map((p) => ({
    amount: Number(p.amount),
    paidAt: p.paidAt,
  }));

  const creditCollections = creditPaymentsRaw.map((c) => ({
    amount: Number(c.amount),
    createdAt: c.createdAt,
  }));

  // Transform raw data to plain records
  const sales: SaleRec[] = salesRaw.map((s) => ({
    id: s.id,
    status: s.status,
    createdAt: s.createdAt,
    userId: s.userId,
    customerId: s.customerId,
    subtotal: Number(s.subtotal),
    discountAmount: Number(s.discountAmount),
    taxAmount: Number(s.taxAmount),
    serviceCharge: Number(s.serviceCharge),
    total: Number(s.total),
    creditAmount: Number(s.creditAmount),
    payments: s.payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
      createdAt: p.createdAt,
    })),
    items: s.items.map((it): SaleItemRec => ({
      productId: it.productId,
      name: it.name,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      costPrice: Number(it.costPrice || 0),
      fallbackCost: it.product?.costPrice ? Number(it.product.costPrice) : undefined,
      discountAmount: Number(it.discountAmount || 0),
      taxAmount: Number(it.taxAmount || 0),
      total: Number(it.total),
    })),
  }));

  const refunds: RefundRec[] = refundsRaw.map((r) => ({
    id: r.id,
    saleId: r.saleId,
    createdAt: r.createdAt,
    totalAmount: Number(r.totalAmount),
    subtotal: Number(r.subtotal),
    taxAmount: Number(r.taxAmount),
    paymentMethod: r.paymentMethod,
    userId: r.userId,
    restockedCost: 0,
  }));

  const expenses: ExpenseRec[] = expensesRaw.map((e) => ({
    id: e.id,
    categoryName: e.category?.name || "General",
    amount: Number(e.amount),
    taxAmount: Number(e.taxAmount),
    inputVatEligible: e.inputVatEligibility === "ELIGIBLE",
    status: e.status,
    expenseDate: e.expenseDate,
  }));

  // 6. Range bounds
  const rangeLast30 = rangeBounds(last30StartStr, todayStr, tz);
  const rangePrev30 = rangeBounds(prev30StartStr, prev30EndStr, tz);
  const rangeMtd = rangeBounds(mtdStartStr, todayStr, tz);
  const rangePrevMtd = rangeBounds(prevMonthStartStr, prevMtdEndStr, tz);

  const rangeToday = dayBounds(todayStr, tz);
  const yesterdayStr = addDays(todayStr, -1);
  const rangeYesterday = dayBounds(yesterdayStr, tz);
  const lastWeekStr = addDays(todayStr, -7);
  const rangeLastWeek = dayBounds(lastWeekStr, tz);

  const profitBaseInput: Omit<ProfitabilityInput, "range"> = {
    sales,
    refunds,
    expenses,
    overdueRecurringCount,
    noExpensesInLookback: expenses.length === 0,
  };

  const last30 = computeProfitability({ ...profitBaseInput, range: rangeLast30 });
  const prev30 = computeProfitability({ ...profitBaseInput, range: rangePrev30 });
  const mtd = computeProfitability({ ...profitBaseInput, range: rangeMtd });
  const prevMtd = computeProfitability({ ...profitBaseInput, range: rangePrevMtd });

  const todaySummary = computeProfitability({ ...profitBaseInput, range: rangeToday });
  const yesterdaySummary = computeProfitability({ ...profitBaseInput, range: rangeYesterday });
  const lastWeekSummary = computeProfitability({ ...profitBaseInput, range: rangeLastWeek });
  const cashFlowToday = computeCashFlow({
    range: rangeToday,
    sales,
    refunds,
    expenses,
    supplierPayments,
    creditCollections,
  });

  // 7. Expense historical baseline (last 30 vs prior 3 x 30 day windows)
  const windowRanges = [
    rangeBounds(addDays(todayStr, -59), addDays(todayStr, -30), tz),
    rangeBounds(addDays(todayStr, -89), addDays(todayStr, -60), tz),
    rangeBounds(addDays(todayStr, -119), addDays(todayStr, -90), tz),
  ];

  const catMap = new Map<string, { last30: number; priorTotals: number[] }>();
  for (const e of expenses) {
    if (e.status !== "PAID" && e.status !== "APPROVED") continue;
    const cur = catMap.get(e.categoryName) ?? { last30: 0, priorTotals: [0, 0, 0] };
    const t = e.expenseDate.getTime();

    if (t >= rangeLast30.start.getTime() && t < rangeLast30.end.getTime()) {
      cur.last30 += e.amount;
    } else {
      windowRanges.forEach((w, idx) => {
        if (t >= w.start.getTime() && t < w.end.getTime()) {
          cur.priorTotals[idx] += e.amount;
        }
      });
    }
    catMap.set(e.categoryName, cur);
  }

  // Count how many prior windows actually have data across the business
  const priorWindowsWithData = windowRanges.filter((w) =>
    expenses.some((e) => e.expenseDate.getTime() >= w.start.getTime() && e.expenseDate.getTime() < w.end.getTime())
  ).length;

  const expenseCategories = Array.from(catMap.entries()).map(([name, val]) => {
    const divisor = Math.max(1, priorWindowsWithData);
    const priorAvg = val.priorTotals.slice(0, divisor).reduce((a, b) => a + b, 0) / divisor;
    return {
      name,
      last30: val.last30,
      priorAvg,
      priorWindows: priorWindowsWithData,
    };
  });

  const totalExpenseLast30 = last30.operatingExpenses;
  const totalExpensePriorAvg = expenseCategories.reduce((sum, c) => sum + c.priorAvg, 0);

  // 8. Receivables & Customers
  const customersWithCreditRaw = await prisma.customer.findMany({
    where: {
      businessId,
      creditBalance: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      creditBalance: true,
      creditTransactions: {
        where: { type: "CREDIT_SALE" },
        select: { amount: true, createdAt: true, dueDate: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const receivables = computeReceivables(
    customersWithCreditRaw.map((c) => ({
      customerId: c.id,
      name: c.name,
      balance: Number(c.creditBalance),
      credits: c.creditTransactions.map((tx) => ({
        amount: Number(tx.amount),
        createdAt: tx.createdAt,
        dueDate: tx.dueDate,
      })),
    })),
    now,
    thresholds.receivableTermDays
  );

  // Net credit change in last 30 days
  const [creditSales30, creditPayments30] = await Promise.all([
    prisma.creditTransaction.aggregate({
      where: {
        businessId,
        type: "CREDIT_SALE",
        createdAt: { gte: rangeLast30.start, lt: rangeLast30.end },
      },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.aggregate({
      where: {
        businessId,
        type: "PAYMENT",
        createdAt: { gte: rangeLast30.start, lt: rangeLast30.end },
      },
      _sum: { amount: true },
    }),
  ]);
  const receivablesNet30 =
    creditSales30._sum.amount !== null
      ? Number(creditSales30._sum.amount || 0) - Math.abs(Number(creditPayments30._sum.amount || 0))
      : null;

  // 9. Payables
  const payablesRaw = await prisma.supplierPayable.findMany({
    where: {
      businessId,
      status: { not: "PAID" },
      balance: { gt: 0 },
    },
    select: {
      balance: true,
      dueDate: true,
      status: true,
    },
  });
  const payables = computePayables(
    payablesRaw.map((p) => ({
      balance: Number(p.balance),
      dueDate: p.dueDate,
      status: p.status,
    })),
    now
  );

  // 10. Cash & Bank Balances
  const cashAccounts = await prisma.account.findMany({
    where: {
      businessId,
      isActive: true,
      OR: [
        { isBankAccount: true },
        { code: { in: ["1000", "1010", "1020", "1100"] } },
      ],
    },
    select: { balance: true },
  });
  const totalCashBalance =
    cashAccounts.length > 0
      ? cashAccounts.reduce((sum, a) => sum + Number(a.balance), 0)
      : null;

  // Next 14 days recurring expenses
  const recurringDueRaw = await prisma.recurringExpense.findMany({
    where: {
      businessId,
      isActive: true,
      nextDueDate: {
        gte: now,
        lte: new Date(now.getTime() + thresholds.cashHorizonDays * 86_400_000),
      },
    },
    select: { amount: true },
  });
  const recurringDueTotal = recurringDueRaw.reduce((sum, r) => sum + Number(r.amount), 0);

  // 11. Inventory & Products
  const productsRaw = await prisma.product.findMany({
    where: {
      businessId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      costPrice: true,
      retailPrice: true,
      reorderLevel: true,
      createdAt: true,
      stocks: { select: { quantity: true } },
    },
  });

  // Calculate units sold in 30 / 90 days per product
  const date30Ago = rangeLast30.start;
  const date90Ago = new Date(now.getTime() - 90 * 86_400_000);

  const sold30Map = new Map<string, number>();
  const sold90Map = new Map<string, number>();
  const lastSoldMap = new Map<string, Date>();

  for (const s of sales) {
    if (!COUNTED_SALE_STATUSES.includes(s.status as any)) continue;
    const t = s.createdAt.getTime();
    for (const it of s.items) {
      if (t >= date30Ago.getTime()) {
        sold30Map.set(it.productId, (sold30Map.get(it.productId) || 0) + it.quantity);
      }
      if (t >= date90Ago.getTime()) {
        sold90Map.set(it.productId, (sold90Map.get(it.productId) || 0) + it.quantity);
      }
      const prev = lastSoldMap.get(it.productId);
      if (!prev || t > prev.getTime()) {
        lastSoldMap.set(it.productId, s.createdAt);
      }
    }
  }

  const inventoryRows: InventoryProductRow[] = productsRaw.map((p) => {
    const totalQty = p.stocks.reduce((sum, st) => sum + st.quantity, 0);
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      qtyOnHand: totalQty,
      unitCost: Number(p.costPrice || 0),
      retailPrice: Number(p.retailPrice || 0),
      reorderLevel: p.reorderLevel || 0,
      unitsSold30: sold30Map.get(p.id) || 0,
      unitsSold90: sold90Map.get(p.id) || 0,
      lastSoldAt: lastSoldMap.get(p.id) || null,
      createdAt: p.createdAt,
    };
  });

  const inventory = computeInventory(inventoryRows, {
    leadDays: thresholds.leadDays,
    bufferDays: thresholds.bufferDays,
    slowMovingDays: thresholds.slowMovingDays,
    excessCoverDays: thresholds.excessCoverDays,
    minFlagValue: thresholds.minFlagValue,
    cogsPeriod: last30.cogs,
    cogsPeriodDays: 30,
    now,
  });

  // 12. Product Margins & Top Sellers
  const margins = computeProductMargins(sales, rangeLast30);
  const topProducts = [...margins].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // 13. Discounts & Refunds analytics
  const discountRate30 = last30.grossSales > 0 ? (last30.discounts / last30.grossSales) * 100 : null;
  const sales90 = sales.filter((s) => s.createdAt.getTime() >= date90Ago.getTime());
  const grossSales90 = sales90.reduce((sum, s) => sum + s.total - s.taxAmount, 0);
  const discountAmount90 = sales90.reduce((sum, s) => sum + s.discountAmount, 0);
  const discountRateBaseline = grossSales90 > 0 ? (discountAmount90 / grossSales90) * 100 : null;

  // Discount margin effectiveness
  let discountedRev = 0, discountedCost = 0, discountedLines = 0;
  let regularRev = 0, regularCost = 0;
  for (const s of sales) {
    if (s.createdAt.getTime() < rangeLast30.start.getTime() || s.createdAt.getTime() >= rangeLast30.end.getTime()) continue;
    for (const it of s.items) {
      const rev = it.total - it.taxAmount;
      const c = (it.costPrice || it.fallbackCost || 0) * it.quantity;
      if (it.discountAmount > 0) {
        discountedRev += rev;
        discountedCost += c;
        discountedLines += 1;
      } else {
        regularRev += rev;
        regularCost += c;
      }
    }
  }
  const discountEffect = {
    discountedMarginPct: discountedRev > 0 ? ((discountedRev - discountedCost) / discountedRev) * 100 : null,
    regularMarginPct: regularRev > 0 ? ((regularRev - regularCost) / regularRev) * 100 : null,
    discountedRevenueSharePct: last30.netRevenue > 0 ? (discountedRev / last30.netRevenue) * 100 : 0,
    discountedLines,
  };

  const refunds30 = refunds.filter((r) => r.createdAt.getTime() >= rangeLast30.start.getTime() && r.createdAt.getTime() < rangeLast30.end.getTime());
  const refundRate30 = last30.grossSales > 0 ? (last30.returns / last30.grossSales) * 100 : null;
  const refunds90Count = refunds.filter((r) => r.createdAt.getTime() >= date90Ago.getTime()).length;
  const countBaseline = refunds90Count / 3;

  // Top user share in refunds (to detect staff/cashier concentration)
  const refundUserMap = new Map<string, number>();
  refunds30.forEach((r) => {
    if (r.userId) {
      refundUserMap.set(r.userId, (refundUserMap.get(r.userId) || 0) + 1);
    }
  });
  const maxUserRefunds = Math.max(0, ...Array.from(refundUserMap.values()));
  const topUserSharePct = refunds30.length > 0 && maxUserRefunds > 0 ? (maxUserRefunds / refunds30.length) * 100 : null;

  // 14. Purchase costs & supplier comparisons
  const purchasesRaw = await prisma.purchase.findMany({
    where: {
      businessId,
      status: "RECEIVED",
      receivedDate: { gte: date90Ago },
    },
    select: {
      receivedDate: true,
      supplier: { select: { name: true } },
      items: { select: { productId: true, unitCost: true } },
    },
    orderBy: { receivedDate: "asc" },
  });

  const costHistoryMap = new Map<string, { date: Date; cost: number; supplier: string }[]>();
  purchasesRaw.forEach((pur) => {
    pur.items.forEach((item) => {
      const cur = costHistoryMap.get(item.productId) ?? [];
      cur.push({
        date: pur.receivedDate,
        cost: Number(item.unitCost),
        supplier: pur.supplier?.name || "Unknown",
      });
      costHistoryMap.set(item.productId, cur);
    });
  });

  const costIncreases: AdvisorSnapshot["purchaseCosts"]["increases"] = [];
  const supplierComparisons: AdvisorSnapshot["purchaseCosts"]["supplierComparisons"] = [];

  for (const [prodId, history] of costHistoryMap.entries()) {
    if (history.length < 2) continue;
    const prod = productsRaw.find((p) => p.id === prodId);
    if (!prod) continue;

    const latest = history[history.length - 1];
    const priors = history.slice(0, -1);
    const prevAvg = priors.reduce((a, b) => a + b.cost, 0) / priors.length;
    const diffPct = prevAvg > 0 ? ((latest.cost - prevAvg) / prevAvg) * 100 : 0;

    if (diffPct >= thresholds.purchaseCostIncreasePct) {
      costIncreases.push({
        productId: prodId,
        name: prod.name,
        prevAvg,
        latest: latest.cost,
        pct: diffPct,
        supplier: latest.supplier,
      });
    }

    // Compare suppliers
    const bySupplier = new Map<string, number[]>();
    history.forEach((h) => {
      const arr = bySupplier.get(h.supplier) ?? [];
      arr.push(h.cost);
      bySupplier.set(h.supplier, arr);
    });

    if (bySupplier.size >= 2) {
      const supplierAvgs = Array.from(bySupplier.entries()).map(([sup, costs]) => ({
        supplier: sup,
        avg: costs.reduce((a, b) => a + b, 0) / costs.length,
      }));
      supplierAvgs.sort((a, b) => a.avg - b.avg);
      const cheapest = supplierAvgs[0];
      const priciest = supplierAvgs[supplierAvgs.length - 1];
      const spread = cheapest.avg > 0 ? ((priciest.avg - cheapest.avg) / cheapest.avg) * 100 : 0;

      if (spread >= 10) {
        supplierComparisons.push({
          productId: prodId,
          name: prod.name,
          cheapest,
          priciest,
          spreadPct: spread,
        });
      }
    }
  }

  // 15. Customers & Weekday patterns
  const customers = computeRepeatCustomers(sales, now);

  const dailyPoints = buildDailySeries(
    {
      sales,
      refunds,
      expenses,
      supplierPayments,
      creditCollections,
    },
    addDays(todayStr, -27),
    todayStr,
    tz
  );
  const weekday = weekdayAverages(dailyPoints, (d) => weekdayOf(d));

  // 16. Data Quality Checks
  const productsMissingCostSold90 = Array.from(sold90Map.keys()).filter((id) => {
    const p = productsRaw.find((pr) => pr.id === id);
    return p && (!p.costPrice || Number(p.costPrice) <= 0);
  }).length;

  const sales30 = sales.filter((s) => s.createdAt.getTime() >= rangeLast30.start.getTime() && s.createdAt.getTime() < rangeLast30.end.getTime());
  const salesMissingPayment30 = sales30.filter((s) => {
    const paid = s.payments.reduce((sum, p) => sum + p.amount, 0);
    return paid < s.total && s.creditAmount <= 0;
  }).length;

  // Ledger Inventory vs Physical Inventory check
  const invAccount = await prisma.account.findFirst({
    where: { businessId, code: "1300", isActive: true },
    select: { balance: true },
  });
  const ledgerInventoryValue = invAccount ? Number(invAccount.balance) : null;
  const ledgerInventoryDeltaPct =
    ledgerInventoryValue !== null && inventory.valueAtCost > 0
      ? ((ledgerInventoryValue - inventory.valueAtCost) / inventory.valueAtCost) * 100
      : null;

  // 17. Type-specific Queries (conditional on module flags)
  let expiring = { count: 0, value: 0, expiredCount: 0, expiredValue: 0, names: [] as string[], nearestDays: null as number | null };
  let waste = { value30: 0, valuePrev30: 0 };
  let serialAging = { count: 0, value: 0 };
  let warrantyClaims = { open: 0, stale: 0 };
  let service = { overdue: 0, unpaidCount: 0, unpaidValue: 0 };

  if (modules.batchTracking) {
    const batchesRaw = await prisma.batch.findMany({
      where: {
        businessId,
        quantity: { gt: 0 },
        expiryDate: { not: null },
      },
      include: { product: { select: { name: true, costPrice: true } } },
    });

    const horizonDate = new Date(now.getTime() + thresholds.expiryWarningDays * 86_400_000);
    for (const b of batchesRaw) {
      if (!b.expiryDate) continue;
      const unitCost = Number(b.costPrice || b.product?.costPrice || 0);
      const val = unitCost * b.quantity;
      if (b.expiryDate < now) {
        expiring.expiredCount += 1;
        expiring.expiredValue += val;
      } else if (b.expiryDate <= horizonDate) {
        expiring.count += 1;
        expiring.value += val;
        if (!expiring.names.includes(b.product.name)) expiring.names.push(b.product.name);
        const days = Math.floor((b.expiryDate.getTime() - now.getTime()) / 86_400_000);
        if (expiring.nearestDays === null || days < expiring.nearestDays) expiring.nearestDays = days;
      }
    }

    // Waste / Damage stock movements
    const wasteMovements = await prisma.stockMovement.findMany({
      where: {
        businessId,
        type: { in: ["DAMAGE", "EXPIRY_WRITE_OFF"] },
        createdAt: { gte: rangePrev30.start },
      },
      select: { quantity: true, unitCost: true, createdAt: true },
    });
    wasteMovements.forEach((wm) => {
      const val = Math.abs(wm.quantity) * Number(wm.unitCost || 0);
      if (wm.createdAt >= rangeLast30.start) waste.value30 += val;
      else waste.valuePrev30 += val;
    });
  }

  if (modules.serialTracking) {
    const cutoff = new Date(now.getTime() - thresholds.serialAgingDays * 86_400_000);
    const serials = await prisma.serialNumber.findMany({
      where: {
        businessId,
        status: "IN_STOCK",
        createdAt: { lte: cutoff },
      },
      include: { product: { select: { costPrice: true } } },
    });
    serialAging.count = serials.length;
    serialAging.value = serials.reduce((sum, s) => sum + Number(s.product?.costPrice || 0), 0);
  }

  if (modules.warranty) {
    const staleDate = new Date(now.getTime() - thresholds.claimStaleDays * 86_400_000);
    const [openCount, staleCount] = await Promise.all([
      prisma.warrantyClaim.count({
        where: { businessId, status: { notIn: ["DELIVERED", "COMPLETED", "CANCELLED", "REJECTED"] } },
      }),
      prisma.warrantyClaim.count({
        where: {
          businessId,
          status: { notIn: ["DELIVERED", "COMPLETED", "CANCELLED", "REJECTED"] },
          createdAt: { lte: staleDate },
        },
      }),
    ]);
    warrantyClaims = { open: openCount, stale: staleCount };
  }

  if (modules.service) {
    const overdueTicketDate = new Date(now.getTime() - thresholds.serviceOverdueDays * 86_400_000);
    const [overdueCount, unpaidTickets] = await Promise.all([
      prisma.serviceTicket.count({
        where: {
          businessId,
          status: { notIn: ["COMPLETED", "DELIVERED", "CANCELLED"] },
          createdAt: { lte: overdueTicketDate },
        },
      }),
      prisma.serviceTicket.findMany({
        where: {
          businessId,
          status: { in: ["COMPLETED", "READY"] },
          isPaid: false,
        },
        select: { finalCost: true, estimatedCost: true },
      }),
    ]);
    const unpaidVal = unpaidTickets.reduce((sum, t) => sum + Number(t.finalCost || t.estimatedCost || 0), 0);
    service = {
      overdue: overdueCount,
      unpaidCount: unpaidTickets.length,
      unpaidValue: unpaidVal,
    };
  }

  return {
    generatedAt: now.toISOString(),
    timezone: tz,
    currency,
    category: business.category,
    today: todayStr,
    historyDays,
    modules,
    thresholds,
    ranges: {
      last30: { from: last30StartStr, to: todayStr },
      prev30: { from: prev30StartStr, to: prev30EndStr },
      mtd: { from: mtdStartStr, to: todayStr },
      prevMtd: { from: prevMonthStartStr, to: prevMtdEndStr },
    },
    last30,
    prev30,
    mtd,
    prevMtd,
    dailySeries: dailyPoints,
    todaySummary,
    yesterdaySummary,
    lastWeekSummary,
    cashFlowToday,
    expenses: {
      byCategory: expenseCategories,
      totalLast30: totalExpenseLast30,
      totalPriorAvg: totalExpensePriorAvg,
      priorWindows: priorWindowsWithData,
    },
    receivables,
    receivablesNet30,
    payables,
    cash: {
      balance: totalCashBalance,
      accountCount: cashAccounts.length,
      recurringDue: recurringDueTotal,
    },
    inventory,
    inventoryLedgerValue: ledgerInventoryValue,
    margins,
    topProducts,
    discounts: {
      rate30: discountRate30,
      rateBaseline: discountRateBaseline,
      amount30: last30.discounts,
      transactions30: last30.transactions,
    },
    discountEffect,
    refunds: {
      rate30: refundRate30,
      count30: refunds30.length,
      countBaseline,
      value30: last30.returns,
      topUserSharePct,
    },
    purchaseCosts: {
      increases: costIncreases,
      supplierComparisons,
    },
    customers,
    weekday,
    dataQuality: {
      productsMissingCostSold90,
      salesMissingPayment30,
      salesWithoutJournal30: 0,
      ledgerInventoryDeltaPct,
      truncated: false,
    },
    typeSpecific: {
      expiring,
      waste,
      serialAging,
      warrantyClaims,
      service,
    },
  };
}
