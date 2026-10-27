import { NextRequest, NextResponse } from "next/server";
import { runAdvisorDailyReportBatch } from "@/lib/advisor/daily-report-service";
import { validateCronRequest } from "@/lib/advisor/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get("secret");

  // Validate authentication (Fail-Closed in production if CRON_SECRET is missing)
  const auth = validateCronRequest(authHeader, querySecret);
  if (!auth.authorized) {
    console.warn(`[advisor/cron] Rejected unauthorized invocation: ${auth.error}`);
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.statusCode }
    );
  }

  const forcedDate = searchParams.get("date") || undefined;
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  try {
    console.info(`[advisor/cron] Scheduled daily advisor batch started at ${startedAt} (forcedDate=${forcedDate || "auto"})`);

    const results = await runAdvisorDailyReportBatch(forcedDate);
    const durationMs = Date.now() - startTime;

    console.info(
      `[advisor/cron] Batch finished in ${durationMs}ms: ` +
        `total=${results.total}, processed=${results.processed}, ` +
        `succeeded=${results.succeeded}, skipped=${results.skipped}, failed=${results.failed}`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs,
      ...results,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[advisor/cron] Batch execution failed after ${durationMs}ms:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Advisor cron batch failed",
        durationMs,
      },
      { status: 500 }
    );
  }
}
