/**
 * CENTRALIZED ADVISOR CALCULATION SERVICE
 * ======================================
 *
 * Pure, database-free functions. Every figure shown by the advisor (dashboard, daily report,
 * insights, chat) is produced here so the formulas are defined — and tested — once.
 *
 * Accounting model (mirrors src/lib/accounting.ts):
 *
 *  Revenue      = Σ (Sale.total − Sale.taxAmount)         for sales with status
 *                 COMPLETED | PARTIALLY_REFUNDED | REFUNDED
 *                 (DRAFT / ON_HOLD / CANCELLED are never counted). Output VAT (SSCL/VAT) is a
 *                 liability, not revenue, so it is excluded — exactly like recordSaleJournalEntry.
 *  Discounts    = Σ Sale.discountAmount (informational; Sale.total is already net of discounts).
 *  Returns      = Σ Refund.subtotal (ex tax) by *refund date*; falls back to totalAmount − taxAmount
 *                 for legacy refunds without a subtotal. Credit notes reverse revenue in the period
 *                 the refund happens, not the period of the original sale.
 *  Net revenue  = Revenue − Returns.
 *  COGS         = Σ (SaleItem.costPrice × quantity) − cost of returned goods that were restocked.
 *                 Lines whose snapshot cost is missing fall back to the *current* product cost and
 *                 are flagged as an estimate; lines with no usable cost are "missing cost".
 *  Gross profit = Net revenue − COGS — shown only when cost coverage is ≥ 90 % of revenue.
 *  Opex         = Σ Expense (status PAID | APPROVED) net of recoverable input VAT
 *                 (eligible input VAT is an asset, see createExpenseEntry). PENDING expenses are
 *                 counted separately and downgrade the status; REJECTED are ignored.
 *  Net profit   = Gross profit − Opex   (operating profit BEFORE income tax, depreciation and any
 *                 cost not recorded as an expense). Never "COMPLETE" if expenses are possibly
 *                 incomplete.
 *
 *  Cash flow is NOT profit: it counts money actually received/paid in the period
 *  (customer receipts, credit collections, expenses paid, supplier payments, cash refunds), so a
 *  credit sale is revenue but not cash inflow, and a supplier payment is cash outflow but not an
 *  expense (it increases inventory).
 */

import type {
  CalcStatus,
  CashFlow,
  DailySeriesPoint,
  DateRange,
  ExpenseRec,
  InventoryItemFlag,
  InventoryProductRow,
  InventorySummary,
  PayablesSummary,
  ProductMargin,
  Profitability,
  ReceivableCustomer,
  ReceivablesSummary,
  RefundRec,
  SaleItemRec,
  SaleRec,
} from "./types";
import { addDays, daysBetween, localDateString } from "./timezone";

export const COUNTED_SALE_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] as const;
export const COUNTED_EXPENSE_STATUSES = ["PAID", "APPROVED"] as const;

/** Payment methods that do not move cash/bank balances when the sale is made. */
const NON_CASH_METHODS = new Set(["CREDIT", "LOYALTY_POINTS"]);

export const COVERAGE_COMPLETE = 0.995;
export const COVERAGE_ESTIMATED = 0.9;
export const COVERAGE_INCOMPLETE = 0.5;

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

export function safeDiv(a: number, b: number): number | null {
  return b === 0 || !Number.isFinite(a) || !Number.isFinite(b) ? null : a / b;
}

export function isCountedSale(status: string): boolean {
  return (COUNTED_SALE_STATUSES as readonly string[]).includes(status);
}

export function inRange(d: Date, range: DateRange): boolean {
  const t = d.getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

// ---------------------------------------------------------------------------
// Line level helpers
// ---------------------------------------------------------------------------

export type CostSource = "SNAPSHOT" | "CURRENT_COST" | "MISSING";

export function lineCost(item: SaleItemRec): { unitCost: number; source: CostSource } {
  if (item.costPrice > 0) return { unitCost: item.costPrice, source: "SNAPSHOT" };
  if ((item.fallbackCost ?? 0) > 0) return { unitCost: item.fallbackCost as number, source: "CURRENT_COST" };
  return { unitCost: 0, source: "MISSING" };
}

export function lineRevenue(item: SaleItemRec): number {
  return Math.max(0, item.total - item.taxAmount);
}

export function refundNetValue(r: RefundRec): number {
  if (r.subtotal > 0) return r.subtotal;
  return Math.max(0, r.totalAmount - r.taxAmount);
}

export function expenseNetAmount(e: ExpenseRec): number {
  return e.inputVatEligible && e.taxAmount > 0 ? Math.max(0, e.amount - e.taxAmount) : e.amount;
}

/** Cash actually received at the point of sale (excludes credit / points, clamps change). */
export function saleCashReceipts(s: SaleRec): number {
  const tendered = s.payments
    .filter((p) => p.status === "PAID" && !NON_CASH_METHODS.has(p.method))
    .reduce((a, p) => a + p.amount, 0);
  const collectable = Math.max(0, s.total - s.creditAmount);
  return Math.min(tendered, collectable);
}

/** Cash leaving the till/bank for a refund (credit-note-to-account refunds are not cash). */
export function refundCashPaid(r: RefundRec): number {
  return NON_CASH_METHODS.has(r.paymentMethod) ? 0 : r.totalAmount;
}

// ---------------------------------------------------------------------------
// Profitability
// ---------------------------------------------------------------------------

export interface ProfitabilityInput {
  range: DateRange;
  sales: SaleRec[];
  refunds: RefundRec[];
  expenses: ExpenseRec[];
  /** recurring expenses whose due date has passed without a recorded expense */
  overdueRecurringCount?: number;
  /** true when the business has recorded no expense at all in the lookback window */
  noExpensesInLookback?: boolean;
}

export function costStatus(coverage: number, estimatedShare: number, hasRevenue: boolean): CalcStatus {
  if (!hasRevenue) return "UNAVAILABLE";
  if (coverage < COVERAGE_INCOMPLETE) return "UNAVAILABLE";
  if (coverage < COVERAGE_ESTIMATED) return "INCOMPLETE";
  if (coverage < COVERAGE_COMPLETE) return "ESTIMATED";
  return estimatedShare > 0.005 ? "ESTIMATED" : "COMPLETE";
}

export function computeProfitability(input: ProfitabilityInput): Profitability {
  const { range } = input;
  const sales = input.sales.filter((s) => inRange(s.createdAt, range) && isCountedSale(s.status));
  const refunds = input.refunds.filter((r) => inRange(r.createdAt, range));
  const expenses = input.expenses.filter((e) => inRange(e.expenseDate, range));

  let grossSales = 0;
  let discounts = 0;
  let units = 0;
  let itemRevenue = 0;
  let revCosted = 0;
  let revEstimated = 0;
  let revMissing = 0;
  let linesMissing = 0;
  let cogsGross = 0;

  for (const s of sales) {
    grossSales += s.total - s.taxAmount;
    discounts += s.discountAmount;
    for (const it of s.items) {
      const rev = lineRevenue(it);
      const { unitCost, source } = lineCost(it);
      units += it.quantity;
      itemRevenue += rev;
      if (source === "MISSING") {
        if (rev > 0) {
          revMissing += rev;
          linesMissing += 1;
        }
      } else {
        cogsGross += unitCost * it.quantity;
        if (source === "SNAPSHOT") revCosted += rev;
        else revEstimated += rev;
      }
    }
  }

  const returns = refunds.reduce((a, r) => a + refundNetValue(r), 0);
  const returnedCogs = refunds.reduce((a, r) => a + r.restockedCost, 0);
  const netRevenue = grossSales - returns;
  const cogs = Math.max(0, cogsGross - returnedCogs);

  const coverage = itemRevenue > 0 ? 1 - revMissing / itemRevenue : sales.length > 0 ? 1 : 0;
  const estShare = itemRevenue > 0 ? revEstimated / itemRevenue : 0;
  const noActivity = sales.length === 0 && refunds.length === 0;
  const grossStatus = costStatus(coverage, estShare, itemRevenue > 0);

  const grossProfit =
    grossStatus === "COMPLETE" || grossStatus === "ESTIMATED" ? round2(netRevenue - cogs) : null;
  const grossMarginPct =
    grossProfit !== null && netRevenue > 0 ? round2((grossProfit / netRevenue) * 100) : null;

  const opex = expenses
    .filter((e) => (COUNTED_EXPENSE_STATUSES as readonly string[]).includes(e.status))
    .reduce((a, e) => a + expenseNetAmount(e), 0);
  const pending = expenses.filter((e) => e.status === "PENDING");
  const pendingAmount = pending.reduce((a, e) => a + e.amount, 0);

  const expenseIncomplete =
    pending.length > 0 || (input.overdueRecurringCount ?? 0) > 0 || !!input.noExpensesInLookback;
  const expenseStatus: "COMPLETE" | "ESTIMATED" = expenseIncomplete ? "ESTIMATED" : "COMPLETE";

  let netProfit: number | null = null;
  let netStatus: CalcStatus;
  if (grossProfit !== null) {
    netProfit = round2(grossProfit - opex);
    netStatus = grossStatus === "COMPLETE" && expenseStatus === "COMPLETE" ? "COMPLETE" : "ESTIMATED";
  } else {
    netStatus = grossStatus;
  }
  const netMarginPct =
    netProfit !== null && netRevenue > 0 ? round2((netProfit / netRevenue) * 100) : null;

  const notes: string[] = [];
  if (noActivity) notes.push("NO_SALES");
  if (!noActivity && coverage < COVERAGE_COMPLETE && itemRevenue > 0) notes.push("COST_MISSING_PARTIAL");
  if (estShare > 0.005) notes.push("COST_FROM_CURRENT");
  if (pending.length > 0) notes.push("PENDING_EXPENSES");
  if ((input.overdueRecurringCount ?? 0) > 0) notes.push("RECURRING_OVERDUE");
  if (input.noExpensesInLookback && !noActivity) notes.push("NO_EXPENSES_RECORDED");

  return {
    transactions: sales.length,
    unitsSold: units,
    avgTicket: sales.length > 0 ? round2(grossSales / sales.length) : 0,
    grossSales: round2(grossSales),
    discounts: round2(discounts),
    returns: round2(returns),
    netRevenue: round2(netRevenue),
    cogs: round2(cogs),
    costCoveragePct: round2(coverage * 100),
    estimatedCostSharePct: round2(estShare * 100),
    linesMissingCost: linesMissing,
    revenueMissingCost: round2(revMissing),
    grossProfit,
    grossProfitOnCosted: round2(revCosted + revEstimated - cogsGross),
    grossMarginPct,
    grossStatus,
    operatingExpenses: round2(opex),
    pendingExpensesCount: pending.length,
    pendingExpensesAmount: round2(pendingAmount),
    expenseStatus,
    netProfit,
    netMarginPct,
    netStatus,
    noActivity,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Cash flow
// ---------------------------------------------------------------------------

export interface CashFlowInput {
  range: DateRange;
  sales: SaleRec[];
  refunds: RefundRec[];
  expenses: ExpenseRec[];
  /** PurchasePayment rows (covers both initial GRN payments and later supplier settlements) */
  supplierPayments: { amount: number; paidAt: Date }[];
  /** CreditTransaction rows of type PAYMENT (customer repayments of credit) */
  creditCollections: { amount: number; createdAt: Date }[];
}

export function computeCashFlow(input: CashFlowInput): CashFlow {
  const { range } = input;
  const salesReceipts = input.sales
    .filter((s) => isCountedSale(s.status))
    .reduce((a, s) => {
      // use the payment timestamp when available, otherwise the sale time
      const stamp = s.payments.find((p) => p.createdAt)?.createdAt ?? s.createdAt;
      return inRange(stamp, range) ? a + saleCashReceipts(s) : a;
    }, 0);
  const creditCollections = input.creditCollections
    .filter((c) => inRange(c.createdAt, range))
    .reduce((a, c) => a + Math.abs(c.amount), 0);
  const expenses = input.expenses
    .filter((e) => e.status === "PAID" && inRange(e.expenseDate, range))
    .reduce((a, e) => a + e.amount, 0);
  const supplierPayments = input.supplierPayments
    .filter((p) => inRange(p.paidAt, range))
    .reduce((a, p) => a + p.amount, 0);
  const refunds = input.refunds
    .filter((r) => inRange(r.createdAt, range))
    .reduce((a, r) => a + refundCashPaid(r), 0);

  const inflowTotal = salesReceipts + creditCollections;
  const outflowTotal = expenses + supplierPayments + refunds;
  return {
    inflow: {
      salesReceipts: round2(salesReceipts),
      creditCollections: round2(creditCollections),
      total: round2(inflowTotal),
    },
    outflow: {
      expenses: round2(expenses),
      supplierPayments: round2(supplierPayments),
      refunds: round2(refunds),
      total: round2(outflowTotal),
    },
    net: round2(inflowTotal - outflowTotal),
  };
}

// ---------------------------------------------------------------------------
// Receivables / payables
// ---------------------------------------------------------------------------

export interface ReceivableInput {
  customerId: string;
  name: string;
  balance: number;
  /** CREDIT_SALE transactions: amount > 0 */
  credits: { amount: number; createdAt: Date; dueDate?: Date | null }[];
}

/**
 * Ageing assumes customer repayments settle the *oldest* invoices first (FIFO), so the
 * outstanding balance is allocated to the newest credit sales. Balance that cannot be traced to
 * a dated credit sale (opening balances, manual adjustments) is reported as `undated` and is
 * never classified as overdue.
 */
export function computeReceivables(
  customers: ReceivableInput[],
  now: Date,
  termDays = 30,
  topN = 8
): ReceivablesSummary {
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_plus: 0, undated: 0 };
  const rows: ReceivableCustomer[] = [];
  let total = 0;
  let overdueTotal = 0;
  let overdueCustomers = 0;
  let withBalance = 0;

  for (const c of customers) {
    if (!(c.balance > 0.004)) continue;
    withBalance += 1;
    total += c.balance;
    let remaining = c.balance;
    let custOverdue = 0;
    let oldest: number | null = null;
    const credits = [...c.credits].filter((x) => x.amount > 0).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const cr of credits) {
      if (remaining <= 0.004) break;
      const piece = Math.min(cr.amount, remaining);
      remaining -= piece;
      const due = cr.dueDate ?? new Date(cr.createdAt.getTime() + termDays * 86_400_000);
      const overdueDays = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
      if (overdueDays <= 0) buckets.current += piece;
      else {
        custOverdue += piece;
        if (overdueDays <= 30) buckets.d1_30 += piece;
        else if (overdueDays <= 60) buckets.d31_60 += piece;
        else buckets.d61_plus += piece;
        oldest = oldest === null ? overdueDays : Math.max(oldest, overdueDays);
      }
    }
    if (remaining > 0.004) buckets.undated += remaining;
    if (custOverdue > 0) {
      overdueTotal += custOverdue;
      overdueCustomers += 1;
    }
    rows.push({
      customerId: c.customerId,
      name: c.name,
      balance: round2(c.balance),
      overdueAmount: round2(custOverdue),
      oldestDays: oldest,
    });
  }

  rows.sort((a, b) => b.overdueAmount - a.overdueAmount || b.balance - a.balance);
  return {
    total: round2(total),
    customersWithBalance: withBalance,
    overdueTotal: round2(overdueTotal),
    overdueCustomers,
    buckets: {
      current: round2(buckets.current),
      d1_30: round2(buckets.d1_30),
      d31_60: round2(buckets.d31_60),
      d61_plus: round2(buckets.d61_plus),
      undated: round2(buckets.undated),
    },
    top: rows.slice(0, topN),
    termDays,
  };
}

export function computePayables(
  rows: { balance: number; dueDate: Date | null; status: string }[],
  now: Date
): PayablesSummary {
  const horizon = now.getTime() + 14 * 86_400_000;
  let total = 0, count = 0, overdueTotal = 0, overdueCount = 0, dueTotal = 0, dueCount = 0;
  for (const r of rows) {
    if (r.status === "PAID" || !(r.balance > 0.004)) continue;
    total += r.balance;
    count += 1;
    if (r.dueDate) {
      const t = r.dueDate.getTime();
      if (t < now.getTime()) {
        overdueTotal += r.balance;
        overdueCount += 1;
      } else if (t <= horizon) {
        dueTotal += r.balance;
        dueCount += 1;
      }
    }
  }
  return {
    total: round2(total),
    count,
    overdueTotal: round2(overdueTotal),
    overdueCount,
    dueNext14Total: round2(dueTotal),
    dueNext14Count: dueCount,
  };
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export interface InventoryOptions {
  /** supplier lead time used for stock-out risk */
  leadDays: number;
  /** extra cover to order on top of lead time */
  bufferDays: number;
  /** product must have had no sale in 90 days and be at least this old to be "slow moving" */
  slowMovingDays: number;
  /** days of cover above which stock is "excess" */
  excessCoverDays: number;
  /** ignore flags below this stock value */
  minFlagValue: number;
  cogsPeriod?: number;
  cogsPeriodDays?: number;
  now: Date;
  topN?: number;
}

export function computeInventory(rows: InventoryProductRow[], opt: InventoryOptions): InventorySummary {
  const topN = opt.topN ?? 10;
  let valueAtCost = 0, valueAtRetail = 0, units = 0, missingCost = 0;
  const lowStock: InventoryItemFlag[] = [];
  const outOfStockSelling: InventoryItemFlag[] = [];
  const slow: InventoryItemFlag[] = [];
  const excess: InventoryItemFlag[] = [];
  const risk: InventoryItemFlag[] = [];

  for (const r of rows) {
    const qty = Math.max(0, r.qtyOnHand);
    const value = qty * r.unitCost;
    valueAtCost += value;
    valueAtRetail += qty * r.retailPrice;
    units += qty;
    if (qty > 0 && r.unitCost <= 0) missingCost += 1;

    const velocity = r.unitsSold30 / 30;
    const cover = velocity > 0 ? qty / velocity : null;
    const base: InventoryItemFlag = {
      productId: r.productId,
      name: r.name,
      qty,
      value: round2(value),
      reorderLevel: r.reorderLevel,
      daysOfCover: cover === null ? null : round2(cover),
      velocityPerDay: round2(velocity),
    };

    if (qty <= 0 && r.unitsSold90 > 0) outOfStockSelling.push({ ...base, suggestedReorderQty: Math.ceil(velocity * (opt.leadDays + opt.bufferDays)) });
    else if (r.reorderLevel > 0 && qty > 0 && qty <= r.reorderLevel) lowStock.push(base);

    if (velocity > 0 && qty > 0 && cover !== null && cover < opt.leadDays) {
      risk.push({
        ...base,
        suggestedReorderQty: Math.max(1, Math.ceil(velocity * (opt.leadDays + opt.bufferDays) - qty)),
      });
    }

    const ageDays = (opt.now.getTime() - r.createdAt.getTime()) / 86_400_000;
    if (qty > 0 && r.unitsSold90 === 0 && ageDays >= opt.slowMovingDays && value >= opt.minFlagValue) slow.push(base);
    else if (velocity > 0 && cover !== null && cover > opt.excessCoverDays && value >= opt.minFlagValue) excess.push(base);
  }

  const byValue = (a: InventoryItemFlag, b: InventoryItemFlag) => b.value - a.value;
  const slowValue = slow.reduce((a, x) => a + x.value, 0);
  const excessValue = excess.reduce((a, x) => a + x.value, 0);

  let inventoryDays: number | null = null;
  let turnover: number | null = null;
  if (opt.cogsPeriod && opt.cogsPeriodDays && opt.cogsPeriod > 0 && valueAtCost > 0) {
    const cogsPerDay = opt.cogsPeriod / opt.cogsPeriodDays;
    inventoryDays = round2(valueAtCost / cogsPerDay);
    turnover = round2((cogsPerDay * 365) / valueAtCost);
  }

  return {
    valueAtCost: round2(valueAtCost),
    valueAtRetail: round2(valueAtRetail),
    units,
    productCount: rows.length,
    productsMissingCost: missingCost,
    lowStock: lowStock.sort(byValue).slice(0, topN),
    outOfStockSelling: outOfStockSelling.slice(0, topN),
    slowMoving: slow.sort(byValue).slice(0, topN),
    slowMovingValue: round2(slowValue),
    excess: excess.sort(byValue).slice(0, topN),
    excessValue: round2(excessValue),
    stockoutRisk: risk.sort((a, b) => (a.daysOfCover ?? 0) - (b.daysOfCover ?? 0)).slice(0, topN),
    inventoryDays,
    turnoverAnnualised: turnover,
  };
}

/**
 * Safest discount ceiling that keeps the minimum margin: price × (1 − d) ≥ cost / (1 − minMargin).
 * Returns null when cost is unknown — a discount must then NOT be recommended.
 */
export function maxSafeDiscountPct(price: number, cost: number, minMarginPct: number): number | null {
  if (!(price > 0) || !(cost > 0)) return null;
  const floor = cost / (1 - minMarginPct / 100);
  const pct = (1 - floor / price) * 100;
  return pct > 0 ? round2(pct) : 0;
}

// ---------------------------------------------------------------------------
// Product margins
// ---------------------------------------------------------------------------

export function computeProductMargins(sales: SaleRec[], range: DateRange): ProductMargin[] {
  const map = new Map<
    string,
    { name: string; units: number; revenue: number; revCosted: number; cost: number; anyMissing: boolean }
  >();
  for (const s of sales) {
    if (!inRange(s.createdAt, range) || !isCountedSale(s.status)) continue;
    for (const it of s.items) {
      const rev = lineRevenue(it);
      const { unitCost, source } = lineCost(it);
      const cur = map.get(it.productId) ?? { name: it.name, units: 0, revenue: 0, revCosted: 0, cost: 0, anyMissing: false };
      cur.units += it.quantity;
      cur.revenue += rev;
      if (source === "MISSING") {
        if (rev > 0) cur.anyMissing = true;
      } else {
        cur.revCosted += rev;
        cur.cost += unitCost * it.quantity;
      }
      map.set(it.productId, cur);
    }
  }
  return [...map.entries()].map(([productId, v]) => {
    const profit = v.revCosted - v.cost;
    return {
      productId,
      name: v.name,
      units: v.units,
      revenue: round2(v.revenue),
      cost: round2(v.cost),
      profit: round2(profit),
      marginPct: v.revCosted > 0 ? round2((profit / v.revCosted) * 100) : null,
      costKnown: !v.anyMissing,
    };
  });
}

// ---------------------------------------------------------------------------
// Daily series (local calendar days)
// ---------------------------------------------------------------------------

export function buildDailySeries(
  input: {
    sales: SaleRec[];
    refunds: RefundRec[];
    expenses: ExpenseRec[];
    supplierPayments: { amount: number; paidAt: Date }[];
    creditCollections: { amount: number; createdAt: Date }[];
  },
  fromDate: string,
  toDate: string,
  tz: string
): DailySeriesPoint[] {
  const days = Math.max(0, daysBetween(fromDate, toDate));
  const keys: string[] = [];
  for (let i = 0; i <= days; i++) keys.push(addDays(fromDate, i));
  const m = new Map<string, DailySeriesPoint & { _itemRev: number; _missRev: number }>();
  for (const k of keys)
    m.set(k, { date: k, revenue: 0, cogs: 0, grossProfit: null, expenses: 0, transactions: 0, cashIn: 0, cashOut: 0, _itemRev: 0, _missRev: 0 });
  const slot = (d: Date) => m.get(localDateString(d, tz));

  for (const s of input.sales) {
    if (!isCountedSale(s.status)) continue;
    const p = slot(s.createdAt);
    if (!p) continue;
    p.revenue += s.total - s.taxAmount;
    p.transactions += 1;
    p.cashIn += saleCashReceipts(s);
    for (const it of s.items) {
      const rev = lineRevenue(it);
      const { unitCost, source } = lineCost(it);
      p._itemRev += rev;
      if (source === "MISSING") p._missRev += rev;
      else p.cogs += unitCost * it.quantity;
    }
  }
  for (const r of input.refunds) {
    const p = slot(r.createdAt);
    if (!p) continue;
    p.revenue -= refundNetValue(r);
    p.cogs -= r.restockedCost;
    p.cashOut += refundCashPaid(r);
  }
  for (const e of input.expenses) {
    const p = slot(e.expenseDate);
    if (!p) continue;
    if ((COUNTED_EXPENSE_STATUSES as readonly string[]).includes(e.status)) p.expenses += expenseNetAmount(e);
    if (e.status === "PAID") p.cashOut += e.amount;
  }
  for (const sp of input.supplierPayments) {
    const p = slot(sp.paidAt);
    if (p) p.cashOut += sp.amount;
  }
  for (const c of input.creditCollections) {
    const p = slot(c.createdAt);
    if (p) p.cashIn += Math.abs(c.amount);
  }

  return keys.map((k) => {
    const p = m.get(k)!;
    const covered = p._itemRev > 0 ? 1 - p._missRev / p._itemRev : 1;
    return {
      date: p.date,
      revenue: round2(p.revenue),
      cogs: round2(Math.max(0, p.cogs)),
      grossProfit: p.transactions > 0 && covered >= COVERAGE_ESTIMATED ? round2(p.revenue - Math.max(0, p.cogs)) : null,
      expenses: round2(p.expenses),
      transactions: p.transactions,
      cashIn: round2(p.cashIn),
      cashOut: round2(p.cashOut),
    };
  });
}

/** Average revenue per weekday from a daily series (0 = Sunday). Needs ≥ minWeeks of data. */
export function weekdayAverages(
  series: { date: string; revenue: number; transactions: number }[],
  weekdayOf: (d: string) => number
): { averages: number[]; sampleDays: number[] } {
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const p of series) {
    const w = weekdayOf(p.date);
    sums[w] += p.revenue;
    counts[w] += 1;
  }
  return { averages: sums.map((s, i) => (counts[i] ? round2(s / counts[i]) : 0)), sampleDays: counts };
}

/** Repeat-customer analysis over a set of counted sales. */
export function computeRepeatCustomers(sales: SaleRec[], now: Date) {
  const byCustomer = new Map<string, { dates: number[]; revenue: number }>();
  let totalRevenue = 0;
  let identifiedRevenue = 0;
  for (const s of sales) {
    if (!isCountedSale(s.status)) continue;
    const rev = s.total - s.taxAmount;
    totalRevenue += rev;
    if (!s.customerId) continue;
    identifiedRevenue += rev;
    const c = byCustomer.get(s.customerId) ?? { dates: [], revenue: 0 };
    c.dates.push(s.createdAt.getTime());
    c.revenue += rev;
    byCustomer.set(s.customerId, c);
  }
  let repeat = 0, repeatRevenue = 0, lapsing = 0;
  for (const c of byCustomer.values()) {
    if (c.dates.length >= 2) {
      repeat += 1;
      repeatRevenue += c.revenue;
      const sorted = [...c.dates].sort((a, b) => a - b);
      const gaps = sorted.slice(1).map((d, i) => d - sorted[i]);
      const avgGap = gaps.reduce((a, g) => a + g, 0) / gaps.length;
      const sinceLast = now.getTime() - sorted[sorted.length - 1];
      if (c.dates.length >= 3 && avgGap > 0 && sinceLast > avgGap * 1.5) lapsing += 1;
    }
  }
  return {
    identifiedCustomers: byCustomer.size,
    repeatCustomers: repeat,
    repeatRevenue: round2(repeatRevenue),
    repeatRevenueSharePct: totalRevenue > 0 ? round2((repeatRevenue / totalRevenue) * 100) : 0,
    identifiedSharePct: totalRevenue > 0 ? round2((identifiedRevenue / totalRevenue) * 100) : 0,
    lapsingRepeatCustomers: lapsing,
  };
}
