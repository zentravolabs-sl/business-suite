/**
 * Rule-based financial intelligence. Pure functions: AdvisorSnapshot → findings.
 *
 * Principles
 *  - Every finding carries supporting numbers, the date range, a confidence level and the data
 *    that is missing. Wording lives in messages.ts (localised) and is rendered from `params`.
 *  - Findings describe what the data shows; they never claim causation and never predict the
 *    future. Impact is always an *estimate range* and labelled as such.
 *  - A rule only runs when its required modules are present (see ModuleRequirement).
 *  - Discounts are never recommended without a known cost and a margin floor.
 */

import type {
  CashFlow,
  Confidence,
  DailySeriesPoint,
  InsightCategory,
  InventorySummary,
  PayablesSummary,
  ProductMargin,
  Profitability,
  ReceivablesSummary,
  Severity,
} from "./types";
import type { ModuleFlags, ModuleRequirement, Thresholds } from "./config";
import { pctChange, round2, maxSafeDiscountPct } from "./calculations";

export type ParamValue = string | number | null;

export interface AdvisorSnapshot {
  generatedAt: string;
  timezone: string;
  currency: string;
  category: string;
  today: string;
  historyDays: number | null;
  modules: ModuleFlags;
  thresholds: Thresholds;
  ranges: Record<"last30" | "prev30" | "mtd" | "prevMtd", { from: string; to: string }>;
  last30: Profitability;
  prev30: Profitability;
  mtd: Profitability;
  prevMtd: Profitability;
  dailySeries: DailySeriesPoint[];
  todaySummary: Profitability;
  yesterdaySummary: Profitability;
  lastWeekSummary: Profitability;
  cashFlowToday: CashFlow;
  expenses: {
    byCategory: { name: string; last30: number; priorAvg: number; priorWindows: number }[];
    totalLast30: number;
    totalPriorAvg: number;
    priorWindows: number;
  };
  receivables: ReceivablesSummary;
  /** credit sales minus collections over the last 30 days (null when unknown) */
  receivablesNet30: number | null;
  payables: PayablesSummary;
  cash: {
    balance: number | null;
    accountCount: number;
    recurringDue: number;
  };
  inventory: InventorySummary;
  /** balance of the ledger inventory account, for reconciliation */
  inventoryLedgerValue: number | null;
  margins: ProductMargin[];
  topProducts: ProductMargin[];
  discounts: {
    rate30: number | null;
    rateBaseline: number | null;
    amount30: number;
    transactions30: number;
  };
  discountEffect: {
    discountedMarginPct: number | null;
    regularMarginPct: number | null;
    discountedRevenueSharePct: number;
    discountedLines: number;
  };
  refunds: {
    rate30: number | null;
    count30: number;
    countBaseline: number;
    value30: number;
    topUserSharePct: number | null;
  };
  purchaseCosts: {
    increases: { productId: string; name: string; prevAvg: number; latest: number; pct: number; supplier: string | null }[];
    supplierComparisons: {
      productId: string;
      name: string;
      cheapest: { supplier: string; avg: number };
      priciest: { supplier: string; avg: number };
      spreadPct: number;
    }[];
  };
  customers: {
    identifiedCustomers: number;
    repeatCustomers: number;
    repeatRevenueSharePct: number;
    identifiedSharePct: number;
    lapsingRepeatCustomers: number;
  };
  weekday: { averages: number[]; sampleDays: number[] };
  dataQuality: {
    productsMissingCostSold90: number;
    salesMissingPayment30: number;
    salesWithoutJournal30: number;
    ledgerInventoryDeltaPct: number | null;
    truncated: boolean;
  };
  typeSpecific: {
    expiring: {
      count: number;
      value: number;
      expiredCount: number;
      expiredValue: number;
      names: string[];
      nearestDays: number | null;
    };
    waste: { value30: number; valuePrev30: number };
    serialAging: { count: number; value: number };
    warrantyClaims: { open: number; stale: number };
    service: { overdue: number; unpaidCount: number; unpaidValue: number };
  };
}

export interface RuleFinding {
  ruleKey: string;
  fingerprint: string;
  category: InsightCategory;
  severity: Severity;
  confidence: Confidence;
  params: Record<string, ParamValue>;
  evidence: Record<string, unknown>;
  period: { from: string; to: string };
  impact: { low: number; high: number; label: "ESTIMATE"; basis: string } | null;
  missingData: string[];
  recommendation: {
    priority: 1 | 2 | 3;
    actionUrl: string;
    metricKey: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Metrics used to review recommendation outcomes (before/after, never causal)
// ---------------------------------------------------------------------------

export interface MetricDef {
  get: (s: AdvisorSnapshot) => number | null;
  /** direction considered an improvement */
  better: "UP" | "DOWN";
  kind: "money" | "pct" | "count";
}

export const METRICS: Record<string, MetricDef> = {
  netRevenue30: { get: (s) => s.last30.netRevenue, better: "UP", kind: "money" },
  grossMargin30: { get: (s) => s.last30.grossMarginPct, better: "UP", kind: "pct" },
  expenses30: { get: (s) => s.last30.operatingExpenses, better: "DOWN", kind: "money" },
  overdueReceivables: { get: (s) => s.receivables.overdueTotal, better: "DOWN", kind: "money" },
  overduePayables: { get: (s) => s.payables.overdueTotal, better: "DOWN", kind: "money" },
  slowMovingValue: { get: (s) => s.inventory.slowMovingValue, better: "DOWN", kind: "money" },
  excessValue: { get: (s) => s.inventory.excessValue, better: "DOWN", kind: "money" },
  stockoutRiskCount: { get: (s) => s.inventory.stockoutRisk.length + s.inventory.outOfStockSelling.length, better: "DOWN", kind: "count" },
  lowStockCount: { get: (s) => s.inventory.lowStock.length, better: "DOWN", kind: "count" },
  missingCostLines: { get: (s) => s.last30.linesMissingCost, better: "DOWN", kind: "count" },
  refundRate30: { get: (s) => s.refunds.rate30, better: "DOWN", kind: "pct" },
  discountRate30: { get: (s) => s.discounts.rate30, better: "DOWN", kind: "pct" },
  expiringValue: { get: (s) => s.typeSpecific.expiring.value + s.typeSpecific.expiring.expiredValue, better: "DOWN", kind: "money" },
  repeatRevenueShare: { get: (s) => s.customers.repeatRevenueSharePct, better: "UP", kind: "pct" },
};

export function metricValue(key: string | null | undefined, s: AdvisorSnapshot): number | null {
  if (!key) return null;
  const def = METRICS[key];
  return def ? def.get(s) : null;
}

// ---------------------------------------------------------------------------
// Rule definitions
// ---------------------------------------------------------------------------

interface RuleDef {
  key: string;
  requires?: ModuleRequirement[];
  run: (s: AdvisorSnapshot) => RuleFinding[];
}

const priorityOf = (sev: Severity): 1 | 2 | 3 => (sev === "CRITICAL" || sev === "HIGH" ? 1 : sev === "MEDIUM" ? 2 : 3);

function names(list: { name: string }[], n = 3): string {
  return list.slice(0, n).map((x) => x.name).join(", ");
}

function estimate(x: number, spread = 0.2): { low: number; high: number } {
  const v = Math.abs(x);
  return { low: round2(v * (1 - spread)), high: round2(v * (1 + spread)) };
}

function find(
  s: AdvisorSnapshot,
  f: {
    ruleKey: string;
    subject?: string;
    category: InsightCategory;
    severity: Severity;
    confidence: Confidence;
    params: Record<string, ParamValue>;
    evidence?: Record<string, unknown>;
    period?: { from: string; to: string };
    impact?: { low: number; high: number; basis: string } | null;
    missingData?: string[];
    actionUrl?: string;
    metricKey?: string | null;
    noRecommendation?: boolean;
  }
): RuleFinding {
  return {
    ruleKey: f.ruleKey,
    fingerprint: f.subject ? `${f.ruleKey}:${f.subject}` : f.ruleKey,
    category: f.category,
    severity: f.severity,
    confidence: f.confidence,
    params: f.params,
    evidence: f.evidence ?? {},
    period: f.period ?? s.ranges.last30,
    impact: f.impact ? { ...f.impact, label: "ESTIMATE" } : null,
    missingData: f.missingData ?? [],
    recommendation: f.noRecommendation
      ? null
      : {
          priority: priorityOf(f.severity),
          actionUrl: f.actionUrl ?? "/dashboard/business-advisor",
          metricKey: f.metricKey ?? null,
        },
  };
}

/** Confidence from how much comparable history exists. */
function historyConfidence(s: AdvisorSnapshot, minTxns: number, ...txns: number[]): Confidence {
  const days = s.historyDays ?? 0;
  const enoughTxns = txns.every((t) => t >= minTxns);
  if (days >= 60 && enoughTxns) return "HIGH";
  if (days >= s.thresholds.minHistoryDays && txns.every((t) => t >= Math.ceil(minTxns / 2))) return "MEDIUM";
  return "LOW";
}

const RULES: RuleDef[] = [
  // ------------------------------------------------------------------ sales & profit
  {
    key: "limited_history",
    run: (s) => {
      const d = s.historyDays;
      if (d !== null && d >= s.thresholds.minHistoryDays) return [];
      return [
        find(s, {
          ruleKey: "limited_history",
          category: "DATA_QUALITY",
          severity: "INFO",
          confidence: "HIGH",
          params: { days: d ?? 0, min: s.thresholds.minHistoryDays },
          missingData: ["history"],
          noRecommendation: true,
        }),
      ];
    },
  },
  {
    key: "revenue_decline",
    run: (s) => {
      const cur = s.last30.netRevenue;
      const prev = s.prev30.netRevenue;
      const pct = pctChange(cur, prev);
      if (pct === null || prev <= 0 || pct > -s.thresholds.revenueDeclinePct) return [];
      const conf = historyConfidence(s, 20, s.last30.transactions, s.prev30.transactions);
      const margin = s.prev30.grossMarginPct;
      const gap = prev - cur;
      const profitGap = margin !== null ? gap * (margin / 100) : null;
      return [
        find(s, {
          ruleKey: "revenue_decline",
          category: "SALES",
          severity: pct <= -25 ? "HIGH" : "MEDIUM",
          confidence: conf,
          params: { pct: Math.abs(pct), current: cur, previous: prev, gap: round2(gap) },
          evidence: { last30: s.last30.netRevenue, prev30: s.prev30.netRevenue, txns: [s.last30.transactions, s.prev30.transactions] },
          impact: profitGap !== null ? { ...estimate(profitGap), basis: "gross_profit_on_revenue_gap" } : null,
          missingData: margin === null ? ["costs"] : [],
          actionUrl: "/dashboard/reports",
          metricKey: "netRevenue30",
        }),
      ];
    },
  },
  {
    key: "margin_decline",
    run: (s) => {
      const cur = s.last30.grossMarginPct;
      const prev = s.prev30.grossMarginPct;
      if (cur === null || prev === null) return [];
      const drop = prev - cur;
      if (drop < s.thresholds.marginDropPoints) return [];
      return [
        find(s, {
          ruleKey: "margin_decline",
          category: "FINANCE",
          severity: drop >= s.thresholds.marginDropPoints * 2 ? "HIGH" : "MEDIUM",
          confidence: s.last30.grossStatus === "COMPLETE" && s.prev30.grossStatus === "COMPLETE" ? "HIGH" : "MEDIUM",
          params: { current: cur, previous: prev, drop: round2(drop) },
          impact: { ...estimate((s.last30.netRevenue * drop) / 100), basis: "margin_points_on_current_revenue" },
          missingData: s.last30.grossStatus !== "COMPLETE" ? ["costs"] : [],
          actionUrl: "/dashboard/products",
          metricKey: "grossMargin30",
        }),
      ];
    },
  },
  {
    key: "net_loss",
    run: (s) => {
      const m = s.mtd;
      if (m.netProfit === null || m.netProfit >= 0 || m.transactions < 5) return [];
      return [
        find(s, {
          ruleKey: "net_loss",
          category: "FINANCE",
          severity: "HIGH",
          confidence: m.netStatus === "COMPLETE" ? "HIGH" : "MEDIUM",
          period: s.ranges.mtd,
          params: { netProfit: m.netProfit, revenue: m.netRevenue, expenses: m.operatingExpenses, gross: m.grossProfit },
          missingData: m.netStatus !== "COMPLETE" ? ["expenses_or_costs"] : [],
          actionUrl: "/dashboard/expenses",
          metricKey: "expenses30",
        }),
      ];
    },
  },
  {
    key: "expense_spike",
    run: (s) => {
      const out: RuleFinding[] = [];
      const t = s.thresholds;
      const rows = [...s.expenses.byCategory]
        .map((c) => ({ ...c, delta: c.last30 - c.priorAvg, pct: c.priorAvg > 0 ? ((c.last30 - c.priorAvg) / c.priorAvg) * 100 : null }))
        .filter((c) => c.priorWindows >= 1 && c.pct !== null && c.pct >= t.expenseSpikePct && c.delta >= t.expenseMinAmount)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 3);
      for (const c of rows) {
        out.push(
          find(s, {
            ruleKey: "expense_spike",
            subject: c.name.toLowerCase(),
            category: "FINANCE",
            severity: c.pct! >= t.expenseSpikePct * 3 ? "HIGH" : "MEDIUM",
            confidence: c.priorWindows >= 3 ? "HIGH" : c.priorWindows === 2 ? "MEDIUM" : "LOW",
            params: { category: c.name, current: round2(c.last30), avg: round2(c.priorAvg), pct: round2(c.pct!), delta: round2(c.delta) },
            evidence: { priorWindows: c.priorWindows },
            impact: { ...estimate(c.delta, 0), basis: "increase_over_historical_average" },
            missingData: c.priorWindows < 3 ? ["history"] : [],
            actionUrl: "/dashboard/expenses",
            metricKey: "expenses30",
          })
        );
      }
      return out;
    },
  },
  {
    key: "low_margin_products",
    run: (s) => {
      const t = s.thresholds;
      const list = s.margins
        .filter((p) => p.costKnown && p.marginPct !== null && p.units >= t.minUnitsForMargin && p.marginPct >= 0 && p.marginPct < t.lowMarginPct)
        .sort((a, b) => b.revenue - a.revenue);
      if (!list.length) return [];
      const worst = [...list].sort((a, b) => (a.marginPct ?? 0) - (b.marginPct ?? 0))[0];
      return [
        find(s, {
          ruleKey: "low_margin_products",
          category: "FINANCE",
          severity: "MEDIUM",
          confidence: "HIGH",
          params: { count: list.length, names: names(list), threshold: t.lowMarginPct, worst: worst.name, worstPct: worst.marginPct },
          evidence: { products: list.slice(0, 10) },
          actionUrl: "/dashboard/products",
          metricKey: "grossMargin30",
        }),
      ];
    },
  },
  {
    key: "negative_margin_products",
    run: (s) => {
      const t = s.thresholds;
      const list = s.margins.filter((p) => p.costKnown && p.marginPct !== null && p.marginPct < 0 && p.units >= 1);
      if (!list.length) return [];
      const loss = list.reduce((a, p) => a + Math.abs(Math.min(0, p.profit)), 0);
      return [
        find(s, {
          ruleKey: "negative_margin_products",
          category: "FINANCE",
          severity: "HIGH",
          confidence: "HIGH",
          params: { count: list.length, names: names(list.sort((a, b) => a.profit - b.profit)), loss: round2(loss), min: t.minMarginForDiscountPct },
          evidence: { products: list.slice(0, 10) },
          impact: { ...estimate(loss, 0), basis: "recorded_loss_on_these_products" },
          actionUrl: "/dashboard/products",
          metricKey: "grossMargin30",
        }),
      ];
    },
  },
  {
    key: "discount_effectiveness",
    run: (s) => {
      const d = s.discountEffect;
      if (d.discountedLines < 5 || d.discountedMarginPct === null || d.regularMarginPct === null) return [];
      const gap = d.regularMarginPct - d.discountedMarginPct;
      if (!(d.discountedMarginPct < s.thresholds.lowMarginPct || gap >= 8)) return [];
      return [
        find(s, {
          ruleKey: "discount_effectiveness",
          category: "SALES",
          severity: d.discountedMarginPct < 0 ? "HIGH" : "MEDIUM",
          confidence: d.discountedLines >= 20 ? "MEDIUM" : "LOW",
          params: { discounted: d.discountedMarginPct, regular: d.regularMarginPct, share: d.discountedRevenueSharePct, lines: d.discountedLines },
          missingData: ["uplift"],
          actionUrl: "/dashboard/sales",
          metricKey: "discountRate30",
        }),
      ];
    },
  },
  {
    key: "unusual_discounts",
    run: (s) => {
      const r = s.discounts.rate30;
      if (r === null || s.discounts.transactions30 < 10) return [];
      const base = s.discounts.rateBaseline;
      const t = s.thresholds;
      const spike = base !== null && base > 0 && r >= base * t.discountBaselineMultiplier && r >= 2;
      if (!(r >= t.discountRatePct || spike)) return [];
      return [
        find(s, {
          ruleKey: "unusual_discounts",
          category: "SALES",
          severity: r >= t.discountRatePct * 2 ? "HIGH" : "MEDIUM",
          confidence: base === null ? "LOW" : "MEDIUM",
          params: { rate: r, baseline: base, amount: s.discounts.amount30, threshold: t.discountRatePct },
          impact: { ...estimate(base !== null ? (s.discounts.amount30 * Math.max(0, r - base)) / r : s.discounts.amount30 * 0.3, 0.3), basis: "discounts_above_baseline" },
          missingData: base === null ? ["baseline"] : [],
          actionUrl: "/dashboard/sales",
          metricKey: "discountRate30",
        }),
      ];
    },
  },
  {
    key: "refund_pattern",
    run: (s) => {
      const f = s.refunds;
      const t = s.thresholds;
      if (f.rate30 === null || f.count30 < 3) return [];
      const doubled = f.countBaseline > 0 && f.count30 >= f.countBaseline * 2;
      if (!(f.rate30 >= t.refundRatePct || doubled)) return [];
      return [
        find(s, {
          ruleKey: "refund_pattern",
          category: "SALES",
          severity: f.rate30 >= t.refundRatePct * 2 ? "HIGH" : "MEDIUM",
          confidence: f.count30 >= 8 ? "MEDIUM" : "LOW",
          params: { rate: f.rate30, count: f.count30, amount: f.value30, baselineCount: round2(f.countBaseline), topSharePct: f.topUserSharePct },
          impact: { ...estimate(f.value30, 0), basis: "refunded_value_in_period" },
          actionUrl: "/dashboard/sales",
          metricKey: "refundRate30",
        }),
      ];
    },
  },
  // ------------------------------------------------------------------ cash & credit
  {
    key: "overdue_receivables",
    run: (s) => {
      const r = s.receivables;
      if (r.overdueTotal <= 0) return [];
      const share = s.last30.netRevenue > 0 ? (r.overdueTotal / s.last30.netRevenue) * 100 : null;
      return [
        find(s, {
          ruleKey: "overdue_receivables",
          category: "FINANCE",
          severity: r.buckets.d61_plus > 0 || (share !== null && share >= 20) ? "HIGH" : "MEDIUM",
          confidence: "MEDIUM",
          params: {
            amount: r.overdueTotal,
            customers: r.overdueCustomers,
            names: r.top.filter((c) => c.overdueAmount > 0).slice(0, 3).map((c) => c.name).join(", "),
            oldestDays: r.top.reduce((m, c) => Math.max(m, c.oldestDays ?? 0), 0),
            pctRevenue: share === null ? null : round2(share),
            terms: r.termDays,
          },
          evidence: { buckets: r.buckets },
          impact: { ...estimate(r.overdueTotal, 0), basis: "outstanding_overdue_amount" },
          missingData: ["due_dates"],
          actionUrl: "/dashboard/customers",
          metricKey: "overdueReceivables",
        }),
      ];
    },
  },
  {
    key: "receivables_growth",
    run: (s) => {
      const net = s.receivablesNet30;
      const total = s.receivables.total;
      if (net === null || net <= 0 || total <= 0) return [];
      const prev = total - net;
      if (prev <= 0) return [];
      const pct = (net / prev) * 100;
      if (pct < s.thresholds.receivablesGrowthPct) return [];
      return [
        find(s, {
          ruleKey: "receivables_growth",
          category: "FINANCE",
          severity: "MEDIUM",
          confidence: "MEDIUM",
          params: { pct: round2(pct), net: round2(net), total },
          actionUrl: "/dashboard/customers",
          metricKey: "overdueReceivables",
        }),
      ];
    },
  },
  {
    key: "cash_shortage_risk",
    run: (s) => {
      const bal = s.cash.balance;
      if (bal === null) return [];
      const obligations = s.payables.overdueTotal + s.payables.dueNext14Total + s.cash.recurringDue;
      if (obligations <= 0 || bal >= obligations) return [];
      const gap = obligations - bal;
      return [
        find(s, {
          ruleKey: "cash_shortage_risk",
          category: "FINANCE",
          severity: bal <= 0 ? "CRITICAL" : "HIGH",
          confidence: "MEDIUM",
          params: { balance: bal, obligations: round2(obligations), gap: round2(gap), days: s.thresholds.cashHorizonDays },
          evidence: { overduePayables: s.payables.overdueTotal, dueNext14: s.payables.dueNext14Total, recurring: s.cash.recurringDue, receivables: s.receivables.total },
          impact: { ...estimate(gap, 0), basis: "recorded_obligations_exceed_cash" },
          missingData: ["expected_receipts", "other_commitments"],
          actionUrl: "/dashboard/purchases",
          metricKey: "overduePayables",
        }),
      ];
    },
  },
  // ------------------------------------------------------------------ inventory
  {
    key: "stockout_risk",
    run: (s) => {
      const inv = s.inventory;
      const list = [...inv.outOfStockSelling, ...inv.stockoutRisk];
      if (!list.length) return [];
      const first = list[0];
      return [
        find(s, {
          ruleKey: "stockout_risk",
          category: "INVENTORY",
          severity: inv.outOfStockSelling.length > 0 ? "HIGH" : "MEDIUM",
          confidence: (s.historyDays ?? 0) >= 30 ? "MEDIUM" : "LOW",
          params: {
            count: list.length,
            names: names(list),
            first: first.name,
            firstQty: first.suggestedReorderQty ?? null,
            firstCover: first.daysOfCover ?? null,
            lead: s.thresholds.leadDays,
          },
          evidence: { items: list.slice(0, 10) },
          missingData: ["supplier_lead_time"],
          actionUrl: "/dashboard/purchases/orders/new",
          metricKey: "stockoutRiskCount",
        }),
      ];
    },
  },
  {
    key: "low_stock_reorder",
    run: (s) => {
      const list = s.inventory.lowStock;
      if (!list.length) return [];
      return [
        find(s, {
          ruleKey: "low_stock_reorder",
          category: "INVENTORY",
          severity: "MEDIUM",
          confidence: "HIGH",
          params: { count: list.length, names: names(list) },
          evidence: { items: list },
          actionUrl: "/dashboard/inventory",
          metricKey: "lowStockCount",
        }),
      ];
    },
  },
  {
    key: "slow_moving_stock",
    run: (s) => {
      const inv = s.inventory;
      if (!inv.slowMoving.length || inv.slowMovingValue < s.thresholds.minFlagValue) return [];
      return [
        find(s, {
          ruleKey: "slow_moving_stock",
          category: "INVENTORY",
          severity: inv.valueAtCost > 0 && inv.slowMovingValue / inv.valueAtCost > 0.25 ? "HIGH" : "MEDIUM",
          confidence: "HIGH",
          params: { count: inv.slowMoving.length, value: inv.slowMovingValue, names: names(inv.slowMoving), days: s.thresholds.slowMovingDays, min: s.thresholds.minMarginForDiscountPct },
          evidence: { items: inv.slowMoving },
          impact: { ...estimate(inv.slowMovingValue, 0), basis: "stock_value_tied_up_at_cost" },
          missingData: inv.productsMissingCost > 0 ? ["costs"] : [],
          actionUrl: "/dashboard/inventory",
          metricKey: "slowMovingValue",
        }),
      ];
    },
  },
  {
    key: "excess_stock",
    run: (s) => {
      const inv = s.inventory;
      if (!inv.excess.length || inv.excessValue < s.thresholds.minFlagValue) return [];
      return [
        find(s, {
          ruleKey: "excess_stock",
          category: "INVENTORY",
          severity: "LOW",
          confidence: "MEDIUM",
          params: { count: inv.excess.length, value: inv.excessValue, names: names(inv.excess), cover: s.thresholds.excessCoverDays, min: s.thresholds.minMarginForDiscountPct },
          evidence: { items: inv.excess },
          impact: { ...estimate(inv.excessValue, 0), basis: "stock_value_above_target_cover" },
          missingData: ["seasonality"],
          actionUrl: "/dashboard/inventory",
          metricKey: "excessValue",
        }),
      ];
    },
  },
  {
    key: "slow_inventory_turnover",
    run: (s) => {
      const inv = s.inventory;
      if (inv.inventoryDays === null || inv.inventoryDays < s.thresholds.excessCoverDays * 1.5) return [];
      return [
        find(s, {
          ruleKey: "slow_inventory_turnover",
          category: "INVENTORY",
          severity: "LOW",
          confidence: s.last30.grossStatus === "COMPLETE" ? "MEDIUM" : "LOW",
          params: { days: inv.inventoryDays, turnover: inv.turnoverAnnualised },
          missingData: ["seasonality"],
          actionUrl: "/dashboard/inventory",
        }),
      ];
    },
  },
  // ------------------------------------------------------------------ data quality
  {
    key: "missing_costs",
    run: (s) => {
      const lines = s.last30.linesMissingCost;
      const products = s.dataQuality.productsMissingCostSold90;
      if (lines === 0 && products === 0) return [];
      return [
        find(s, {
          ruleKey: "missing_costs",
          category: "DATA_QUALITY",
          severity: s.last30.costCoveragePct < 90 ? "HIGH" : "MEDIUM",
          confidence: "HIGH",
          params: { products, lines, coverage: s.last30.costCoveragePct },
          missingData: ["costs"],
          actionUrl: "/dashboard/products",
          metricKey: "missingCostLines",
        }),
      ];
    },
  },
  {
    key: "incomplete_records",
    run: (s) => {
      const q = s.dataQuality;
      const bigDelta = q.ledgerInventoryDeltaPct !== null && Math.abs(q.ledgerInventoryDeltaPct) >= 20;
      if (q.salesMissingPayment30 === 0 && q.salesWithoutJournal30 === 0 && !bigDelta) return [];
      return [
        find(s, {
          ruleKey: "incomplete_records",
          category: "DATA_QUALITY",
          severity: q.salesWithoutJournal30 > 0 ? "MEDIUM" : "LOW",
          confidence: "HIGH",
          params: { noPayment: q.salesMissingPayment30, noJournal: q.salesWithoutJournal30, ledgerDelta: q.ledgerInventoryDeltaPct },
          missingData: ["records"],
          actionUrl: "/dashboard/accounting/journal",
        }),
      ];
    },
  },
  // ------------------------------------------------------------------ purchasing
  {
    key: "purchase_cost_increase",
    run: (s) => {
      const inc = s.purchaseCosts.increases;
      if (!inc.length) return [];
      const top = inc[0];
      return [
        find(s, {
          ruleKey: "purchase_cost_increase",
          category: "FINANCE",
          severity: top.pct >= s.thresholds.purchaseCostIncreasePct * 2 ? "HIGH" : "MEDIUM",
          confidence: "MEDIUM",
          params: { count: inc.length, names: names(inc), product: top.name, pct: top.pct, from: top.prevAvg, to: top.latest },
          evidence: { items: inc.slice(0, 10) },
          period: { from: s.ranges.last30.from, to: s.ranges.last30.to },
          missingData: ["selling_price_review"],
          actionUrl: "/dashboard/products",
          metricKey: "grossMargin30",
        }),
      ];
    },
  },
  {
    key: "supplier_price_gap",
    run: (s) => {
      const list = s.purchaseCosts.supplierComparisons;
      if (!list.length) return [];
      const top = list[0];
      return [
        find(s, {
          ruleKey: "supplier_price_gap",
          category: "FINANCE",
          severity: "LOW",
          confidence: "MEDIUM",
          params: {
            product: top.name,
            cheap: top.cheapest.supplier,
            cheapAvg: top.cheapest.avg,
            dear: top.priciest.supplier,
            dearAvg: top.priciest.avg,
            spread: top.spreadPct,
            count: list.length,
          },
          evidence: { items: list.slice(0, 10) },
          missingData: ["quality_delivery_terms"],
          actionUrl: "/dashboard/suppliers",
        }),
      ];
    },
  },
  // ------------------------------------------------------------------ customers & patterns
  {
    key: "retention_opportunity",
    run: (s) => {
      const c = s.customers;
      if (c.lapsingRepeatCustomers < 3 && !(c.identifiedCustomers >= 20 && c.repeatRevenueSharePct < 20)) return [];
      return [
        find(s, {
          ruleKey: "retention_opportunity",
          category: "CUSTOMERS",
          severity: "LOW",
          confidence: c.identifiedCustomers >= 20 ? "MEDIUM" : "LOW",
          params: { lapsing: c.lapsingRepeatCustomers, repeat: c.repeatCustomers, sharePct: c.repeatRevenueSharePct },
          missingData: c.identifiedSharePct < 50 ? ["unidentified_customers"] : [],
          period: { from: s.ranges.last30.from, to: s.ranges.last30.to },
          actionUrl: "/dashboard/marketing",
          metricKey: "repeatRevenueShare",
        }),
      ];
    },
  },
  {
    key: "weekday_pattern",
    run: (s) => {
      const w = s.weekday;
      if (w.sampleDays.some((n) => n < 4)) return [];
      let best = 0, worst = 0;
      w.averages.forEach((v, i) => {
        if (v > w.averages[best]) best = i;
        if (v < w.averages[worst]) worst = i;
      });
      if (w.averages[best] <= 0 || w.averages[best] < w.averages[worst] * 1.4) return [];
      return [
        find(s, {
          ruleKey: "weekday_pattern",
          category: "SALES",
          severity: "INFO",
          confidence: "MEDIUM",
          params: { bestDay: best, worstDay: worst, best: w.averages[best], worst: w.averages[worst] },
          missingData: ["promotions_holidays"],
          actionUrl: "/dashboard/reports",
        }),
      ];
    },
  },
  // ------------------------------------------------------------------ business-type specific
  {
    key: "expiring_stock",
    requires: ["batchTracking"],
    run: (s) => {
      const e = s.typeSpecific.expiring;
      if (e.count === 0 && e.expiredCount === 0) return [];
      return [
        find(s, {
          ruleKey: "expiring_stock",
          category: "INVENTORY",
          severity: e.expiredCount > 0 ? "HIGH" : "MEDIUM",
          confidence: "HIGH",
          params: { count: e.count, value: e.value, expired: e.expiredCount, expiredValue: e.expiredValue, days: s.thresholds.expiryWarningDays, names: e.names.join(", ") },
          impact: { ...estimate(e.value + e.expiredValue, 0), basis: "stock_value_at_cost_at_risk" },
          actionUrl: "/dashboard/inventory",
          metricKey: "expiringValue",
        }),
      ];
    },
  },
  {
    key: "waste_increase",
    requires: ["batchTracking"],
    run: (s) => {
      const w = s.typeSpecific.waste;
      const cogs = s.last30.cogs;
      if (w.value30 <= 0 || w.value30 < s.thresholds.minFlagValue) return [];
      const share = cogs > 0 ? (w.value30 / cogs) * 100 : null;
      const grew = w.valuePrev30 > 0 ? w.value30 >= w.valuePrev30 * 1.5 : true;
      if (!((share !== null && share >= s.thresholds.wasteSharePct) || (share === null && grew))) return [];
      return [
        find(s, {
          ruleKey: "waste_increase",
          category: "INVENTORY",
          severity: share !== null && share >= s.thresholds.wasteSharePct * 3 ? "HIGH" : "MEDIUM",
          confidence: "MEDIUM",
          params: { value: w.value30, prev: w.valuePrev30, pct: pctChange(w.value30, w.valuePrev30), sharePct: share === null ? null : round2(share) },
          impact: { ...estimate(w.value30, 0), basis: "recorded_write_offs_at_cost" },
          actionUrl: "/dashboard/inventory/movements",
          metricKey: "expiringValue",
        }),
      ];
    },
  },
  {
    key: "serial_aging",
    requires: ["serialTracking"],
    run: (s) => {
      const a = s.typeSpecific.serialAging;
      if (a.count === 0 || a.value < s.thresholds.minFlagValue) return [];
      return [
        find(s, {
          ruleKey: "serial_aging",
          category: "INVENTORY",
          severity: "MEDIUM",
          confidence: "MEDIUM",
          params: { count: a.count, value: a.value, days: s.thresholds.serialAgingDays },
          impact: { ...estimate(a.value, 0), basis: "device_stock_value_at_cost" },
          actionUrl: "/dashboard/inventory",
          metricKey: "slowMovingValue",
        }),
      ];
    },
  },
  {
    key: "warranty_claim_backlog",
    requires: ["warranty"],
    run: (s) => {
      const w = s.typeSpecific.warrantyClaims;
      if (w.stale === 0) return [];
      return [
        find(s, {
          ruleKey: "warranty_claim_backlog",
          category: "OPERATIONS",
          severity: w.stale >= 5 ? "HIGH" : "MEDIUM",
          confidence: "HIGH",
          params: { open: w.open, stale: w.stale, days: s.thresholds.claimStaleDays },
          actionUrl: "/dashboard/warranties",
        }),
      ];
    },
  },
  {
    key: "service_backlog",
    requires: ["service"],
    run: (s) => {
      const sv = s.typeSpecific.service;
      if (sv.overdue === 0 && sv.unpaidCount === 0) return [];
      return [
        find(s, {
          ruleKey: "service_backlog",
          category: "OPERATIONS",
          severity: sv.overdue >= 5 ? "HIGH" : "MEDIUM",
          confidence: "HIGH",
          params: { overdue: sv.overdue, days: s.thresholds.serviceOverdueDays, unpaid: sv.unpaidCount, unpaidValue: sv.unpaidValue },
          impact: sv.unpaidValue > 0 ? { ...estimate(sv.unpaidValue, 0), basis: "completed_unpaid_tickets" } : null,
          actionUrl: "/dashboard/service",
        }),
      ];
    },
  },
];

export interface RunRulesOptions {
  disabledRules?: string[];
}

export function runRules(s: AdvisorSnapshot, opts: RunRulesOptions = {}): RuleFinding[] {
  const disabled = new Set(opts.disabledRules ?? []);
  const out: RuleFinding[] = [];
  for (const rule of RULES) {
    if (disabled.has(rule.key)) continue;
    if (rule.requires?.some((m) => !s.modules[m])) continue;
    try {
      out.push(...rule.run(s));
    } catch (err) {
      // A faulty rule must never break the dashboard or the daily report.
      console.error(`[advisor] rule ${rule.key} failed`, err);
    }
  }
  const sevOrder: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  return out.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
}

export const RULE_KEYS = RULES.map((r) => r.key);

/** Used by the UI to explain which rules apply to this business. */
export function applicableRules(modules: ModuleFlags): { key: string; applicable: boolean; requires: ModuleRequirement[] }[] {
  return RULES.map((r) => ({
    key: r.key,
    requires: r.requires ?? [],
    applicable: !(r.requires ?? []).some((m) => !modules[m]),
  }));
}

/** Safe discount helper exposed for recommendation text (never suggest without cost). */
export function safeDiscountFor(price: number, cost: number, minMargin: number): number | null {
  return maxSafeDiscountPct(price, cost, minMargin);
}

export type { InsightCategory };
