import type { Metadata } from "next";
import { DashboardOverview } from "@/components/dashboard/overview";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { SetupBanner } from "@/components/onboarding/setup-banner";

export const metadata: Metadata = {
  title: "Dashboard | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tenant = await getTenantContext();
  if (!tenant) {
    return <DashboardOverview />;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [
      business,
      branch,
      todaySales,
      yesterdaySales,
      monthRevenue,
      customerCount,
      receivables,
      lowStockCount,
      activeWarranties,
      openTickets,
      pendingOrders,
      topProductsAgg,
      recentSalesList,
      dailySalesRaw,
    ] = await Promise.all([
      prisma.business.findUnique({ where: { id: tenant.businessId }, select: { name: true, onboardingCompleted: true } }),
      tenant.branchId ? prisma.branch.findUnique({ where: { id: tenant.branchId }, select: { name: true } }) : null,
      prisma.sale.aggregate({
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: todayStart } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.sale.aggregate({
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: yesterdayStart, lt: todayStart } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.sale.aggregate({
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: monthStart } },
        _sum: { total: true, discountAmount: true },
      }),
      prisma.customer.count({ where: { businessId: tenant.businessId, isActive: true } }),
      prisma.customer.aggregate({
        where: { businessId: tenant.businessId, creditBalance: { gt: 0 } },
        _sum: { creditBalance: true },
        _count: { id: true },
      }),
      prisma.stock.count({ where: { businessId: tenant.businessId, quantity: { lte: 5 } } }),
      prisma.warranty.count({ where: { businessId: tenant.businessId, status: "ACTIVE" } }),
      prisma.serviceTicket.count({ where: { businessId: tenant.businessId, status: { in: ["RECEIVED", "UNDER_INSPECTION", "REPAIRING"] } } }),
      prisma.onlineOrder.count({ where: { businessId: tenant.businessId, status: "PENDING" } }),
      prisma.saleItem.groupBy({
        by: ["name", "productId"],
        where: { sale: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: sevenDaysAgo } } },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 5,
      }),
      prisma.sale.findMany({
        where: { businessId: tenant.businessId, status: "COMPLETED" },
        include: { customer: { select: { name: true } }, payments: { select: { method: true }, take: 1 } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.$queryRaw<Array<{ day: string; sales: number }>>`
        SELECT DATE("createdAt") as day, SUM("total") as sales
        FROM "sales"
        WHERE "businessId" = ${tenant.businessId} AND "status" = 'COMPLETED' AND "createdAt" >= ${sevenDaysAgo}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `.catch(() => []),
    ]);

    const todayRev = Number(todaySales._sum.total || 0);
    const yestRev = Number(yesterdaySales._sum.total || 0);
    const dayChange = yestRev > 0 ? ((todayRev - yestRev) / yestRev) * 100 : 0;
    const estProfit = todayRev * 0.28;

    const realMetrics = [
      {
        title: "Today's Sales",
        value: todayRev,
        change: Math.round(dayChange * 10) / 10,
        trend: dayChange >= 0 ? "up" : "down",
        icon: "ShoppingCart",
        color: "text-violet-500",
        bg: "bg-violet-500/10",
        subtitle: `${todaySales._count.id} transactions`,
        isCurrency: true,
      },
      {
        title: "Est. Gross Profit",
        value: estProfit,
        change: Math.round(dayChange * 10) / 10,
        trend: dayChange >= 0 ? "up" : "down",
        icon: "TrendingUp",
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        subtitle: "28% avg margin",
        isCurrency: true,
      },
      {
        title: "Active Customers",
        value: customerCount,
        change: 0,
        trend: "neutral",
        icon: "Users",
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        subtitle: "Total customer base",
        isCurrency: false,
      },
      {
        title: "Receivables",
        value: Number(receivables._sum.creditBalance || 0),
        change: 0,
        trend: "neutral",
        icon: "DollarSign",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        subtitle: `${receivables._count.id} customers owe`,
        isCurrency: true,
      },
      {
        title: "Pending Orders",
        value: pendingOrders,
        change: 0,
        trend: "neutral",
        icon: "Receipt",
        color: "text-indigo-500",
        bg: "bg-indigo-500/10",
        subtitle: "E-Commerce orders",
        isCurrency: false,
      },
      {
        title: "Low Stock Items",
        value: lowStockCount,
        change: 0,
        trend: "neutral",
        icon: "AlertTriangle",
        color: "text-red-500",
        bg: "bg-red-500/10",
        subtitle: "Needs reorder",
        isCurrency: false,
        isAlert: lowStockCount > 0,
      },
      {
        title: "Active Warranties",
        value: activeWarranties,
        change: 0,
        trend: "neutral",
        icon: "Shield",
        color: "text-teal-500",
        bg: "bg-teal-500/10",
        subtitle: "Protected items",
        isCurrency: false,
      },
      {
        title: "Open Tickets",
        value: openTickets,
        change: 0,
        trend: "neutral",
        icon: "Wrench",
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        subtitle: "In service center",
        isCurrency: false,
      },
    ];

    const realTopProducts = topProductsAgg.map((p) => ({
      name: p.name,
      sales: p._sum.quantity || 0,
      revenue: Number(p._sum.total || 0),
    }));

    const realRecentSales = recentSalesList.map((s) => ({
      id: s.invoiceNumber,
      customer: s.customer?.name || "Walk-in Customer",
      amount: Number(s.total),
      time: new Date(s.createdAt).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" }),
      method: s.payments[0]?.method || "CASH",
      status: s.status === "COMPLETED" ? "PAID" : s.status,
    }));

    const realSalesData = (dailySalesRaw || []).map((d) => ({
      date: new Date(d.day).toLocaleDateString("en-LK", { day: "2-digit", month: "short" }),
      sales: Number(d.sales),
      profit: Number(d.sales) * 0.28,
    }));

    return (
      <>
        {business && !business.onboardingCompleted && (
          <div className="mb-6">
            <SetupBanner businessName={business.name} />
          </div>
        )}
        <DashboardOverview
          initialMetrics={realMetrics}
          initialTopProducts={realTopProducts.length > 0 ? realTopProducts : undefined}
          initialRecentSales={realRecentSales.length > 0 ? realRecentSales : undefined}
          initialSalesData={realSalesData.length > 0 ? realSalesData : undefined}
          businessName={business?.name}
          branchName={branch?.name}
        />
      </>
    );
  } catch (error) {
    console.warn("Failed to fetch dynamic dashboard stats, falling back to defaults:", error);
    return <DashboardOverview />;
  }
}
