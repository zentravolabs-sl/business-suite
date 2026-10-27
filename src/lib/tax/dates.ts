/**
 * Business-calendar helpers (Asia/Colombo, UTC+05:30, no DST since 2006).
 *
 * Tax periods, report filters and printed dates must follow the Sri Lanka calendar,
 * NOT the server's UTC clock — otherwise a sale made at 01:00 on the 1st would be
 * reported in the previous day/month.
 */
import { BUSINESS_TIME_ZONE, getZonedParts } from "./numbering";

const COLOMBO_OFFSET = "+05:30";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD of an instant in the Sri Lanka calendar. */
export function formatBusinessDate(date: Date, timeZone: string = BUSINESS_TIME_ZONE): string {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** DD/MM/YYYY (the format printed on Sri Lankan invoices). */
export function formatBusinessDateDisplay(date: Date): string {
  const iso = formatBusinessDate(date);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export class DateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DateRangeError";
  }
}

/** Instant at 00:00:00.000 (Colombo) on the given YYYY-MM-DD. */
export function businessDayStart(dateStr: string): Date {
  if (!DATE_ONLY.test(dateStr)) throw new DateRangeError(`Invalid date "${dateStr}" (expected YYYY-MM-DD)`);
  const d = new Date(`${dateStr}T00:00:00.000${COLOMBO_OFFSET}`);
  if (Number.isNaN(d.getTime())) throw new DateRangeError(`Invalid date "${dateStr}"`);
  return d;
}

/** Instant at 23:59:59.999 (Colombo) on the given YYYY-MM-DD (inclusive end of day). */
export function businessDayEnd(dateStr: string): Date {
  const start = businessDayStart(dateStr);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export interface BusinessDateRange {
  start: Date | null;
  end: Date | null;
}

/** Converts `from`/`to` query strings (YYYY-MM-DD) to an inclusive instant range. */
export function parseBusinessDateRange(from?: string | null, to?: string | null): BusinessDateRange {
  const start = from ? businessDayStart(from) : null;
  const end = to ? businessDayEnd(to) : null;
  if (start && end && start.getTime() > end.getTime()) {
    throw new DateRangeError('"From" date cannot be after "To" date');
  }
  return { start, end };
}

/** Period label (YYYY-MM) of an instant in the Sri Lanka calendar. */
export function businessMonthKey(date: Date): string {
  return formatBusinessDate(date).slice(0, 7);
}

/** Quarter label (YYYY-Qn) of an instant in the Sri Lanka calendar. */
export function businessQuarterKey(date: Date): string {
  const { year, month } = getZonedParts(date);
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}
