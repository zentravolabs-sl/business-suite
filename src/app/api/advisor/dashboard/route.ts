import { NextRequest, NextResponse } from "next/server";
import { authorizeAdvisor } from "@/lib/advisor/access";
import { loadAdvisorSnapshot } from "@/lib/advisor/data";
import { runRules } from "@/lib/advisor/rules";
import { prisma } from "@/lib/db";
import { renderFinding, type FormatContext } from "@/lib/advisor/messages";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const [preference, goals, existingRecs, existingInsights] = await Promise.all([
      prisma.advisorPreference.findUnique({
        where: { businessId: tenant.businessId },
      }),
      prisma.advisorGoal.findMany({
        where: { businessId: tenant.businessId, isActive: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.advisorRecommendation.findMany({
        where: { businessId: tenant.businessId, isActive: true },
        include: { history: { orderBy: { createdAt: "desc" }, take: 5 } },
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      }),
      prisma.advisorInsight.findMany({
        where: { businessId: tenant.businessId, status: "OPEN" },
        orderBy: [{ severity: "asc" }, { lastDetectedAt: "desc" }],
        take: 20,
      }),
    ]);

    // Load full calculation snapshot
    const snapshot = await loadAdvisorSnapshot(tenant.businessId);

    // Format findings in the preferred language
    const formatCtx: FormatContext = {
      lang: "en",
      currency: snapshot.currency,
    };

    const renderedInsights = existingInsights.map((ins) => {
      const rendered = renderFinding(ins.ruleKey, ins.params as Record<string, unknown>, formatCtx);
      return {
        ...ins,
        renderedTitle: rendered.title,
        renderedWhat: rendered.what,
        renderedWhy: rendered.why,
        renderedSteps: rendered.steps,
      };
    });

    const renderedRecommendations = existingRecs.map((rec) => {
      const rendered = renderFinding(rec.ruleKey, rec.params as Record<string, unknown>, formatCtx);
      return {
        ...rec,
        renderedTitle: rendered.title,
        renderedAction: rendered.steps[0] || rendered.recommendationTitle,
      };
    });

    // Compute progress for goals
    const goalsWithProgress = goals.map((g) => {
      let currentValue: number | null = null;
      if (g.metric === "DAILY_SALES") currentValue = snapshot.todaySummary.netRevenue;
      else if (g.metric === "MONTHLY_SALES") currentValue = snapshot.mtd.netRevenue;
      else if (g.metric === "MONTHLY_GROSS_PROFIT") currentValue = snapshot.mtd.grossProfit;
      else if (g.metric === "MONTHLY_EXPENSE_LIMIT") currentValue = snapshot.mtd.operatingExpenses;
      else if (g.metric === "STOCK_TURNOVER") currentValue = snapshot.inventory.turnoverAnnualised;
      else if (g.metric === "REPEAT_CUSTOMER_SALES") currentValue = snapshot.customers.repeatRevenueSharePct;

      const target = Number(g.targetValue);
      const pct = target > 0 && currentValue !== null ? Math.min(150, Math.round((currentValue / target) * 100)) : null;

      return {
        ...g,
        currentValue,
        progressPct: pct,
      };
    });

    return NextResponse.json({
      snapshot,
      preference: preference || {
        enabled: true,
        dailyReportEnabled: true,
        reportFrequency: "DAILY",
        deliveryTime: "18:00",
        channels: ["IN_APP"],
        aiExplanationsEnabled: false,
      },
      insights: renderedInsights,
      recommendations: renderedRecommendations,
      goals: goalsWithProgress,
    });
  } catch (err: any) {
    console.error("[advisor/dashboard] GET error:", err);
    return NextResponse.json({ error: err?.message || "Failed to load advisor dashboard" }, { status: 500 });
  }
}
