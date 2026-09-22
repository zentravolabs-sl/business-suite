import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { MarketingClient } from "@/components/marketing/marketing-client";

export const metadata = {
  title: "Marketing Campaigns | Zentravo BMS",
  description: "Create and manage SMS, WhatsApp, and email marketing campaigns",
};

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const tenant = await requireTenant();

  const [campaigns, loyaltyTiers, customerStats, products] = await Promise.all([
    prisma.campaign.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { recipients: true } },
        products: {
          include: { product: { select: { id: true, name: true, image: true } } },
          take: 3,
        },
      },
    }),
    prisma.loyaltyTier.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { minPoints: "asc" },
    }),
    prisma.customer.groupBy({
      by: ["isVip"],
      where: { businessId: tenant.businessId, isActive: true },
      _count: { id: true },
    }),
    prisma.product.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      select: { id: true, name: true, image: true, retailPrice: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
  ]);

  const totalCustomers = customerStats.reduce((sum, g) => sum + g._count.id, 0);
  const vipCount = customerStats.find((g) => g.isVip)?._count.id || 0;

  return (
    <MarketingClient
      initialCampaigns={campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        channel: c.channel,
        status: c.status,
        subject: c.subject,
        message: c.message,
        imageUrl: c.imageUrl,
        scheduledAt: c.scheduledAt?.toISOString() || null,
        sentAt: c.sentAt?.toISOString() || null,
        targetAll: c.targetAll,
        targetTier: c.targetTier,
        stats: c.stats as any,
        recipientCount: c._count.recipients,
        products: c.products.map((p) => ({ productId: p.productId, name: p.product.name, imageUrl: p.product.image })),
        createdAt: c.createdAt.toISOString(),
      }))}
      loyaltyTiers={loyaltyTiers.map((t) => ({ id: t.id, tier: t.tier, name: t.name }))}
      availableProducts={products.map((p) => ({ id: p.id, name: p.name, imageUrl: p.image, retailPrice: Number(p.retailPrice) }))}
      audienceStats={{
        totalCustomers,
        vipCount,
        silverCount: 0,
        goldCount: 0,
        platinumCount: 0,
      }}
    />
  );
}
