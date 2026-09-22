import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const poItemSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().min(0),
});

const poCreateSchema = z.object({
  supplierId: z.string(),
  branchId: z.string().optional(),
  expectedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(poItemSchema).min(1, "At least one product is required"),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status");

    const where: any = {
      businessId: tenant.businessId,
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        branch: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = poCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const branchId = data.branchId || tenant.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Delivery branch required" }, { status: 400 });
    }

    // Compute subtotal
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0
    );

    // Generate PO Number
    const count = await prisma.purchaseOrder.count({
      where: { businessId: tenant.businessId },
    });
    const orderNumber = `PO-${String(count + 101).padStart(5, "0")}`;

    const order = await prisma.$transaction(async (tx) => {
      const newPO = await tx.purchaseOrder.create({
        data: {
          businessId: tenant.businessId,
          branchId,
          supplierId: data.supplierId,
          orderNumber,
          status: "ORDERED",
          subtotal,
          total: subtotal,
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          notes: data.notes || null,
          userId: tenant.userId,
        },
      });

      for (const it of data.items) {
        await tx.purchaseOrderItem.create({
          data: {
            orderId: newPO.id,
            productId: it.productId,
            quantity: it.quantity,
            unitCost: it.unitCost,
            total: it.quantity * it.unitCost,
          },
        });
      }

      return newPO;
    });

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("PO create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
