/**
 * Timezone helpers. Everything the advisor schedules or buckets by "day" must use the
 * business's configured timezone, never the server's. Pure functions, no dependencies.
 */

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) if (isValidTimezone(c)) return c;
  return "Asia/Colombo";
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function localParts(date: Date, tz: string): LocalParts {
  const parts = dtf(tz).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** YYYY-MM-DD of `date` as seen in `tz`. */
export function localDateString(date: Date, tz: string): string {
  const p = localParts(date, tz);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes since local midnight in `tz`. */
export function localMinutesOfDay(date: Date, tz: string): number {
  const p = localParts(date, tz);
  return p.hour * 60 + p.minute;
}

export function parseHHmm(value: string | null | undefined, fallback = "18:00"): { h: number; m: number } {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((value ?? "").trim());
  const v = match ? value!.trim() : fallback;
  const [h, m] = v.split(":").map(Number);
  return { h, m };
}

/** Shift a YYYY-MM-DD string by `n` calendar days (timezone independent). */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Day of week (0 = Sunday) of a YYYY-MM-DD calendar date. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(fromDate: string, toDate: string): number {
  const [y1, m1, d1] = fromDate.split("-").map(Number);
  const [y2, m2, d2] = toDate.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export function firstOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export function daysInMonth(dateStr: string): number {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function firstOfPreviousMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 2, 1));
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-01`;
}

/**
 * Offset (ms) of `tz` from UTC at the instant `utc`. Positive for zones ahead of UTC.
 */
function offsetMs(utc: Date, tz: string): number {
  const p = localParts(utc, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utc.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in `tz` to the matching UTC instant (DST safe, two-pass). */
export function zonedTimeToUtc(dateStr: string, hhmm: string, tz: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const { h, m } = parseHHmm(hhmm, "00:00");
  const naive = Date.UTC(y, mo - 1, d, h, m, 0);
  let guess = new Date(naive - offsetMs(new Date(naive), tz));
  guess = new Date(naive - offsetMs(guess, tz));
  return guess;
}

/** [start, end) UTC instants covering the local calendar day `dateStr` in `tz`. */
export function dayBounds(dateStr: string, tz: string): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(dateStr, "00:00", tz),
    end: zonedTimeToUtc(addDays(dateStr, 1), "00:00", tz),
  };
}

/** [start, end) covering local dates [fromDate .. toDate] inclusive. */
export function rangeBounds(fromDate: string, toDate: string, tz: string): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(fromDate, "00:00", tz),
    end: zonedTimeToUtc(addDays(toDate, 1), "00:00", tz),
  };
}
