/**
 * ADVISOR CHAT & INTELLIGENCE SERVICE
 * ===================================
 *
 * Implements conversational question-answering strictly grounded in
 * verified database metrics. Never fakes numbers or assumes revenue is profit.
 *
 * Architecture:
 * 1. Intent Detection: Maps owner questions to verified calculations.
 * 2. Metric Retrieval: Extracts exact figures from AdvisorSnapshot.
 * 3. Grounded Synthesis: Builds deterministic, verified response or
 *    enhances via AI synthesis strictly constrained by provided numbers.
 * 4. Audit & History: Stores conversational transcripts in AdvisorChatMessage.
 */

import { prisma } from "@/lib/db";
import { loadAdvisorSnapshot } from "./data";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { AdvisorSnapshot } from "./rules";

export type ChatIntent =
  | "TODAY_PERFORMANCE"
  | "MONTH_PROFIT"
  | "EXPENSES"
  | "MARGINS"
  | "RECEIVABLES"
  | "PAYABLES"
  | "INVENTORY_ALERTS"
  | "CASH_FLOW"
  | "RECOMMENDATIONS"
  | "GENERAL";

export interface ChatAnswer {
  intent: ChatIntent;
  message: string;
  data: Record<string, unknown>;
  usedAi: boolean;
}

/**
 * Classifies query intent via rule-based keyword matching.
 */
export function classifyIntent(query: string): ChatIntent {
  const q = query.toLowerCase();

  if (
    q.includes("cash") ||
    q.includes("cash flow") ||
    q.includes("inflow") ||
    q.includes("outflow") ||
    q.includes("mudala")
  ) {
    return "CASH_FLOW";
  }

  if (
    q.includes("owe") ||
    q.includes("debt") ||
    q.includes("credit") ||
    q.includes("customer balance") ||
    q.includes("receivable") ||
    q.includes("naya")
  ) {
    return "RECEIVABLES";
  }

  if (
    q.includes("payable") ||
    q.includes("supplier") ||
    q.includes("bill") ||
    q.includes("due to")
  ) {
    return "PAYABLES";
  }

  if (
    q.includes("stock") ||
    q.includes("inventory") ||
    q.includes("reorder") ||
    q.includes("out of stock") ||
    q.includes("low stock")
  ) {
    return "INVENTORY_ALERTS";
  }

  if (
    q.includes("margin") ||
    q.includes("loss") ||
    q.includes("discount") ||
    q.includes("negative")
  ) {
    return "MARGINS";
  }

  if (
    q.includes("expense") ||
    q.includes("spending") ||
    q.includes("viyadama") ||
    q.includes("cost")
  ) {
    return "EXPENSES";
  }

  if (
    q.includes("recommend") ||
    q.includes("advice") ||
    q.includes("tip") ||
    q.includes("what should i do") ||
    q.includes("improve")
  ) {
    return "RECOMMENDATIONS";
  }

  if (
    q.includes("month") ||
    ((q.includes("profit") || q.includes("labha")) &&
      !q.includes("today") &&
      !q.includes("ada") &&
      !q.includes("inru"))
  ) {
    return "MONTH_PROFIT";
  }

  if (
    q.includes("today") ||
    q.includes("today's") ||
    q.includes("ada") || // Sinhala
    q.includes("inru") // Tamil
  ) {
    return "TODAY_PERFORMANCE";
  }

  return "GENERAL";
}

/**
 * Generates verified answers based on real database figures.
 */
export function buildVerifiedAnswer(
  intent: ChatIntent,
  snapshot: AdvisorSnapshot,
  query: string
): { message: string; data: Record<string, unknown> } {
  const currency = snapshot.currency;

  switch (intent) {
    case "TODAY_PERFORMANCE": {
      const today = snapshot.todaySummary;
      const cash = snapshot.cashFlowToday;
      if (today.noActivity) {
        return {
          message: `No sales or refund activity recorded today (${snapshot.today}) yet. Expenses recorded today are ${formatCurrency(today.operatingExpenses, currency)}. Cash inflow today is ${formatCurrency(cash.inflow.total, currency)}.`,
          data: { today, cash },
        };
      }

      const gp = today.grossProfit !== null ? formatCurrency(today.grossProfit, currency) : "Estimated/Unavailable";
      const np = today.netProfit !== null ? formatCurrency(today.netProfit, currency) : "Estimated/Unavailable";

      return {
        message: `Today (${snapshot.today}), your business generated ${formatCurrency(today.netRevenue, currency)} in net revenue across ${formatNumber(today.transactions)} transactions. Gross profit is ${gp} (${today.grossMarginPct ?? 0}% margin). Operating expenses recorded today are ${formatCurrency(today.operatingExpenses, currency)}, leaving an estimated net profit of ${np}.`,
        data: { today, cash },
      };
    }

    case "MONTH_PROFIT": {
      const mtd = snapshot.mtd;
      const gp = mtd.grossProfit !== null ? formatCurrency(mtd.grossProfit, currency) : "Pending cost data";
      const np = mtd.netProfit !== null ? formatCurrency(mtd.netProfit, currency) : "Pending expense data";

      return {
        message: `Month-to-date (${snapshot.ranges.mtd.from} to ${snapshot.ranges.mtd.to}), total net revenue is ${formatCurrency(mtd.netRevenue, currency)} across ${formatNumber(mtd.transactions)} sales. Gross profit is ${gp} (${mtd.grossMarginPct ?? 0}% margin). Total operating expenses recorded are ${formatCurrency(mtd.operatingExpenses, currency)}, yielding a net profit of ${np}.`,
        data: { mtd },
      };
    }

    case "EXPENSES": {
      const exp = snapshot.expenses;
      const topCats = exp.byCategory.slice(0, 3).map((c) => `${c.name}: ${formatCurrency(c.last30, currency)}`);
      return {
        message: `Total operating expenses over the last 30 days were ${formatCurrency(exp.totalLast30, currency)}. Top expense categories:\n• ${topCats.join("\n• ")}.`,
        data: { expenses: exp },
      };
    }

    case "MARGINS": {
      const neg = snapshot.margins.filter((m) => m.marginPct !== null && m.marginPct < 0);
      const low = snapshot.margins.filter((m) => m.marginPct !== null && m.marginPct >= 0 && m.marginPct < 15);

      if (neg.length === 0 && low.length === 0) {
        return {
          message: `All tracked products with recorded cost prices maintained healthy gross margins (15%+) over the last 30 days.`,
          data: { negativeCount: 0, lowCount: 0 },
        };
      }

      const sampleNeg = neg.slice(0, 3).map((p) => `${p.name} (Loss: ${formatCurrency(p.profit, currency)})`);
      return {
        message: `Found ${neg.length} products selling at a net loss and ${low.length} products with margins under 15%.\nProducts selling below cost: ${sampleNeg.join(", ") || "None"}. Consider adjusting selling prices or reviewing supplier costs.`,
        data: { negativeMargins: neg, lowMargins: low },
      };
    }

    case "RECEIVABLES": {
      const rec = snapshot.receivables;
      if (rec.total <= 0) {
        return {
          message: `You currently have no outstanding customer credit balances.`,
          data: { receivables: rec },
        };
      }

      const topDebtors = rec.top.slice(0, 3).map((c) => `${c.name}: ${formatCurrency(c.balance, currency)}`);
      return {
        message: `Total outstanding customer credit is ${formatCurrency(rec.total, currency)} across ${rec.customersWithBalance} customers. ${formatCurrency(rec.overdueTotal, currency)} is overdue (${rec.overdueCustomers} customers).\nTop customer balances:\n• ${topDebtors.join("\n• ")}.`,
        data: { receivables: rec },
      };
    }

    case "PAYABLES": {
      const pay = snapshot.payables;
      return {
        message: `Total outstanding supplier payables: ${formatCurrency(pay.total, currency)} across ${pay.count} bills. ${formatCurrency(pay.overdueTotal, currency)} is currently overdue, and ${formatCurrency(pay.dueNext14Total, currency)} is due within the next 14 days.`,
        data: { payables: pay },
      };
    }

    case "INVENTORY_ALERTS": {
      const inv = snapshot.inventory;
      const lowCount = inv.lowStock.length;
      const stockoutCount = inv.stockoutRisk.length;
      const slowValue = formatCurrency(inv.slowMovingValue, currency);

      const sampleLow = inv.lowStock.slice(0, 3).map((i) => `${i.name} (Qty: ${i.qty})`);
      return {
        message: `Inventory overview: ${lowCount} items are at or below reorder level, and ${stockoutCount} active products are at risk of stocking out.\nItems to reorder: ${sampleLow.join(", ") || "None"}.\nAdditionally, ${formatCurrency(inv.slowMovingValue, currency)} of capital is tied up in slow-moving inventory.`,
        data: { inventory: inv },
      };
    }

    case "CASH_FLOW": {
      const cash = snapshot.cashFlowToday;
      const net = cash.net;
      const netStr = formatCurrency(Math.abs(net), currency);
      const direction = net >= 0 ? "positive (net surplus)" : "negative (net deficit)";

      return {
        message: `Today's Cash Flow: Total Inflow is ${formatCurrency(cash.inflow.total, currency)} (Sales receipts: ${formatCurrency(cash.inflow.salesReceipts, currency)}, Credit collections: ${formatCurrency(cash.inflow.creditCollections, currency)}). Total Outflow is ${formatCurrency(cash.outflow.total, currency)} (Expenses: ${formatCurrency(cash.outflow.expenses, currency)}, Supplier payments: ${formatCurrency(cash.outflow.supplierPayments, currency)}, Refunds: ${formatCurrency(cash.outflow.refunds, currency)}). Net cash flow is ${direction} of ${netStr}.`,
        data: { cashFlow: cash },
      };
    }

    case "RECOMMENDATIONS": {
      return {
        message: `Key Advisor Recommendations:\n1. Follow up on ${formatCurrency(snapshot.receivables.overdueTotal, currency)} in overdue customer credit to improve liquidity.\n2. Reorder the ${snapshot.inventory.stockoutRisk.length} fast-selling items at immediate stockout risk.\n3. Review expense categories that spiked above their baseline to protect operating margins.`,
        data: {
          receivablesOverdue: snapshot.receivables.overdueTotal,
          stockoutCount: snapshot.inventory.stockoutRisk.length,
        },
      };
    }

    default: {
      return {
        message: `Here is your 30-day performance summary: Net Revenue is ${formatCurrency(snapshot.last30.netRevenue, currency)} across ${formatNumber(snapshot.last30.transactions)} transactions. Gross profit is ${snapshot.last30.grossProfit !== null ? formatCurrency(snapshot.last30.grossProfit, currency) : "N/A"} (${snapshot.last30.grossMarginPct ?? 0}%). Ask me specifically about today's sales, month profit, expenses, customer credit, stock, or cash flow!`,
        data: { last30: snapshot.last30 },
      };
    }
  }
}

/**
 * Handle a chat query from a user.
 */
export async function processAdvisorChat(
  businessId: string,
  userId: string,
  query: string
): Promise<ChatAnswer> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new Error("Message cannot be empty");
  }

  // 1. Fetch preferences & check AI permissions
  const preference = await prisma.advisorPreference.findUnique({
    where: { businessId },
  });

  // 2. Load verified snapshot
  const snapshot = await loadAdvisorSnapshot(businessId);

  // 3. Classify intent & build grounded factual answer
  const intent = classifyIntent(cleanQuery);
  const verified = buildVerifiedAnswer(intent, snapshot, cleanQuery);

  let finalMessage = verified.message;
  let usedAi = false;

  // 4. If AI synthesis enabled and keys present, polish into natural assistant speech
  if (preference?.aiExplanationsEnabled) {
    const aiResponse = await tryAiChatSynthesis(cleanQuery, verified, snapshot.currency);
    if (aiResponse) {
      finalMessage = aiResponse;
      usedAi = true;
    }
  }

  // 5. Save chat messages to database
  await prisma.$transaction([
    prisma.advisorChatMessage.create({
      data: {
        businessId,
        userId,
        role: "USER",
        content: cleanQuery,
        intent,
      },
    }),
    prisma.advisorChatMessage.create({
      data: {
        businessId,
        userId,
        role: "ADVISOR",
        content: finalMessage,
        intent,
        usedAi,
        data: verified.data as any,
      },
    }),
  ]);

  return {
    intent,
    message: finalMessage,
    data: verified.data,
    usedAi,
  };
}

/**
 * Polish factual answer using external AI API strictly grounded by facts.
 */
async function tryAiChatSynthesis(
  userQuery: string,
  verified: { message: string; data: Record<string, unknown> },
  currency: string
): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) return null;

  const systemInstructions = `You are Zentravo AI Business Advisor, an expert CFO and financial assistant.
You must answer the business owner's question using ONLY the provided verified metrics.
NEVER invent numbers, assume facts not provided, or promise guaranteed future profits.
Keep your response clear, conversational, actionable, and under 3-4 sentences. Currency is ${currency}.

Verified Data:
${JSON.stringify(verified.data, null, 2)}

Baseline Verified Answer:
${verified.message}
`;

  try {
    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemInstructions}\n\nOwner's Question: "${userQuery}"` },
                ],
              },
            ],
            generationConfig: { maxOutputTokens: 250, temperature: 0.2 },
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
          messages: [
            { role: "system", content: systemInstructions },
            { role: "user", content: userQuery },
          ],
          max_tokens: 250,
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
    console.warn("[advisor] AI chat synthesis skipped:", err);
  }

  return null;
}

/**
 * Get recent chat history for a user in a business.
 */
export async function getChatHistory(businessId: string, limit = 50) {
  return prisma.advisorChatMessage.findMany({
    where: { businessId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/**
 * Clear chat history for a business.
 */
export async function clearChatHistory(businessId: string) {
  return prisma.advisorChatMessage.deleteMany({
    where: { businessId },
  });
}
