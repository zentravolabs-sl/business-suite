import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { issueCreditNoteForRefund } from "@/lib/tax/document-service";
import { recordCreditNoteJournalEntry } from "@/lib/accounting";
import { toErrorResponse, TaxError } from "@/lib/tax/errors";
import { Prisma } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canRefund =
      tenant.isOwner ||
      hasPermission(tenant.permissions, "pos.refund_sale") ||
      hasPermission(tenant.permissions, "tax.issue_documents");

    if (!canRefund) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions for refund" }, { status: 403 });
    }

    const { id: saleId } = await params;
    const body = await req.json();
    const {
      reason = "Customer Return",
      restock = true,
      items: refundLines,
      refundMethod: reqRefundMethod,
    } = body;

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId: tenant.businessId },
      include: {
        items: true,
        payments: true,
        refunds: {
          include: { items: true },
        },
        taxDocuments: {
          where: { status: "FINALIZED" },
          include: { lines: true },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    if (sale.status === "REFUNDED") {
      return NextResponse.json({ error: "Sale is already fully refunded" }, { status: 400 });
    }

    const refundMethod = reqRefundMethod || sale.payments[0]?.method || "CASH";

    const refund = await prisma.$transaction(async (tx) => {
      // Find primary finalized TaxDocument (excluding existing credit notes)
      const parentDoc = sale.taxDocuments.find(
        (d) => d.status === "FINALIZED" && d.documentType !== "CREDIT_NOTE"
      );

      // Determine return items
      const itemsToProcess = Array.isArray(refundLines) && refundLines.length > 0
        ? refundLines
        : sale.items.map((it) => ({
            saleItemId: it.id,
            productId: it.productId,
            quantity: it.quantity,
          }));

      // Calculate previously refunded quantities per sale item
      const alreadyRefundedBySaleItemId = new Map<string, number>();
      for (const priorRefund of sale.refunds) {
        for (const rItem of priorRefund.items) {
          if (rItem.saleItemId) {
            const cur = alreadyRefundedBySaleItemId.get(rItem.saleItemId) || 0;
            alreadyRefundedBySaleItemId.set(rItem.saleItemId, cur + Number(rItem.quantity));
          }
        }
      }

      const creditNoteItemRequests: { parentLineId: string; returnedQuantity: number }[] = [];
      const createdRefundItemsData: any[] = [];

      let totalRefundAmount = 0;
      let totalTaxableAmount = 0;
      let totalTaxAmount = 0;
      let totalCostAmount = 0;

      for (const reqItem of itemsToProcess) {
        const saleItem = sale.items.find(
          (si) => si.id === reqItem.saleItemId || (reqItem.productId && si.productId === reqItem.productId)
        );
        if (!saleItem) continue;

        const returnedQty = Number(reqItem.quantity || saleItem.quantity);
        if (returnedQty <= 0) continue;

        const origQty = Number(saleItem.quantity);
        const previouslyRefunded = alreadyRefundedBySaleItemId.get(saleItem.id) || 0;
        const creditableQty = origQty - previouslyRefunded;

        if (returnedQty > creditableQty) {
          throw new TaxError(
            "CREDIT_EXCEEDS_INVOICE",
            `Cannot refund ${returnedQty} units of ${saleItem.name}; only ${creditableQty} remaining creditable units`
          );
        }

        // Match to parent document line if tax document exists
        const parentLine = parentDoc?.lines.find(
          (pl) => pl.saleItemId === saleItem.id || pl.productId === saleItem.productId
        );

        if (parentDoc && parentLine) {
          creditNoteItemRequests.push({
            parentLineId: parentLine.id,
            returnedQuantity: returnedQty,
          });
        }

        // Compute pro-rata refund amounts for the refund line record
        const ratio = returnedQty / origQty;
        const lineTotal = Number(saleItem.total) * ratio;
        const lineTax = Number(saleItem.taxAmount || 0) * ratio;
        const lineTaxable = lineTotal - lineTax;
        const lineCost = Number(saleItem.costPrice || 0) * returnedQty;

        totalRefundAmount += lineTotal;
        totalTaxableAmount += lineTaxable;
        totalTaxAmount += lineTax;
        totalCostAmount += lineCost;

        createdRefundItemsData.push({
          productId: saleItem.productId,
          variantId: saleItem.variantId || null,
          saleItemId: saleItem.id,
          quantity: returnedQty,
          unitPrice: saleItem.unitPrice,
          total: new Prisma.Decimal(lineTotal.toFixed(2)),
        });
      }

      if (createdRefundItemsData.length === 0) {
        throw new TaxError("NO_REFUND_ITEMS", "No valid items selected for refund");
      }

      // 1. Create Refund record
      const newRefund = await tx.refund.create({
        data: {
          businessId: tenant.businessId,
          saleId: sale.id,
          totalAmount: new Prisma.Decimal(totalRefundAmount.toFixed(2)),
          subtotal: new Prisma.Decimal(totalTaxableAmount.toFixed(2)),
          taxAmount: new Prisma.Decimal(totalTaxAmount.toFixed(2)),
          reason: reason || "Customer Return",
          userId: tenant.userId,
          paymentMethod: refundMethod,
          items: {
            create: createdRefundItemsData,
          },
        },
      });

      // 2. Issue official Credit Note if parent finalized document exists
      let creditNote = null;
      if (parentDoc && creditNoteItemRequests.length > 0) {
        creditNote = await issueCreditNoteForRefund(tx, {
          businessId: tenant.businessId,
          parentDocumentId: parentDoc.id,
          refundId: newRefund.id,
          saleId: sale.id,
          items: creditNoteItemRequests,
          reason,
          createdById: tenant.userId,
          refundMethod,
          branchId: sale.branchId,
        });

        // Use exact totals computed by Credit Note service
        totalRefundAmount = Number(creditNote.grandTotal);
        totalTaxableAmount = Number(creditNote.netValue);
        totalTaxAmount = Number(creditNote.taxTotal);

        await tx.refund.update({
          where: { id: newRefund.id },
          data: {
            totalAmount: new Prisma.Decimal(creditNote.grandTotal),
            subtotal: new Prisma.Decimal(creditNote.netValue),
            taxAmount: new Prisma.Decimal(creditNote.taxTotal),
          },
        });
      }

      // 3. Determine if Sale is fully refunded or partially refunded
      const totalOriginalQty = sale.items.reduce((sum, it) => sum + Number(it.quantity), 0);
      const totalRefundedQty =
        Array.from(alreadyRefundedBySaleItemId.values()).reduce((sum, q) => sum + q, 0) +
        createdRefundItemsData.reduce((sum, it) => sum + it.quantity, 0);

      const nextStatus = totalRefundedQty >= totalOriginalQty ? "REFUNDED" : "PARTIALLY_REFUNDED";

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: nextStatus },
      });

      // 4. Double-Entry Accounting reversal
      await recordCreditNoteJournalEntry({
        tx,
        businessId: tenant.businessId,
        refundId: newRefund.id,
        creditNoteNumber: creditNote ? creditNote.documentNumber : `RFD-${newRefund.id.slice(-6)}`,
        taxableAmount: totalTaxableAmount,
        taxAmount: totalTaxAmount,
        totalAmount: totalRefundAmount,
        costAmount: restock ? totalCostAmount : 0,
        paymentMethod: refundMethod,
      });

      // 5. Restock inventory if requested
      if (restock) {
        for (const item of createdRefundItemsData) {
          let stock = await tx.stock.findFirst({
            where: { branchId: sale.branchId, productId: item.productId },
          });

          const currentQty = stock?.quantity || 0;
          const newQty = currentQty + item.quantity;

          if (stock) {
            await tx.stock.update({
              where: { id: stock.id },
              data: { quantity: newQty },
            });
          }

          const saleItem = sale.items.find((si) => si.id === item.saleItemId);

          await tx.stockMovement.create({
            data: {
              businessId: tenant.businessId,
              branchId: sale.branchId,
              productId: item.productId,
              type: "RETURN_IN",
              quantity: item.quantity,
              quantityBefore: currentQty,
              quantityAfter: newQty,
              unitCost: saleItem?.costPrice || 0,
              referenceType: "Refund",
              referenceId: newRefund.id,
              notes: `Refund for Sale #${sale.invoiceNumber} (${creditNote?.documentNumber || ""})`,
              userId: tenant.userId,
            },
          });

          if (saleItem?.serialNumber) {
            await tx.serialNumber.updateMany({
              where: {
                businessId: tenant.businessId,
                serialNumber: saleItem.serialNumber,
              },
              data: {
                status: "IN_STOCK",
                saleId: null,
              },
            });
          }
        }
      }

      // 6. Handle customer credit balance reduction if refund method is CREDIT
      if (refundMethod === "CREDIT" && sale.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
        if (customer) {
          const newBalance = Math.max(0, Number(customer.creditBalance || 0) - totalRefundAmount);
          await tx.customer.update({
            where: { id: customer.id },
            data: { creditBalance: newBalance },
          });

          await tx.creditTransaction.create({
            data: {
              businessId: tenant.businessId,
              customerId: customer.id,
              saleId: sale.id,
              type: "ADJUSTMENT",
              amount: -totalRefundAmount,
              balance: newBalance,
              notes: `Credit adjustment for return #${creditNote?.documentNumber || newRefund.id.slice(-6)}`,
            },
          });
        }
      }

      // 7. Void linked warranties if fully refunded
      if (nextStatus === "REFUNDED") {
        await tx.warranty.updateMany({
          where: { saleId: sale.id, businessId: tenant.businessId },
          data: { status: "VOID" },
        });
      }

      return {
        ...newRefund,
        creditNote,
      };
    });

    return NextResponse.json({ success: true, refund });
  } catch (error: any) {
    console.error("Refund error:", error);
    return toErrorResponse(error);
  }
}
