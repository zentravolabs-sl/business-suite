import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "month"; // today | week | month | last_month

    // Compute date range
    const now = new Date();
    let startDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;

    if (period === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      prevStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      prevEndDate = startDate;
    } else if (period === "week") {
      const day = now.getDay();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevEndDate = startDate;
    } else if (period === "last_month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevEndDate = startDate;
      now.setTime(endDate.getTime() - 1);
    } else {
      // This month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEndDate = startDate;
    }

    const [
      // Revenue & profit for current period
      currentSales,
      prevSales,
      // Sales by branch
      salesByBranch,
      // Top products
      topProducts,
      // Sales by category
      salesByCategory,
      // Daily trend (last 30 days)
      dailyTrend,
      // Customer stats
      totalCustomers,
      newCustomers,
      vipCustomers,
      // Inventory health
      lowStockProducts,
      stockValue,
      // Online orders
      onlineOrders,
      // Service tickets
      openTickets,
    ] = await Promise.all([
      // Current period sales
      prisma.sale.aggregate({
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: startDate, lte: new Date() } },
        _sum: { total: true, subtotal: true, discountAmount: true },
        _count: { id: true },
      }),
      // Previous period
      prisma.sale.aggregate({
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: prevStartDate, lte: prevEndDate } },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Sales by branch
      prisma.sale.groupBy({
        by: ["branchId"],
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: startDate } },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: "desc" } },
      }),
      // Top products by revenue from sale items
      prisma.saleItem.groupBy({
        by: ["productId", "name", "sku"],
        where: { sale: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: startDate } } },
        _sum: { total: true, quantity: true },
        orderBy: { _sum: { total: "desc" } },
        take: 10,
      }),
      // Sales by category  
      prisma.saleItem.groupBy({
        by: ["name"],
        where: { sale: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: startDate } } },
        _sum: { total: true, quantity: true },
        orderBy: { _sum: { total: "desc" } },
        take: 8,
      }),
      // Daily trend (last 30 days)
      prisma.$queryRaw<{ day: Date; revenue: number; txns: number }[]>`
        SELECT 
          DATE_TRUNC('day', "createdAt" AT TIME ZONE 'Asia/Colombo') as day,
          SUM(total)::float as revenue,
          COUNT(*)::int as txns
        FROM sales
        WHERE "businessId" = ${tenant.businessId}
          AND status = 'COMPLETED'
          AND "createdAt" >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
        GROUP BY day
        ORDER BY day ASC
      `,
      // Customer counts
      prisma.customer.count({ where: { businessId: tenant.businessId, isActive: true } }),
      prisma.customer.count({ where: { businessId: tenant.businessId, createdAt: { gte: startDate } } }),
      prisma.customer.count({ where: { businessId: tenant.businessId, isVip: true } }),
      // Low stock
      prisma.stock.findMany({
        where: {
          product: { businessId: tenant.businessId, isActive: true, deletedAt: null },
          quantity: { lte: 5 },
        },
        include: { product: { select: { name: true, reorderLevel: true } }, branch: { select: { name: true } } },
        take: 20,
        orderBy: { quantity: "asc" },
      }),
      // Total stock value
      prisma.stock.aggregate({
        where: { product: { businessId: tenant.businessId, isActive: true } },
        _sum: { quantity: true },
      }),
      // Online orders
      prisma.onlineOrder.count({
        where: { businessId: tenant.businessId, createdAt: { gte: startDate }, status: { in: ["DELIVERED", "CONFIRMED"] } },
      }),
      // Open service tickets
      prisma.serviceTicket.count({
        where: { businessId: tenant.businessId, status: { notIn: ["DELIVERED", "CANCELLED"] } },
      }),
    ]);

    // Fetch branch names for salesByBranch
    const branchIds = salesByBranch.map((s) => s.branchId);
    const branches = await prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    // Fetch product COGS to compute profit
    const productIds = topProducts.map((p) => p.productId).filter(Boolean);
    const productCosts = await prisma.product.findMany({
      where: { id: { in: productIds as string[] } },
      select: { id: true, costPrice: true },
    });
    const costMap = new Map(productCosts.map((p) => [p.id, Number(p.costPrice)]));

    const currentRevenue = Number(currentSales._sum.total || 0);
    const prevRevenue = Number(prevSales._sum.total || 0);
    const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Estimated profit: 30% margin average (we'd need COGS from journal for exact figure)
    const estimatedProfit = currentRevenue * 0.28;

    return NextResponse.json({
      period,
      summary: {
        revenue: currentRevenue,
        prevRevenue,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        transactions: currentSales._count.id,
        prevTransactions: prevSales._count.id,
        estimatedProfit,
        avgOrderValue: currentSales._count.id > 0 ? currentRevenue / currentSales._count.id : 0,
        totalDiscounts: Number(currentSales._sum.discountAmount || 0),
        totalCustomers,
        newCustomers,
        vipCustomers,
        onlineOrders,
        openTickets,
      },
      salesByBranch: salesByBranch.map((s) => ({
        branchId: s.branchId,
        branchName: branchMap.get(s.branchId) || "Unknown",
        revenue: Number(s._sum.total || 0),
        transactions: s._count.id,
      })),
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        name: p.name,
        sku: p.sku,
        revenue: Number(p._sum.total || 0),
        unitsSold: p._sum.quantity || 0,
        estimatedProfit: Number(p._sum.total || 0) - (costMap.get(p.productId!) || 0) * (p._sum.quantity || 0),
      })),
      dailyTrend: dailyTrend.map((d) => ({
        date: new Date(d.day).toLocaleDateString("en-LK", { month: "short", day: "numeric" }),
        revenue: Number(d.revenue),
        transactions: Number(d.txns),
      })),
      inventoryHealth: {
        totalStockUnits: Number(stockValue._sum.quantity || 0),
        lowStockItems: lowStockProducts.map((s) => ({
          productName: s.product.name,
          branchName: s.branch.name,
          quantity: s.quantity,
          reorderLevel: s.product.reorderLevel || 10,
        })),
      },
    });
  } catch (error: any) {
    console.error("Reports GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
