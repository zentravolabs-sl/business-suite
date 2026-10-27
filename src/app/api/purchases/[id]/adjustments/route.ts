import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { issueInputDocument, type InputDocumentLine } from "@/lib/tax/document-service";
import { allocateDocumentNumber } from "@/lib/tax/sequence-service";
import { recordSupplierCreditDebitNoteEntry } from "@/lib/accounting";
import { toErrorResponse, TaxError } from "@/lib/tax/errors";
import { Prisma } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canAdjust =
      tenant.isOwner ||
      hasPermission(tenant.permissions, "purchases.edit") ||
      hasPermission(tenant.permissions, "tax.issue_documents");

    if (!canAdjust) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id: purchaseId } = await params;
    const body = await req.json();
    const {
      type, // "CREDIT_NOTE" | "DEBIT_NOTE"
      supplierInvoiceNo,
      reason,
      netAmount,
      taxAmount = 0,
      totalAmount,
      paymentMethod = "CREDIT",
      items = [],
    } = body;

    if (type !== "CREDIT_NOTE" && type !== "DEBIT_NOTE") {
      return NextResponse.json({ error: "Adjustment type must be CREDIT_NOTE or DEBIT_NOTE" }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "Reason is required for supplier adjustment" }, { status: 400 });
    }

    const total = Number(totalAmount || (Number(netAmount || 0) + Number(taxAmount || 0)));
    const net = Number(netAmount || (total - Number(taxAmount || 0)));
    const tax = Number(taxAmount || 0);

    if (total <= 0) {
      return NextResponse.json({ error: "Total adjustment amount must be greater than zero" }, { status: 400 });
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, businessId: tenant.businessId },
      include: {
        supplier: true,
        payables: true,
        taxDocuments: { where: { status: "FINALIZED" } },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Purchase record not found" }, { status: 404 });
    }

    const parentDoc = purchase.taxDocuments[0];

    const result = await prisma.$transaction(async (tx) => {
      // 1. Allocate adjustment number
      const prefix = type === "CREDIT_NOTE" ? "SCN" : "SDN";
      const { documentNumber: adjNumber } = await allocateDocumentNumber(tx, {
        businessId: tenant.businessId,
        documentType: type,
        prefix,
        resetPeriod: "YEARLY",
        minDigits: 5,
      });

      // 2. Prepare lines for the input tax document
      const inputLines: InputDocumentLine[] =
        Array.isArray(items) && items.length > 0
          ? items.map((it: any) => ({
              description: it.name || `Adjustment line for Product #${it.productId}`,
              quantity: it.quantity || 1,
              unitPrice: it.unitCost || net,
              taxableValue: Number(it.taxableValue || it.unitCost * it.quantity || net).toFixed(2),
              taxAmount: Number(it.taxAmount || 0).toFixed(2),
              treatment: tax > 0 ? "STANDARD_RATED" : "OUT_OF_SCOPE",
              productId: it.productId,
            }))
          : [
              {
                description: `${type === "CREDIT_NOTE" ? "Supplier Credit Note" : "Supplier Debit Note"}: ${reason}`,
                quantity: 1,
                unitPrice: net,
                taxableValue: net.toFixed(2),
                taxAmount: tax.toFixed(2),
                treatment: tax > 0 ? "STANDARD_RATED" : "OUT_OF_SCOPE",
              },
            ];

      // 3. Issue INPUT TaxDocument for the adjustment
      const isVatEligible = purchase.inputVatEligibility === "ELIGIBLE";
      const doc = await issueInputDocument(tx, {
        businessId: tenant.businessId,
        branchId: purchase.branchId,
        documentType: type,
        documentNumber: adjNumber,
        externalDocumentNo: supplierInvoiceNo || null,
        issueDate: new Date(),
        supplyDate: purchase.receivedDate,
        parentDocumentId: parentDoc?.id || null,
        adjustmentReason: reason.trim(),
        supplier: {
          id: purchase.supplierId,
          name: purchase.supplier.name,
          tin: purchase.supplier.taxNumber || purchase.supplier.vatNumber || null,
          vatNumber: purchase.supplier.vatNumber || null,
          address: purchase.supplier.address || null,
          phone: purchase.supplier.phone || null,
        },
        buyerName: tenant.businessName,
        pricesIncludeTax: purchase.pricesIncludeTax,
        inputVatEligibility: (purchase.inputVatEligibility as "ELIGIBLE" | "INELIGIBLE" | "UNDER_REVIEW") || "ELIGIBLE",
        purchaseId: purchase.id,
        lines: inputLines,
        paidAmount: paymentMethod !== "CREDIT" ? total : 0,
        paymentMethod,
        createdById: tenant.userId,
        notes: `Supplier ${type}: ${reason}`,
      });

      // 4. Update Supplier Payable / Accounts Payable
      if (paymentMethod === "CREDIT") {
        const delta = type === "CREDIT_NOTE" ? -total : total;

        const openPayable = purchase.payables.find((p) => p.status === "PENDING" || p.status === "PARTIAL");
        if (openPayable) {
          const newBal = Math.max(0, Number(openPayable.balance) + delta);
          await tx.supplierPayable.update({
            where: { id: openPayable.id },
            data: {
              balance: new Prisma.Decimal(newBal),
              status: newBal <= 0 ? "PAID" : "PARTIAL",
            },
          });
        }

        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: { creditBalance: { increment: new Prisma.Decimal(delta) } },
        });
      }

      // 5. Stock movement if returning goods to vendor
      if (type === "CREDIT_NOTE" && Array.isArray(items) && items.length > 0) {
        for (const it of items) {
          if (!it.productId || !it.quantity) continue;

          const stock = await tx.stock.findFirst({
            where: { branchId: purchase.branchId, productId: it.productId },
          });

          const currentQty = stock?.quantity || 0;
          const newQty = Math.max(0, currentQty - Number(it.quantity));

          if (stock) {
            await tx.stock.update({
              where: { id: stock.id },
              data: { quantity: newQty },
            });
          }

          await tx.stockMovement.create({
            data: {
              businessId: tenant.businessId,
              branchId: purchase.branchId,
              productId: it.productId,
              type: "RETURN_OUT",
              quantity: -Number(it.quantity),
              quantityBefore: currentQty,
              quantityAfter: newQty,
              unitCost: new Prisma.Decimal(it.unitCost || 0),
              referenceType: "PurchaseReturn",
              referenceId: purchase.id,
              notes: `Vendor return via ${adjNumber}: ${reason}`,
              userId: tenant.userId,
            },
          });
        }
      }

      // 6. Record Double-Entry Accounting
      await recordSupplierCreditDebitNoteEntry({
        tx,
        businessId: tenant.businessId,
        adjustmentNumber: adjNumber,
        type,
        netAmount: net,
        taxAmount: tax,
        totalAmount: total,
        inputVatEligible: isVatEligible,
        paymentMethod,
        referenceId: doc.id,
      });

      return {
        adjustmentNumber: adjNumber,
        taxDocument: doc,
      };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
