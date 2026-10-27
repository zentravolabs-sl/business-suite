/**
 * Effective-dated tax-rate resolution (pure).
 *
 * A TaxRate (e.g. "Standard VAT") owns many versions, each with a percentage and an
 * [effectiveFrom, effectiveTo) window. Nothing here knows a specific percentage.
 * The version that applied at the *supply date* is resolved, and its id + percentage
 * are copied onto the document line so the historical figure never changes.
 */
export interface RateVersionLike {
  id: string;
  taxRateId: string;
  ratePercent: string | number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive?: boolean;
}

export class RateResolutionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RateResolutionError";
    this.code = code;
  }
}

/** Latest-starting active version whose window contains `at`. */
export function resolveRateVersion<T extends RateVersionLike>(versions: T[], at: Date): T | null {
  const t = at.getTime();
  const candidates = versions
    .filter((v) => v.isActive !== false)
    .filter((v) => v.effectiveFrom.getTime() <= t && (!v.effectiveTo || t < v.effectiveTo.getTime()))
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return candidates[0] ?? null;
}

/** Detects overlapping windows for one rate (used when saving a new version). */
export function findOverlap<T extends Pick<RateVersionLike, "id" | "effectiveFrom" | "effectiveTo">>(
  existing: T[],
  candidate: Pick<RateVersionLike, "id" | "effectiveFrom" | "effectiveTo">
): T | null {
  const cStart = candidate.effectiveFrom.getTime();
  const cEnd = candidate.effectiveTo ? candidate.effectiveTo.getTime() : Number.POSITIVE_INFINITY;
  for (const v of existing) {
    if (v.id === candidate.id) continue;
    const vStart = v.effectiveFrom.getTime();
    const vEnd = v.effectiveTo ? v.effectiveTo.getTime() : Number.POSITIVE_INFINITY;
    if (cStart < vEnd && vStart < cEnd) return v;
  }
  return null;
}
