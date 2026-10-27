/**
 * Pure helpers for finalized-document adjustments (credit / debit notes) and for
 * tamper-evidence hashing. No database, no I/O — fully unit-testable.
 */
import crypto from "crypto";
import Decimal from "decimal.js";
import { TaxError } from "./errors";
import type { TaxTreatment } from "./constants";
import type { TaxBreakdownRow } from "./engine";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type Dec = InstanceType<typeof D>;

/** JSON.stringify with recursively sorted keys (the replacer-array form drops nested keys). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** SHA-256 over the canonical form of the payload (stable regardless of key order). */
export function computeDocumentHash(payload: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export interface AmountSet {
  quantity: string | number;
  grossAmount: string | number;
  discountAmount: string | number;
  taxableValue: string | number;
  taxAmount: string | number;
  lineTotal: string | number;
}

export interface CreditedSoFar {
  quantity: string | number;
  grossAmount?: string | number;
  discountAmount?: string | number;
  taxableValue: string | number;
  taxAmount: string | number;
  lineTotal: string | number;
}

export interface CreditLineAmounts {
  quantity: string;
  grossAmount: string;
  discountAmount: string;
  taxableValue: string;
  taxAmount: string;
  lineTotal: string;
  /** True when this credit exhausts the original line. */
  exhaustsLine: boolean;
}

/**
 * Amounts for crediting `returnQty` units of an original invoice line.
 *
 *  - Uses the ORIGINAL line's historical rate/treatment (it is derived from the stored
 *    line amounts, never from current configuration).
 *  - Quantity can never exceed what has not yet been credited, so repeated partial
 *    refunds cannot over-credit the invoice.
 *  - The credit that exhausts the line takes the exact remainder, so the sum of all
 *    credit notes equals the original line to the cent (no rounding drift).
 */
export function computeCreditLine(
  parent: AmountSet,
  credited: CreditedSoFar,
  returnQty: string | number,
  dp = 2
): CreditLineAmounts {
  const origQty = new D(parent.quantity);
  const ret = new D(returnQty);
  const alreadyQty = new D(credited.quantity);
  const remainingQty = origQty.minus(alreadyQty);

  if (origQty.lte(0)) throw new TaxError("INVALID_QUANTITY", "Original line quantity is zero");
  if (ret.lte(0)) throw new TaxError("INVALID_QUANTITY", "Returned quantity must be greater than zero");
  if (ret.gt(remainingQty)) {
    throw new TaxError(
      "CREDIT_EXCEEDS_INVOICE",
      `Returned quantity ${ret.toString()} exceeds the remaining creditable quantity ${remainingQty.toString()}`
    );
  }

  const remaining = {
    gross: new D(parent.grossAmount).minus(credited.grossAmount ?? 0),
    discount: new D(parent.discountAmount).minus(credited.discountAmount ?? 0),
    taxable: new D(parent.taxableValue).minus(credited.taxableValue),
    tax: new D(parent.taxAmount).minus(credited.taxAmount),
  };

  const exhausts = ret.eq(remainingQty);
  const ratio = ret.div(origQty);
  const scale = (value: string | number, cap: Dec) => {
    const s = new D(value).times(ratio).toDecimalPlaces(dp);
    return Decimal.min(s, cap.isNegative() ? new D(0) : cap);
  };

  const gross = exhausts ? remaining.gross : scale(parent.grossAmount, remaining.gross);
  const discount = exhausts ? remaining.discount : scale(parent.discountAmount, remaining.discount);
  const taxable = exhausts ? remaining.taxable : scale(parent.taxableValue, remaining.taxable);
  const tax = exhausts ? remaining.tax : scale(parent.taxAmount, remaining.tax);

  return {
    quantity: ret.toString(),
    grossAmount: gross.toFixed(dp),
    discountAmount: discount.toFixed(dp),
    taxableValue: taxable.toFixed(dp),
    taxAmount: tax.toFixed(dp),
    lineTotal: taxable.plus(tax).toFixed(dp),
    exhaustsLine: exhausts,
  };
}

export interface SummarizableLine {
  treatment: TaxTreatment | string;
  ratePercent?: string | number;
  grossAmount: string | number;
  discountAmount: string | number;
  taxableValue: string | number;
  taxAmount: string | number;
  lineTotal: string | number;
}

export interface DocumentTotals {
  grossTotal: string;
  discountTotal: string;
  netValue: string;
  standardRatedValue: string;
  zeroRatedValue: string;
  exemptValue: string;
  outOfScopeValue: string;
  taxTotal: string;
  grandTotal: string;
}

/** Totals + per-(treatment, rate) breakdown for any set of stored document lines. */
export function summarizeDocumentLines(
  lines: SummarizableLine[],
  dp = 2
): { totals: DocumentTotals; breakdown: Omit<TaxBreakdownRow, "rateRef">[] } {
  const zero = () => new D(0);
  let gross = zero();
  let discount = zero();
  let net = zero();
  let tax = zero();
  const byTreatment: Record<string, Dec> = {
    STANDARD_RATED: zero(),
    ZERO_RATED: zero(),
    EXEMPT: zero(),
    OUT_OF_SCOPE: zero(),
  };
  const rows = new Map<string, { treatment: TaxTreatment; ratePercent: string; taxable: Dec; tax: Dec; count: number }>();

  for (const l of lines) {
    gross = gross.plus(l.grossAmount);
    discount = discount.plus(l.discountAmount);
    net = net.plus(l.taxableValue);
    tax = tax.plus(l.taxAmount);
    byTreatment[l.treatment] = (byTreatment[l.treatment] ?? zero()).plus(l.taxableValue);

    const rate = new D(l.ratePercent ?? 0).toString();
    const key = `${l.treatment}|${rate}`;
    const row = rows.get(key) ?? { treatment: l.treatment as TaxTreatment, ratePercent: rate, taxable: zero(), tax: zero(), count: 0 };
    row.taxable = row.taxable.plus(l.taxableValue);
    row.tax = row.tax.plus(l.taxAmount);
    row.count += 1;
    rows.set(key, row);
  }

  const order: Record<string, number> = { STANDARD_RATED: 0, ZERO_RATED: 1, EXEMPT: 2, OUT_OF_SCOPE: 3 };
  const breakdown = [...rows.values()]
    .map((r) => ({
      treatment: r.treatment,
      ratePercent: r.ratePercent,
      taxableValue: r.taxable.toFixed(dp),
      taxAmount: r.tax.toFixed(dp),
      grossValue: r.taxable.plus(r.tax).toFixed(dp),
      lineCount: r.count,
    }))
    .sort((a, b) => (order[a.treatment] ?? 9) - (order[b.treatment] ?? 9) || new D(b.ratePercent).comparedTo(a.ratePercent));

  return {
    totals: {
      grossTotal: gross.toFixed(dp),
      discountTotal: discount.toFixed(dp),
      netValue: net.toFixed(dp),
      standardRatedValue: byTreatment.STANDARD_RATED.toFixed(dp),
      zeroRatedValue: byTreatment.ZERO_RATED.toFixed(dp),
      exemptValue: byTreatment.EXEMPT.toFixed(dp),
      outOfScopeValue: byTreatment.OUT_OF_SCOPE.toFixed(dp),
      taxTotal: tax.toFixed(dp),
      grandTotal: net.plus(tax).toFixed(dp),
    },
    breakdown,
  };
}

/**
 * Splits a paid amount across several documents of one sale, in order, never allocating
 * more than a document's total. Returns the per-document paid amount (same order).
 */
export function allocatePayment(docTotals: (string | number)[], paid: string | number, dp = 2): string[] {
  let remaining = new D(paid);
  if (remaining.isNegative()) remaining = new D(0);
  return docTotals.map((t) => {
    const total = new D(t);
    const applied = Decimal.min(remaining, total);
    remaining = remaining.minus(applied);
    return applied.toFixed(dp);
  });
}

/**
 * Allocates `targetTotal` across `weights` using the largest-remainder method (Hamilton-Hare)
 * so that sum(allocated) === targetTotal exactly, to `dp` decimal places.
 * If totalWeight <= 0, distributes equally (or zeroes if targetTotal is 0).
 */
export function allocateProportionally(
  weights: (string | number)[],
  targetTotal: string | number,
  dp = 2
): string[] {
  const target = new D(targetTotal);
  if (weights.length === 0) return [];
  if (weights.length === 1) return [target.toFixed(dp)];

  const totalWeight = weights.reduce((acc: Dec, w) => acc.plus(new D(w).abs()), new D(0));
  const factor = new D(10).pow(dp);

  const safeWeights = totalWeight.isZero()
    ? weights.map(() => new D(1))
    : weights.map((w) => new D(w).abs());
  const effectiveTotalWeight = totalWeight.isZero() ? new D(weights.length) : totalWeight;

  const rawShares = safeWeights.map((w) => w.times(target).div(effectiveTotalWeight));
  const integerParts = rawShares.map((s) => s.times(factor).floor());
  const fractionalParts = rawShares.map((s, idx) => ({
    idx,
    remainder: s.times(factor).minus(integerParts[idx]),
  }));

  const targetCents = target.times(factor).round();
  const currentSumCents = integerParts.reduce((acc, c) => acc.plus(c), new D(0));
  const diffCents = targetCents.minus(currentSumCents).toNumber();

  fractionalParts.sort((a, b) => b.remainder.comparedTo(a.remainder));

  if (diffCents > 0) {
    for (let i = 0; i < diffCents; i++) {
      const idx = fractionalParts[i % fractionalParts.length].idx;
      integerParts[idx] = integerParts[idx].plus(1);
    }
  } else if (diffCents < 0) {
    fractionalParts.reverse();
    for (let i = 0; i < Math.abs(diffCents); i++) {
      const idx = fractionalParts[i % fractionalParts.length].idx;
      integerParts[idx] = integerParts[idx].minus(1);
    }
  }

  return integerParts.map((cents) => cents.div(factor).toFixed(dp));
}
