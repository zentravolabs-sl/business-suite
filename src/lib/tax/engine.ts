/**
 * TaxCalculationService — the single, centralized tax engine.
 *
 * Pure (no database, no React, no I/O) so it can run identically on the server
 * (POS / orders / purchases / credit notes) and in the browser (live POS preview),
 * and so it can be exhaustively unit-tested.
 *
 * Guarantees
 *  - Exact decimal arithmetic (decimal.js) — never IEEE-754 floats.
 *  - Supports STANDARD_RATED / ZERO_RATED / EXEMPT / OUT_OF_SCOPE supplies.
 *  - Tax-inclusive (tax is *extracted*) and tax-exclusive (tax is *added*) pricing,
 *    configurable per call and overridable per line.
 *  - Discounts (line level + invoice level) are applied BEFORE tax, i.e. tax is
 *    computed on the consideration actually charged.
 *  - Rounding is deterministic (default HALF_UP, 2dp) at LINE or INVOICE level.
 *    Invoice-level rounding is allocated back to lines with the largest-remainder
 *    method so that  Σ line tax == invoice tax  and  Σ line total == grand total
 *    ALWAYS hold exactly (no one-cent drift between the lines and the footer).
 *  - Rates are INPUTS (resolved from effective-dated configuration by the caller).
 *    No rate is hard-coded in this module.
 */
import Decimal from "decimal.js";
import type { RoundingLevel, TaxPricingMode, TaxTreatment } from "./constants";
import { TAX_RATE_MAX_PERCENT, isTaxTreatment } from "./constants";

// Isolated Decimal constructor: never mutate the global decimal.js configuration.
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type Dec = InstanceType<typeof D>;

export type Numeric = number | string | Dec;

export type RoundingMode = "HALF_UP" | "HALF_EVEN" | "UP" | "DOWN";

const ROUNDING_MAP: Record<RoundingMode, Decimal.Rounding> = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  UP: Decimal.ROUND_UP,
  DOWN: Decimal.ROUND_DOWN,
};

export class TaxCalculationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TaxCalculationError";
    this.code = code;
  }
}

export interface DiscountSpec {
  type: "FIXED" | "PERCENTAGE";
  value: Numeric;
}

export interface RateReference {
  taxRateId?: string | null;
  taxRateVersionId?: string | null;
  name?: string | null;
}

export interface TaxLineInput {
  /** Caller correlation id (e.g. sale item id / cart index). Returned untouched. */
  key?: string;
  description: string;
  quantity: Numeric;
  /** Price per unit exactly as entered/charged (basis depends on pricing mode). */
  unitPrice: Numeric;
  discount?: DiscountSpec | null;
  treatment: TaxTreatment;
  /** Percentage, e.g. 18 means 18%. Only used for STANDARD_RATED. */
  ratePercent?: Numeric;
  rateRef?: RateReference | null;
  /** Per-line override of the invoice pricing mode. */
  pricesIncludeTax?: boolean;
  /** Free-form data carried to the result (e.g. productId, sku, unit, overrideReason). */
  meta?: Record<string, unknown>;
}

export interface TaxCalculationOptions {
  pricingMode: TaxPricingMode;
  roundingLevel?: RoundingLevel;
  roundingMode?: RoundingMode;
  /** Decimal places for currency amounts. LKR = 2. */
  currencyDecimals?: number;
  /** Invoice-level discount, allocated pro-rata to lines BEFORE tax. */
  invoiceDiscount?: DiscountSpec | null;
}

export interface TaxLineResult {
  key?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  priceIncludesTax: boolean;
  treatment: TaxTreatment;
  ratePercent: string;
  rateRef: RateReference | null;
  /** quantity × unitPrice in the entered basis, before any discount. */
  grossAmount: string;
  lineDiscount: string;
  allocatedInvoiceDiscount: string;
  /** lineDiscount + allocatedInvoiceDiscount (entered basis). */
  discountTotal: string;
  /** Amount charged for the line (entered basis) after all discounts. */
  netEntered: string;
  /** Line value excluding tax BEFORE discounts (display only; derived). */
  listValueExclTax: string;
  /** listValueExclTax − taxableValue (so taxable = list − discount exactly). */
  discountExclTax: string;
  /** Value of supply excluding tax, after discounts. */
  taxableValue: string;
  taxAmount: string;
  /** taxableValue + taxAmount. */
  lineTotal: string;
  /** listValueExclTax ÷ quantity (display; 4dp to limit apparent drift). */
  unitPriceExclTax: string;
  meta?: Record<string, unknown>;
}

export interface TaxBreakdownRow {
  treatment: TaxTreatment;
  ratePercent: string;
  rateRef: RateReference | null;
  /** Value excluding tax. */
  taxableValue: string;
  taxAmount: string;
  /** Value including tax. */
  grossValue: string;
  lineCount: number;
}

export interface TaxTotals {
  /** Σ quantity × price before discounts (entered basis). */
  grossTotal: string;
  discountTotal: string;
  /** Σ taxable value of every line, all treatments (value excluding tax). */
  netValue: string;
  /** Standard-rated value excluding VAT. */
  standardRatedValue: string;
  zeroRatedValue: string;
  exemptValue: string;
  outOfScopeValue: string;
  /** Standard-rated + zero-rated value (the "taxable supplies"). */
  vatableValue: string;
  taxTotal: string;
  /** netValue + taxTotal. */
  grandTotal: string;
  roundingAdjustment: string;
}

export interface TaxCalculationResult {
  pricingMode: TaxPricingMode;
  roundingLevel: RoundingLevel;
  roundingMode: RoundingMode;
  currencyDecimals: number;
  lines: TaxLineResult[];
  breakdown: TaxBreakdownRow[];
  totals: TaxTotals;
}

const TREATMENT_ORDER: Record<TaxTreatment, number> = {
  STANDARD_RATED: 0,
  ZERO_RATED: 1,
  EXEMPT: 2,
  OUT_OF_SCOPE: 3,
};

function toDec(value: Numeric, field: string): Dec {
  let d: Dec;
  try {
    d = new D(value as never);
  } catch {
    throw new TaxCalculationError("INVALID_NUMBER", `${field} is not a valid number`);
  }
  if (!d.isFinite()) {
    throw new TaxCalculationError("INVALID_NUMBER", `${field} must be a finite number`);
  }
  return d;
}

function nonNegative(value: Numeric, field: string): Dec {
  const d = toDec(value, field);
  if (d.isNegative()) {
    throw new TaxCalculationError("NEGATIVE_VALUE", `${field} cannot be negative`);
  }
  return d;
}

/**
 * Distribute `targetCents` (a non-negative integer) across `raw` values (in major
 * units) so the allocated cents sum EXACTLY to the target, giving the extra cents to
 * the entries with the largest fractional remainder (ties → earliest index).
 */
function allocateByLargestRemainder(raw: Dec[], targetUnits: Dec, scale: number): Dec[] {
  const factor = new D(10).pow(scale);
  const floors = raw.map((r) => r.times(factor).floor());
  const target = targetUnits.times(factor).round();
  const floorSum = floors.reduce((a, b) => a.plus(b), new D(0));
  let remainder = target.minus(floorSum).toNumber();

  const order = raw
    .map((r, index) => ({ index, frac: r.times(factor).minus(floors[index]) }))
    .sort((a, b) => {
      const c = b.frac.comparedTo(a.frac);
      return c !== 0 ? c : a.index - b.index;
    });

  const out = floors.slice();
  // remainder may (theoretically) be negative only if the target was reduced externally.
  let i = 0;
  while (remainder > 0 && order.length > 0) {
    out[order[i % order.length].index] = out[order[i % order.length].index].plus(1);
    remainder -= 1;
    i += 1;
  }
  while (remainder < 0) {
    const idx = order[order.length - 1 - (i % order.length)].index;
    if (out[idx].gt(0)) {
      out[idx] = out[idx].minus(1);
      remainder += 1;
    }
    i += 1;
    if (i > order.length * 4) break;
  }
  return out.map((c) => c.div(factor));
}

function resolveDiscount(spec: DiscountSpec | null | undefined, base: Dec, field: string, rm: Decimal.Rounding, dp: number): Dec {
  if (!spec) return new D(0);
  const value = nonNegative(spec.value, `${field} value`);
  if (value.isZero() || base.isZero()) return new D(0);
  if (spec.type === "PERCENTAGE") {
    if (value.gt(100)) {
      throw new TaxCalculationError("INVALID_DISCOUNT", `${field} percentage cannot exceed 100`);
    }
    return base.times(value).div(100).toDecimalPlaces(dp, rm);
  }
  if (spec.type === "FIXED") {
    return Decimal.min(value.toDecimalPlaces(dp, rm), base);
  }
  throw new TaxCalculationError("INVALID_DISCOUNT", `${field} type must be FIXED or PERCENTAGE`);
}

const fmt = (d: Dec, dp: number) => d.toFixed(dp);

export class TaxCalculationService {
  /**
   * Calculate line-level and invoice-level tax.
   * Throws TaxCalculationError on invalid input and verifies reconciliation before returning.
   */
  static calculate(inputLines: TaxLineInput[], options: TaxCalculationOptions): TaxCalculationResult {
    const dp = options.currencyDecimals ?? 2;
    const roundingMode = options.roundingMode ?? "HALF_UP";
    const rm = ROUNDING_MAP[roundingMode];
    const roundingLevel: RoundingLevel = options.roundingLevel ?? "LINE";
    if (!Number.isInteger(dp) || dp < 0 || dp > 4) {
      throw new TaxCalculationError("INVALID_PRECISION", "currencyDecimals must be an integer between 0 and 4");
    }

    const round = (d: Dec) => d.toDecimalPlaces(dp, rm);

    // ── 1. Normalise & validate each line ───────────────────────────────────
    const prepared = inputLines.map((line, idx) => {
      const label = `Line ${idx + 1}`;
      if (!isTaxTreatment(line.treatment)) {
        throw new TaxCalculationError("INVALID_TREATMENT", `${label}: unknown tax treatment "${String(line.treatment)}"`);
      }
      const quantity = nonNegative(line.quantity, `${label} quantity`);
      const unitPrice = nonNegative(line.unitPrice, `${label} unit price`);

      let rate = new D(0);
      if (line.treatment === "STANDARD_RATED") {
        if (line.ratePercent === undefined || line.ratePercent === null) {
          throw new TaxCalculationError("MISSING_RATE", `${label}: a rate is required for standard-rated supplies`);
        }
        rate = nonNegative(line.ratePercent, `${label} tax rate`);
        if (rate.gt(TAX_RATE_MAX_PERCENT)) {
          throw new TaxCalculationError("INVALID_RATE", `${label}: tax rate cannot exceed ${TAX_RATE_MAX_PERCENT}%`);
        }
      }

      const inclusive = line.pricesIncludeTax ?? options.pricingMode === "TAX_INCLUSIVE";
      const gross = round(quantity.times(unitPrice));
      const lineDiscount = resolveDiscount(line.discount, gross, `${label} discount`, rm, dp);
      const afterLineDiscount = gross.minus(lineDiscount);

      return { line, quantity, unitPrice, rate, inclusive, gross, lineDiscount, afterLineDiscount };
    });

    // ── 2. Allocate invoice-level discount pro-rata (before tax) ────────────
    const discountableBase = prepared.reduce((a, p) => a.plus(p.afterLineDiscount), new D(0));
    const invoiceDiscountAmount = resolveDiscount(options.invoiceDiscount, discountableBase, "Invoice discount", rm, dp);

    let allocations: Dec[] = prepared.map(() => new D(0));
    if (invoiceDiscountAmount.gt(0) && discountableBase.gt(0)) {
      const raw = prepared.map((p) => invoiceDiscountAmount.times(p.afterLineDiscount).div(discountableBase));
      allocations = allocateByLargestRemainder(raw, invoiceDiscountAmount, dp);
      // Safety: an allocation can never exceed the line's remaining value.
      allocations = allocations.map((a, i) => Decimal.min(a, prepared[i].afterLineDiscount));
    }

    // ── 3. Raw (unrounded) tax per line ─────────────────────────────────────
    const work = prepared.map((p, i) => {
      const net = p.afterLineDiscount.minus(allocations[i]);
      const hundred = new D(100);
      let taxRaw: Dec;
      if (p.rate.isZero()) {
        taxRaw = new D(0);
      } else if (p.inclusive) {
        taxRaw = net.times(p.rate).div(hundred.plus(p.rate));
      } else {
        taxRaw = net.times(p.rate).div(hundred);
      }
      return { ...p, allocation: allocations[i], net, taxRaw, tax: new D(0) };
    });

    // ── 4. Rounding ─────────────────────────────────────────────────────────
    if (roundingLevel === "LINE") {
      for (const w of work) w.tax = round(w.taxRaw);
    } else {
      // Invoice level: round once per (treatment, rate) bucket, then allocate to lines.
      const buckets = new Map<string, number[]>();
      work.forEach((w, i) => {
        const key = `${w.line.treatment}|${w.rate.toString()}`;
        const arr = buckets.get(key) ?? [];
        arr.push(i);
        buckets.set(key, arr);
      });
      for (const indexes of buckets.values()) {
        const rawSum = indexes.reduce((a, i) => a.plus(work[i].taxRaw), new D(0));
        const bucketTax = round(rawSum);
        const alloc = allocateByLargestRemainder(
          indexes.map((i) => work[i].taxRaw),
          bucketTax,
          dp
        );
        indexes.forEach((lineIdx, k) => {
          work[lineIdx].tax = alloc[k];
        });
      }
    }

    // ── 5. Derive line results ──────────────────────────────────────────────
    const lines: TaxLineResult[] = work.map((w) => {
      // Tax can never exceed the amount charged (guards pathological rounding on tiny amounts).
      const tax = Decimal.min(w.tax, w.net);
      const taxable = w.inclusive ? w.net.minus(tax) : w.net;
      const total = taxable.plus(tax);

      // Display-only list value excluding tax (before discounts); taxable is authoritative.
      const listValueExclTaxRaw = w.inclusive
        ? w.gross.times(100).div(new D(100).plus(w.rate))
        : w.gross;
      let listValueExclTax = round(listValueExclTaxRaw);
      if (listValueExclTax.lt(taxable)) listValueExclTax = taxable;
      const discountExclTax = listValueExclTax.minus(taxable);
      const unitPriceExclTax = w.quantity.isZero()
        ? new D(0)
        : listValueExclTax.div(w.quantity).toDecimalPlaces(4, rm);

      return {
        key: w.line.key,
        description: w.line.description,
        quantity: w.quantity.toString(),
        unitPrice: fmt(w.unitPrice, dp),
        priceIncludesTax: w.inclusive,
        treatment: w.line.treatment,
        ratePercent: w.rate.toString(),
        rateRef: w.line.rateRef ?? null,
        grossAmount: fmt(w.gross, dp),
        lineDiscount: fmt(w.lineDiscount, dp),
        allocatedInvoiceDiscount: fmt(w.allocation, dp),
        discountTotal: fmt(w.lineDiscount.plus(w.allocation), dp),
        netEntered: fmt(w.net, dp),
        listValueExclTax: fmt(listValueExclTax, dp),
        discountExclTax: fmt(discountExclTax, dp),
        taxableValue: fmt(taxable, dp),
        taxAmount: fmt(tax, dp),
        lineTotal: fmt(total, dp),
        unitPriceExclTax: unitPriceExclTax.toFixed(4),
        meta: w.line.meta,
      };
    });

    // ── 6. Breakdown + totals ───────────────────────────────────────────────
    const { breakdown, totals } = summarizeLines(lines, dp);

    const result: TaxCalculationResult = {
      pricingMode: options.pricingMode,
      roundingLevel,
      roundingMode,
      currencyDecimals: dp,
      lines,
      breakdown,
      totals,
    };

    const violations = TaxCalculationService.verify(result);
    if (violations.length > 0) {
      throw new TaxCalculationError("RECONCILIATION_FAILED", violations.join("; "));
    }
    return result;
  }

  /**
   * Re-verify an already computed result (also used on stored documents before PDF/export).
   * Returns a list of human-readable violations; empty list == fully reconciled.
   */
  static verify(result: TaxCalculationResult): string[] {
    const v: string[] = [];
    const sum = (vals: string[]) => vals.reduce((a, x) => a.plus(x), new D(0));

    const lineTotalSum = sum(result.lines.map((l) => l.lineTotal));
    const lineTaxSum = sum(result.lines.map((l) => l.taxAmount));
    const lineTaxableSum = sum(result.lines.map((l) => l.taxableValue));

    if (!lineTotalSum.eq(result.totals.grandTotal)) {
      v.push(`Σ line totals (${lineTotalSum}) ≠ grand total (${result.totals.grandTotal})`);
    }
    if (!lineTaxSum.eq(result.totals.taxTotal)) {
      v.push(`Σ line tax (${lineTaxSum}) ≠ tax total (${result.totals.taxTotal})`);
    }
    if (!lineTaxableSum.eq(result.totals.netValue)) {
      v.push(`Σ taxable value (${lineTaxableSum}) ≠ net value (${result.totals.netValue})`);
    }
    if (!new D(result.totals.netValue).plus(result.totals.taxTotal).eq(result.totals.grandTotal)) {
      v.push("net value + tax ≠ grand total");
    }
    const bucketTax = sum(result.breakdown.map((b) => b.taxAmount));
    if (!bucketTax.eq(result.totals.taxTotal)) {
      v.push(`Σ breakdown tax (${bucketTax}) ≠ tax total (${result.totals.taxTotal})`);
    }
    const bucketGross = sum(result.breakdown.map((b) => b.grossValue));
    if (!bucketGross.eq(result.totals.grandTotal)) {
      v.push(`Σ breakdown value (${bucketGross}) ≠ grand total (${result.totals.grandTotal})`);
    }
    const treatmentSum = sum([
      result.totals.standardRatedValue,
      result.totals.zeroRatedValue,
      result.totals.exemptValue,
      result.totals.outOfScopeValue,
    ]);
    if (!treatmentSum.eq(result.totals.netValue)) {
      v.push("Σ treatment values ≠ net value");
    }
    // gross − discount must equal the amount charged on every line (entered basis).
    for (const l of result.lines) {
      const charged = new D(l.grossAmount).minus(l.discountTotal);
      if (!charged.eq(l.netEntered)) {
        v.push(`Line "${l.description}": gross − discount ≠ net charged`);
      }
      if (new D(l.taxableValue).plus(l.taxAmount).comparedTo(l.lineTotal) !== 0) {
        v.push(`Line "${l.description}": taxable + tax ≠ line total`);
      }
      if (l.priceIncludesTax && !new D(l.lineTotal).eq(l.netEntered)) {
        v.push(`Line "${l.description}": tax-inclusive line total ≠ entered price`);
      }
      if (l.treatment !== "STANDARD_RATED" && !new D(l.taxAmount).isZero()) {
        v.push(`Line "${l.description}": non-standard-rated supply carries tax`);
      }
    }
    return v;
  }

  /** Extract the tax component from a tax-inclusive amount. */
  static extractTax(
    inclusiveAmount: Numeric,
    ratePercent: Numeric,
    opts: { currencyDecimals?: number; roundingMode?: RoundingMode } = {}
  ): { taxable: string; tax: string; total: string } {
    const dp = opts.currencyDecimals ?? 2;
    const rm = ROUNDING_MAP[opts.roundingMode ?? "HALF_UP"];
    const amount = nonNegative(inclusiveAmount, "amount");
    const rate = nonNegative(ratePercent, "rate");
    const tax = amount.times(rate).div(new D(100).plus(rate)).toDecimalPlaces(dp, rm);
    return { taxable: fmt(amount.minus(tax), dp), tax: fmt(tax, dp), total: fmt(amount, dp) };
  }

  /** Add tax to a tax-exclusive amount. */
  static addTax(
    exclusiveAmount: Numeric,
    ratePercent: Numeric,
    opts: { currencyDecimals?: number; roundingMode?: RoundingMode } = {}
  ): { taxable: string; tax: string; total: string } {
    const dp = opts.currencyDecimals ?? 2;
    const rm = ROUNDING_MAP[opts.roundingMode ?? "HALF_UP"];
    const amount = nonNegative(exclusiveAmount, "amount");
    const rate = nonNegative(ratePercent, "rate");
    const tax = amount.times(rate).div(100).toDecimalPlaces(dp, rm);
    return { taxable: fmt(amount, dp), tax: fmt(tax, dp), total: fmt(amount.plus(tax), dp) };
  }

  /** Exact decimal helpers exposed for services that must add/compare stored amounts. */
  static decimal(value: Numeric): Dec {
    return toDec(value, "value");
  }
}

/**
 * Proportionally split an already-computed result's line values for a partial
 * credit/debit note (e.g. returning 1 of 3 units). Returns lines scaled by `ratio`
 * of the ORIGINAL line, using the original's historical rate and treatment —
 * never the current configuration.
 */
export function scaleLineForPartial(
  original: Pick<TaxLineResult, "taxableValue" | "taxAmount" | "lineTotal" | "quantity" | "discountTotal" | "grossAmount" | "netEntered" | "priceIncludesTax" | "listValueExclTax" | "discountExclTax">,
  returnedQuantity: Numeric,
  dp = 2,
  roundingMode: RoundingMode = "HALF_UP"
): { taxableValue: string; taxAmount: string; lineTotal: string; grossAmount: string; discountTotal: string; netEntered: string; listValueExclTax: string; discountExclTax: string; ratio: string } {
  const qty = new D(original.quantity);
  const ret = nonNegative(returnedQuantity, "returned quantity");
  if (qty.isZero()) throw new TaxCalculationError("INVALID_QUANTITY", "Original quantity is zero");
  if (ret.gt(qty)) throw new TaxCalculationError("RETURN_EXCEEDS_ORIGINAL", "Returned quantity exceeds the original quantity");
  const rm = ROUNDING_MAP[roundingMode];
  const ratio = ret.div(qty);
  // Full return → exact original figures (no rounding drift).
  if (ret.eq(qty)) {
    return {
      taxableValue: original.taxableValue,
      taxAmount: original.taxAmount,
      lineTotal: original.lineTotal,
      grossAmount: original.grossAmount,
      discountTotal: original.discountTotal,
      netEntered: original.netEntered,
      listValueExclTax: original.listValueExclTax,
      discountExclTax: original.discountExclTax,
      ratio: ratio.toString(),
    };
  }
  const scale = (value: string) => new D(value).times(ratio).toDecimalPlaces(dp, rm);
  const tax = scale(original.taxAmount);
  const taxable = scale(original.taxableValue);
  const list = Decimal.max(scale(original.listValueExclTax), taxable);
  return {
    taxableValue: fmt(taxable, dp),
    taxAmount: fmt(tax, dp),
    lineTotal: fmt(taxable.plus(tax), dp),
    grossAmount: fmt(scale(original.grossAmount), dp),
    discountTotal: fmt(scale(original.discountTotal), dp),
    netEntered: fmt(original.priceIncludesTax ? taxable.plus(tax) : taxable, dp),
    listValueExclTax: fmt(list, dp),
    discountExclTax: fmt(list.minus(taxable), dp),
    ratio: ratio.toString(),
  };
}

/**
 * Build the tax breakdown (per treatment/rate bucket) and totals for any set of
 * already-calculated lines. Used by calculate() and by the document planner when
 * one sale is split into several documents.
 */
export function summarizeLines(
  lines: TaxLineResult[],
  dp = 2
): { breakdown: TaxBreakdownRow[]; totals: TaxTotals } {
  const breakdownMap = new Map<string, { row: TaxBreakdownRow; taxable: Dec; tax: Dec }>();
  for (const l of lines) {
    const key = `${l.treatment}|${l.ratePercent}`;
    const entry = breakdownMap.get(key) ?? {
      row: {
        treatment: l.treatment,
        ratePercent: l.ratePercent,
        rateRef: l.rateRef,
        taxableValue: "0",
        taxAmount: "0",
        grossValue: "0",
        lineCount: 0,
      },
      taxable: new D(0),
      tax: new D(0),
    };
    entry.taxable = entry.taxable.plus(l.taxableValue);
    entry.tax = entry.tax.plus(l.taxAmount);
    entry.row.lineCount += 1;
    breakdownMap.set(key, entry);
  }
  const breakdown: TaxBreakdownRow[] = [...breakdownMap.values()]
    .map(({ row, taxable, tax }) => ({
      ...row,
      taxableValue: fmt(taxable, dp),
      taxAmount: fmt(tax, dp),
      grossValue: fmt(taxable.plus(tax), dp),
    }))
    .sort((a, b) => {
      const t = TREATMENT_ORDER[a.treatment] - TREATMENT_ORDER[b.treatment];
      return t !== 0 ? t : new D(b.ratePercent).comparedTo(a.ratePercent);
    });

  const sum = (pick: (l: TaxLineResult) => string, filter?: (l: TaxLineResult) => boolean) =>
    lines.filter((l) => (filter ? filter(l) : true)).reduce((a, l) => a.plus(pick(l)), new D(0));

  const netValue = sum((l) => l.taxableValue);
  const taxTotal = sum((l) => l.taxAmount);
  const standardRatedValue = sum((l) => l.taxableValue, (l) => l.treatment === "STANDARD_RATED");
  const zeroRatedValue = sum((l) => l.taxableValue, (l) => l.treatment === "ZERO_RATED");

  const totals: TaxTotals = {
    grossTotal: fmt(sum((l) => l.grossAmount), dp),
    discountTotal: fmt(sum((l) => l.discountTotal), dp),
    netValue: fmt(netValue, dp),
    standardRatedValue: fmt(standardRatedValue, dp),
    zeroRatedValue: fmt(zeroRatedValue, dp),
    exemptValue: fmt(sum((l) => l.taxableValue, (l) => l.treatment === "EXEMPT"), dp),
    outOfScopeValue: fmt(sum((l) => l.taxableValue, (l) => l.treatment === "OUT_OF_SCOPE"), dp),
    vatableValue: fmt(standardRatedValue.plus(zeroRatedValue), dp),
    taxTotal: fmt(taxTotal, dp),
    grandTotal: fmt(netValue.plus(taxTotal), dp),
    roundingAdjustment: fmt(new D(0), dp),
  };
  return { breakdown, totals };
}

export const money = {
  /** Round a numeric value to currency precision, returning a fixed-decimals string. */
  fixed(value: Numeric, dp = 2): string {
    return toDec(value, "value").toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toFixed(dp);
  },
  add(a: Numeric, b: Numeric, dp = 2): string {
    return toDec(a, "a").plus(toDec(b, "b")).toFixed(dp);
  },
  sub(a: Numeric, b: Numeric, dp = 2): string {
    return toDec(a, "a").minus(toDec(b, "b")).toFixed(dp);
  },
  sum(values: Numeric[], dp = 2): string {
    return values.reduce<Dec>((acc, v) => acc.plus(toDec(v, "value")), new D(0)).toFixed(dp);
  },
  toNumber(value: Numeric): number {
    return toDec(value, "value").toNumber();
  },
  gt(a: Numeric, b: Numeric): boolean {
    return toDec(a, "a").gt(toDec(b, "b"));
  },
  eq(a: Numeric, b: Numeric): boolean {
    return toDec(a, "a").eq(toDec(b, "b"));
  },
  isZero(a: Numeric): boolean {
    return toDec(a, "a").isZero();
  },
  min(a: Numeric, b: Numeric, dp = 2): string {
    return Decimal.min(toDec(a, "a"), toDec(b, "b")).toFixed(dp);
  },
};
