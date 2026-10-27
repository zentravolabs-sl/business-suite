import { Prisma } from "@prisma/client";
import { amountInWordsLKR } from "./amount-in-words";
import { COMPLIANCE_PROFILE_VERSION, CLASSIFICATION_CODE_PATTERN, type TaxDocumentType, type TaxTreatment } from "./constants";
import { allocatePayment, computeCreditLine, computeDocumentHash, summarizeDocumentLines } from "./adjustments";
import { planDocuments, validateAdjustmentParent, validateBuyerForTaxInvoice } from "./document-types";
import { TaxCalculationService, summarizeLines, type TaxCalculationResult } from "./engine";
import { TaxError } from "./errors";
import { type BusinessTaxContext } from "./profile-service";
import { allocateDocumentNumber, allocateTaxInvoiceSerial } from "./sequence-service";
import { queueDocumentForIrd } from "./ird-integration";

export { computeDocumentHash } from "./adjustments";

const D = Prisma.Decimal;
type Tx = Prisma.TransactionClient;

/** Quotations and proforma invoices are non-fiscal: they stay cancellable. */
export const NON_FISCAL_TYPES: readonly TaxDocumentType[] = ["QUOTATION", "PROFORMA_INVOICE"];

type DocHeader = Omit<Prisma.TaxDocumentUncheckedCreateInput, "status" | "contentHash" | "finalizedAt" | "id">;
type LineData = Omit<Prisma.TaxDocumentLineUncheckedCreateInput, "documentId" | "id">;

/**
 * Persists a document so that its lines are written while it is still a DRAFT and only then
 * flipped to FINALIZED. The database immutability trigger rejects any line write against a
 * FINALIZED fiscal document, so this ordering is mandatory — and it guarantees a finalized
 * document is always complete. A tamper-evidence hash of the canonical content is stored.
 */
async function persistDocument(tx: Tx, header: DocHeader, lines: LineData[]) {
  const contentHash = computeDocumentHash({
    documentType: header.documentType,
    direction: header.direction,
    documentNumber: header.documentNumber,
    issueDate: header.issueDate,
    supplyDate: header.supplyDate,
    seller: [header.sellerName, header.sellerTin, header.sellerVatNumber, header.sellerAddress],
    buyer: [header.buyerName, header.buyerTin, header.buyerVatNumber, header.buyerAddress],
    currency: header.currency,
    totals: [
      String(header.grossTotal),
      String(header.discountTotal),
      String(header.netValue),
      String(header.taxTotal),
      String(header.grandTotal),
    ],
    lines: lines.map((l) => [
      l.lineNo,
      l.description,
      String(l.quantity),
      String(l.unitPrice),
      String(l.taxableValue),
      String(l.taxAmount),
      String(l.lineTotal),
      String(l.ratePercent ?? 0),
      l.treatment,
    ]),
  });

  const draft = await tx.taxDocument.create({
    data: { ...header, status: "DRAFT", contentHash },
  });
  if (lines.length > 0) {
    await tx.taxDocumentLine.createMany({ data: lines.map((l) => ({ ...l, documentId: draft.id })) });
  }
  const finalized = await tx.taxDocument.update({
    where: { id: draft.id },
    data: { status: "FINALIZED", finalizedAt: new Date() },
    include: { lines: { orderBy: { lineNo: "asc" } } },
  });

  if (!NON_FISCAL_TYPES.includes(header.documentType)) {
    await queueDocumentForIrd(tx, finalized);
  }

  return finalized;
}

async function resolveClassificationCode(
  tx: Tx,
  businessId: string,
  branchId: string | null | undefined,
  profileCode: string
): Promise<string> {
  let code = profileCode || "MAIN";
  if (branchId) {
    const branch = await tx.branch.findFirst({
      where: { id: branchId, businessId },
      select: { taxClassificationCode: true },
    });
    if (branch?.taxClassificationCode?.trim()) code = branch.taxClassificationCode;
  }
  code = code.trim().toUpperCase();
  if (!CLASSIFICATION_CODE_PATTERN.test(code)) {
    throw new TaxError(
      "INVALID_CLASSIFICATION",
      `Tax classification code "${code}" is invalid. Use 1–15 upper-case letters or digits.`
    );
  }
  return code;
}

async function numberFor(
  tx: Tx,
  businessId: string,
  documentType: TaxDocumentType,
  issueDate: Date,
  profile?: { classificationCode: string; serialResetPeriod: "NEVER" | "YEARLY" | "MONTHLY"; serialMinDigits: number },
  branchId?: string | null
) {
  if (documentType === "TAX_INVOICE") {
    if (!profile) throw new TaxError("PROFILE_REQUIRED", "A tax profile is required to number a tax invoice");
    const classificationCode = await resolveClassificationCode(tx, businessId, branchId, profile.classificationCode);
    const alloc = await allocateTaxInvoiceSerial(tx, {
      businessId,
      classificationCode,
      issueDate,
      resetPeriod: profile.serialResetPeriod,
      minDigits: profile.serialMinDigits,
    });
    return {
      documentNumber: alloc.serial,
      sequenceNumber: alloc.sequenceNumber,
      sequenceKey: alloc.sequenceKey,
      classificationCode,
    };
  }
  const defaults: Record<string, string> = {
    CREDIT_NOTE: "CN",
    DEBIT_NOTE: "DN",
    SALES_INVOICE: "INV",
    COMMERCIAL_INVOICE: "CI",
    RECEIPT: "RCP",
    QUOTATION: "QT",
    PROFORMA_INVOICE: "PI",
  };
  const rule = await tx.numberingRule.findUnique({
    where: { businessId_documentType: { businessId, documentType } },
  });
  const alloc = await allocateDocumentNumber(tx, {
    businessId,
    documentType,
    prefix: rule?.prefix || defaults[documentType] || documentType.slice(0, 3),
    issueDate,
    resetPeriod: rule?.resetPeriod ?? "NEVER",
    minDigits: rule?.minDigits ?? 6,
  });
  return {
    documentNumber: alloc.documentNumber,
    sequenceNumber: alloc.sequenceNumber,
    sequenceKey: alloc.sequenceKey,
    classificationCode: null as string | null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT: sales / online orders / quotations
// ─────────────────────────────────────────────────────────────────────────────

export interface IssueDocumentsOptions {
  businessId: string;
  branchId?: string | null;
  saleId?: string | null;
  purchaseId?: string | null;
  refundId?: string | null;
  onlineOrderId?: string | null;
  expenseId?: string | null;
  issueDate?: Date;
  supplyDate?: Date;
  dueDate?: Date | null;
  paymentMethod?: string | null;
  /** Amount actually paid against the whole sale (never more than the total is attributed). */
  paidAmount?: number | string | null;
  notes?: string | null;
  createdById?: string | null;
  buyer?: {
    id?: string | null;
    name?: string | null;
    tin?: string | null;
    vatRegistrationNumber?: string | null;
    isVatRegistered?: boolean | null;
    address?: string | null;
    phone?: string | null;
  } | null;
  requestedType?: Extract<TaxDocumentType, "QUOTATION" | "PROFORMA_INVOICE"> | null;
  /** SaleItem ids aligned with `calc.lines` so credit notes can reference the exact sale item. */
  saleItemIds?: (string | null)[];
}

export async function issueTaxDocumentsForSale(
  tx: Tx,
  taxContext: BusinessTaxContext,
  calc: TaxCalculationResult,
  opts: IssueDocumentsOptions
) {
  const supplyDate = opts.supplyDate ?? new Date();
  const issueDate = opts.issueDate ?? new Date();
  const profile = taxContext.profile;

  const plan = planDocuments({
    supplier: {
      vatStatus: profile.vatStatus,
      effectiveDate: profile.registrationEffectiveDate,
      defaultNonTaxDocument:
        profile.defaultNonTaxDocument === "COMMERCIAL_INVOICE" || profile.defaultNonTaxDocument === "RECEIPT"
          ? profile.defaultNonTaxDocument
          : "SALES_INVOICE",
    },
    supplyDate,
    buyer: opts.buyer,
    lines: calc.lines.map((l) => ({ treatment: l.treatment, taxAmount: l.taxAmount, description: l.description })),
    requestedType: opts.requestedType,
  });

  if (plan.issues.length > 0) {
    throw new TaxError("DOCUMENT_PLAN_INVALID", plan.issues.map((i) => i.message).join("; "), 422, plan.issues);
  }

  // Attribute the amount paid across the documents of this sale (a split sale must not
  // show the full payment on each document).
  const docTotals = plan.documents.map((p) =>
    summarizeLines(
      p.lineIndexes.map((i) => calc.lines[i]),
      calc.currencyDecimals
    )
  );
  const paidSplit = allocatePayment(
    docTotals.map((t) => t.totals.grandTotal),
    opts.paidAmount ?? calc.totals.grandTotal
  );

  const created = [];
  for (let n = 0; n < plan.documents.length; n++) {
    const docPlan = plan.documents[n];
    const docLines = docPlan.lineIndexes.map((i) => ({ line: calc.lines[i], originalIndex: i }));
    const { breakdown, totals } = docTotals[n];

    const num = await numberFor(tx, opts.businessId, docPlan.documentType, issueDate, profile, opts.branchId);

    const paid = new D(paidSplit[n]);
    const nonFiscal = NON_FISCAL_TYPES.includes(docPlan.documentType);
    const header: DocHeader = {
      businessId: opts.businessId,
      branchId: opts.branchId || null,
      direction: "OUTPUT",
      documentType: docPlan.documentType,
      documentNumber: num.documentNumber,
      sequenceKey: num.sequenceKey,
      sequenceNumber: num.sequenceNumber,
      classificationCode: num.classificationCode,
      issueDate,
      supplyDate,
      dueDate: opts.dueDate || null,

      sellerName: profile.legalName || taxContext.business.name,
      sellerTin: profile.tin || null,
      sellerVatNumber: profile.vatRegistrationNumber || null,
      sellerAddress: profile.registeredAddress || null,
      sellerPhone: profile.registeredPhone || null,
      sellerVatStatus: profile.vatStatus,

      buyerName: opts.buyer?.name || "Walk-in Customer",
      buyerTin: opts.buyer?.tin || null,
      buyerVatNumber: opts.buyer?.vatRegistrationNumber || null,
      buyerAddress: opts.buyer?.address || null,
      buyerPhone: opts.buyer?.phone || null,
      customerId: opts.buyer?.id || null,

      currency: profile.defaultCurrency || "LKR",
      pricingMode: calc.pricingMode,
      roundingLevel: calc.roundingLevel,

      grossTotal: new D(totals.grossTotal),
      discountTotal: new D(totals.discountTotal),
      netValue: new D(totals.netValue),
      standardRatedValue: new D(totals.standardRatedValue),
      zeroRatedValue: new D(totals.zeroRatedValue),
      exemptValue: new D(totals.exemptValue),
      outOfScopeValue: new D(totals.outOfScopeValue),
      taxTotal: new D(totals.taxTotal),
      grandTotal: new D(totals.grandTotal),
      breakdown: breakdown as unknown as Prisma.InputJsonValue,
      amountInWords: profile.showAmountInWords ? amountInWordsLKR(totals.grandTotal) : null,

      paymentMethod: opts.paymentMethod || null,
      paidAmount: nonFiscal ? new D(0) : paid,
      balanceDue: nonFiscal ? new D(totals.grandTotal) : new D(totals.grandTotal).minus(paid),
      notes: opts.notes || profile.invoiceNotes || null,
      notices: docPlan.notices,
      templateKey: docPlan.documentType === "TAX_INVOICE" ? "TAX_A4" : "STANDARD_A4",
      complianceVersion: COMPLIANCE_PROFILE_VERSION,

      saleId: nonFiscal ? null : opts.saleId || null,
      purchaseId: opts.purchaseId || null,
      refundId: opts.refundId || null,
      onlineOrderId: nonFiscal ? null : opts.onlineOrderId || null,
      expenseId: opts.expenseId || null,
      createdById: opts.createdById || null,
    };

    const lines: LineData[] = docLines.map(({ line, originalIndex }, idx) => ({
      lineNo: idx + 1,
      productId: (line.meta?.productId as string) || null,
      saleItemId: opts.saleItemIds?.[originalIndex] ?? null,
      description: line.description,
      sku: (line.meta?.sku as string) || null,
      unit: (line.meta?.unit as string) || null,
      quantity: new D(line.quantity),
      unitPrice: new D(line.unitPrice),
      priceIncludesTax: line.priceIncludesTax,
      grossAmount: new D(line.grossAmount),
      discountAmount: new D(line.discountTotal),
      taxableValue: new D(line.taxableValue),
      taxAmount: new D(line.taxAmount),
      lineTotal: new D(line.lineTotal),
      treatment: line.treatment,
      ratePercent: new D(line.ratePercent),
      taxRateId: line.rateRef?.taxRateId || null,
      taxRateVersionId: line.rateRef?.taxRateVersionId || null,
      taxCategoryId: (line.meta?.taxCategoryId as string) || null,
      taxCategoryName: (line.meta?.taxCategoryName as string) || null,
      exemptionReason: (line.meta?.exemptionReason as string) || null,
    }));

    created.push(await persistDocument(tx, header, lines));
  }
  return created;
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT: credit notes (sales returns / refunds)
// ─────────────────────────────────────────────────────────────────────────────

export interface IssueCreditNoteOptions {
  businessId: string;
  branchId?: string | null;
  parentDocumentId: string;
  refundId?: string | null;
  saleId?: string | null;
  /** Lines to credit: the original document line and the quantity being returned. */
  items: { parentLineId: string; returnedQuantity: number | string }[];
  reason: string;
  refundMethod?: string | null;
  createdById?: string | null;
}

async function loadAdjustableParent(tx: Tx, businessId: string, parentDocumentId: string, label: string) {
  const parent = await tx.taxDocument.findFirst({
    where: { id: parentDocumentId, businessId },
    include: { lines: true },
  });
  if (!parent) throw new TaxError("PARENT_NOT_FOUND", `Original tax document not found`, 404);
  const issues = validateAdjustmentParent({ documentType: parent.documentType, status: parent.status });
  if (issues.length > 0 || parent.direction !== "OUTPUT") {
    throw new TaxError("PARENT_INVALID", `${label} cannot be issued: ${issues.map((i) => i.message).join("; ") || "only sales documents can be adjusted here"}`);
  }
  return parent;
}

export async function issueCreditNoteForRefund(tx: Tx, opts: IssueCreditNoteOptions) {
  if (!opts.reason?.trim()) throw new TaxError("REASON_REQUIRED", "A reason is required to issue a credit note");
  if (opts.items.length === 0) throw new TaxError("NO_LINES", "A credit note needs at least one line");

  const parent = await loadAdjustableParent(tx, opts.businessId, opts.parentDocumentId, "Credit note");
  const parentLines = new Map(parent.lines.map((l) => [l.id, l]));

  // Already credited quantity/amounts per original line (finalized credit notes only).
  const previous = await tx.taxDocumentLine.findMany({
    where: {
      parentLineId: { in: opts.items.map((i) => i.parentLineId) },
      document: { documentType: "CREDIT_NOTE", status: "FINALIZED", parentDocumentId: parent.id },
    },
    select: {
      parentLineId: true,
      quantity: true,
      grossAmount: true,
      discountAmount: true,
      taxableValue: true,
      taxAmount: true,
      lineTotal: true,
    },
  });
  const creditedBy = new Map<string, { quantity: Prisma.Decimal; grossAmount: Prisma.Decimal; discountAmount: Prisma.Decimal; taxableValue: Prisma.Decimal; taxAmount: Prisma.Decimal; lineTotal: Prisma.Decimal }>();
  for (const p of previous) {
    const key = p.parentLineId as string;
    const cur = creditedBy.get(key) ?? {
      quantity: new D(0),
      grossAmount: new D(0),
      discountAmount: new D(0),
      taxableValue: new D(0),
      taxAmount: new D(0),
      lineTotal: new D(0),
    };
    creditedBy.set(key, {
      quantity: cur.quantity.plus(p.quantity),
      grossAmount: cur.grossAmount.plus(p.grossAmount),
      discountAmount: cur.discountAmount.plus(p.discountAmount),
      taxableValue: cur.taxableValue.plus(p.taxableValue),
      taxAmount: cur.taxAmount.plus(p.taxAmount),
      lineTotal: cur.lineTotal.plus(p.lineTotal),
    });
  }

  const merged = new Map<string, number>(); // merge duplicate request lines
  const lineData: LineData[] = [];
  opts.items.forEach((item) => {
    merged.set(item.parentLineId, (merged.get(item.parentLineId) ?? 0) + Number(item.returnedQuantity));
  });

  let lineNo = 0;
  for (const [parentLineId, qty] of merged) {
    const pl = parentLines.get(parentLineId);
    if (!pl) throw new TaxError("PARENT_LINE_NOT_FOUND", "A credited line does not belong to the original document", 404);
    const credited = creditedBy.get(parentLineId);
    const amounts = computeCreditLine(
      {
        quantity: pl.quantity.toString(),
        grossAmount: pl.grossAmount.toString(),
        discountAmount: pl.discountAmount.toString(),
        taxableValue: pl.taxableValue.toString(),
        taxAmount: pl.taxAmount.toString(),
        lineTotal: pl.lineTotal.toString(),
      },
      {
        quantity: credited?.quantity.toString() ?? "0",
        grossAmount: credited?.grossAmount.toString() ?? "0",
        discountAmount: credited?.discountAmount.toString() ?? "0",
        taxableValue: credited?.taxableValue.toString() ?? "0",
        taxAmount: credited?.taxAmount.toString() ?? "0",
        lineTotal: credited?.lineTotal.toString() ?? "0",
      },
      qty
    );
    lineNo += 1;
    lineData.push({
      lineNo,
      productId: pl.productId,
      variantId: pl.variantId,
      saleItemId: pl.saleItemId,
      purchaseItemId: pl.purchaseItemId,
      parentLineId: pl.id,
      description: pl.description,
      sku: pl.sku,
      unit: pl.unit,
      quantity: new D(amounts.quantity),
      unitPrice: pl.unitPrice,
      priceIncludesTax: pl.priceIncludesTax,
      grossAmount: new D(amounts.grossAmount),
      discountAmount: new D(amounts.discountAmount),
      taxableValue: new D(amounts.taxableValue),
      taxAmount: new D(amounts.taxAmount),
      lineTotal: new D(amounts.lineTotal),
      treatment: pl.treatment,
      ratePercent: pl.ratePercent, // HISTORICAL rate of the original line
      taxRateId: pl.taxRateId,
      taxRateVersionId: pl.taxRateVersionId,
      taxCategoryId: pl.taxCategoryId,
      taxCategoryName: pl.taxCategoryName,
      exemptionReason: pl.exemptionReason,
    });
  }

  const { totals, breakdown } = summarizeDocumentLines(
    lineData.map((l) => ({
      treatment: l.treatment as TaxTreatment,
      ratePercent: String(l.ratePercent ?? 0),
      grossAmount: String(l.grossAmount),
      discountAmount: String(l.discountAmount),
      taxableValue: String(l.taxableValue),
      taxAmount: String(l.taxAmount),
      lineTotal: String(l.lineTotal),
    }))
  );

  const issueDate = new Date();
  const num = await numberFor(tx, opts.businessId, "CREDIT_NOTE", issueDate);
  const header = adjustmentHeader(parent, {
    documentType: "CREDIT_NOTE",
    num,
    issueDate,
    totals,
    breakdown,
    reason: opts.reason.trim(),
    label: "Credit Note",
    refundId: opts.refundId ?? null,
    saleId: opts.saleId ?? parent.saleId,
    purchaseId: null,
    paymentMethod: opts.refundMethod ?? null,
    createdById: opts.createdById ?? null,
    templateKey: "CREDIT_NOTE_A4",
  });
  return persistDocument(tx, header, lineData);
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT: debit notes (upward corrections)
// ─────────────────────────────────────────────────────────────────────────────

export interface IssueDebitNoteOptions {
  businessId: string;
  /** The original finalized invoice being corrected upward. */
  parentDocumentId: string;
  items: {
    /** Existing line being adjusted: historical treatment / rate are inherited. */
    parentLineId?: string | null;
    description?: string | null;
    quantity: number | string;
    /** Price entered in the original document's pricing basis (inclusive or exclusive). */
    unitPrice: number | string;
    /** Required only for lines that do not reference an original line. */
    treatment?: TaxTreatment | null;
    ratePercent?: number | string | null;
  }[];
  /** Mandatory explanation of why the debit note is being issued. */
  reason: string;
  createdById?: string | null;
}

/**
 * Debit Note: an *upward* correction — additional quantity, a price increase after
 * delivery, or items omitted from the original invoice. Tax is calculated by the central
 * TaxCalculationService using the original line's historical treatment and rate.
 */
export async function issueDebitNote(tx: Tx, opts: IssueDebitNoteOptions) {
  if (!opts.reason?.trim()) throw new TaxError("REASON_REQUIRED", "A reason is required to issue a debit note");
  if (opts.items.length === 0) throw new TaxError("NO_LINES", "A debit note needs at least one line");

  const parent = await loadAdjustableParent(tx, opts.businessId, opts.parentDocumentId, "Debit note");
  const parentLines = new Map(parent.lines.map((l) => [l.id, l]));
  const inclusive = parent.pricingMode === "TAX_INCLUSIVE";

  const inputs = opts.items.map((it, idx) => {
    const pl = it.parentLineId ? parentLines.get(it.parentLineId) : null;
    if (it.parentLineId && !pl) {
      throw new TaxError("PARENT_LINE_NOT_FOUND", "A debit-note line does not belong to the original document", 404);
    }
    const treatment = (pl?.treatment ?? it.treatment) as TaxTreatment | undefined;
    if (!treatment) {
      throw new TaxError("TREATMENT_REQUIRED", `Debit note line ${idx + 1}: reference an original line or supply a tax treatment`);
    }
    const rate = pl ? pl.ratePercent.toString() : treatment === "STANDARD_RATED" ? String(it.ratePercent ?? "") : "0";
    if (treatment === "STANDARD_RATED" && (rate === "" || rate === "undefined")) {
      throw new TaxError("RATE_REQUIRED", `Debit note line ${idx + 1}: a tax rate is required for standard-rated lines`);
    }
    return {
      line: {
        key: `dn_${idx}`,
        description: it.description?.trim() || pl?.description || "Additional charge",
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        treatment,
        ratePercent: rate,
        rateRef: pl ? { taxRateId: pl.taxRateId, taxRateVersionId: pl.taxRateVersionId } : null,
        pricesIncludeTax: pl ? pl.priceIncludesTax : inclusive,
      },
      pl,
    };
  });

  const calc = TaxCalculationService.calculate(
    inputs.map((i) => i.line),
    {
      pricingMode: parent.pricingMode,
      roundingLevel: parent.roundingLevel,
      roundingMode: "HALF_UP",
      currencyDecimals: 2,
    }
  );

  const lineData: LineData[] = calc.lines.map((l, idx) => {
    const pl = inputs[idx].pl;
    return {
      lineNo: idx + 1,
      productId: pl?.productId ?? null,
      variantId: pl?.variantId ?? null,
      saleItemId: pl?.saleItemId ?? null,
      parentLineId: pl?.id ?? null,
      description: l.description,
      sku: pl?.sku ?? null,
      unit: pl?.unit ?? null,
      quantity: new D(l.quantity),
      unitPrice: new D(l.unitPrice),
      priceIncludesTax: l.priceIncludesTax,
      grossAmount: new D(l.grossAmount),
      discountAmount: new D(l.discountTotal),
      taxableValue: new D(l.taxableValue),
      taxAmount: new D(l.taxAmount),
      lineTotal: new D(l.lineTotal),
      treatment: l.treatment,
      ratePercent: new D(l.ratePercent),
      taxRateId: pl?.taxRateId ?? null,
      taxRateVersionId: pl?.taxRateVersionId ?? null,
      taxCategoryId: pl?.taxCategoryId ?? null,
      taxCategoryName: pl?.taxCategoryName ?? null,
      exemptionReason: pl?.exemptionReason ?? null,
    };
  });

  const issueDate = new Date();
  const num = await numberFor(tx, opts.businessId, "DEBIT_NOTE", issueDate);
  const { totals, breakdown } = summarizeLines(calc.lines, calc.currencyDecimals);
  const header = adjustmentHeader(parent, {
    documentType: "DEBIT_NOTE",
    num,
    issueDate,
    totals,
    breakdown,
    reason: opts.reason.trim(),
    label: "Debit Note",
    refundId: null,
    saleId: parent.saleId,
    purchaseId: null,
    paymentMethod: null,
    createdById: opts.createdById ?? null,
    templateKey: "DEBIT_NOTE_A4",
  });
  return persistDocument(tx, header, lineData);
}

function adjustmentHeader(
  parent: Prisma.TaxDocumentGetPayload<object>,
  a: {
    documentType: "CREDIT_NOTE" | "DEBIT_NOTE";
    num: { documentNumber: string; sequenceKey: string; sequenceNumber: number };
    issueDate: Date;
    totals: {
      grossTotal: string;
      discountTotal: string;
      netValue: string;
      standardRatedValue: string;
      zeroRatedValue: string;
      exemptValue: string;
      outOfScopeValue: string;
      taxTotal: string;
      grandTotal: string;
    };
    breakdown: unknown;
    reason: string;
    label: string;
    refundId: string | null;
    saleId: string | null;
    purchaseId: string | null;
    paymentMethod: string | null;
    createdById: string | null;
    templateKey: string;
  }
): DocHeader {
  return {
    businessId: parent.businessId,
    branchId: parent.branchId,
    direction: "OUTPUT",
    documentType: a.documentType,
    documentNumber: a.num.documentNumber,
    sequenceKey: a.num.sequenceKey,
    sequenceNumber: a.num.sequenceNumber,
    issueDate: a.issueDate,
    supplyDate: parent.supplyDate,

    // Snapshots are copied from the original document, never from live profile data.
    sellerName: parent.sellerName,
    sellerTin: parent.sellerTin,
    sellerVatNumber: parent.sellerVatNumber,
    sellerAddress: parent.sellerAddress,
    sellerPhone: parent.sellerPhone,
    sellerVatStatus: parent.sellerVatStatus,
    buyerName: parent.buyerName,
    buyerTin: parent.buyerTin,
    buyerVatNumber: parent.buyerVatNumber,
    buyerAddress: parent.buyerAddress,
    buyerPhone: parent.buyerPhone,
    customerId: parent.customerId,

    currency: parent.currency,
    pricingMode: parent.pricingMode,
    roundingLevel: parent.roundingLevel,

    grossTotal: new D(a.totals.grossTotal),
    discountTotal: new D(a.totals.discountTotal),
    netValue: new D(a.totals.netValue),
    standardRatedValue: new D(a.totals.standardRatedValue),
    zeroRatedValue: new D(a.totals.zeroRatedValue),
    exemptValue: new D(a.totals.exemptValue),
    outOfScopeValue: new D(a.totals.outOfScopeValue),
    taxTotal: new D(a.totals.taxTotal),
    grandTotal: new D(a.totals.grandTotal),
    breakdown: a.breakdown as Prisma.InputJsonValue,
    amountInWords: amountInWordsLKR(a.totals.grandTotal),

    paymentMethod: a.paymentMethod,
    paidAmount: new D(0),
    balanceDue: new D(0),
    notes: `${a.label} against ${parent.documentNumber}. Reason: ${a.reason}`,
    templateKey: a.templateKey,
    complianceVersion: COMPLIANCE_PROFILE_VERSION,

    parentDocumentId: parent.id,
    adjustmentReason: a.reason,
    saleId: a.saleId,
    purchaseId: a.purchaseId,
    refundId: a.refundId,
    createdById: a.createdById,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT: supplier invoices (purchases), expenses, supplier credit / debit notes
// ─────────────────────────────────────────────────────────────────────────────

export interface InputDocumentLine {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  taxableValue: number | string;
  taxAmount: number | string;
  ratePercent?: number | string;
  treatment?: TaxTreatment;
  purchaseItemId?: string | null;
  productId?: string | null;
  unit?: string | null;
}

export interface IssueInputDocumentOptions {
  businessId: string;
  branchId?: string | null;
  documentType: Extract<TaxDocumentType, "COMMERCIAL_INVOICE" | "TAX_INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE">;
  /** Internal, unique number (GRN / expense / note number). */
  documentNumber?: string;
  /** Number printed on the supplier's own document. */
  externalDocumentNo?: string | null;
  issueDate: Date;
  supplyDate: Date;
  supplier: {
    id?: string | null;
    name: string;
    tin?: string | null;
    vatNumber?: string | null;
    address?: string | null;
    phone?: string | null;
  };
  buyerName: string;
  pricesIncludeTax: boolean;
  lines: InputDocumentLine[];
  inputVatEligibility: "ELIGIBLE" | "INELIGIBLE" | "UNDER_REVIEW";
  purchaseId?: string | null;
  expenseId?: string | null;
  parentDocumentId?: string | null;
  adjustmentReason?: string | null;
  discountTotal?: number | string;
  paidAmount?: number | string;
  paymentMethod?: string | null;
  notes?: string | null;
  createdById?: string | null;
}

/**
 * Records a purchase-side document (supplier invoice / expense / supplier note) so the
 * Input VAT register is built from finalized transactional data. Document numbers are
 * internal and unique; the supplier's own number is kept in `externalDocumentNo`, so two
 * suppliers reusing the same invoice number can never collide.
 */
export async function issueInputDocument(tx: Tx, opts: IssueInputDocumentOptions) {
  if (opts.lines.length === 0) throw new TaxError("NO_LINES", "An input document needs at least one line");

  const lines: LineData[] = opts.lines.map((l, idx) => {
    const taxable = new D(l.taxableValue);
    const tax = new D(l.taxAmount);
    const treatment: TaxTreatment = l.treatment ?? (tax.gt(0) ? "STANDARD_RATED" : "OUT_OF_SCOPE");
    const rate =
      l.ratePercent !== undefined
        ? new D(l.ratePercent)
        : taxable.gt(0) && tax.gt(0)
          ? tax.div(taxable).times(100).toDecimalPlaces(4)
          : new D(0);
    const total = taxable.plus(tax);
    return {
      lineNo: idx + 1,
      productId: l.productId ?? null,
      purchaseItemId: l.purchaseItemId ?? null,
      description: l.description,
      unit: l.unit ?? null,
      quantity: new D(l.quantity),
      unitPrice: new D(l.unitPrice),
      priceIncludesTax: opts.pricesIncludeTax,
      grossAmount: total,
      discountAmount: new D(0),
      taxableValue: taxable,
      taxAmount: tax,
      lineTotal: total,
      treatment,
      ratePercent: rate,
    };
  });

  const { totals, breakdown } = summarizeDocumentLines(
    lines.map((l) => ({
      treatment: l.treatment as TaxTreatment,
      ratePercent: String(l.ratePercent ?? 0),
      grossAmount: String(l.grossAmount),
      discountAmount: String(l.discountAmount),
      taxableValue: String(l.taxableValue),
      taxAmount: String(l.taxAmount),
      lineTotal: String(l.lineTotal),
    }))
  );
  const discount = new D(opts.discountTotal ?? 0);

  let documentNumber = opts.documentNumber;
  let sequenceKey: string | null = null;
  let sequenceNumber: number | null = null;
  if (!documentNumber) {
    const alloc = await allocateDocumentNumber(tx, {
      businessId: opts.businessId,
      documentType: `INPUT_${opts.documentType}`,
      prefix: opts.documentType === "CREDIT_NOTE" ? "SCN" : opts.documentType === "DEBIT_NOTE" ? "SDN" : "PIN",
      issueDate: opts.issueDate,
      resetPeriod: "NEVER",
      minDigits: 6,
    });
    documentNumber = alloc.documentNumber;
    sequenceKey = alloc.sequenceKey;
    sequenceNumber = alloc.sequenceNumber;
  }

  const paid = new D(opts.paidAmount ?? 0);
  const header: DocHeader = {
    businessId: opts.businessId,
    branchId: opts.branchId ?? null,
    direction: "INPUT",
    documentType: opts.documentType,
    documentNumber,
    sequenceKey,
    sequenceNumber,
    externalDocumentNo: opts.externalDocumentNo ?? null,
    issueDate: opts.issueDate,
    supplyDate: opts.supplyDate,

    sellerName: opts.supplier.name,
    sellerTin: opts.supplier.tin ?? null,
    sellerVatNumber: opts.supplier.vatNumber ?? null,
    sellerAddress: opts.supplier.address ?? null,
    sellerPhone: opts.supplier.phone ?? null,
    sellerVatStatus: opts.supplier.vatNumber ? "REGISTERED" : "NOT_REGISTERED",
    supplierId: opts.supplier.id ?? null,
    buyerName: opts.buyerName,

    currency: "LKR",
    pricingMode: opts.pricesIncludeTax ? "TAX_INCLUSIVE" : "TAX_EXCLUSIVE",
    roundingLevel: "LINE",

    grossTotal: new D(totals.grandTotal).plus(discount),
    discountTotal: discount,
    netValue: new D(totals.netValue),
    standardRatedValue: new D(totals.standardRatedValue),
    zeroRatedValue: new D(totals.zeroRatedValue),
    exemptValue: new D(totals.exemptValue),
    outOfScopeValue: new D(totals.outOfScopeValue),
    taxTotal: new D(totals.taxTotal),
    grandTotal: new D(totals.grandTotal),
    breakdown: breakdown as unknown as Prisma.InputJsonValue,
    paymentMethod: opts.paymentMethod ?? null,
    paidAmount: paid,
    balanceDue: D.max(new D(0), new D(totals.grandTotal).minus(paid)),
    notes: opts.notes ?? null,
    templateKey: "STANDARD_A4",
    complianceVersion: COMPLIANCE_PROFILE_VERSION,

    purchaseId: opts.purchaseId ?? null,
    expenseId: opts.expenseId ?? null,
    parentDocumentId: opts.parentDocumentId ?? null,
    adjustmentReason: opts.adjustmentReason ?? null,
    inputVatEligibility: opts.inputVatEligibility,
    createdById: opts.createdById ?? null,
  };
  return persistDocument(tx, header, lines);
}

export { validateBuyerForTaxInvoice };
