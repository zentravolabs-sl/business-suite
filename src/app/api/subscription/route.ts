import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const changePlanSchema = z.object({
  planId: z.string().min(1),
  billingPeriod: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [subscription, plans, branchCount, userCount, productCount] = await Promise.all([
      prisma.subscription.findUnique({
        where: { businessId: tenant.businessId },
        include: {
          plan: true,
          invoices: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      }),
      prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.branch.count({ where: { businessId: tenant.businessId, isActive: true } }),
      prisma.userBusiness.count({ where: { businessId: tenant.businessId, isActive: true } }),
      prisma.product.count({ where: { businessId: tenant.businessId, isActive: true } }),
    ]);

    // If no subscription exists, provide default starter representation
    let activeSub = subscription;
    if (!activeSub && plans.length > 0) {
      // Create a default trial subscription for this business
      const starterPlan = plans.find((p) => p.type === "STARTER") || plans[0];
      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 14);

      activeSub = await prisma.subscription.create({
        data: {
          businessId: tenant.businessId,
          planId: starterPlan.id,
          status: "TRIAL",
          billingPeriod: "MONTHLY",
          amount: starterPlan.monthlyPrice,
          currency: starterPlan.currency,
          trialEndsAt: trialEnds,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEnds,
        },
        include: {
          plan: true,
          invoices: true,
        },
      });
    }

    return NextResponse.json({
      subscription: activeSub
        ? {
            id: activeSub.id,
            status: activeSub.status,
            billingPeriod: activeSub.billingPeriod,
            amount: Number(activeSub.amount),
            currency: activeSub.currency,
            trialEndsAt: activeSub.trialEndsAt?.toISOString() || null,
            currentPeriodStart: activeSub.currentPeriodStart?.toISOString() || null,
            currentPeriodEnd: activeSub.currentPeriodEnd?.toISOString() || null,
            plan: activeSub.plan
              ? {
                  id: activeSub.plan.id,
                  name: activeSub.plan.name,
                  type: activeSub.plan.type,
                  description: activeSub.plan.description,
                  monthlyPrice: Number(activeSub.plan.monthlyPrice),
                  annualPrice: Number(activeSub.plan.annualPrice),
                  currency: activeSub.plan.currency,
                  maxBranches: activeSub.plan.maxBranches,
                  maxUsers: activeSub.plan.maxUsers,
                  maxProducts: activeSub.plan.maxProducts,
                  aiAssistant: activeSub.plan.aiAssistant,
                  ecommerce: activeSub.plan.ecommerce,
                  loyalty: activeSub.plan.loyalty,
                  marketing: activeSub.plan.marketing,
                  advancedReports: activeSub.plan.advancedReports,
                  features: activeSub.plan.features,
                }
              : null,
            invoices: (activeSub.invoices || []).map((inv) => ({
              id: inv.id,
              amount: Number(inv.amount),
              currency: inv.currency,
              status: inv.status,
              paidAt: inv.paidAt?.toISOString() || null,
              invoiceUrl: inv.invoiceUrl,
              periodStart: inv.periodStart.toISOString(),
              periodEnd: inv.periodEnd.toISOString(),
              createdAt: inv.createdAt.toISOString(),
            })),
          }
        : null,
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        description: p.description,
        monthlyPrice: Number(p.monthlyPrice),
        annualPrice: Number(p.annualPrice),
        currency: p.currency,
        maxBranches: p.maxBranches,
        maxUsers: p.maxUsers,
        maxProducts: p.maxProducts,
        aiAssistant: p.aiAssistant,
        ecommerce: p.ecommerce,
        loyalty: p.loyalty,
        marketing: p.marketing,
        advancedReports: p.advancedReports,
        features: p.features,
      })),
      usage: {
        branches: {
          current: branchCount,
          max: activeSub?.plan?.maxBranches ?? 1,
        },
        users: {
          current: userCount,
          max: activeSub?.plan?.maxUsers ?? 5,
        },
        products: {
          current: productCount,
          max: activeSub?.plan?.maxProducts ?? 500,
        },
      },
    });
  } catch (error: any) {
    console.error("Subscription GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = changePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: parsed.data.planId },
    });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const isAnnual = parsed.data.billingPeriod === "ANNUAL";
    const amount = isAnnual ? plan.annualPrice : plan.monthlyPrice;

    const now = new Date();
    const nextPeriodEnd = new Date(now);
    if (isAnnual) {
      nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
    } else {
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    }

    const updated = await prisma.subscription.upsert({
      where: { businessId: tenant.businessId },
      update: {
        planId: plan.id,
        status: "ACTIVE",
        billingPeriod: parsed.data.billingPeriod,
        amount,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd,
      },
      create: {
        businessId: tenant.businessId,
        planId: plan.id,
        status: "ACTIVE",
        billingPeriod: parsed.data.billingPeriod,
        amount,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd,
      },
      include: {
        plan: true,
      },
    });

    // Generate invoice record for this subscription renewal/change
    await prisma.subscriptionInvoice.create({
      data: {
        subscriptionId: updated.id,
        amount,
        currency: plan.currency,
        status: "PAID",
        paidAt: now,
        periodStart: now,
        periodEnd: nextPeriodEnd,
      },
    });

    return NextResponse.json({ success: true, subscription: updated });
  } catch (error: any) {
    console.error("Subscription update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
