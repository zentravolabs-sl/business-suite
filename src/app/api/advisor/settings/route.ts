import { NextRequest, NextResponse } from "next/server";
import { authorizeAdvisor } from "@/lib/advisor/access";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    let preference = await prisma.advisorPreference.findUnique({
      where: { businessId: tenant.businessId },
    });

    if (!preference) {
      preference = await prisma.advisorPreference.create({
        data: {
          businessId: tenant.businessId,
          enabled: true,
          dailyReportEnabled: true,
          reportFrequency: "DAILY",
          deliveryTime: "18:00",
          channels: ["IN_APP"],
          aiExplanationsEnabled: false,
        },
      });
    }

    return NextResponse.json({ preference });
  } catch (err: any) {
    console.error("[advisor/settings] GET error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor({ anyOf: ["advisor.manage", "settings.edit"] });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const body = await req.json();

    const allowedFields = [
      "enabled",
      "dailyReportEnabled",
      "reportFrequency",
      "weeklyDay",
      "deliveryTime",
      "timezone",
      "channels",
      "emailRecipients",
      "smsRecipients",
      "whatsappRecipients",
      "aiExplanationsEnabled",
      "chatRetentionDays",
      "thresholds",
      "disabledRules",
    ];

    const data: any = {
      updatedById: tenant.userId,
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const preference = await prisma.advisorPreference.upsert({
      where: { businessId: tenant.businessId },
      create: {
        businessId: tenant.businessId,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({ preference });
  } catch (err: any) {
    console.error("[advisor/settings] PATCH error:", err);
    return NextResponse.json({ error: err?.message || "Failed to update settings" }, { status: 500 });
  }
}
