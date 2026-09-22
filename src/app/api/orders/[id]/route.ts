import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const orderUpdateSchema = z.object({
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "READY",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
      "REFUNDED",
    ])
    .optional(),
  paymentStatus: z
    .enum(["PENDING", "PROCESSING", "PAID", "FAILED", "REFUNDED"])
    .optional(),
  driverName: z.string().optional().nullable(),
  driverPhone: z.string().optional().nullable(),
  trackingNo: z.string().optional().nullable(),
  deliveryNotes: z.string().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const order = await prisma.onlineOrder.findFirst({
      where: {
        id,
        businessId: tenant.businessId,
      },
      include: {
        items: true,
        delivery: true,
        zone: true,
        branch: true,
        customer: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Failed to load order details:", error);
    return NextResponse.json({ error: "Failed to load order" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = orderUpdateSchema.parse(body);

    const existingOrder = await prisma.onlineOrder.findFirst({
      where: {
        id,
        businessId: tenant.businessId,
      },
      include: {
        items: true,
        delivery: true,
        branch: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Determine target branch for stock operations
    let targetBranchId = existingOrder.branchId;
    if (!targetBranchId) {
      const defaultBranch = await prisma.branch.findFirst({
        where: { businessId: tenant.businessId, isHeadOffice: true },
      });
      targetBranchId = defaultBranch?.id || null;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {};

      if (validated.status) {
        updateData.status = validated.status;

        // 1. Order Confirmation -> Decrement Stock and record StockMovement
        if (
          validated.status === "CONFIRMED" &&
          existingOrder.status === "PENDING" &&
          !existingOrder.confirmedAt
        ) {
          updateData.confirmedAt = new Date();

          if (targetBranchId) {
            for (const item of existingOrder.items) {
              // Decrement branch stock
              const stock = await tx.stock.findFirst({
                where: {
                  branchId: targetBranchId,
                  productId: item.productId,
                },
              });

              const prevQty = stock ? stock.quantity : 0;
              const newQty = Math.max(0, prevQty - item.quantity);

              if (stock) {
                await tx.stock.update({
                  where: { id: stock.id },
                  data: { quantity: newQty },
                });
              } else {
                await tx.stock.create({
                  data: {
                    businessId: tenant.businessId,
                    branchId: targetBranchId,
                    productId: item.productId,
                    quantity: newQty,
                  },
                });
              }

              // Write immutable StockMovement
              await tx.stockMovement.create({
                data: {
                  businessId: tenant.businessId,
                  branchId: targetBranchId,
                  productId: item.productId,
                  type: "SALE",
                  quantity: -item.quantity,
                  quantityBefore: prevQty,
                  quantityAfter: newQty,
                  referenceType: "ONLINE_ORDER",
                  referenceId: existingOrder.orderNumber,
                  notes: `Stock reserved for online order ${existingOrder.orderNumber}`,
                  userId: tenant.userId,
                },
              });
            }
          }
        }

        // 2. Ready for dispatch
        if (validated.status === "READY" && !existingOrder.readyAt) {
          updateData.readyAt = new Date();
        }

        // 3. Out for delivery
        if (validated.status === "OUT_FOR_DELIVERY") {
          // Update linked delivery status
          await tx.delivery.upsert({
            where: { orderId: existingOrder.id },
            update: {
              status: "OUT_FOR_DELIVERY",
              driverName: validated.driverName ?? undefined,
              driverPhone: validated.driverPhone ?? undefined,
              trackingNo: validated.trackingNo ?? undefined,
              notes: validated.deliveryNotes ?? undefined,
              assignedAt: new Date(),
            },
            create: {
              orderId: existingOrder.id,
              status: "OUT_FOR_DELIVERY",
              driverName: validated.driverName || null,
              driverPhone: validated.driverPhone || null,
              trackingNo: validated.trackingNo || null,
              notes: validated.deliveryNotes || null,
              assignedAt: new Date(),
            },
          });
        }

        // 4. Delivered
        if (validated.status === "DELIVERED" || validated.status === "COMPLETED") {
          updateData.deliveredAt = new Date();
          updateData.completedAt = new Date();

          // If payment was pending and method is CASH (COD), mark as paid
          if (
            existingOrder.paymentStatus === "PENDING" &&
            (existingOrder.paymentMethod === "CASH" || validated.paymentStatus === "PAID")
          ) {
            updateData.paymentStatus = "PAID";
          }

          await tx.delivery.upsert({
            where: { orderId: existingOrder.id },
            update: {
              status: "DELIVERED",
              deliveredAt: new Date(),
            },
            create: {
              orderId: existingOrder.id,
              status: "DELIVERED",
              deliveredAt: new Date(),
            },
          });
        }

        // 5. Cancelled -> Restock if stock was already decremented
        if (validated.status === "CANCELLED" && existingOrder.status !== "CANCELLED") {
          updateData.cancelledAt = new Date();

          if (existingOrder.confirmedAt && targetBranchId) {
            for (const item of existingOrder.items) {
              const stock = await tx.stock.findFirst({
                where: {
                  branchId: targetBranchId,
                  productId: item.productId,
                },
              });

              const prevQty = stock ? stock.quantity : 0;
              const newQty = prevQty + item.quantity;

              if (stock) {
                await tx.stock.update({
                  where: { id: stock.id },
                  data: { quantity: newQty },
                });
              } else {
                await tx.stock.create({
                  data: {
                    businessId: tenant.businessId,
                    branchId: targetBranchId,
                    productId: item.productId,
                    quantity: newQty,
                  },
                });
              }

              // Log return in movement
              await tx.stockMovement.create({
                data: {
                  businessId: tenant.businessId,
                  branchId: targetBranchId,
                  productId: item.productId,
                  type: "RETURN_IN",
                  quantity: item.quantity,
                  quantityBefore: prevQty,
                  quantityAfter: newQty,
                  referenceType: "ONLINE_ORDER_CANCEL",
                  referenceId: existingOrder.orderNumber,
                  notes: `Stock restored on cancellation of order ${existingOrder.orderNumber}`,
                  userId: tenant.userId,
                },
              });
            }
          }
        }
      }

      if (validated.paymentStatus) {
        updateData.paymentStatus = validated.paymentStatus;
      }

      // Update delivery fields if provided without changing order status
      if (
        (validated.driverName !== undefined ||
          validated.driverPhone !== undefined ||
          validated.trackingNo !== undefined ||
          validated.deliveryNotes !== undefined) &&
        validated.status !== "OUT_FOR_DELIVERY"
      ) {
        await tx.delivery.upsert({
          where: { orderId: existingOrder.id },
          update: {
            driverName: validated.driverName ?? undefined,
            driverPhone: validated.driverPhone ?? undefined,
            trackingNo: validated.trackingNo ?? undefined,
            notes: validated.deliveryNotes ?? undefined,
          },
          create: {
            orderId: existingOrder.id,
            driverName: validated.driverName || null,
            driverPhone: validated.driverPhone || null,
            trackingNo: validated.trackingNo || null,
            notes: validated.deliveryNotes || null,
          },
        });
      }

      const updated = await tx.onlineOrder.update({
        where: { id: existingOrder.id },
        data: updateData,
        include: {
          items: true,
          delivery: true,
          zone: true,
          branch: true,
        },
      });

      return updated;
    });

    return NextResponse.json({
      order: result,
      message: `Order status updated to ${result.status}`,
    });
  } catch (error: any) {
    console.error("Failed to update order:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to update order" },
      { status: 500 }
    );
  }
}
