import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { parseBusinessDateRange, businessMonthKey, businessQuarterKey } from "./dates";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type Dec = InstanceType<typeof D>;

export interface TaxReportFilters {
  businessId: string;
  branchId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  from?: string | null;
  to?: string | null;
}

export interface TaxSummaryTotals {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  outputVat: {
    totalGross: string;
    totalDiscount: string;
    totalNetTaxable: string;
    standardRatedTaxable: string;
    zeroRatedTaxable: string;
    exemptTaxable: string;
    outOfScopeTaxable: string;
    outputVatTotal: string;
    invoiceCount: number;
  };
  inputVat: {
    totalPurchasesGross: string;
    eligibleInputVat: string;
    ineligibleInputVat: string;
    underReviewInputVat: string;
    totalInputVat: string;
    purchaseCount: number;
  };
  adjustments: {
    creditNoteTotal: string;
    creditNoteVatReversed: string;
    creditNoteCount: number;
    debitNoteTotal: string;
    debitNoteVatAdded: string;
    debitNoteCount: number;
  };
  netTaxPayable: {
    netOutputVat: string;
    eligibleInputVatDeduction: string;
    payableToIrd: string;
  };
  treatmentsBreakdown: {
    treatment: string;
    ratePercent: string;
    taxableValue: string;
    taxAmount: string;
    lineCount: number;
  }[];
}

export interface TaxReportLineItem {
  treatment: string;
  ratePercent: number | string | Prisma.Decimal;
  taxableValue: number | string | Prisma.Decimal;
  taxAmount: number | string | Prisma.Decimal;
}

export interface TaxReportDocumentInput {
  documentType: string;
  direction?: string;
  grandTotal: number | string | Prisma.Decimal;
  discountTotal?: number | string | Prisma.Decimal;
  grossTotal?: number | string | Prisma.Decimal;
  netValue?: number | string | Prisma.Decimal;
  standardRatedValue?: number | string | Prisma.Decimal;
  zeroRatedValue?: number | string | Prisma.Decimal;
  exemptValue?: number | string | Prisma.Decimal;
  outOfScopeValue?: number | string | Prisma.Decimal;
  taxTotal: number | string | Prisma.Decimal;
  inputVatEligibility?: string | null;
  lines?: TaxReportLineItem[];
}

/**
 * Pure aggregation function: reconciles any list of output docs & input docs.
 * Unit-testable without database.
 */
export function aggregateTaxSummary(
  outputDocs: TaxReportDocumentInput[],
  inputDocs: TaxReportDocumentInput[],
  period: { startDate: string | null; endDate: string | null } = { startDate: null, endDate: null }
): TaxSummaryTotals {
  const zero = () => new D(0);

  let totalGross = zero();
  let totalDiscount = zero();
  let totalNetTaxable = zero();
  let standardRatedTaxable = zero();
  let zeroRatedTaxable = zero();
  let exemptTaxable = zero();
  let outOfScopeTaxable = zero();
  let outputVatTotal = zero();
  let invoiceCount = 0;

  let creditNoteTotal = zero();
  let creditNoteVatReversed = zero();
  let creditNoteCount = 0;

  let debitNoteTotal = zero();
  let debitNoteVatAdded = zero();
  let debitNoteCount = 0;

  const treatmentMap = new Map<string, { treatment: string; ratePercent: string; taxable: Dec; tax: Dec; count: number }>();

  for (const doc of outputDocs) {
    if (doc.documentType === "CREDIT_NOTE") {
      creditNoteTotal = creditNoteTotal.plus(doc.grandTotal ?? 0);
      creditNoteVatReversed = creditNoteVatReversed.plus(doc.taxTotal ?? 0);
      creditNoteCount++;
      continue;
    }

    if (doc.documentType === "DEBIT_NOTE") {
      debitNoteTotal = debitNoteTotal.plus(doc.grandTotal ?? 0);
      debitNoteVatAdded = debitNoteVatAdded.plus(doc.taxTotal ?? 0);
      debitNoteCount++;
      continue;
    }

    invoiceCount++;
    totalGross = totalGross.plus(doc.grossTotal ?? 0);
    totalDiscount = totalDiscount.plus(doc.discountTotal ?? 0);
    totalNetTaxable = totalNetTaxable.plus(doc.netValue ?? 0);
    standardRatedTaxable = standardRatedTaxable.plus(doc.standardRatedValue ?? 0);
    zeroRatedTaxable = zeroRatedTaxable.plus(doc.zeroRatedValue ?? 0);
    exemptTaxable = exemptTaxable.plus(doc.exemptValue ?? 0);
    outOfScopeTaxable = outOfScopeTaxable.plus(doc.outOfScopeValue ?? 0);
    outputVatTotal = outputVatTotal.plus(doc.taxTotal ?? 0);

    if (Array.isArray(doc.lines)) {
      for (const line of doc.lines) {
        const rate = new D(line.ratePercent || 0).toString();
        const key = `${line.treatment}|${rate}`;
        const entry = treatmentMap.get(key) ?? {
          treatment: line.treatment,
          ratePercent: rate,
          taxable: zero(),
          tax: zero(),
          count: 0,
        };
        entry.taxable = entry.taxable.plus(line.taxableValue ?? 0);
        entry.tax = entry.tax.plus(line.taxAmount ?? 0);
        entry.count++;
        treatmentMap.set(key, entry);
      }
    }
  }

  let totalPurchasesGross = zero();
  let eligibleInputVat = zero();
  let ineligibleInputVat = zero();
  let underReviewInputVat = zero();
  let totalInputVat = zero();

  for (const doc of inputDocs) {
    totalPurchasesGross = totalPurchasesGross.plus(doc.grandTotal ?? 0);
    totalInputVat = totalInputVat.plus(doc.taxTotal ?? 0);

    if (doc.inputVatEligibility === "ELIGIBLE") {
      eligibleInputVat = eligibleInputVat.plus(doc.taxTotal ?? 0);
    } else if (doc.inputVatEligibility === "INELIGIBLE") {
      ineligibleInputVat = ineligibleInputVat.plus(doc.taxTotal ?? 0);
    } else {
      underReviewInputVat = underReviewInputVat.plus(doc.taxTotal ?? 0);
    }
  }

  const netOutputVat = outputVatTotal.minus(creditNoteVatReversed).plus(debitNoteVatAdded);
  const payableToIrd = netOutputVat.minus(eligibleInputVat);

  const treatmentsBreakdown = Array.from(treatmentMap.values()).map((val) => ({
    treatment: val.treatment,
    ratePercent: val.ratePercent,
    taxableValue: val.taxable.toFixed(2),
    taxAmount: val.tax.toFixed(2),
    lineCount: val.count,
  }));

  return {
    period,
    outputVat: {
      totalGross: totalGross.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      totalNetTaxable: totalNetTaxable.toFixed(2),
      standardRatedTaxable: standardRatedTaxable.toFixed(2),
      zeroRatedTaxable: zeroRatedTaxable.toFixed(2),
      exemptTaxable: exemptTaxable.toFixed(2),
      outOfScopeTaxable: outOfScopeTaxable.toFixed(2),
      outputVatTotal: outputVatTotal.toFixed(2),
      invoiceCount,
    },
    inputVat: {
      totalPurchasesGross: totalPurchasesGross.toFixed(2),
      eligibleInputVat: eligibleInputVat.toFixed(2),
      ineligibleInputVat: ineligibleInputVat.toFixed(2),
      underReviewInputVat: underReviewInputVat.toFixed(2),
      totalInputVat: totalInputVat.toFixed(2),
      purchaseCount: inputDocs.length,
    },
    adjustments: {
      creditNoteTotal: creditNoteTotal.toFixed(2),
      creditNoteVatReversed: creditNoteVatReversed.toFixed(2),
      creditNoteCount,
      debitNoteTotal: debitNoteTotal.toFixed(2),
      debitNoteVatAdded: debitNoteVatAdded.toFixed(2),
      debitNoteCount,
    },
    netTaxPayable: {
      netOutputVat: netOutputVat.toFixed(2),
      eligibleInputVatDeduction: eligibleInputVat.toFixed(2),
      payableToIrd: payableToIrd.toFixed(2),
    },
    treatmentsBreakdown,
  };
}

function buildDateFilter(filters: TaxReportFilters): { start: Date | null; end: Date | null } {
  if (filters.from || filters.to) {
    return parseBusinessDateRange(filters.from, filters.to);
  }
  return {
    start: filters.startDate || null,
    end: filters.endDate || null,
  };
}

// 1. Sales Tax Summary
export async function getTaxSummaryReport(filters: TaxReportFilters): Promise<TaxSummaryTotals> {
  const { start, end } = buildDateFilter(filters);

  const whereOutput: Prisma.TaxDocumentWhereInput = {
    businessId: filters.businessId,
    direction: "OUTPUT",
    status: "FINALIZED",
  };

  const whereInput: Prisma.TaxDocumentWhereInput = {
    businessId: filters.businessId,
    direction: "INPUT",
    status: "FINALIZED",
  };

  if (filters.branchId && filters.branchId !== "ALL") {
    whereOutput.branchId = filters.branchId;
    whereInput.branchId = filters.branchId;
  }

  if (start || end) {
    whereOutput.supplyDate = {};
    whereInput.supplyDate = {};
    if (start) {
      whereOutput.supplyDate.gte = start;
      whereInput.supplyDate.gte = start;
    }
    if (end) {
      whereOutput.supplyDate.lte = end;
      whereInput.supplyDate.lte = end;
    }
  }

  const [outputDocs, inputDocs] = await Promise.all([
    prisma.taxDocument.findMany({ where: whereOutput, include: { lines: true } }),
    prisma.taxDocument.findMany({ where: whereInput }),
  ]);

  return aggregateTaxSummary(outputDocs, inputDocs, {
    startDate: start ? start.toISOString().slice(0, 10) : null,
    endDate: end ? end.toISOString().slice(0, 10) : null,
  });
}

// 2. Output VAT Report
export async function getOutputVatReport(filters: TaxReportFilters) {
  const { start, end } = buildDateFilter(filters);
  const where: Prisma.TaxDocumentWhereInput = {
    businessId: filters.businessId,
    direction: "OUTPUT",
    status: "FINALIZED",
  };
  if (filters.branchId && filters.branchId !== "ALL") where.branchId = filters.branchId;
  if (start || end) {
    where.supplyDate = {};
    if (start) where.supplyDate.gte = start;
    if (end) where.supplyDate.lte = end;
  }

  const docs = await prisma.taxDocument.findMany({
    where,
    orderBy: { issueDate: "desc" },
    include: { branch: { select: { name: true } } },
  });

  return docs.map((d) => ({
    id: d.id,
    documentNumber: d.documentNumber,
    documentType: d.documentType,
    issueDate: d.issueDate.toISOString().slice(0, 10),
    supplyDate: d.supplyDate.toISOString().slice(0, 10),
    buyerName: d.buyerName,
    buyerTin: d.buyerTin,
    branchName: d.branch?.name || "Main",
    grossTotal: Number(d.grossTotal),
    discountTotal: Number(d.discountTotal),
    netValue: Number(d.netValue),
    standardRatedValue: Number(d.standardRatedValue),
    zeroRatedValue: Number(d.zeroRatedValue),
    exemptValue: Number(d.exemptValue),
    taxTotal: Number(d.taxTotal),
    grandTotal: Number(d.grandTotal),
  }));
}

// 3. Purchase / Input VAT Report
export async function getInputVatReport(filters: TaxReportFilters) {
  const { start, end } = buildDateFilter(filters);
  const where: Prisma.TaxDocumentWhereInput = {
    businessId: filters.businessId,
    direction: "INPUT",
    status: "FINALIZED",
  };
  if (filters.branchId && filters.branchId !== "ALL") where.branchId = filters.branchId;
  if (start || end) {
    where.supplyDate = {};
    if (start) where.supplyDate.gte = start;
    if (end) where.supplyDate.lte = end;
  }

  const docs = await prisma.taxDocument.findMany({
    where,
    orderBy: { issueDate: "desc" },
    include: { branch: { select: { name: true } } },
  });

  return docs.map((d) => ({
    id: d.id,
    documentNumber: d.documentNumber,
    externalDocumentNo: d.externalDocumentNo,
    documentType: d.documentType,
    issueDate: d.issueDate.toISOString().slice(0, 10),
    supplyDate: d.supplyDate.toISOString().slice(0, 10),
    supplierName: d.sellerName,
    supplierTin: d.sellerTin,
    branchName: d.branch?.name || "Main",
    netValue: Number(d.netValue),
    taxTotal: Number(d.taxTotal),
    grandTotal: Number(d.grandTotal),
    inputVatEligibility: d.inputVatEligibility,
    inputVatReviewNote: d.inputVatReviewNote,
  }));
}

// 4. Taxable Supplies Summary (Standard-Rated)
export async function getTaxableSuppliesReport(filters: TaxReportFilters) {
  const { start, end } = buildDateFilter(filters);
  const where: Prisma.TaxDocumentLineWhereInput = {
    document: {
      businessId: filters.businessId,
      direction: "OUTPUT",
      status: "FINALIZED",
      ...(filters.branchId && filters.branchId !== "ALL" ? { branchId: filters.branchId } : {}),
      ...(start || end
        ? {
            supplyDate: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
    },
    treatment: "STANDARD_RATED",
  };

  const lines = await prisma.taxDocumentLine.findMany({
    where,
    include: {
      document: { select: { documentNumber: true, issueDate: true, buyerName: true } },
    },
    orderBy: { document: { issueDate: "desc" } },
  });

  return lines.map((l) => ({
    id: l.id,
    documentNumber: l.document.documentNumber,
    issueDate: l.document.issueDate.toISOString().slice(0, 10),
    buyerName: l.document.buyerName,
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    taxableValue: Number(l.taxableValue),
    ratePercent: Number(l.ratePercent),
    taxAmount: Number(l.taxAmount),
    lineTotal: Number(l.lineTotal),
  }));
}

// 5. Zero-Rated Supplies Report
export async function getZeroRatedSuppliesReport(filters: TaxReportFilters) {
  const { start, end } = buildDateFilter(filters);
  const where: Prisma.TaxDocumentLineWhereInput = {
    document: {
      businessId: filters.businessId,
      direction: "OUTPUT",
      status: "FINALIZED",
      ...(filters.branchId && filters.branchId !== "ALL" ? { branchId: filters.branchId } : {}),
      ...(start || end
        ? {
            supplyDate: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
    },
    treatment: "ZERO_RATED",
  };

  const lines = await prisma.taxDocumentLine.findMany({
    where,
    include: {
      document: { select: { documentNumber: true, issueDate: true, buyerName: true } },
    },
    orderBy: { document: { issueDate: "desc" } },
  });

  return lines.map((l) => ({
    id: l.id,
    documentNumber: l.document.documentNumber,
    issueDate: l.document.issueDate.toISOString().slice(0, 10),
    buyerName: l.document.buyerName,
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    taxableValue: Number(l.taxableValue),
    exemptionReason: l.exemptionReason || "Zero-rated export / international supply",
  }));
}

// 6. Exempt Supplies Report
export async function getExemptSuppliesReport(filters: TaxReportFilters) {
  const { start, end } = buildDateFilter(filters);
  const where: Prisma.TaxDocumentLineWhereInput = {
    document: {
      businessId: filters.businessId,
      direction: "OUTPUT",
      status: "FINALIZED",
      ...(filters.branchId && filters.branchId !== "ALL" ? { branchId: filters.branchId } : {}),
      ...(start || end
        ? {
            supplyDate: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
    },
    treatment: "EXEMPT",
  };

  const lines = await prisma.taxDocumentLine.findMany({
    where,
    include: {
      document: { select: { documentNumber: true, issueDate: true, buyerName: true } },
    },
    orderBy: { document: { issueDate: "desc" } },
  });

  return lines.map((l) => ({
    id: l.id,
    documentNumber: l.document.documentNumber,
    issueDate: l.document.issueDate.toISOString().slice(0, 10),
    buyerName: l.document.buyerName,
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    taxableValue: Number(l.taxableValue),
    exemptionReason: l.exemptionReason || "Statutory exemption under VAT Act Schedule",
  }));
}

// 7. Credit & Debit Note Report
export async function getCreditDebitNoteReport(filters: TaxReportFilters) {
  const { start, end } = buildDateFilter(filters);
  const where: Prisma.TaxDocumentWhereInput = {
    businessId: filters.businessId,
    status: "FINALIZED",
    documentType: { in: ["CREDIT_NOTE", "DEBIT_NOTE"] },
  };
  if (filters.branchId && filters.branchId !== "ALL") where.branchId = filters.branchId;
  if (start || end) {
    where.supplyDate = {};
    if (start) where.supplyDate.gte = start;
    if (end) where.supplyDate.lte = end;
  }

  const docs = await prisma.taxDocument.findMany({
    where,
    orderBy: { issueDate: "desc" },
    include: {
      parentDocument: { select: { documentNumber: true, documentType: true } },
      branch: { select: { name: true } },
    },
  });

  return docs.map((d) => ({
    id: d.id,
    documentNumber: d.documentNumber,
    documentType: d.documentType,
    direction: d.direction,
    issueDate: d.issueDate.toISOString().slice(0, 10),
    parentDocumentNumber: d.parentDocument?.documentNumber || null,
    partyName: d.direction === "OUTPUT" ? d.buyerName : d.sellerName,
    reason: d.adjustmentReason || d.notes,
    taxableAmount: Number(d.netValue),
    taxAmount: Number(d.taxTotal),
    totalAmount: Number(d.grandTotal),
    branchName: d.branch?.name || "Main",
  }));
}

// 8. Tax Period Summary (Monthly / Quarterly Breakdown in Sri Lanka Calendar)
export async function getTaxPeriodSummaryReport(filters: TaxReportFilters, periodType: "MONTHLY" | "QUARTERLY" = "MONTHLY") {
  const { start, end } = buildDateFilter(filters);
  const where: Prisma.TaxDocumentWhereInput = {
    businessId: filters.businessId,
    status: "FINALIZED",
  };
  if (filters.branchId && filters.branchId !== "ALL") where.branchId = filters.branchId;
  if (start || end) {
    where.supplyDate = {};
    if (start) where.supplyDate.gte = start;
    if (end) where.supplyDate.lte = end;
  }

  const docs = await prisma.taxDocument.findMany({
    where,
    orderBy: { supplyDate: "asc" },
  });

  const periods = new Map<string, { outputDocs: TaxReportDocumentInput[]; inputDocs: TaxReportDocumentInput[] }>();

  for (const d of docs) {
    const key = periodType === "QUARTERLY" ? businessQuarterKey(d.supplyDate) : businessMonthKey(d.supplyDate);
    const p = periods.get(key) ?? { outputDocs: [], inputDocs: [] };
    if (d.direction === "OUTPUT") p.outputDocs.push(d);
    else p.inputDocs.push(d);
    periods.set(key, p);
  }

  const sortedKeys = Array.from(periods.keys()).sort();
  return sortedKeys.map((k) => {
    const { outputDocs, inputDocs } = periods.get(k)!;
    const summary = aggregateTaxSummary(outputDocs, inputDocs);
    return {
      periodKey: k,
      ...summary,
    };
  });
}

// 9. Tax Invoice Register
export async function getTaxInvoiceRegister(filters: TaxReportFilters) {
  const { start, end } = buildDateFilter(filters);
  const where: Prisma.TaxDocumentWhereInput = {
    businessId: filters.businessId,
    status: "FINALIZED",
  };

  if (filters.branchId && filters.branchId !== "ALL") {
    where.branchId = filters.branchId;
  }

  if (start || end) {
    where.supplyDate = {};
    if (start) where.supplyDate.gte = start;
    if (end) where.supplyDate.lte = end;
  }

  const documents = await prisma.taxDocument.findMany({
    where,
    orderBy: { issueDate: "desc" },
    include: {
      branch: { select: { name: true, code: true } },
    },
  });

  return documents.map((d) => ({
    id: d.id,
    direction: d.direction,
    documentType: d.documentType,
    documentNumber: d.documentNumber,
    issueDate: d.issueDate.toISOString().slice(0, 10),
    supplyDate: d.supplyDate.toISOString().slice(0, 10),
    customerSupplierName: d.direction === "OUTPUT" ? d.buyerName : d.sellerName,
    tin: d.direction === "OUTPUT" ? d.buyerTin : d.sellerTin,
    vatNumber: d.direction === "OUTPUT" ? d.buyerVatNumber : d.sellerVatNumber,
    branchName: d.branch?.name || "Main",
    grossTotal: Number(d.grossTotal),
    netValue: Number(d.netValue),
    standardRatedValue: Number(d.standardRatedValue),
    zeroRatedValue: Number(d.zeroRatedValue),
    exemptValue: Number(d.exemptValue),
    outOfScopeValue: Number(d.outOfScopeValue),
    taxTotal: Number(d.taxTotal),
    grandTotal: Number(d.grandTotal),
    inputVatEligibility: d.inputVatEligibility,
    status: d.status,
    irdStatus: d.irdStatus,
  }));
}
