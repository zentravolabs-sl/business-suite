import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 30;

    const where: any = { businessId: tenant.businessId };
    if (status) where.status = status;

    const [transfers, total, branches] = await Promise.all([
      prisma.branchTransfer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { requestedAt: "desc" },
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          items: {
            include: {
              transfer: false,
              // We'll join product names separately
            },
          },
        },
      }),
      prisma.branchTransfer.count({ where }),
      prisma.branch.findMany({
        where: { businessId: tenant.businessId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Get product names for all transfer items
    const productIds = [...new Set(transfers.flatMap((t) => t.items.map((i) => i.productId)))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return NextResponse.json({
      transfers: transfers.map((t) => ({
        id: t.id,
        referenceNo: t.referenceNo,
        status: t.status,
        notes: t.notes,
        fromBranchId: t.fromBranchId,
        fromBranchName: t.fromBranch.name,
        toBranchId: t.toBranchId,
        toBranchName: t.toBranch.name,
        requestedAt: t.requestedAt.toISOString(),
        approvedAt: t.approvedAt?.toISOString() || null,
        receivedAt: t.receivedAt?.toISOString() || null,
        itemCount: t.items.length,
        items: t.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: productMap.get(i.productId)?.name || "Unknown",
          productSku: productMap.get(i.productId)?.sku || "",
          requestedQty: i.requestedQty,
          sentQty: i.sentQty,
          receivedQty: i.receivedQty,
          notes: i.notes,
        })),
      })),
      total,
      branches,
    });
  } catch (error: any) {
    console.error("Transfers GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { fromBranchId, toBranchId, notes, items } = body;

    if (!fromBranchId || !toBranchId || !items?.length) {
      return NextResponse.json({ error: "fromBranchId, toBranchId, and items are required" }, { status: 400 });
    }

    if (fromBranchId === toBranchId) {
      return NextResponse.json({ error: "From and To branch must be different" }, { status: 400 });
    }

    // Verify branches belong to business
    const branchCount = await prisma.branch.count({
      where: { id: { in: [fromBranchId, toBranchId] }, businessId: tenant.businessId },
    });
    if (branchCount < 2) {
      return NextResponse.json({ error: "Invalid branches" }, { status: 400 });
    }

    // Generate reference number
    const count = await prisma.branchTransfer.count({ where: { businessId: tenant.businessId } });
    const year = new Date().getFullYear();
    const referenceNo = `TRF-${year}-${String(count + 1).padStart(4, "0")}`;

    const transfer = await prisma.branchTransfer.create({
      data: {
        businessId: tenant.businessId,
        fromBranchId,
        toBranchId,
        referenceNo,
        notes: notes || null,
        status: "PENDING",
        requestedById: tenant.userId,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            requestedQty: parseInt(item.quantity),
            notes: item.notes || null,
          })),
        },
      },
    });

    return NextResponse.json({ success: true, transfer });
  } catch (error: any) {
    console.error("Transfer POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
