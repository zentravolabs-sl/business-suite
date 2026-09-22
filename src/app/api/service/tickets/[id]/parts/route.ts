import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const partCreateSchema = z.object({
  productId: z.string().optional().nullable(),
  partName: z.string().min(2, "Part name is required"),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1").default(1),
  unitCost: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  fromInventory: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: ticketId } = await params;
    const body = await req.json();
    const parsed = partCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const ticket = await prisma.serviceTicket.findFirst({
      where: { id: ticketId, businessId: tenant.businessId },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const lineTotal = data.quantity * data.sellingPrice;

    const result = await prisma.$transaction(async (tx) => {
      // If from inventory, decrement branch stock & record movement
      if (data.fromInventory && data.productId) {
        const branchId = ticket.branchId || tenant.branchId;
        if (branchId) {
          const stock = await tx.stock.findFirst({
            where: { branchId, productId: data.productId },
          });

          const currentQty = stock?.quantity || 0;
          const newQty = Math.max(0, currentQty - data.quantity);

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
                productId: data.productId,
                quantity: newQty,
              },
            });
          }

          await tx.stockMovement.create({
            data: {
              businessId: tenant.businessId,
              branchId,
              productId: data.productId,
              type: "ADJUSTMENT_OUT",
              quantity: -data.quantity,
              quantityBefore: currentQty,
              quantityAfter: newQty,
              unitCost: new Prisma.Decimal(data.unitCost),
              referenceType: "ServiceTicket",
              referenceId: ticket.id,
              notes: `Spare part consumed for ${ticket.ticketNumber} (${data.partName})`,
              userId: tenant.userId,
            },
          });
        }
      }

      // Create ServicePart record
      const part = await tx.servicePart.create({
        data: {
          ticketId: ticket.id,
          productId: data.productId || null,
          partName: data.partName.trim(),
          quantity: data.quantity,
          unitCost: new Prisma.Decimal(data.unitCost),
          sellingPrice: new Prisma.Decimal(data.sellingPrice),
          total: new Prisma.Decimal(lineTotal),
          fromInventory: data.fromInventory,
        },
      });

      // Recalculate ticket partsCost and finalCost
      const allParts = await tx.servicePart.findMany({
        where: { ticketId: ticket.id },
      });
      const newPartsSum = allParts.reduce((sum, p) => sum + Number(p.total), 0);
      const laborCost = Number(ticket.laborCost || 0);

      await tx.serviceTicket.update({
        where: { id: ticket.id },
        data: {
          partsCost: new Prisma.Decimal(newPartsSum),
          finalCost: new Prisma.Decimal(laborCost + newPartsSum),
        },
      });

      return part;
    });

    return NextResponse.json({ success: true, part: result }, { status: 201 });
  } catch (error: any) {
    console.error("Service part POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: ticketId } = await params;
    const { searchParams } = new URL(req.url);
    const partId = searchParams.get("partId");

    if (!partId) {
      return NextResponse.json({ error: "partId is required" }, { status: 400 });
    }

    const [ticket, part] = await Promise.all([
      prisma.serviceTicket.findFirst({
        where: { id: ticketId, businessId: tenant.businessId },
      }),
      prisma.servicePart.findFirst({
        where: { id: partId, ticketId },
      }),
    ]);

    if (!ticket || !part) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // If was from inventory, restock
      if (part.fromInventory && part.productId) {
        const branchId = ticket.branchId || tenant.branchId;
        if (branchId) {
          const stock = await tx.stock.findFirst({
            where: { branchId, productId: part.productId },
          });
          const curQty = stock?.quantity || 0;
          const newQty = curQty + part.quantity;

          if (stock) {
            await tx.stock.update({
              where: { id: stock.id },
              data: { quantity: newQty },
            });
          }

          await tx.stockMovement.create({
            data: {
              businessId: tenant.businessId,
              branchId,
              productId: part.productId,
              type: "ADJUSTMENT_IN",
              quantity: part.quantity,
              quantityBefore: curQty,
              quantityAfter: newQty,
              unitCost: part.unitCost,
              referenceType: "ServiceTicket",
              referenceId: ticket.id,
              notes: `Spare part returned/removed from ticket ${ticket.ticketNumber}`,
              userId: tenant.userId,
            },
          });
        }
      }

      // Delete part
      await tx.servicePart.delete({ where: { id: part.id } });

      // Recalculate ticket costs
      const allParts = await tx.servicePart.findMany({
        where: { ticketId: ticket.id },
      });
      const newPartsSum = allParts.reduce((sum, p) => sum + Number(p.total), 0);
      const laborCost = Number(ticket.laborCost || 0);

      await tx.serviceTicket.update({
        where: { id: ticket.id },
        data: {
          partsCost: new Prisma.Decimal(newPartsSum),
          finalCost: new Prisma.Decimal(laborCost + newPartsSum),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Service part DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
