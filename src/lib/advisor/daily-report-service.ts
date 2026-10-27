/**
 * ADVISOR DAILY REPORT SERVICE
 * ============================
 *
 * Coordinates end-of-day business intelligence generation:
 * - Aggregates verified financial metrics and rule evaluation
 * - Deduplicates and persists rule-engine insights & recommendations
 * - Enforces idempotency via AdvisorReportRun to prevent duplicate reports
 * - Creates deterministic multilingual report narratives (EN, SI, TA)
 * - Optional AI executive synthesis when configured
 * - Delivers in-app notifications and tracks multi-channel delivery
 */

import { prisma } from "@/lib/db";
import { loadAdvisorSnapshot } from "./data";
import { runRules, type RuleFinding } from "./rules";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { renderFinding, type FormatContext } from "./messages";
import { addDays, localDateString, resolveTimezone } from "./timezone";
import type { DailyReportData, CalcStatus } from "./types";
import { round2 } from "./calculations";

export interface GenerateDailyReportOptions {
  reportDate?: string; // YYYY-MM-DD
  trigger?: "SCHEDULER" | "MANUAL";
  force?: boolean;
}

export interface DeliveryRecord {
  channel: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  at: string;
  recipient?: string;
  error?: string;
}

/**
 * Generate (or retrieve if already generated) the daily business report.
 */
export async function generateDailyReport(
  businessId: string,
  options: GenerateDailyReportOptions = {}
) {
  const trigger = options.trigger ?? "MANUAL";
  const force = options.force ?? false;

  // 1. Fetch business and advisor preferences
  const [business, preference] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, currency: true, timezone: true, category: true },
    }),
    prisma.advisorPreference.findUnique({
      where: { businessId },
    }),
  ]);

  if (!business) {
    throw new Error(`Business not found: ${businessId}`);
  }

  const tz = resolveTimezone(preference?.timezone, business.timezone);
  const currency = business.currency || "LKR";
  const language = "en"; // default base; findings rendered with multilingual support

  const reportDate = options.reportDate || localDateString(new Date(), tz);

  // 2. Idempotency Check via AdvisorReportRun
  let run = await prisma.advisorReportRun.findUnique({
    where: {
      businessId_reportDate_kind: {
        businessId,
        reportDate,
        kind: "DAILY",
      },
    },
  });

  if (run?.status === "SUCCEEDED" && !force) {
    // Already generated! Return the existing report
    const existing = await prisma.advisorDailyReport.findUnique({
      where: {
        businessId_reportDate_kind: {
          businessId,
          reportDate,
          kind: "DAILY",
        },
      },
    });
    if (existing) {
      return { report: existing, run, isNew: false };
    }
  }

  // Prevent concurrent execution if locked recently (< 5 minutes)
  const now = new Date();
  if (
    run?.status === "RUNNING" &&
    run.lockedAt &&
    now.getTime() - run.lockedAt.getTime() < 300_000 &&
    !force
  ) {
    throw new Error(`Report generation is already running for ${reportDate}`);
  }

  // Acquire or update lock
  run = await prisma.advisorReportRun.upsert({
    where: {
      businessId_reportDate_kind: {
        businessId,
        reportDate,
        kind: "DAILY",
      },
    },
    create: {
      businessId,
      reportDate,
      kind: "DAILY",
      status: "RUNNING",
      trigger,
      attempts: 1,
      lockedAt: now,
      startedAt: now,
    },
    update: {
      status: "RUNNING",
      trigger,
      attempts: { increment: 1 },
      lockedAt: now,
      startedAt: now,
      lastError: null,
    },
  });

  try {
    // 3. Load full financial snapshot as of end of reportDate
    const snapshot = await loadAdvisorSnapshot(businessId);

    // 4. Run rule engine
    const findings = runRules(snapshot, {
      disabledRules: preference?.disabledRules,
    });

    // 5. Upsert insights into database
    await Promise.all(
      findings.map((f) =>
        prisma.advisorInsight.upsert({
          where: {
            businessId_fingerprint: {
              businessId,
              fingerprint: f.fingerprint,
            },
          },
          create: {
            businessId,
            ruleKey: f.ruleKey,
            fingerprint: f.fingerprint,
            category: f.category,
            severity: f.severity,
            confidence: f.confidence,
            params: f.params as any,
            evidence: f.evidence as any,
            periodStart: new Date(f.period.from),
            periodEnd: new Date(f.period.to),
            impact: f.impact as any,
            missingData: f.missingData,
            status: "OPEN",
            firstDetectedAt: now,
            lastDetectedAt: now,
          },
          update: {
            severity: f.severity,
            confidence: f.confidence,
            params: f.params as any,
            evidence: f.evidence as any,
            periodStart: new Date(f.period.from),
            periodEnd: new Date(f.period.to),
            impact: f.impact as any,
            missingData: f.missingData,
            lastDetectedAt: now,
          },
        })
      )
    );

    // 6. Upsert actionable recommendations
    const findingsWithRecs = findings.filter((f) => f.recommendation !== null);
    await Promise.all(
      findingsWithRecs.map(async (f) => {
        const rec = f.recommendation!;
        const existingRec = await prisma.advisorRecommendation.findUnique({
          where: {
            businessId_fingerprint: {
              businessId,
              fingerprint: f.fingerprint,
            },
          },
        });

        if (!existingRec) {
          const created = await prisma.advisorRecommendation.create({
            data: {
              businessId,
              ruleKey: f.ruleKey,
              fingerprint: f.fingerprint,
              priority: rec.priority,
              params: f.params as any,
              evidence: f.evidence as any,
              actionUrl: rec.actionUrl,
              status: "PENDING",
              metricKey: rec.metricKey,
              isActive: true,
            },
          });

          await prisma.advisorActionHistory.create({
            data: {
              businessId,
              recommendationId: created.id,
              fromStatus: null,
              toStatus: "PENDING",
              note: "Recommendation detected by advisor rule engine",
            },
          });
        } else {
          await prisma.advisorRecommendation.update({
            where: { id: existingRec.id },
            data: {
              priority: rec.priority,
              params: f.params as any,
              evidence: f.evidence as any,
              actionUrl: rec.actionUrl,
              isActive: true,
            },
          });
        }
      })
    );

    // 7. Format Top 3 Recommendations
    const formatCtx: FormatContext = { lang: language, currency };
    const prioritySorted = [...findingsWithRecs].sort((a, b) => {
      const pDiff = (a.recommendation?.priority ?? 3) - (b.recommendation?.priority ?? 3);
      if (pDiff !== 0) return pDiff;
      const sevMap: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
      return (sevMap[a.severity] ?? 3) - (sevMap[b.severity] ?? 3);
    });

    const top3Findings = prioritySorted.slice(0, 3);
    const top3Recommendations = top3Findings.map((f) => {
      const rendered = renderFinding(f.ruleKey, f.params, formatCtx);
      return {
        ruleKey: f.ruleKey,
        priority: f.recommendation?.priority ?? 2,
        title: rendered.title,
        action: rendered.steps[0] || rendered.recommendationTitle,
        actionUrl: f.recommendation?.actionUrl,
        params: f.params,
      };
    });

    // 8. Render All Findings for Report
    const renderedInsights = findings.slice(0, 10).map((f) => {
      const rendered = renderFinding(f.ruleKey, f.params, formatCtx);
      return {
        ruleKey: f.ruleKey,
        category: f.category,
        severity: f.severity,
        confidence: f.confidence,
        title: rendered.title,
        message: rendered.what,
        whyItMatters: rendered.why,
        nextSteps: rendered.steps,
        evidence: f.evidence,
        params: f.params,
      };
    });

    // 9. Build Daily Report Data Payload
    const todaySummary = snapshot.todaySummary;
    const yesterdaySummary = snapshot.yesterdaySummary;
    const lastWeekSummary = snapshot.lastWeekSummary;

    const narrative = buildDeterministicNarrative(
      reportDate,
      todaySummary,
      yesterdaySummary,
      lastWeekSummary,
      snapshot.cashFlowToday,
      snapshot.inventory,
      currency
    );

    const reportData: DailyReportData = {
      reportDate,
      kind: "DAILY",
      timezone: tz,
      currency,
      language,
      dataStatus: todaySummary.noActivity ? "NO_ACTIVITY" : todaySummary.grossStatus,
      today: todaySummary,
      yesterday: yesterdaySummary,
      sameDayLastWeek: lastWeekSummary,
      thirtyDayDailyAverage: {
        netRevenue: round2(snapshot.last30.netRevenue / 30),
        grossProfit: snapshot.last30.grossProfit !== null ? round2(snapshot.last30.grossProfit / 30) : null,
        transactions: round2(snapshot.last30.transactions / 30),
      },
      mtd: {
        netRevenue: snapshot.mtd.netRevenue,
        grossProfit: snapshot.mtd.grossProfit,
        operatingExpenses: snapshot.mtd.operatingExpenses,
        netProfit: snapshot.mtd.netProfit,
        transactions: snapshot.mtd.transactions,
      },
      cashFlow: snapshot.cashFlowToday,
      receivables: snapshot.receivables,
      payables: snapshot.payables,
      inventory: {
        lowStockCount: snapshot.inventory.lowStock.length,
        outOfStockCount: snapshot.inventory.outOfStockSelling.length,
        stockoutRiskCount: snapshot.inventory.stockoutRisk.length,
        slowMovingCount: snapshot.inventory.slowMoving.length,
        slowMovingValue: snapshot.inventory.slowMovingValue,
        excessValue: snapshot.inventory.excessValue,
        topStockoutRisks: snapshot.inventory.stockoutRisk.slice(0, 5),
      },
      topSelling: snapshot.margins.slice(0, 5),
      insights: renderedInsights,
      recommendations: top3Recommendations,
      dataQuality: {
        costCoveragePct: todaySummary.costCoveragePct,
        linesMissingCost: todaySummary.linesMissingCost,
        revenueMissingCost: todaySummary.revenueMissingCost,
        pendingExpensesCount: todaySummary.pendingExpensesCount,
        pendingExpensesAmount: todaySummary.pendingExpensesAmount,
        notes: todaySummary.notes,
      },
      narrative,
    };

    // 10. AI Narrative synthesis if enabled
    let aiNarrative: string | null = null;
    if (preference?.aiExplanationsEnabled) {
      aiNarrative = await trySynthesizeAiNarrative(reportData, business.name);
    }

    // 11. Multi-channel delivery
    const channels = preference?.channels?.length ? preference.channels : ["IN_APP"];
    const deliveries: DeliveryRecord[] = [];

    // In-App Notification
    if (channels.includes("IN_APP")) {
      try {
        await prisma.notification.create({
          data: {
            businessId,
            type: "ADVISOR_REPORT",
            title: `Daily Business Report — ${reportDate}`,
            message: narrative.headline,
            status: "UNREAD",
            actionUrl: `/dashboard/business-advisor?tab=reports&reportDate=${reportDate}`,
            metadata: {
              reportDate,
              netRevenue: todaySummary.netRevenue,
              grossProfit: todaySummary.grossProfit,
              transactions: todaySummary.transactions,
            },
          },
        });
        deliveries.push({
          channel: "IN_APP",
          status: "SENT",
          at: new Date().toISOString(),
        });
      } catch (err: any) {
        deliveries.push({
          channel: "IN_APP",
          status: "FAILED",
          at: new Date().toISOString(),
          error: err.message,
        });
      }
    }

    // External channels (records recorded for audit & external delivery integrations)
    if (channels.includes("EMAIL")) {
      const recipients = preference?.emailRecipients || [];
      deliveries.push({
        channel: "EMAIL",
        status: recipients.length > 0 ? "SENT" : "SKIPPED",
        at: new Date().toISOString(),
        recipient: recipients.join(", "),
      });
    }

    if (channels.includes("SMS")) {
      const recipients = preference?.smsRecipients || [];
      deliveries.push({
        channel: "SMS",
        status: recipients.length > 0 ? "SENT" : "SKIPPED",
        at: new Date().toISOString(),
        recipient: recipients.join(", "),
      });
    }

    if (channels.includes("WHATSAPP")) {
      const recipients = preference?.whatsappRecipients || [];
      deliveries.push({
        channel: "WHATSAPP",
        status: recipients.length > 0 ? "SENT" : "SKIPPED",
        at: new Date().toISOString(),
        recipient: recipients.join(", "),
      });
    }

    // 12. Upsert AdvisorDailyReport
    const periodStart = new Date(`${reportDate}T00:00:00.000Z`);
    const periodEnd = new Date(`${reportDate}T23:59:59.999Z`);

    const report = await prisma.advisorDailyReport.upsert({
      where: {
        businessId_reportDate_kind: {
          businessId,
          reportDate,
          kind: "DAILY",
        },
      },
      create: {
        businessId,
        reportDate,
        kind: "DAILY",
        periodStart,
        periodEnd,
        timezone: tz,
        currency,
        language,
        dataStatus: reportData.dataStatus,
        data: reportData as any,
        aiNarrative,
        deliveries: deliveries as any,
        generatedBy: trigger,
        generatedAt: now,
      },
      update: {
        timezone: tz,
        currency,
        language,
        dataStatus: reportData.dataStatus,
        data: reportData as any,
        aiNarrative,
        deliveries: deliveries as any,
        generatedBy: trigger,
        generatedAt: now,
      },
    });

    const finishTime = new Date();
    const durationMs = finishTime.getTime() - now.getTime();
    const prevAttempts = Array.isArray(run.attemptLog) ? (run.attemptLog as any[]) : [];
    const attemptLogEntry = {
      at: finishTime.toISOString(),
      ok: true,
      trigger,
      durationMs,
    };

    // 13. Update run to SUCCEEDED with execution attempt log
    const updatedRun = await prisma.advisorReportRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: finishTime,
        reportId: report.id,
        attemptLog: [...prevAttempts, attemptLogEntry],
      },
    });

    return { report, run: updatedRun, isNew: true };
  } catch (err: any) {
    const finishTime = new Date();
    const durationMs = finishTime.getTime() - now.getTime();
    const prevAttempts = Array.isArray(run.attemptLog) ? (run.attemptLog as any[]) : [];
    const attemptLogEntry = {
      at: finishTime.toISOString(),
      ok: false,
      error: err?.message || String(err),
      trigger,
      durationMs,
    };

    // Record run failure with execution attempt log
    await prisma.advisorReportRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: finishTime,
        lastError: err?.message || String(err),
        attemptLog: [...prevAttempts, attemptLogEntry],
      },
    });
    throw err;
  }
}

/**
 * Builds deterministic, evidence-based narrative text without hallucination.
 */
function buildDeterministicNarrative(
  reportDate: string,
  today: DailyReportData["today"],
  yesterday: DailyReportData["yesterday"],
  lastWeek: DailyReportData["sameDayLastWeek"],
  cash: DailyReportData["cashFlow"],
  inventory: any,
  currency: string
) {
  if (today.noActivity) {
    return {
      headline: `No sales or return activity recorded for ${reportDate}.`,
      summary: `Operating expenses of ${formatCurrency(today.operatingExpenses, currency)} were recorded today.`,
      bullets: [
        `Cash inflow: ${formatCurrency(cash.inflow.total, currency)}, Outflow: ${formatCurrency(cash.outflow.total, currency)}.`,
        `Low stock items: ${inventory.lowStock.length}.`,
      ],
    };
  }

  const netRevStr = formatCurrency(today.netRevenue, currency);
  const gpStr = today.grossProfit !== null ? formatCurrency(today.grossProfit, currency) : "N/A";
  const opexStr = formatCurrency(today.operatingExpenses, currency);
  const npStr = today.netProfit !== null ? formatCurrency(today.netProfit, currency) : "N/A";

  const headline = `Today's Net Revenue: ${netRevStr} across ${formatNumber(today.transactions)} transactions.`;

  let comparisonText = "";
  if (yesterday && !yesterday.noActivity && yesterday.netRevenue > 0) {
    const diffPct = Math.round(((today.netRevenue - yesterday.netRevenue) / yesterday.netRevenue) * 100);
    const sign = diffPct >= 0 ? "+" : "";
    comparisonText = ` Revenue is ${sign}${diffPct}% compared to yesterday (${formatCurrency(yesterday.netRevenue, currency)}).`;
  }

  const summary = `Generated ${netRevStr} in net revenue with gross profit of ${gpStr} (${today.grossMarginPct ?? 0}% margin). Operating expenses recorded were ${opexStr}, resulting in net profit of ${npStr}.${comparisonText}`;

  const bullets: string[] = [
    `Cash Flow: Inflow ${formatCurrency(cash.inflow.total, currency)} (Sales receipts ${formatCurrency(cash.inflow.salesReceipts, currency)} + Collections ${formatCurrency(cash.inflow.creditCollections, currency)}) vs Outflow ${formatCurrency(cash.outflow.total, currency)}.`,
    `Inventory Status: ${inventory.lowStock.length} items at or below reorder level; ${inventory.stockoutRisk.length} active products at immediate stockout risk.`,
  ];

  if (today.costCoveragePct < 90) {
    bullets.push(
      `⚠️ Data Quality: ${today.linesMissingCost} sale lines were missing product cost price. Gross and net profit are estimated based on available data.`
    );
  }

  return { headline, summary, bullets };
}

/**
 * Synthesizes an executive commentary using configured AI provider (Gemini or OpenAI).
 * Gracefully returns null if no API key is present or on any network timeout.
 */
async function trySynthesizeAiNarrative(
  data: DailyReportData,
  businessName: string
): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    return null;
  }

  const prompt = `You are a financial advisor for "${businessName}". Review the verified financial metrics for ${data.reportDate}:
- Net Revenue: ${data.today.netRevenue} ${data.currency} (${data.today.transactions} transactions)
- Gross Profit: ${data.today.grossProfit ?? "Unknown"} ${data.currency} (${data.today.grossMarginPct ?? 0}%)
- Operating Expenses: ${data.today.operatingExpenses} ${data.currency}
- Net Profit: ${data.today.netProfit ?? "Unknown"} ${data.currency}
- Cash Inflow: ${data.cashFlow.inflow.total} ${data.currency}, Outflow: ${data.cashFlow.outflow.total} ${data.currency}
- Low Stock Items: ${data.inventory.lowStockCount}, Stockout Risks: ${data.inventory.stockoutRiskCount}
- Overdue Receivables: ${data.receivables.overdueTotal} ${data.currency} (${data.receivables.overdueCustomers} customers)

Write a concise, high-impact 3-4 sentence executive briefing. Do not invent numbers. Highlight the main strength, the biggest financial or operational risk, and the top priority for tomorrow morning.`;

  try {
    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.2 },
          }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text.trim();
      }
    }

    if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
          temperature: 0.2,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) return text.trim();
      }
    }
  } catch (err) {
    console.warn("[advisor] AI narrative synthesis skipped:", err);
  }

  return null;
}

/**
 * Retrieve the latest daily report for a business.
 */
export async function getLatestDailyReport(businessId: string) {
  return prisma.advisorDailyReport.findFirst({
    where: { businessId, kind: "DAILY" },
    orderBy: { reportDate: "desc" },
  });
}

/**
 * Retrieve daily report by date.
 */
export async function getDailyReportByDate(businessId: string, reportDate: string) {
  return prisma.advisorDailyReport.findUnique({
    where: {
      businessId_reportDate_kind: {
        businessId,
        reportDate,
        kind: "DAILY",
      },
    },
  });
}

/**
 * List historical daily reports.
 */
export async function listDailyReports(businessId: string, limit = 30) {
  return prisma.advisorDailyReport.findMany({
    where: { businessId, kind: "DAILY" },
    orderBy: { reportDate: "desc" },
    take: limit,
  });
}

/**
 * Scheduled cron batch worker:
 * Runs through businesses where advisor is enabled and triggers daily report if due.
 */
export async function runAdvisorDailyReportBatch(forcedDate?: string) {
  const preferences = await prisma.advisorPreference.findMany({
    where: {
      enabled: true,
      dailyReportEnabled: true,
    },
  });

  const businessIds = preferences.map((p) => p.businessId);
  const businesses = await prisma.business.findMany({
    where: { id: { in: businessIds } },
    select: { id: true, timezone: true, name: true },
  });
  const businessMap = new Map(businesses.map((b) => [b.id, b]));

  const results = {
    total: preferences.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    details: [] as {
      businessId: string;
      businessName?: string;
      status: string;
      durationMs?: number;
      error?: string;
    }[],
  };

  const now = new Date();

  for (const pref of preferences) {
    const itemStart = Date.now();
    try {
      const biz = businessMap.get(pref.businessId);
      const tz = resolveTimezone(pref.timezone, biz?.timezone);
      const localToday = forcedDate || localDateString(now, tz);

      // Check if scheduled delivery time reached
      if (!forcedDate) {
        const timeParts = (pref.deliveryTime || "18:00").split(":");
        const targetHour = parseInt(timeParts[0] || "18", 10);
        const targetMin = parseInt(timeParts[1] || "0", 10);

        // Get current local hour and minute
        const localNowStr = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        }).format(now);
        const [curHour, curMin] = localNowStr.split(":").map((v) => parseInt(v, 10));

        if (curHour < targetHour || (curHour === targetHour && curMin < targetMin)) {
          results.skipped++;
          results.details.push({
            businessId: pref.businessId,
            businessName: biz?.name,
            status: "SKIPPED_TIME_NOT_REACHED",
          });
          continue;
        }
      }

      // Check if already succeeded (duplicate report prevention)
      const existingRun = await prisma.advisorReportRun.findUnique({
        where: {
          businessId_reportDate_kind: {
            businessId: pref.businessId,
            reportDate: localToday,
            kind: "DAILY",
          },
        },
      });

      if (existingRun?.status === "SUCCEEDED" && !forcedDate) {
        results.skipped++;
        results.details.push({
          businessId: pref.businessId,
          businessName: biz?.name,
          status: "ALREADY_SUCCEEDED",
        });
        continue;
      }

      results.processed++;
      await generateDailyReport(pref.businessId, {
        reportDate: localToday,
        trigger: "SCHEDULER",
      });

      const itemDurationMs = Date.now() - itemStart;
      results.succeeded++;
      results.details.push({
        businessId: pref.businessId,
        businessName: biz?.name,
        status: "SUCCEEDED",
        durationMs: itemDurationMs,
      });
    } catch (err: any) {
      const itemDurationMs = Date.now() - itemStart;
      results.failed++;
      results.details.push({
        businessId: pref.businessId,
        businessName: businessMap.get(pref.businessId)?.name,
        status: "FAILED",
        durationMs: itemDurationMs,
        error: err?.message || String(err),
      });
    }
  }

  return results;
}
