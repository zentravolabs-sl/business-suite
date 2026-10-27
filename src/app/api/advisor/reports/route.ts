import { NextRequest, NextResponse } from "next/server";
import { authorizeAdvisor } from "@/lib/advisor/access";
import {
  generateDailyReport,
  getDailyReportByDate,
  getLatestDailyReport,
  listDailyReports,
} from "@/lib/advisor/daily-report-service";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    if (date) {
      const report = await getDailyReportByDate(tenant.businessId, date);
      if (!report) {
        return NextResponse.json({ error: "Report not found for date" }, { status: 404 });
      }
      return NextResponse.json({ report });
    }

    const [reports, latestRun] = await Promise.all([
      listDailyReports(tenant.businessId, limit),
      prisma.advisorReportRun.findFirst({
        where: { businessId: tenant.businessId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ reports, latestRun });
  } catch (err: any) {
    console.error("[advisor/reports] GET error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch reports" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    let body: { reportDate?: string; force?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine
    }

    const result = await generateDailyReport(tenant.businessId, {
      reportDate: body.reportDate,
      trigger: "MANUAL",
      force: body.force ?? true,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[advisor/reports] POST error:", err);
    return NextResponse.json({ error: err?.message || "Failed to generate report" }, { status: 500 });
  }
}
