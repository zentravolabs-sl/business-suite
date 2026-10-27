/**
 * Shared types for the Business Advisor module.
 *
 * The calculation layer works on plain numbers / plain objects so it can be unit-tested
 * without a database. The data layer (data.ts) is the only place that talks to Prisma.
 */

/** How trustworthy a calculated figure is. Never present INCOMPLETE/UNAVAILABLE as definitive. */
export type CalcStatus = "COMPLETE" | "ESTIMATED" | "INCOMPLETE" | "UNAVAILABLE";

export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type InsightCategory =
  | "FINANCE"
  | "SALES"
  | "INVENTORY"
  | "CUSTOMERS"
  | "DATA_QUALITY"
  | "OPERATIONS";

export interface DateRange {
  /** inclusive */
  start: Date;
  /** exclusive */
  end: Date;
}

// ---------------------------------------------------------------------------
// Plain transaction records (mapped from Prisma rows by data.ts)
// ---------------------------------------------------------------------------

export interface SaleItemRec {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** cost snapshot stored on the sale line (0 when unknown) */
  costPrice: number;
  /** current product cost, used only as a flagged fallback estimate */
  fallbackCost?: number;
  discountAmount: number;
  taxAmount: number;
  /** line total including tax */
  total: number;
}

export interface SaleRec {
  id: string;
  status: string;
  createdAt: Date;
  userId?: string | null;
  customerId?: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceCharge: number;
  /** grand total including tax */
  total: number;
  creditAmount: number;
  payments: { method: string; amount: number; status: string; createdAt?: Date }[];
  items: SaleItemRec[];
}

export interface RefundRec {
  id: string;
  saleId: string;
  createdAt: Date;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  paymentMethod: string;
  userId?: string | null;
  /** cost of goods returned to stock (only when the refund restocked inventory) */
  restockedCost: number;
}

export interface ExpenseRec {
  id: string;
  categoryName: string;
  amount: number;
  taxAmount: number;
  inputVatEligible: boolean;
  status: string; // PENDING | APPROVED | REJECTED | PAID
  expenseDate: Date;
}

// ---------------------------------------------------------------------------
// Calculation outputs
// ---------------------------------------------------------------------------

export interface Profitability {
  transactions: number;
  unitsSold: number;
  avgTicket: number;
  /** Net sales excluding output tax and before returns */
  grossSales: number;
  discounts: number;
  returns: number;
  /** grossSales - returns */
  netRevenue: number;
  /** Cost of goods sold net of restocked returns (includes flagged estimates) */
  cogs: number;
  costCoveragePct: number;
  /** share of line revenue whose cost came from the *current* product cost (estimate) */
  estimatedCostSharePct: number;
  linesMissingCost: number;
  revenueMissingCost: number;
  grossProfit: number | null;
  /** Gross profit on costed sales only (always available when there are costed sales) */
  grossProfitOnCosted: number;
  grossMarginPct: number | null;
  grossStatus: CalcStatus;
  operatingExpenses: number;
  pendingExpensesCount: number;
  pendingExpensesAmount: number;
  expenseStatus: "COMPLETE" | "ESTIMATED";
  netProfit: number | null;
  netMarginPct: number | null;
  netStatus: CalcStatus;
  noActivity: boolean;
  /** human readable reasons a figure is partial; localized by the UI via keys */
  notes: string[];
}

export interface CashFlow {
  inflow: { salesReceipts: number; creditCollections: number; total: number };
  outflow: { expenses: number; supplierPayments: number; refunds: number; total: number };
  net: number;
}

export interface ReceivableCustomer {
  customerId: string;
  name: string;
  balance: number;
  overdueAmount: number;
  oldestDays: number | null;
}

export interface ReceivablesSummary {
  total: number;
  customersWithBalance: number;
  overdueTotal: number;
  overdueCustomers: number;
  buckets: { current: number; d1_30: number; d31_60: number; d61_plus: number; undated: number };
  top: ReceivableCustomer[];
  /** how overdue was determined */
  termDays: number;
}

export interface PayablesSummary {
  total: number;
  count: number;
  overdueTotal: number;
  overdueCount: number;
  dueNext14Total: number;
  dueNext14Count: number;
}

export interface InventoryProductRow {
  productId: string;
  name: string;
  sku?: string | null;
  qtyOnHand: number;
  unitCost: number;
  retailPrice: number;
  reorderLevel: number;
  unitsSold30: number;
  unitsSold90: number;
  lastSoldAt: Date | null;
  createdAt: Date;
}

export interface InventoryItemFlag {
  productId: string;
  name: string;
  qty: number;
  value: number;
  reorderLevel?: number;
  daysOfCover?: number | null;
  velocityPerDay?: number;
  suggestedReorderQty?: number;
}

export interface InventorySummary {
  valueAtCost: number;
  valueAtRetail: number;
  units: number;
  productCount: number;
  productsMissingCost: number;
  lowStock: InventoryItemFlag[];
  outOfStockSelling: InventoryItemFlag[];
  slowMoving: InventoryItemFlag[];
  slowMovingValue: number;
  excess: InventoryItemFlag[];
  excessValue: number;
  stockoutRisk: InventoryItemFlag[];
  /** inventory days = value / (COGS per day) ; null when it cannot be computed */
  inventoryDays: number | null;
  /** annualised turnover = (COGS/period days*365)/inventory value */
  turnoverAnnualised: number | null;
}

export interface ProductMargin {
  productId: string;
  name: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
  costKnown: boolean;
}

export interface DailySeriesPoint {
  date: string; // local YYYY-MM-DD
  revenue: number;
  cogs: number;
  grossProfit: number | null;
  expenses: number;
  transactions: number;
  cashIn: number;
  cashOut: number;
}

export interface DailyReportData {
  reportDate: string; // YYYY-MM-DD
  kind: "DAILY" | "WEEKLY";
  timezone: string;
  currency: string;
  language: string;
  dataStatus: CalcStatus | "NO_ACTIVITY";
  today: Profitability;
  yesterday: Profitability | null;
  sameDayLastWeek: Profitability | null;
  thirtyDayDailyAverage: {
    netRevenue: number;
    grossProfit: number | null;
    transactions: number;
  } | null;
  mtd: {
    netRevenue: number;
    grossProfit: number | null;
    operatingExpenses: number;
    netProfit: number | null;
    transactions: number;
  };
  cashFlow: CashFlow;
  receivables: ReceivablesSummary;
  payables: PayablesSummary;
  inventory: {
    lowStockCount: number;
    outOfStockCount: number;
    stockoutRiskCount: number;
    slowMovingCount: number;
    slowMovingValue: number;
    excessValue: number;
    topStockoutRisks: InventoryItemFlag[];
  };
  topSelling: ProductMargin[];
  insights: Array<{
    ruleKey: string;
    category: string;
    severity: string;
    confidence: string;
    title: string;
    message: string;
    whyItMatters: string;
    nextSteps: string[];
    evidence?: unknown;
    params: Record<string, unknown>;
  }>;
  recommendations: Array<{
    ruleKey: string;
    priority: number;
    title: string;
    action: string;
    actionUrl?: string;
    params: Record<string, unknown>;
  }>;
  dataQuality: {
    costCoveragePct: number;
    linesMissingCost: number;
    revenueMissingCost: number;
    pendingExpensesCount: number;
    pendingExpensesAmount: number;
    notes: string[];
  };
  narrative: {
    headline: string;
    summary: string;
    bullets: string[];
  };
}
