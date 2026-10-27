import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { generateTaxInvoicePdf } from "@/lib/tax/pdf-generator";
import { toErrorResponse } from "@/lib/tax/errors";
import type { TaxDocumentType } from "@/lib/tax/constants";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const doc = await prisma.taxDocument.findFirst({
      where: { id, businessId: tenant.businessId },
      include: {
        lines: { orderBy: { lineNo: "asc" } },
        parentDocument: { select: { documentNumber: true } },
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Tax document not found" }, { status: 404 });
    }

    const pdfBytes = await generateTaxInvoicePdf({
      documentType: doc.documentType as TaxDocumentType,
      documentNumber: doc.documentNumber,
      parentDocumentNumber: doc.parentDocument?.documentNumber || null,
      adjustmentReason: doc.adjustmentReason || null,
      issueDate: doc.issueDate.toISOString().slice(0, 10),
      supplyDate: doc.supplyDate.toISOString().slice(0, 10),
      dueDate: doc.dueDate ? doc.dueDate.toISOString().slice(0, 10) : null,
      currency: doc.currency,
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
      },
      lines: doc.lines.map((l) => ({
        lineNo: l.lineNo,
        description: l.description,
        unit: l.unit,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        taxableValue: Number(l.taxableValue),
        ratePercent: Number(l.ratePercent),
        taxAmount: Number(l.taxAmount),
        lineTotal: Number(l.lineTotal),
        treatment: l.treatment,
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
      },
      amountInWords: doc.amountInWords,
      paymentMethod: doc.paymentMethod,
      notes: doc.notes,
      complianceVersion: doc.complianceVersion,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${doc.documentNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation route error:", error);
    return toErrorResponse(error);
  }
}
