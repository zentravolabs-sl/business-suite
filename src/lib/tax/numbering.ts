/**
 * Tax invoice serial numbering — pure formatting / parsing / validation.
 *
 * Format:  YYMMM_QQQQ_XXXXX
 *   YY    two-digit year          (Asia/Colombo calendar, not UTC)
 *   MMM   upper-case month abbr.  (JAN … DEC)
 *   QQQQ  classification / branch code (alphanumeric, upper-case)
 *   XXXXX sequential number, zero-padded to ≥ 5 digits
 * Overall length ≤ 40 characters and no whitespace.
 *
 * The *allocation* of XXXXX is concurrency-safe and lives in `sequence-service.ts`
 * (row-locked upsert inside the issuing DB transaction) — never count()+1.
 */
import {
  CLASSIFICATION_CODE_PATTERN,
  MONTH_ABBREVIATIONS,
  SERIAL_MAX_LENGTH,
  type SequenceResetPeriod,
} from "./constants";

export const BUSINESS_TIME_ZONE = "Asia/Colombo";

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Calendar date parts of an instant in the Sri Lanka business time zone. */
export function getZonedParts(date: Date, timeZone: string = BUSINESS_TIME_ZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export class NumberingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "NumberingError";
    this.code = code;
  }
}

export function normalizeClassificationCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidClassificationCode(code: string): boolean {
  return CLASSIFICATION_CODE_PATTERN.test(code);
}

export interface SerialInput {
  issueDate: Date;
  classificationCode: string;
  sequence: number;
  /** Minimum digits for XXXXX (default 5). */
  minDigits?: number;
  timeZone?: string;
}

export function formatTaxInvoiceSerial(input: SerialInput): string {
  const code = normalizeClassificationCode(input.classificationCode);
  if (!isValidClassificationCode(code)) {
    throw new NumberingError(
      "INVALID_CLASSIFICATION",
      "Classification code must be 1–15 upper-case letters/digits with no spaces"
    );
  }
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new NumberingError("INVALID_SEQUENCE", "Sequence must be a positive integer");
  }
  const { year, month } = getZonedParts(input.issueDate, input.timeZone);
  const yy = String(year % 100).padStart(2, "0");
  const mmm = MONTH_ABBREVIATIONS[month - 1];
  const seq = String(input.sequence).padStart(input.minDigits ?? 5, "0");
  const serial = `${yy}${mmm}_${code}_${seq}`;
  if (serial.length > SERIAL_MAX_LENGTH) {
    throw new NumberingError("SERIAL_TOO_LONG", `Serial "${serial}" exceeds ${SERIAL_MAX_LENGTH} characters`);
  }
  return serial;
}

const SERIAL_PATTERN = /^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)_([A-Z0-9]{1,15})_(\d{5,})$/;

export interface ParsedSerial {
  year: number;
  month: number;
  classificationCode: string;
  sequence: number;
}

export function parseTaxInvoiceSerial(serial: string): ParsedSerial | null {
  const m = SERIAL_PATTERN.exec(serial);
  if (!m) return null;
  return {
    year: 2000 + Number(m[1]),
    month: (MONTH_ABBREVIATIONS as readonly string[]).indexOf(m[2]) + 1,
    classificationCode: m[3],
    sequence: Number(m[4]),
  };
}

export function isValidTaxInvoiceSerial(serial: string): boolean {
  return serial.length <= SERIAL_MAX_LENGTH && !/\s/.test(serial) && SERIAL_PATTERN.test(serial);
}

/** Period bucket for a counter given the business' reset policy. */
export function sequencePeriodKey(
  reset: SequenceResetPeriod,
  date: Date,
  timeZone: string = BUSINESS_TIME_ZONE
): string {
  if (reset === "NEVER") return "ALL";
  const { year, month } = getZonedParts(date, timeZone);
  return reset === "YEARLY" ? String(year) : `${year}-${String(month).padStart(2, "0")}`;
}

/** Non-fiscal documents use a free-form `PREFIX-000001` style. */
export function formatSimpleNumber(prefix: string, sequence: number, minDigits = 6): string {
  const clean = prefix.trim().replace(/\s+/g, "");
  return `${clean}${clean && !clean.endsWith("-") ? "-" : ""}${String(sequence).padStart(minDigits, "0")}`;
}
