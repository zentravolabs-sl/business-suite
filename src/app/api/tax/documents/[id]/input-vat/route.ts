import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTax, clientIp } from "@/lib/tax/access";
import { recordInputVatReclassificationEntry } from "@/lib/accounting";
import { toErrorResponse } from "@/lib/tax/errors";
import { TAX_PERMISSIONS, INPUT_VAT_ELIGIBILITY, type InputVatEligibility } from "@/lib/tax/constants";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeTax({ anyOf: [TAX_PERMISSIONS.REVIEW_INPUT_VAT] });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const { id } = await params;
    const body = await req.json();
    const { eligibility, note } = body;

    if (!eligibility || !INPUT_VAT_ELIGIBILITY.includes(eligibility as InputVatEligibility)) {
      return NextResponse.json(
        { error: `Invalid eligibility. Must be one of: ${INPUT_VAT_ELIGIBILITY.join(", ")}` },
        { status: 400 }
      );
    }

    const doc = await prisma.taxDocument.findFirst({
      where: { id, businessId: tenant.businessId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Tax document not found" }, { status: 404 });
    }

    if (doc.direction !== "INPUT") {
      return NextResponse.json(
        { error: "Input VAT eligibility review applies only to input/purchase tax documents" },
        { status: 400 }
      );
    }

    const priorEligibility = doc.inputVatEligibility;
    if (priorEligibility === eligibility) {
      return NextResponse.json({ success: true, document: doc });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.taxDocument.update({
        where: { id: doc.id },
        data: {
          inputVatEligibility: eligibility as InputVatEligibility,
          inputVatReviewedById: tenant.userId,
          inputVatReviewedAt: new Date(),
          inputVatReviewNote: note ? String(note).trim() : null,
        },
      });

      // If eligibility changed between ELIGIBLE and INELIGIBLE, perform general ledger reclassification
      const wasEligible = priorEligibility === "ELIGIBLE";
      const isNowEligible = eligibility === "ELIGIBLE";

      if (wasEligible !== isNowEligible && Number(doc.taxTotal) > 0) {
        await recordInputVatReclassificationEntry({
          tx,
          businessId: tenant.businessId,
          documentNumber: doc.documentNumber,
          taxAmount: Number(doc.taxTotal),
          toEligible: isNowEligible,
          isInventory: !!doc.purchaseId,
        });
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          businessId: tenant.businessId,
          userId: tenant.userId,
          action: "UPDATE",
          entity: "TaxDocumentInputVat",
          entityId: doc.id,
          oldValue: { inputVatEligibility: priorEligibility },
          newValue: {
            inputVatEligibility: eligibility,
            note: note || null,
            reviewedBy: tenant.userId,
          },
          ipAddress: clientIp(req),
        },
      });

      return res;
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
