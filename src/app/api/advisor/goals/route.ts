import { NextRequest, NextResponse } from "next/server";
import { authorizeAdvisor } from "@/lib/advisor/access";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const goals = await prisma.advisorGoal.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ goals });
  } catch (err: any) {
    console.error("[advisor/goals] GET error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch goals" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const body = await req.json();
    const { metric, title, targetValue, endsOn } = body;

    if (!metric || targetValue === undefined || targetValue === null) {
      return NextResponse.json({ error: "metric and targetValue are required" }, { status: 400 });
    }

    const goal = await prisma.advisorGoal.create({
      data: {
        businessId: tenant.businessId,
        metric,
        title: title || metric,
        targetValue,
        endsOn: endsOn ? new Date(endsOn) : null,
        createdById: tenant.userId,
      },
    });

    return NextResponse.json({ goal });
  } catch (err: any) {
    console.error("[advisor/goals] POST error:", err);
    return NextResponse.json({ error: err?.message || "Failed to create goal" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const body = await req.json();
    const { id, targetValue, title, isActive, endsOn } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.advisorGoal.findFirst({
      where: { id, businessId: tenant.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const data: any = {};
    if (targetValue !== undefined) data.targetValue = targetValue;
    if (title !== undefined) data.title = title;
    if (isActive !== undefined) data.isActive = isActive;
    if (endsOn !== undefined) data.endsOn = endsOn ? new Date(endsOn) : null;

    const goal = await prisma.advisorGoal.update({
      where: { id },
      data,
    });

    return NextResponse.json({ goal });
  } catch (err: any) {
    console.error("[advisor/goals] PATCH error:", err);
    return NextResponse.json({ error: err?.message || "Failed to update goal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.advisorGoal.deleteMany({
      where: { id, businessId: tenant.businessId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[advisor/goals] DELETE error:", err);
    return NextResponse.json({ error: err?.message || "Failed to delete goal" }, { status: 500 });
  }
}
