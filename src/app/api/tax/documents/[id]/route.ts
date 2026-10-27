import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { toErrorResponse } from "@/lib/tax/errors";

/**
 * GET /api/tax/documents/[id]
 *
 * Returns the full tax document including all line items, branch info, and
 * the parent document reference (for credit / debit notes).
 *
 * Callers: print-client, POS receipt overlay, any external integration.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canView =
      tenant.isOwner ||
      hasPermission(tenant.permissions, "tax.view") ||
      hasPermission(tenant.permissions, "reports.view") ||
      hasPermission(tenant.permissions, "sales.view");
    if (!canView) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;

    const doc = await prisma.taxDocument.findFirst({
      where: { id, businessId: tenant.businessId },
      include: {
        lines: { orderBy: { lineNo: "asc" } },
        branch: { select: { name: true, code: true } },
        parentDocument: {
          select: {
            id: true,
            documentNumber: true,
            documentType: true,
          },
        },
        adjustments: {
          select: {
            id: true,
            documentNumber: true,
            documentType: true,
            grandTotal: true,
            status: true,
          },
        },
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Tax document not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: doc.id,
      direction: doc.direction,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber,
      status: doc.status,
      classificationCode: doc.classificationCode,
      sequenceNumber: doc.sequenceNumber,
      issueDate: doc.issueDate.toISOString().slice(0, 10),
      supplyDate: doc.supplyDate.toISOString().slice(0, 10),
      dueDate: doc.dueDate ? doc.dueDate.toISOString().slice(0, 10) : null,
      currency: doc.currency,
      pricingMode: doc.pricingMode,
      roundingLevel: doc.roundingLevel,

      seller: {
        name: doc.sellerName,
        tin: doc.sellerTin,
        vatNumber: doc.sellerVatNumber,
        address: doc.sellerAddress,
        phone: doc.sellerPhone,
        vatStatus: doc.sellerVatStatus,
      },
      buyer: {
        name: doc.buyerName,
        tin: doc.buyerTin,
        vatNumber: doc.buyerVatNumber,
        address: doc.buyerAddress,
        phone: doc.buyerPhone,
        customerId: doc.customerId,
      },

      lines: doc.lines.map((l) => ({
        id: l.id,
        lineNo: l.lineNo,
        productId: l.productId,
        description: l.description,
        unit: l.unit,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice).toFixed(2),
        priceIncludesTax: l.priceIncludesTax,
        grossAmount: Number(l.grossAmount).toFixed(2),
        discountAmount: Number(l.discountAmount).toFixed(2),
        taxableValue: Number(l.taxableValue).toFixed(2),
        ratePercent: Number(l.ratePercent),
        taxAmount: Number(l.taxAmount).toFixed(2),
        lineTotal: Number(l.lineTotal).toFixed(2),
        treatment: l.treatment,
        taxRateId: l.taxRateId,
        taxRateVersionId: l.taxRateVersionId,
        exemptionReason: l.exemptionReason,
      })),

      totals: {
        grossTotal: Number(doc.grossTotal).toFixed(2),
        discountTotal: Number(doc.discountTotal).toFixed(2),
        netValue: Number(doc.netValue).toFixed(2),
        standardRatedValue: Number(doc.standardRatedValue).toFixed(2),
        zeroRatedValue: Number(doc.zeroRatedValue).toFixed(2),
        exemptValue: Number(doc.exemptValue).toFixed(2),
        outOfScopeValue: Number(doc.outOfScopeValue).toFixed(2),
        taxTotal: Number(doc.taxTotal).toFixed(2),
        grandTotal: Number(doc.grandTotal).toFixed(2),
        paidAmount: Number(doc.paidAmount).toFixed(2),
        balanceDue: Number(doc.balanceDue).toFixed(2),
      },

      breakdown: doc.breakdown,
      amountInWords: doc.amountInWords,
      paymentMethod: doc.paymentMethod,
      notes: doc.notes,
      notices: doc.notices,
      templateKey: doc.templateKey,
      complianceVersion: doc.complianceVersion,

      inputVatEligibility: doc.inputVatEligibility,
      irdStatus: doc.irdStatus,

      saleId: doc.saleId,
      purchaseId: doc.purchaseId,
      refundId: doc.refundId,
      onlineOrderId: doc.onlineOrderId,
      expenseId: doc.expenseId,
      adjustmentReason: doc.adjustmentReason,

      parentDocument: doc.parentDocument
        ? {
            id: doc.parentDocument.id,
            documentNumber: doc.parentDocument.documentNumber,
            documentType: doc.parentDocument.documentType,
          }
        : null,
      adjustments: (doc.adjustments || []).map((c) => ({
        id: c.id,
        documentNumber: c.documentNumber,
        documentType: c.documentType,
        grandTotal: Number(c.grandTotal),
        status: c.status,
      })),

      branch: doc.branch ? { name: doc.branch.name, code: doc.branch.code } : null,
      finalizedAt: doc.finalizedAt ? doc.finalizedAt.toISOString() : null,
    });
  } catch (error) {
    console.error("GET /api/tax/documents/[id] error:", error);
    return toErrorResponse(error);
  }
}
