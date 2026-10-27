/**
 * Advisor configuration: rule thresholds, business-type profiles and goal metric definitions.
 *
 * Effective thresholds = DEFAULTS ← business-type overrides ← the owner's saved overrides.
 * Nothing here is hardcoded to a single workflow: every threshold is editable in Advisor Settings.
 */

export interface Thresholds {
  /** expense category (or total) rise over the historical average that is flagged */
  expenseSpikePct: number;
  /** ignore expense changes smaller than this absolute amount */
  expenseMinAmount: number;
  /** revenue drop vs previous comparable period that is flagged */
  revenueDeclinePct: number;
  /** gross margin drop (percentage points) that is flagged */
  marginDropPoints: number;
  /** products below this gross margin % are "low margin" */
  lowMarginPct: number;
  /** minimum units sold before a product margin is evaluated */
  minUnitsForMargin: number;
  /** days after invoice date before a credit sale without a due date is overdue */
  receivableTermDays: number;
  /** receivables growth over 30 days that is flagged */
  receivablesGrowthPct: number;
  /** discounts as % of gross sales that is flagged */
  discountRatePct: number;
  /** flag when discount rate exceeds the 90 day baseline by this multiple */
  discountBaselineMultiplier: number;
  /** refunds as % of gross sales that is flagged */
  refundRatePct: number;
  /** supplier lead time for stock-out risk */
  leadDays: number;
  /** additional days of cover to order */
  bufferDays: number;
  /** no sales for this many days (max 90) → slow moving */
  slowMovingDays: number;
  /** days of cover above which stock is excess */
  excessCoverDays: number;
  /** ignore stock lines worth less than this */
  minFlagValue: number;
  /** purchase unit-cost rise that is flagged */
  purchaseCostIncreasePct: number;
  /** batches expiring within this many days are warned */
  expiryWarningDays: number;
  /** write-offs as % of COGS that is flagged */
  wasteSharePct: number;
  /** serial/IMEI units in stock longer than this are aged */
  serialAgingDays: number;
  /** open warranty claims older than this are stale */
  claimStaleDays: number;
  /** service tickets open longer than this are overdue */
  serviceOverdueDays: number;
  /** minimum margin % a discount must preserve */
  minMarginForDiscountPct: number;
  /** days of history required for high-confidence comparisons */
  minHistoryDays: number;
  /** cash obligations horizon */
  cashHorizonDays: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  expenseSpikePct: 30,
  expenseMinAmount: 2000,
  revenueDeclinePct: 10,
  marginDropPoints: 3,
  lowMarginPct: 10,
  minUnitsForMargin: 3,
  receivableTermDays: 30,
  receivablesGrowthPct: 20,
  discountRatePct: 8,
  discountBaselineMultiplier: 1.5,
  refundRatePct: 5,
  leadDays: 7,
  bufferDays: 7,
  slowMovingDays: 90,
  excessCoverDays: 120,
  minFlagValue: 1000,
  purchaseCostIncreasePct: 10,
  expiryWarningDays: 30,
  wasteSharePct: 2,
  serialAgingDays: 90,
  claimStaleDays: 14,
  serviceOverdueDays: 7,
  minMarginForDiscountPct: 15,
  minHistoryDays: 30,
  cashHorizonDays: 14,
};

export const THRESHOLD_LIMITS: Record<keyof Thresholds, [number, number]> = {
  expenseSpikePct: [5, 500],
  expenseMinAmount: [0, 100_000_000],
  revenueDeclinePct: [1, 90],
  marginDropPoints: [0.5, 50],
  lowMarginPct: [0, 60],
  minUnitsForMargin: [1, 1000],
  receivableTermDays: [0, 365],
  receivablesGrowthPct: [5, 500],
  discountRatePct: [1, 60],
  discountBaselineMultiplier: [1.1, 10],
  refundRatePct: [0.5, 50],
  leadDays: [1, 120],
  bufferDays: [0, 120],
  slowMovingDays: [14, 90],
  excessCoverDays: [14, 730],
  minFlagValue: [0, 100_000_000],
  purchaseCostIncreasePct: [1, 200],
  expiryWarningDays: [1, 365],
  wasteSharePct: [0.1, 50],
  serialAgingDays: [14, 730],
  claimStaleDays: [1, 180],
  serviceOverdueDays: [1, 90],
  minMarginForDiscountPct: [0, 80],
  minHistoryDays: [7, 365],
  cashHorizonDays: [3, 90],
};

export const THRESHOLD_KEYS = Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[];

/** Drops unknown keys / non-numbers and clamps to the allowed range. */
export function sanitizeThresholds(input: unknown): Partial<Thresholds> {
  const out: Partial<Thresholds> = {};
  if (!input || typeof input !== "object") return out;
  for (const key of THRESHOLD_KEYS) {
    const raw = (input as Record<string, unknown>)[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    const [lo, hi] = THRESHOLD_LIMITS[key];
    out[key] = Math.min(hi, Math.max(lo, n));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Business-type profiles
// ---------------------------------------------------------------------------

export type BusinessProfileKey =
  | "GROCERY"
  | "DEVICES"
  | "FASHION"
  | "SERVICE"
  | "PHARMACY"
  | "GENERAL_RETAIL";

export interface BusinessProfile {
  key: BusinessProfileKey;
  /** i18n keys (advisor namespace) describing what this type should watch */
  focus: string[];
  thresholds: Partial<Thresholds>;
}

export const BUSINESS_PROFILES: Record<BusinessProfileKey, BusinessProfile> = {
  GROCERY: {
    key: "GROCERY",
    focus: ["focus.expiry", "focus.waste", "focus.reorder", "focus.turnover"],
    thresholds: { slowMovingDays: 30, excessCoverDays: 45, expiryWarningDays: 14, leadDays: 3, bufferDays: 4, wasteSharePct: 1.5 },
  },
  PHARMACY: {
    key: "PHARMACY",
    focus: ["focus.expiry", "focus.batches", "focus.reorder", "focus.margins"],
    thresholds: { slowMovingDays: 60, excessCoverDays: 90, expiryWarningDays: 60, wasteSharePct: 1 },
  },
  DEVICES: {
    key: "DEVICES",
    focus: ["focus.serial", "focus.warranty", "focus.repairs", "focus.accessories"],
    thresholds: { slowMovingDays: 60, serialAgingDays: 60, lowMarginPct: 8 },
  },
  FASHION: {
    key: "FASHION",
    focus: ["focus.variants", "focus.seasonal", "focus.turnover", "focus.markdowns"],
    thresholds: { slowMovingDays: 60, excessCoverDays: 90 },
  },
  SERVICE: {
    key: "SERVICE",
    focus: ["focus.serviceRevenue", "focus.labour", "focus.appointments", "focus.invoices"],
    thresholds: { serviceOverdueDays: 5, receivableTermDays: 14 },
  },
  GENERAL_RETAIL: {
    key: "GENERAL_RETAIL",
    focus: ["focus.turnover", "focus.margins", "focus.suppliers", "focus.retention"],
    thresholds: {},
  },
};

export function profileForCategory(category: string | null | undefined): BusinessProfile {
  switch (category) {
    case "GROCERY":
    case "SUPERMARKET":
      return BUSINESS_PROFILES.GROCERY;
    case "PHARMACY":
      return BUSINESS_PROFILES.PHARMACY;
    case "ELECTRONICS":
    case "MOBILE_PHONES":
    case "COMPUTERS":
    case "APPLIANCES":
    case "SPARE_PARTS":
      return BUSINESS_PROFILES.DEVICES;
    case "FASHION":
    case "COSMETICS":
      return BUSINESS_PROFILES.FASHION;
    case "SERVICE_REPAIR":
      return BUSINESS_PROFILES.SERVICE;
    default:
      return BUSINESS_PROFILES.GENERAL_RETAIL;
  }
}

export function effectiveThresholds(category: string | null | undefined, overrides: unknown): Thresholds {
  return {
    ...DEFAULT_THRESHOLDS,
    ...profileForCategory(category).thresholds,
    ...sanitizeThresholds(overrides),
  };
}

// ---------------------------------------------------------------------------
// Module requirements used by rules
// ---------------------------------------------------------------------------

export interface ModuleFlags {
  warranty: boolean;
  service: boolean;
  ecommerce: boolean;
  loyalty: boolean;
  /** at least one active batch/expiry tracked product exists */
  batchTracking: boolean;
  /** at least one active serial/IMEI tracked product exists */
  serialTracking: boolean;
  /** at least one product has variants */
  variants: boolean;
}

export type ModuleRequirement = keyof ModuleFlags;

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export const GOAL_METRICS = [
  "DAILY_SALES",
  "MONTHLY_SALES",
  "MONTHLY_GROSS_PROFIT",
  "MONTHLY_EXPENSE_LIMIT",
  "MONTHLY_COLLECTIONS",
  "STOCK_TURNOVER",
  "REPEAT_CUSTOMER_SALES",
] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];

/** Goals where lower is better (progress = how much of the limit is used). */
export const LIMIT_GOALS: GoalMetric[] = ["MONTHLY_EXPENSE_LIMIT"];

export const REPORT_FREQUENCIES = ["DAILY", "WEEKDAYS", "WEEKLY"] as const;
export const CHANNELS = ["IN_APP", "EMAIL", "SMS", "WHATSAPP"] as const;
export type Channel = (typeof CHANNELS)[number];
