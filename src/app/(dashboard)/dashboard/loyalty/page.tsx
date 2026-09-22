import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { LoyaltyClient } from "@/components/loyalty/loyalty-client";

export const metadata = {
  title: "Loyalty Program | Zentravo BMS",
  description: "Manage loyalty tiers, points, and member rewards",
};

export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const tenant = await requireTenant();

  const [tiers, topMembers, recentTransactions, stats] = await Promise.all([
    prisma.loyaltyTier.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { minPoints: "asc" },
      include: {
        _count: { select: { accounts: true } },
      },
    }),
    prisma.loyaltyAccount.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { points: "desc" },
      take: 20,
      include: {
        customer: { select: { id: true, name: true, phone: true, isVip: true } },
        tier: true,
      },
    }),
    prisma.loyaltyTransaction.findMany({
      where: {
        account: { businessId: tenant.businessId },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        account: {
          include: { customer: { select: { name: true } } },
        },
        sale: { select: { invoiceNumber: true } },
      },
    }),
    prisma.loyaltyAccount.aggregate({
      where: { businessId: tenant.businessId },
      _count: { id: true },
      _sum: { points: true, lifetimePoints: true },
      _avg: { points: true },
    }),
  ]);

  return (
    <LoyaltyClient
      tiers={tiers.map((t) => ({
        id: t.id,
        tier: t.tier,
        name: t.name,
        minPoints: t.minPoints,
        pointsMultiplier: Number(t.pointsMultiplier),
        benefits: t.benefits as string[] | null,
        memberCount: t._count.accounts,
      }))}
      topMembers={topMembers.map((m) => ({
        id: m.id,
        customerId: m.customerId,
        customerName: m.customer.name,
        customerPhone: m.customer.phone,
        isVip: m.customer.isVip,
        tierName: m.tier?.name || "No Tier",
        tierCode: m.tier?.tier || null,
        points: m.points,
        lifetimePoints: m.lifetimePoints,
      }))}
      recentTransactions={recentTransactions.map((t) => ({
        id: t.id,
        customerName: t.account.customer.name,
        type: t.type,
        points: t.points,
        balance: t.balance,
        notes: t.notes,
        invoiceNumber: t.sale?.invoiceNumber || null,
        createdAt: t.createdAt.toISOString(),
      }))}
      stats={{
        totalMembers: stats._count.id,
        totalActivePoints: Number(stats._sum.points || 0),
        totalLifetimePoints: Number(stats._sum.lifetimePoints || 0),
        avgPoints: Math.round(Number(stats._avg.points || 0)),
      }}
    />
  );
}
