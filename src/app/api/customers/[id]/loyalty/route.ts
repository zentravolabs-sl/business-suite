import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

// Award or deduct loyalty points for a customer
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { type, points, notes } = body;

    if (!type || !points) {
      return NextResponse.json({ error: "Type and points are required" }, { status: 400 });
    }

    // Verify customer belongs to business
    const customer = await prisma.customer.findFirst({
      where: { id, businessId: tenant.businessId },
      include: { loyaltyAccount: true },
    });

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    let account = customer.loyaltyAccount;

    if (!account) {
      account = await prisma.loyaltyAccount.create({
        data: {
          businessId: tenant.businessId,
          customerId: customer.id,
          points: 0,
          lifetimePoints: 0,
        },
      });
    }

    const delta = type === "REDEEM" || type === "EXPIRY" ? -Math.abs(points) : Math.abs(points);
    const newBalance = Math.max(0, account.points + delta);
    const newLifetime =
      type === "EARN" || type === "BONUS" || type === "BIRTHDAY" || type === "REFERRAL"
        ? account.lifetimePoints + Math.abs(points)
        : account.lifetimePoints;

    await prisma.$transaction([
      prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: newBalance, lifetimePoints: newLifetime },
      }),
      prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type,
          points: Math.abs(points),
          balance: newBalance,
          notes: notes || null,
        },
      }),
    ]);

    // Check for tier upgrade
    const tiers = await prisma.loyaltyTier.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { minPoints: "desc" },
    });

    if (tiers.length > 0) {
      const eligibleTier = tiers.find((t) => newLifetime >= t.minPoints);
      if (eligibleTier && account.tierId !== eligibleTier.id) {
        await prisma.loyaltyAccount.update({
          where: { id: account.id },
          data: { tierId: eligibleTier.id },
        });
      }
    }

    return NextResponse.json({ success: true, newBalance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
