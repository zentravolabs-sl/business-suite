/**
 * Message renderer for Advisor findings, reports, and UI.
 * Formats template placeholders ({key}, {key|money}, {key|pct}, {key|num}, {key|day})
 * using currency, language, and number conventions.
 */

import { formatCurrency, formatNumber } from "@/lib/utils";
import { RULE_MESSAGES, type Lang } from "./messages-rules";

const WEEKDAYS: Record<Lang, string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  si: ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"],
  ta: ["ஞாயிறு", "திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி"],
};

export interface FormatContext {
  lang?: Lang | string;
  currency?: string;
}

export function formatParam(
  value: unknown,
  format: string | undefined,
  ctx: FormatContext
): string {
  const lang: Lang = (ctx.lang === "si" || ctx.lang === "ta") ? ctx.lang : "en";
  const currency = ctx.currency || "LKR";

  if (value === null || value === undefined) return "-";

  if (format === "money") {
    const num = typeof value === "number" ? value : Number(value);
    return isNaN(num) ? "-" : formatCurrency(num, currency);
  }

  if (format === "pct") {
    const num = typeof value === "number" ? value : Number(value);
    return isNaN(num) ? "-" : `${num.toFixed(1)}%`;
  }

  if (format === "num") {
    const num = typeof value === "number" ? value : Number(value);
    return isNaN(num) ? "-" : formatNumber(num);
  }

  if (format === "day") {
    const dayIndex = typeof value === "number" ? value : Number(value);
    if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex <= 6) {
      return WEEKDAYS[lang][dayIndex] || String(value);
    }
    return String(value);
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? formatNumber(value) : value.toFixed(2);
  }

  return String(value);
}

export function renderTemplate(
  template: string,
  params: Record<string, unknown>,
  ctx: FormatContext
): string {
  return template.replace(/\{(\w+)(?:\|(\w+))?\}/g, (match, key, format) => {
    if (key in params) {
      return formatParam(params[key], format, ctx);
    }
    return match;
  });
}

export function getRuleMessage(
  key: string,
  lang?: Lang | string
): string | undefined {
  const targetLang: Lang = (lang === "si" || lang === "ta") ? lang : "en";
  return RULE_MESSAGES[targetLang]?.[key] || RULE_MESSAGES.en?.[key];
}

export interface RenderedFinding {
  title: string;
  what: string;
  why: string;
  steps: string[];
  recommendationTitle: string;
}

export function renderFinding(
  ruleKey: string,
  params: Record<string, unknown>,
  ctx: FormatContext
): RenderedFinding {
  const titleTpl = getRuleMessage(`i.${ruleKey}.title`, ctx.lang) || ruleKey;
  const whatTpl = getRuleMessage(`i.${ruleKey}.what`, ctx.lang) || "";
  const whyTpl = getRuleMessage(`i.${ruleKey}.why`, ctx.lang) || "";
  const stepsTpl = getRuleMessage(`i.${ruleKey}.steps`, ctx.lang) || "";
  const recTpl = getRuleMessage(`r.${ruleKey}`, ctx.lang) || titleTpl;

  const rawSteps = renderTemplate(stepsTpl, params, ctx);
  const steps = rawSteps ? rawSteps.split("|").map((s) => s.trim()).filter(Boolean) : [];

  return {
    title: renderTemplate(titleTpl, params, ctx),
    what: renderTemplate(whatTpl, params, ctx),
    why: renderTemplate(whyTpl, params, ctx),
    steps,
    recommendationTitle: renderTemplate(recTpl, params, ctx),
  };
}
