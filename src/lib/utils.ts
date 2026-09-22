import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Sri Lankan Rupees (LKR) or specified currency
 */
export function formatCurrency(amount: number | string | null | undefined, currency: string = "LKR"): string {
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(numericAmount)) return `${currency} 0.00`;

  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: currency === "LKR" ? "LKR" : currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(numericAmount)
    .replace("LKR", "Rs.")
    .trim();
}

/**
 * Format date in a human-friendly format
 */
export function formatDate(date: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  };

  return new Intl.DateTimeFormat("en-LK", defaultOptions).format(d);
}

/**
 * Format date and time
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Format number with comma separators
 */
export function formatNumber(num: number | string | null | undefined): string {
  const n = typeof num === "string" ? parseFloat(num) : (num ?? 0);
  if (isNaN(n)) return "0";
  return new Intl.NumberFormat("en-LK").format(n);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (!text) return "";
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}

/**
 * Generate a slug from string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
