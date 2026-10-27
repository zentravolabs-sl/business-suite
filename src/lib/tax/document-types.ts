/**
 * Document-type planning — decides which legal document(s) a sale must produce.
 *
 * Pure & deterministic. Key rules enforced here (and re-checked server side by the
 * issuing service):
 *
 *  1. The words "TAX INVOICE" are only used when the supplier is a VAT-registered
 *     person whose registration is in force on the supply date AND the document
 *     contains taxable (standard-rated / zero-rated) supplies.
 *  2. Exempt and out-of-scope supplies are NEVER mixed into a Tax Invoice. A mixed
 *     sale is split into a TAX INVOICE (taxable lines) + a non-tax invoice (rest).
 *  3. A non-registered supplier never charges VAT and never issues a Tax Invoice.
 *  4. Quotations and proforma invoices are non-fiscal and never consume a tax serial.
 *  5. Credit / debit notes must reference a finalized original fiscal document.
 */
import {
  FISCAL_DOCUMENT_TYPES,
  TIN_PATTERN,
  type TaxDocumentType,
  type TaxTreatment,
  type VatRegistrationStatus,
} from "./constants";
import type { TaxLineResult } from "./engine";

export type NonTaxInvoiceType = Extract<TaxDocumentType, "SALES_INVOICE" | "RECEIPT" | "COMMERCIAL_INVOICE">;

export interface SupplierTaxStatus {
  vatStatus: VatRegistrationStatus;
  /** Date the VAT registration came into force. */
  effectiveDate?: Date | null;
  /** Document used when the sale is not a Tax Invoice. */
  defaultNonTaxDocument?: NonTaxInvoiceType;
}

/** True when the supplier may legally charge VAT and issue a Tax Invoice on `supplyDate`. */
export function isVatRegisteredOn(profile: SupplierTaxStatus, supplyDate: Date): boolean {
  if (profile.vatStatus !== "REGISTERED") return false;
  if (!profile.effectiveDate) return true;
  return profile.effectiveDate.getTime() <= supplyDate.getTime();
}

/**
 * A non-registered supplier cannot charge VAT, so whatever the product category
 * says, the supply is treated as out of scope of VAT for that supplier.
 */
export function effectiveTreatmentForSupplier(
  profile: SupplierTaxStatus,
  supplyDate: Date,
  treatment: TaxTreatment
): TaxTreatment {
  return isVatRegisteredOn(profile, supplyDate) ? treatment : "OUT_OF_SCOPE";
}

export interface BuyerTaxInfo {
  name?: string | null;
  tin?: string | null;
  isVatRegistered?: boolean | null;
  vatRegistrationNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  /** Customer-level exemption (diplomatic, SEZ, approved exemption certificate…). */
  exemptionTreatment?: Extract<TaxTreatment, "EXEMPT" | "ZERO_RATED"> | null;
  exemptionCertificate?: string | null;
  exemptionValidUntil?: Date | null;
  exemptionReason?: string | null;
}

export interface ExemptionResult {
  treatment: TaxTreatment;
  overridden: boolean;
  reason?: string;
  /** Why an exemption configured on the customer was NOT applied (shown to the cashier). */
  ignoredBecause?: string;
}

/**
 * Customer-level exemption. Only honoured with a certificate reference and while
 * valid, and only ever *reduces* tax (never turns an exempt line into standard-rated).
 */
export function applyCustomerExemption(
  treatment: TaxTreatment,
  buyer: BuyerTaxInfo | null | undefined,
  supplyDate: Date
): ExemptionResult {
  if (!buyer?.exemptionTreatment) return { treatment, overridden: false };
  if (treatment !== "STANDARD_RATED") return { treatment, overridden: false };
  if (!buyer.exemptionCertificate?.trim()) {
    return { treatment, overridden: false, ignoredBecause: "Customer exemption has no certificate reference" };
  }
  if (buyer.exemptionValidUntil && buyer.exemptionValidUntil.getTime() < supplyDate.getTime()) {
    return { treatment, overridden: false, ignoredBecause: "Customer exemption certificate has expired" };
  }
  return {
    treatment: buyer.exemptionTreatment,
    overridden: true,
    reason:
      buyer.exemptionReason?.trim() ||
      `Customer exemption – certificate ${buyer.exemptionCertificate.trim()}`,
  };
}

export interface PlannedDocument {
  documentType: TaxDocumentType;
  /** Indexes into the lines supplied to `planDocuments`. */
  lineIndexes: number[];
  /** Compliance notes printed on the document (e.g. mixed-supply disclosure). */
  notices: string[];
}

export interface PlanIssue {
  code:
    | "BUYER_TIN_REQUIRED"
    | "BUYER_TIN_INVALID"
    | "TAX_ON_NON_REGISTERED"
    | "NO_LINES"
    | "PARENT_REQUIRED"
    | "PARENT_NOT_FISCAL"
    | "PARENT_NOT_FINALIZED";
  message: string;
}

export interface PlanInput {
  supplier: SupplierTaxStatus;
  supplyDate: Date;
  buyer?: BuyerTaxInfo | null;
  lines: Pick<TaxLineResult, "treatment" | "taxAmount" | "description">[];
  /** Non-fiscal request (e.g. the user is preparing a quotation/proforma). */
  requestedType?: Extract<TaxDocumentType, "QUOTATION" | "PROFORMA_INVOICE"> | null;
}

export interface DocumentPlan {
  documents: PlannedDocument[];
  issues: PlanIssue[];
}

export function planDocuments(input: PlanInput): DocumentPlan {
  const issues: PlanIssue[] = [];
  if (input.lines.length === 0) {
    return { documents: [], issues: [{ code: "NO_LINES", message: "A document needs at least one line" }] };
  }
  const all = input.lines.map((_, i) => i);

  if (input.requestedType === "QUOTATION" || input.requestedType === "PROFORMA_INVOICE") {
    return {
      documents: [
        {
          documentType: input.requestedType,
          lineIndexes: all,
          notices: ["This document is not a tax invoice."],
        },
      ],
      issues,
    };
  }

  const registered = isVatRegisteredOn(input.supplier, input.supplyDate);
  const nonTaxType: NonTaxInvoiceType = input.supplier.defaultNonTaxDocument ?? "SALES_INVOICE";

  if (!registered) {
    const taxed = input.lines.find((l) => Number(l.taxAmount) !== 0);
    if (taxed) {
      issues.push({
        code: "TAX_ON_NON_REGISTERED",
        message: `"${taxed.description}" carries VAT but the business is not VAT-registered`,
      });
    }
    return {
      documents: [
        {
          documentType: nonTaxType,
          lineIndexes: all,
          notices: ["Supplier is not registered for VAT. No VAT has been charged."],
        },
      ],
      issues,
    };
  }

  const taxable: number[] = [];
  const other: number[] = [];
  input.lines.forEach((l, i) => {
    if (l.treatment === "STANDARD_RATED" || l.treatment === "ZERO_RATED") taxable.push(i);
    else other.push(i);
  });

  const documents: PlannedDocument[] = [];
  if (taxable.length > 0) {
    documents.push({
      documentType: "TAX_INVOICE",
      lineIndexes: taxable,
      notices: other.length > 0 ? ["Exempt / non-taxable supplies on this sale are shown on a separate invoice."] : [],
    });
    issues.push(...validateBuyerForTaxInvoice(input.buyer));
  }
  if (other.length > 0) {
    documents.push({
      documentType: nonTaxType === "RECEIPT" ? "SALES_INVOICE" : nonTaxType,
      lineIndexes: other,
      notices: [
        "This document covers exempt / out-of-scope supplies and is NOT a tax invoice.",
        ...(taxable.length > 0 ? ["Taxable supplies on the same sale are shown on the accompanying tax invoice."] : []),
      ],
    });
  }
  return { documents, issues };
}

/** A VAT-registered buyer must be identified by TIN on a tax invoice. */
export function validateBuyerForTaxInvoice(buyer: BuyerTaxInfo | null | undefined): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const tin = buyer?.tin?.trim();
  if (tin && !TIN_PATTERN.test(tin)) {
    issues.push({ code: "BUYER_TIN_INVALID", message: "Buyer TIN must be exactly 9 digits" });
  }
  if (buyer?.isVatRegistered && !tin) {
    issues.push({ code: "BUYER_TIN_REQUIRED", message: "Buyer is VAT-registered; their TIN is required on a tax invoice" });
  }
  return issues;
}

export interface ParentDocumentRef {
  documentType: TaxDocumentType;
  status: string;
}

/** Validates the original document for a credit / debit note. */
export function validateAdjustmentParent(parent: ParentDocumentRef | null | undefined): PlanIssue[] {
  if (!parent) return [{ code: "PARENT_REQUIRED", message: "A credit / debit note must reference the original invoice" }];
  const issues: PlanIssue[] = [];
  if (!FISCAL_DOCUMENT_TYPES.includes(parent.documentType) || parent.documentType === "CREDIT_NOTE" || parent.documentType === "DEBIT_NOTE") {
    issues.push({ code: "PARENT_NOT_FISCAL", message: "The referenced document is not an invoice that can be adjusted" });
  }
  if (parent.status !== "FINALIZED") {
    issues.push({ code: "PARENT_NOT_FINALIZED", message: "The original invoice has not been finalized" });
  }
  return issues;
}
