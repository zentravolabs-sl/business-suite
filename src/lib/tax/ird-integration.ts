/**
 * Sri Lanka Inland Revenue Department (IRD) & RAMIS E-Invoicing Integration Module
 *
 * Implements:
 * 1. AES-256-GCM authenticated credential encryption for IRD API keys/secrets
 * 2. Statutory IRD document validation (Gazette No. 2481/22 & Circular SEC/2026/E/03)
 * 3. Canonical payload formatting and cryptographic hashing
 * 4. Outbound submission queue helpers
 */

import crypto from "crypto";
import { isValidTaxInvoiceSerial } from "./numbering";

// =============================================================================
// 1. CREDENTIAL VAULT (AES-256-GCM)
// =============================================================================

function getVaultKey(): Buffer {
  const secret =
    process.env.TAX_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    "zentravo-sri-lanka-ird-credential-vault-secret-key-32b";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts sensitive credentials using AES-256-GCM with authenticated tag.
 * Returns payload in standard format: iv:authTag:ciphertext (base64 encoded).
 */
export function encryptCredential(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", getVaultKey(), iv);

  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");

  return `${iv.toString("base64")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted credentials and validates authentication tag.
 */
export function decryptCredential(encryptedPayload: string): string {
  if (!encryptedPayload) return "";
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted credential format. Expected iv:authTag:ciphertext"
    );
  }

  const [ivB64, authTagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", getVaultKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherB64, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// =============================================================================
// 2. STATUTORY DOCUMENT VALIDATION FOR IRD
// =============================================================================

export interface IrdLineItemValidation {
  description?: string;
  quantity?: number;
  unitPrice?: number | string;
  taxAmount?: number | string;
  unit?: string;
  lineTotal?: number | string;
  treatment?: string;
}

export interface IrdDocumentValidationInput {
  documentNumber?: string;
  documentType?: string;
  issueDate?: Date | string;
  supplyDate?: Date | string;
  sellerName?: string | null;
  sellerAddress?: string | null;
  sellerTin?: string | null;
  sellerVatStatus?: string | null;
  sellerVatNumber?: string | null;
  buyerName?: string | null;
  buyerAddress?: string | null;
  buyerTin?: string | null;
  buyerVatNumber?: string | null;
  currency?: string | null;
  netValue?: number | string | null;
  taxTotal?: number | string | null;
  grandTotal?: number | string | null;
  lines?: IrdLineItemValidation[];
}

export interface IrdValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const SRI_LANKA_TIN_PATTERN = /^\d{9}$/;

/**
 * Validates a tax document against Sri Lanka Inland Revenue Department statutory standards.
 * Covers Gazette Extraordinary No. 2481/22, Circular SEC/2026/E/03, and VAT Act No. 14 of 2002.
 */
export function validateDocumentForIrd(
  doc: IrdDocumentValidationInput
): IrdValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isTaxInvoice = doc.documentType === "TAX_INVOICE";

  // 1. Document Number
  if (!doc.documentNumber || !doc.documentNumber.trim()) {
    errors.push("Document number is mandatory.");
  } else if (isTaxInvoice && !isValidTaxInvoiceSerial(doc.documentNumber)) {
    errors.push(
      `Tax Invoice number "${doc.documentNumber}" does not comply with statutory IRD serial format (YYMMM_QQQQ_XXXXX).`
    );
  }

  // 2. Dual Dates (Mandatory under Gazette 2481/22)
  if (!doc.issueDate) {
    errors.push("Date of Issue is mandatory.");
  } else {
    const issue = new Date(doc.issueDate);
    if (isNaN(issue.getTime())) {
      errors.push("Date of Issue is invalid.");
    }
  }

  if (!doc.supplyDate) {
    errors.push("Date of Supply is mandatory under statutory IRD requirements.");
  } else {
    const supply = new Date(doc.supplyDate);
    if (isNaN(supply.getTime())) {
      errors.push("Date of Supply is invalid.");
    }
  }

  // 3. Seller Particulars
  if (!doc.sellerName || !doc.sellerName.trim()) {
    errors.push("Seller legal name is mandatory.");
  }

  if (!doc.sellerAddress || !doc.sellerAddress.trim()) {
    errors.push("Seller registered business address is mandatory.");
  }

  if (!doc.sellerTin || !doc.sellerTin.trim()) {
    errors.push("Seller TIN is mandatory.");
  } else if (!SRI_LANKA_TIN_PATTERN.test(doc.sellerTin.trim())) {
    errors.push(
      `Seller TIN "${doc.sellerTin}" is invalid. Sri Lankan TIN must be exactly 9 digits.`
    );
  }

  // 4. VAT Registration Guards
  if (isTaxInvoice) {
    if (doc.sellerVatStatus !== "REGISTERED") {
      errors.push(
        "Only VAT-registered businesses may issue a Tax Invoice under Section 20 of the VAT Act."
      );
    }
    if (!doc.sellerVatNumber || !doc.sellerVatNumber.trim()) {
      errors.push(
        "Seller VAT registration number is mandatory on all Tax Invoices."
      );
    }
  }

  // 5. Buyer Particulars
  if (!doc.buyerName || !doc.buyerName.trim()) {
    errors.push("Buyer name is mandatory.");
  }

  if (doc.buyerTin && doc.buyerTin.trim()) {
    if (!SRI_LANKA_TIN_PATTERN.test(doc.buyerTin.trim())) {
      errors.push(
        `Buyer TIN "${doc.buyerTin}" is invalid. Sri Lankan TIN must be exactly 9 digits.`
      );
    }
  } else {
    const total = Number(doc.grandTotal || 0);
    if (total >= 100000) {
      warnings.push(
        "Buyer TIN is strongly recommended under IRD guidelines for transactions of LKR 100,000 or above."
      );
    }
  }

  // 6. Currency & Amounts
  const currency = (doc.currency || "LKR").toUpperCase().trim();
  if (currency.length !== 3) {
    errors.push(`Invalid currency code "${doc.currency}". Must be a 3-letter ISO code.`);
  }

  const netValue = Number(doc.netValue ?? 0);
  const taxTotal = Number(doc.taxTotal ?? 0);
  const grandTotal = Number(doc.grandTotal ?? 0);

  if (isNaN(netValue) || netValue < 0) {
    errors.push("Net value must be a valid non-negative number.");
  }
  if (isNaN(taxTotal) || taxTotal < 0) {
    errors.push("Tax total must be a valid non-negative number.");
  }
  if (isNaN(grandTotal) || grandTotal < 0) {
    errors.push("Grand total must be a valid non-negative number.");
  }

  if (
    !isNaN(netValue) &&
    !isNaN(taxTotal) &&
    !isNaN(grandTotal) &&
    Math.abs(netValue + taxTotal - grandTotal) > 0.05
  ) {
    errors.push(
      `Reconciliation mismatch: Net Value (${netValue.toFixed(2)}) + Tax (${taxTotal.toFixed(2)}) does not equal Grand Total (${grandTotal.toFixed(2)}).`
    );
  }

  // 7. Line Items
  if (!doc.lines || doc.lines.length === 0) {
    errors.push("Tax document must contain at least one line item.");
  } else {
    doc.lines.forEach((line, index) => {
      if (!line.description || !line.description.trim()) {
        errors.push(`Line item #${index + 1} is missing a description.`);
      }
      const qty = Number(line.quantity ?? 0);
      if (isNaN(qty) || qty <= 0) {
        errors.push(
          `Line item #${index + 1} (${line.description || "Unnamed"}) has an invalid quantity (${line.quantity}). Must be greater than 0.`
        );
      }
      const price = Number(line.unitPrice ?? 0);
      if (isNaN(price) || price < 0) {
        errors.push(
          `Line item #${index + 1} (${line.description || "Unnamed"}) has an invalid unit price (${line.unitPrice}).`
        );
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// 3. CANONICAL PAYLOAD & HASHING (FOR IRD RAMIS E-INVOICING)
// =============================================================================

export interface CanonicalIrdPayload {
  specificationVersion: string;
  documentType: string;
  documentNumber: string;
  issueTimestamp: string;
  supplyDate: string;
  seller: {
    tin: string;
    vatNumber: string | null;
    legalName: string;
    address: string;
  };
  buyer: {
    tin: string | null;
    vatNumber: string | null;
    name: string;
    address: string | null;
  };
  financial: {
    currency: string;
    netAmount: string;
    taxAmount: string;
    grandTotal: string;
  };
  items: Array<{
    lineNo: number;
    description: string;
    quantity: number;
    unitPrice: string;
    taxAmount: string;
    lineTotal: string;
  }>;
}

/**
 * Builds canonical IRD schema payload from validated tax document input.
 */
export function buildCanonicalIrdPayload(
  doc: IrdDocumentValidationInput
): CanonicalIrdPayload {
  const issueDate = doc.issueDate ? new Date(doc.issueDate) : new Date();
  const supplyDate = doc.supplyDate ? new Date(doc.supplyDate) : issueDate;

  return {
    specificationVersion: "RAMIS-3.0-DRAFT",
    documentType: doc.documentType || "TAX_INVOICE",
    documentNumber: doc.documentNumber || "",
    issueTimestamp: issueDate.toISOString(),
    supplyDate: supplyDate.toISOString().slice(0, 10),
    seller: {
      tin: doc.sellerTin || "",
      vatNumber: doc.sellerVatNumber || null,
      legalName: doc.sellerName || "",
      address: doc.sellerAddress || "",
    },
    buyer: {
      tin: doc.buyerTin || null,
      vatNumber: doc.buyerVatNumber || null,
      name: doc.buyerName || "",
      address: doc.buyerAddress || null,
    },
    financial: {
      currency: doc.currency || "LKR",
      netAmount: Number(doc.netValue || 0).toFixed(2),
      taxAmount: Number(doc.taxTotal || 0).toFixed(2),
      grandTotal: Number(doc.grandTotal || 0).toFixed(2),
    },
    items: (doc.lines || []).map((line, idx) => ({
      lineNo: idx + 1,
      description: line.description || "",
      quantity: Number(line.quantity || 1),
      unitPrice: Number(line.unitPrice || 0).toFixed(2),
      taxAmount: Number(line.taxAmount || 0).toFixed(2),
      lineTotal: Number(line.lineTotal || 0).toFixed(2),
    })),
  };
}

/**
 * Generates deterministic SHA-256 hash of canonical payload for tamper verification.
 */
export function calculatePayloadHash(payload: CanonicalIrdPayload): string {
  const canonicalString = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash("sha256").update(canonicalString).digest("hex");
}

/**
 * Automatically queues a finalized fiscal document for IRD submission if the business
 * has IRD integration and auto-submission enabled.
 */
export interface QueueIrdDocumentLine {
  description?: string;
  quantity?: number | string | { toString(): string } | unknown;
  unitPrice?: number | string | { toString(): string } | unknown;
  taxAmount?: number | string | { toString(): string } | unknown;
  unit?: string | null;
  lineTotal?: number | string | { toString(): string } | unknown;
  [key: string]: unknown;
}

export interface QueueIrdDocumentInput {
  id: string;
  businessId: string;
  documentType: string;
  documentNumber: string;
  issueDate: Date;
  supplyDate: Date;
  sellerName: string;
  sellerAddress?: string | null;
  sellerTin?: string | null;
  sellerVatStatus?: string | null;
  sellerVatNumber?: string | null;
  buyerName?: string | null;
  buyerAddress?: string | null;
  buyerTin?: string | null;
  buyerVatNumber?: string | null;
  currency: string;
  netValue?: number | string | { toString(): string } | unknown;
  taxTotal?: number | string | { toString(): string } | unknown;
  grandTotal?: number | string | { toString(): string } | unknown;
  lines: QueueIrdDocumentLine[];
  [key: string]: unknown;
}

export interface IrdQueueTx {
  taxIntegrationSetting: {
    findUnique: (args: { where: { businessId: string } }) => Promise<{
      enabled: boolean;
      autoSubmit: boolean;
    } | null>;
  };
  irdSubmission: {
    create: (args: {
      data: {
        businessId: string;
        documentId: string;
        status: "PENDING" | "VALIDATION_FAILED";
        attempts: number;
        validationErrors?: string[];
        payloadHash?: string;
      };
    }) => Promise<unknown>;
  };
  taxDocument: {
    update: (args: {
      where: { id: string };
      data: { irdStatus: "PENDING" | "VALIDATION_FAILED" };
    }) => Promise<unknown>;
  };
}

/**
 * Automatically queues a finalized fiscal document for IRD submission if the business
 * has IRD integration and auto-submission enabled.
 */
export async function queueDocumentForIrd(
  tx: IrdQueueTx,
  doc: QueueIrdDocumentInput
) {
  try {
    const setting = await tx.taxIntegrationSetting.findUnique({
      where: { businessId: doc.businessId },
    });
    if (!setting || !setting.enabled || !setting.autoSubmit) {
      return null;
    }

    const validationInput: IrdDocumentValidationInput = {
      documentNumber: doc.documentNumber,
      documentType: doc.documentType,
      issueDate: doc.issueDate,
      supplyDate: doc.supplyDate,
      sellerName: doc.sellerName,
      sellerAddress: doc.sellerAddress,
      sellerTin: doc.sellerTin,
      sellerVatStatus: doc.sellerVatStatus,
      sellerVatNumber: doc.sellerVatNumber,
      buyerName: doc.buyerName,
      buyerAddress: doc.buyerAddress,
      buyerTin: doc.buyerTin,
      buyerVatNumber: doc.buyerVatNumber,
      currency: doc.currency,
      netValue: Number(doc.netValue),
      taxTotal: Number(doc.taxTotal),
      grandTotal: Number(doc.grandTotal),
      lines: doc.lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        taxAmount: Number(l.taxAmount),
        unit: l.unit || undefined,
        lineTotal: Number(l.lineTotal),
      })),
    };

    const validation = validateDocumentForIrd(validationInput);
    const payload = buildCanonicalIrdPayload(validationInput);
    const payloadHash = calculatePayloadHash(payload);

    const submissionStatus = validation.isValid ? "PENDING" : "VALIDATION_FAILED";

    const submission = await tx.irdSubmission.create({
      data: {
        businessId: doc.businessId,
        documentId: doc.id,
        status: submissionStatus,
        attempts: 0,
        validationErrors: validation.errors.length > 0 ? validation.errors : undefined,
        payloadHash,
      },
    });

    await tx.taxDocument.update({
      where: { id: doc.id },
      data: {
        irdStatus: submissionStatus,
      },
    });

    return submission;
  } catch (error) {
    console.error("Failed to queue document for IRD submission:", error);
    return null;
  }
}