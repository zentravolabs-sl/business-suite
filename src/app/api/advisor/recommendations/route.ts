import { NextRequest, NextResponse } from "next/server";
import { authorizeAdvisor } from "@/lib/advisor/access";
import { prisma } from "@/lib/db";
import { renderFinding, type FormatContext } from "@/lib/advisor/messages";
import type { AdvisorActionStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as AdvisorActionStatus | null;

    const where: any = { businessId: tenant.businessId };
    if (status) {
      where.status = status;
    }

    const recommendations = await prisma.advisorRecommendation.findMany({
      where,
      include: {
        history: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    });

    const formatCtx: FormatContext = { lang: "en", currency: "LKR" };
    const rendered = recommendations.map((rec) => {
      const rf = renderFinding(rec.ruleKey, rec.params as Record<string, unknown>, formatCtx);
      return {
        ...rec,
        renderedTitle: rf.title,
        renderedAction: rf.steps[0] || rf.recommendationTitle,
        renderedWhy: rf.why,
        renderedSteps: rf.steps,
      };
    });

    return NextResponse.json({ recommendations: rendered });
  } catch (err: any) {
    console.error("[advisor/recommendations] GET error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch recommendations" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const body = await req.json();
    const { id, status, note, metricValue } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    const existing = await prisma.advisorRecommendation.findFirst({
      where: { id, businessId: tenant.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    const [updated] = await prisma.$transaction([
      prisma.advisorRecommendation.update({
        where: { id },
        data: {
          status,
          statusChangedAt: new Date(),
        },
      }),
      prisma.advisorActionHistory.create({
        data: {
          businessId: tenant.businessId,
          recommendationId: id,
          fromStatus: existing.status,
          toStatus: status,
          note: note || `Status updated to ${status}`,
          userId: tenant.userId,
          metricKey: existing.metricKey,
          metricValue: metricValue !== undefined ? metricValue : existing.baselineValue,
        },
      }),
    ]);

    return NextResponse.json({ recommendation: updated });
  } catch (err: any) {
    console.error("[advisor/recommendations] PATCH error:", err);
    return NextResponse.json({ error: err?.message || "Failed to update recommendation" }, { status: 500 });
  }
}
