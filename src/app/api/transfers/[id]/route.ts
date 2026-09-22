import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const transfer = await prisma.branchTransfer.findFirst({
      where: { id, businessId: tenant.businessId },
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        items: true,
      },
    });

    if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const productIds = transfer.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return NextResponse.json({
      transfer: {
        ...transfer,
        requestedAt: transfer.requestedAt.toISOString(),
        approvedAt: transfer.approvedAt?.toISOString() || null,
        receivedAt: transfer.receivedAt?.toISOString() || null,
        items: transfer.items.map((i) => ({
          ...i,
          productName: productMap.get(i.productId)?.name || "Unknown",
          productSku: productMap.get(i.productId)?.sku || "",
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { action, sentQties, receivedQties } = body;

    const transfer = await prisma.branchTransfer.findFirst({
      where: { id, businessId: tenant.businessId },
      include: { items: true },
    });

    if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === "approve") {
      // PENDING → IN_TRANSIT: update sent quantities, deduct from-branch stock
      if (transfer.status !== "PENDING") {
        return NextResponse.json({ error: "Transfer is not in PENDING status" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        // Update each item's sentQty
        for (const item of transfer.items) {
          const sentQty = sentQties?.[item.id] ?? item.requestedQty;
          await tx.branchTransferItem.update({
            where: { id: item.id },
            data: { sentQty },
          });

          // Deduct from source branch
          const existingFromStock = await tx.stock.findFirst({
            where: { branchId: transfer.fromBranchId, productId: item.productId, variantId: null },
          });
          if (existingFromStock) {
            await tx.stock.update({
              where: { id: existingFromStock.id },
              data: { quantity: { decrement: sentQty } },
            });
          } else {
            await tx.stock.create({
              data: { businessId: tenant.businessId, branchId: transfer.fromBranchId, productId: item.productId, quantity: -sentQty },
            });
          }

          // Log TRANSFER_OUT movement
          const fromQty = existingFromStock?.quantity ?? 0;
          await tx.stockMovement.create({
            data: {
              businessId: tenant.businessId,
              branchId: transfer.fromBranchId,
              productId: item.productId,
              type: "TRANSFER_OUT",
              quantity: -sentQty,
              quantityBefore: fromQty,
              quantityAfter: fromQty - sentQty,
              referenceId: transfer.referenceNo || id,
              referenceType: "Transfer",
              notes: `Transfer to ${transfer.toBranchId}`,
              userId: tenant.userId,
            },
          });
        }

        // Update transfer status
        await tx.branchTransfer.update({
          where: { id },
          data: {
            status: "IN_TRANSIT",
            approvedById: tenant.userId,
            approvedAt: new Date(),
          },
        });
      });

      return NextResponse.json({ success: true, message: "Transfer approved and dispatched" });
    }

    if (action === "receive") {
      // IN_TRANSIT → RECEIVED: credit to-branch stock
      if (transfer.status !== "IN_TRANSIT") {
        return NextResponse.json({ error: "Transfer is not IN_TRANSIT" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        for (const item of transfer.items) {
          const receivedQty = receivedQties?.[item.id] ?? item.sentQty ?? item.requestedQty;
          await tx.branchTransferItem.update({
            where: { id: item.id },
            data: { receivedQty },
          });

          // Credit to destination branch
          const existingToStock = await tx.stock.findFirst({
            where: { branchId: transfer.toBranchId, productId: item.productId, variantId: null },
          });
          if (existingToStock) {
            await tx.stock.update({
              where: { id: existingToStock.id },
              data: { quantity: { increment: receivedQty } },
            });
          } else {
            await tx.stock.create({
              data: { businessId: tenant.businessId, branchId: transfer.toBranchId, productId: item.productId, quantity: receivedQty },
            });
          }

          // Log TRANSFER_IN movement
          const toQty = existingToStock?.quantity ?? 0;
          await tx.stockMovement.create({
            data: {
              businessId: tenant.businessId,
              branchId: transfer.toBranchId,
              productId: item.productId,
              type: "TRANSFER_IN",
              quantity: receivedQty,
              quantityBefore: toQty,
              quantityAfter: toQty + receivedQty,
              referenceId: transfer.referenceNo || id,
              referenceType: "Transfer",
              notes: `Transfer from ${transfer.fromBranchId}`,
              userId: tenant.userId,
            },
          });
        }

        await tx.branchTransfer.update({
          where: { id },
          data: {
            status: "RECEIVED",
            receivedById: tenant.userId,
            receivedAt: new Date(),
          },
        });
      });

      return NextResponse.json({ success: true, message: "Transfer received and stock updated" });
    }

    if (action === "cancel") {
      if (!["PENDING"].includes(transfer.status)) {
        return NextResponse.json({ error: "Only PENDING transfers can be cancelled" }, { status: 400 });
      }

      await prisma.branchTransfer.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Transfer PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
