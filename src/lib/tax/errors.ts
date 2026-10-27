/**
 * Domain error carrying an HTTP-friendly status so route handlers can return a precise
 * message to the cashier/accountant instead of a generic 500.
 */
export class TaxError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 422, details?: unknown) {
    super(message);
    this.name = "TaxError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isTaxError(err: unknown): err is TaxError {
  return err instanceof TaxError;
}

/** Maps any thrown value to `{ status, body }` for a JSON route response. */
export function toErrorResponse(err: unknown): { status: number; body: { error: string; code?: string; details?: unknown } } {
  if (isTaxError(err)) {
    return { status: err.status, body: { error: err.message, code: err.code, details: err.details } };
  }
  // Calculation / numbering errors from the pure modules expose a `code` too.
  const maybe = err as { name?: string; code?: unknown; message?: string };
  if (
    maybe &&
    typeof maybe.code === "string" &&
    (maybe.name === "TaxCalculationError" || maybe.name === "NumberingError" || maybe.name === "RateResolutionError")
  ) {
    return { status: 422, body: { error: maybe.message ?? "Tax calculation error", code: maybe.code } };
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return { status: 500, body: { error: message } };
}
