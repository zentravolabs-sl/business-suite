/**
 * Shared tax & invoicing constants.
 *
 * These string unions deliberately mirror the Prisma enums so the pure tax engine
 * (and its unit tests) never has to import the generated Prisma client.
 */

export const TAX_TREATMENTS = [
  "STANDARD_RATED",
  "ZERO_RATED",
  "EXEMPT",
  "OUT_OF_SCOPE",
] as const;
export type TaxTreatment = (typeof TAX_TREATMENTS)[number];

export const TAX_PRICING_MODES = ["TAX_INCLUSIVE", "TAX_EXCLUSIVE"] as const;
export type TaxPricingMode = (typeof TAX_PRICING_MODES)[number];

export const VAT_REGISTRATION_STATUSES = [
  "NOT_REGISTERED",
  "PENDING_REGISTRATION",
  "REGISTERED",
] as const;
export type VatRegistrationStatus = (typeof VAT_REGISTRATION_STATUSES)[number];

export const TAX_DOCUMENT_TYPES = [
  "TAX_INVOICE",
  "COMMERCIAL_INVOICE",
  "SALES_INVOICE",
  "RECEIPT",
  "QUOTATION",
  "PROFORMA_INVOICE",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
] as const;
export type TaxDocumentType = (typeof TAX_DOCUMENT_TYPES)[number];

export const TAX_DOCUMENT_STATUSES = ["DRAFT", "FINALIZED", "CANCELLED"] as const;
export type TaxDocumentStatus = (typeof TAX_DOCUMENT_STATUSES)[number];

export const ROUNDING_LEVELS = ["LINE", "INVOICE"] as const;
export type RoundingLevel = (typeof ROUNDING_LEVELS)[number];

export const SEQUENCE_RESET_PERIODS = ["NEVER", "YEARLY", "MONTHLY"] as const;
export type SequenceResetPeriod = (typeof SEQUENCE_RESET_PERIODS)[number];

export const INPUT_VAT_ELIGIBILITY = ["ELIGIBLE", "INELIGIBLE", "UNDER_REVIEW"] as const;
export type InputVatEligibility = (typeof INPUT_VAT_ELIGIBILITY)[number];

/** Document types that carry (or reverse) a tax liability and therefore must never be edited once finalized. */
export const FISCAL_DOCUMENT_TYPES: readonly TaxDocumentType[] = [
  "TAX_INVOICE",
  "COMMERCIAL_INVOICE",
  "SALES_INVOICE",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
];

/** Documents that create an accounting event (revenue / receivable / VAT). */
export const POSTING_DOCUMENT_TYPES: readonly TaxDocumentType[] = [
  "TAX_INVOICE",
  "COMMERCIAL_INVOICE",
  "SALES_INVOICE",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
];

export const DOCUMENT_TITLES: Record<TaxDocumentType, string> = {
  TAX_INVOICE: "TAX INVOICE",
  COMMERCIAL_INVOICE: "COMMERCIAL INVOICE",
  SALES_INVOICE: "SALES INVOICE",
  RECEIPT: "SALES RECEIPT",
  QUOTATION: "QUOTATION",
  PROFORMA_INVOICE: "PROFORMA INVOICE",
  CREDIT_NOTE: "CREDIT NOTE",
  DEBIT_NOTE: "DEBIT NOTE",
};

export const TREATMENT_LABELS: Record<TaxTreatment, string> = {
  STANDARD_RATED: "Standard-rated",
  ZERO_RATED: "Zero-rated",
  EXEMPT: "Exempt",
  OUT_OF_SCOPE: "Out of scope",
};

/** Upper-case English month abbreviations used by the YYMMM invoice serial component. */
export const MONTH_ABBREVIATIONS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

/**
 * Official sources the tax invoice layout and numbering were built from.
 *
 * IMPORTANT: these were cross-checked against secondary sources only. The primary
 * IRD / Government Printing documents must be reviewed by a qualified tax adviser
 * before production use. See docs/TAX_COMPLIANCE.md.
 */
export const IRD_REFERENCES = {
  gazette: "Gazette Extraordinary No. 2481/22 (27 March 2026)",
  circular: "IRD Circular No. SEC/2026/E/03",
  deferralGazette: "Gazette Extraordinary No. 2500/106 (6 August 2026)",
} as const;

/**
 * Date from which the revised tax invoice format is mandatory.
 * Originally 1 July 2026 (Gazette 2481/22); reported as deferred to 1 October 2026
 * by Gazette 2500/106. Kept as a single constant so it is trivial to change once
 * the primary documents are verified.
 */
export const REVISED_TAX_INVOICE_EFFECTIVE_DATE = new Date("2026-10-01T00:00:00+05:30");

/** Version tag stored on every finalized document so layouts can be audited later. */
export const COMPLIANCE_PROFILE_VERSION = "IRD-2481-22/SEC-2026-E-03@2026-10-01";

export const TAX_RATE_MAX_PERCENT = 100;
export const SERIAL_MAX_LENGTH = 40;
export const CLASSIFICATION_CODE_PATTERN = /^[A-Z0-9]{1,15}$/;
export const TIN_PATTERN = /^\d{9}$/;

export function isTaxTreatment(value: unknown): value is TaxTreatment {
  return typeof value === "string" && (TAX_TREATMENTS as readonly string[]).includes(value);
}

export const TAX_PERMISSIONS = {
  VIEW: "tax.view",
  EDIT_SETTINGS: "tax.edit_settings",
  ISSUE_DOCUMENTS: "tax.issue_documents",
  VIEW_REPORTS: "tax.view_reports",
  MANAGE_INTEGRATION: "tax.manage_integration",
  REVIEW_INPUT_VAT: "tax.review_input_vat",
} as const;
