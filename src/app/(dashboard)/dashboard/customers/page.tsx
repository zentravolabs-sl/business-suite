import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { CustomersClient } from "@/components/customers/customers-client";

export const metadata = {
  title: "Customers | Zentravo BMS",
  description: "Manage customers, view 360 profiles, loyalty status, and purchase history",
};

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const tenant = await requireTenant();

  const [customers, loyaltyTiers, summaryStats] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        loyaltyAccount: {
          include: { tier: true },
        },
        _count: {
          select: { sales: true, onlineOrders: true, serviceTickets: true },
        },
      },
    }),
    prisma.loyaltyTier.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { minPoints: "asc" },
    }),
    prisma.customer.aggregate({
      where: { businessId: tenant.businessId, isActive: true },
      _count: { id: true },
    }),
  ]);

  // Total spend per customer
  const spendData = await prisma.sale.groupBy({
    by: ["customerId"],
    where: {
      businessId: tenant.businessId,
      customerId: { in: customers.map((c) => c.id) },
      status: "COMPLETED",
    },
    _sum: { total: true },
  });
  const spendMap = new Map(
    spendData.map((s) => [s.customerId, Number(s._sum.total || 0)])
  );

  const totalVip = customers.filter((c) => c.isVip).length;
  const totalLoyalty = customers.filter((c) => c.loyaltyAccount).length;
  const totalRevenue = Array.from(spendMap.values()).reduce((a, b) => a + b, 0);

  const serialized = customers.map((c) => ({
    id: c.id,
    customerCode: c.customerCode,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    district: c.district,
    dateOfBirth: c.dateOfBirth?.toISOString() || null,
    gender: c.gender,
    notes: c.notes,
    creditLimit: Number(c.creditLimit),
    creditBalance: Number(c.creditBalance),
    isVip: c.isVip,
    isActive: c.isActive,
    portalEnabled: c.portalEnabled,
    createdAt: c.createdAt.toISOString(),
    totalSales: c._count.sales + c._count.onlineOrders,
    totalServiceTickets: c._count.serviceTickets,
    totalSpend: spendMap.get(c.id) || 0,
    loyaltyPoints: c.loyaltyAccount?.points || 0,
    lifetimePoints: c.loyaltyAccount?.lifetimePoints || 0,
    loyaltyTier: c.loyaltyAccount?.tier?.name || null,
    loyaltyTierCode: c.loyaltyAccount?.tier?.tier || null,
  }));

  return (
    <CustomersClient
      initialCustomers={serialized}
      loyaltyTiers={loyaltyTiers.map((t) => ({
        id: t.id,
        tier: t.tier,
        name: t.name,
        minPoints: t.minPoints,
        pointsMultiplier: Number(t.pointsMultiplier),
      }))}
      summaryStats={{
        total: summaryStats._count.id,
        totalVip,
        totalLoyalty,
        totalRevenue,
      }}
    />
  );
}
