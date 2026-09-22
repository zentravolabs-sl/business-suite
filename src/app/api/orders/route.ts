import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type");

    const where: any = {
      businessId: tenant.businessId,
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (type && type !== "ALL") {
      where.type = type;
    }

    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { deliveryCity: { contains: q, mode: "insensitive" } },
      ];
    }

    const orders = await prisma.onlineOrder.findMany({
      where,
      include: {
        items: true,
        delivery: true,
        zone: true,
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Compute status counts for tabs
    const statusCounts = await prisma.onlineOrder.groupBy({
      by: ["status"],
      where: { businessId: tenant.businessId },
      _count: true,
    });

    const countsMap = statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      orders,
      counts: countsMap,
    });
  } catch (error) {
    console.error("Failed to fetch online orders:", error);
    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 }
    );
  }
}
