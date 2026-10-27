import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTax } from "@/lib/tax/access";
import { issueDebitNote } from "@/lib/tax/document-service";
import { recordDebitNoteJournalEntry } from "@/lib/accounting";
import { toErrorResponse } from "@/lib/tax/errors";
import { TAX_PERMISSIONS, type TaxTreatment } from "@/lib/tax/constants";

interface DebitNoteItemInput {
  parentLineId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  treatment?: TaxTreatment | null;
  ratePercent?: number | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeTax({ anyOf: [TAX_PERMISSIONS.ISSUE_DOCUMENTS] });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const { id: parentDocumentId } = await params;
    const body = await req.json();
    const { reason, items, paymentMethod = "CREDIT" } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "A reason is required to issue a debit note" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item line is required for a debit note" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Issue Debit Note via centralized tax document service
      const debitNote = await issueDebitNote(tx, {
        businessId: tenant.businessId,
        parentDocumentId,
        reason: reason.trim(),
        createdById: tenant.userId,
        items: items.map((it: DebitNoteItemInput) => ({
          parentLineId: it.parentLineId || null,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          treatment: it.treatment || null,
          ratePercent: it.ratePercent !== undefined ? it.ratePercent : null,
        })),
      });

      // 2. Record Double-Entry Accounting
      await recordDebitNoteJournalEntry({
        tx,
        businessId: tenant.businessId,
        debitNoteNumber: debitNote.documentNumber,
        taxableAmount: Number(debitNote.netValue),
        taxAmount: Number(debitNote.taxTotal),
        totalAmount: Number(debitNote.grandTotal),
        paymentMethod,
        referenceId: debitNote.id,
      });

      return debitNote;
    });

    return NextResponse.json({ success: true, debitNote: result }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
