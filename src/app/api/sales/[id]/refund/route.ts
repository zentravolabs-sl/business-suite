import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: saleId } = await params;
    const body = await req.json();
    const { reason, restock = true } = body;

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId: tenant.businessId },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    if (sale.status === "REFUNDED") {
      return NextResponse.json({ error: "Sale is already refunded" }, { status: 400 });
    }

    const refund = await prisma.$transaction(async (tx) => {
      // 1. Create Refund record
      const newRefund = await tx.refund.create({
        data: {
          businessId: tenant.businessId,
          saleId: sale.id,
          totalAmount: sale.total,
          reason: reason || "Customer Return",
          userId: tenant.userId,
        },
      });

      // 2. Mark Sale as REFUNDED
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: "REFUNDED" },
      });

      // 3. Restock inventory if requested
      if (restock) {
        for (const item of sale.items) {
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

          await tx.stockMovement.create({
            data: {
              businessId: tenant.businessId,
              branchId: sale.branchId,
              productId: item.productId,
              type: "RETURN_IN",
              quantity: item.quantity,
              quantityBefore: currentQty,
              quantityAfter: newQty,
              unitCost: item.costPrice,
              referenceType: "Refund",
              referenceId: newRefund.id,
              notes: `Refund for Sale #${sale.invoiceNumber}`,
              userId: tenant.userId,
            },
          });

          // If serial number, mark back to IN_STOCK
          if (item.serialNumber) {
            await tx.serialNumber.updateMany({
              where: {
                businessId: tenant.businessId,
                serialNumber: item.serialNumber,
              },
              data: {
                status: "IN_STOCK",
                saleId: null,
              },
            });
          }
        }
      }

      // 4. Void linked active warranties
      await tx.warranty.updateMany({
        where: { saleId: sale.id, businessId: tenant.businessId },
        data: { status: "VOID" },
      });

      return newRefund;
    });

    return NextResponse.json({ success: true, refund });
  } catch (error: any) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
