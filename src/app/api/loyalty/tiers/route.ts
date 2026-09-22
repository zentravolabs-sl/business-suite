import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tiers = await prisma.loyaltyTier.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { minPoints: "asc" },
      include: {
        _count: { select: { accounts: true } },
      },
    });

    // Get summary stats
    const [totalAccounts, totalPointsAgg] = await Promise.all([
      prisma.loyaltyAccount.count({ where: { businessId: tenant.businessId } }),
      prisma.loyaltyAccount.aggregate({
        where: { businessId: tenant.businessId },
        _sum: { points: true, lifetimePoints: true },
      }),
    ]);

    return NextResponse.json({
      tiers: tiers.map((t) => ({
        id: t.id,
        tier: t.tier,
        name: t.name,
        minPoints: t.minPoints,
        pointsMultiplier: Number(t.pointsMultiplier),
        benefits: t.benefits,
        memberCount: t._count.accounts,
      })),
      stats: {
        totalAccounts,
        totalActivePoints: Number(totalPointsAgg._sum.points || 0),
        totalLifetimePoints: Number(totalPointsAgg._sum.lifetimePoints || 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { tier, name, minPoints, pointsMultiplier, benefits } = body;

    if (!tier || !name || minPoints === undefined) {
      return NextResponse.json({ error: "tier, name, and minPoints are required" }, { status: 400 });
    }

    const loyaltyTier = await prisma.loyaltyTier.upsert({
      where: { businessId_tier: { businessId: tenant.businessId, tier } },
      create: {
        businessId: tenant.businessId,
        tier,
        name,
        minPoints: parseInt(minPoints),
        pointsMultiplier: pointsMultiplier || 1,
        benefits: benefits || null,
      },
      update: {
        name,
        minPoints: parseInt(minPoints),
        pointsMultiplier: pointsMultiplier || 1,
        benefits: benefits || null,
      },
    });

    return NextResponse.json({ success: true, tier: loyaltyTier });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
