import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const adjustmentSchema = z.object({
  productId: z.string(),
  branchId: z.string(),
  type: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT", "DAMAGE", "EXPIRY_WRITE_OFF"]),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = adjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { productId, branchId, type, quantity, notes } = parsed.data;

    // Verify branch belongs to business
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, businessId: tenant.businessId },
    });
    if (!branch) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    // Verify product
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId: tenant.businessId },
    });
    if (!product) {
      return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    }

    const isAddition = type === "ADJUSTMENT_IN";
    const delta = isAddition ? quantity : -quantity;

    const result = await prisma.$transaction(async (tx) => {
      // Find or create Stock
      let stock = await tx.stock.findUnique({
        where: {
          branchId_productId_variantId: {
            branchId,
            productId,
            variantId: "", // Default variant
          },
        },
      });

      if (!stock) {
        stock = await tx.stock.findFirst({
          where: { branchId, productId },
        });
      }

      const currentQty = stock?.quantity || 0;
      const newQty = Math.max(0, currentQty + delta);

      if (stock) {
        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: newQty },
        });
      } else {
        await tx.stock.create({
          data: {
            businessId: tenant.businessId,
            branchId,
            productId,
            quantity: newQty,
          },
        });
      }

      // Record immutable StockMovement
      const movement = await tx.stockMovement.create({
        data: {
          businessId: tenant.businessId,
          branchId,
          productId,
          type,
          quantity: delta,
          quantityBefore: currentQty,
          quantityAfter: newQty,
          unitCost: product.costPrice,
          notes: notes || `Manual stock adjustment: ${type.replace(/_/g, " ")}`,
          userId: tenant.userId,
        },
      });

      return { newQty, movement };
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Stock adjust error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
