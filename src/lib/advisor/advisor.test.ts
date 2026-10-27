import "dotenv/config";
import { describe, it, expect } from "vitest";
import {
  resolveTimezone,
  localDateString,
  dayBounds,
  addDays,
  daysBetween,
} from "./timezone";
import {
  computeProfitability,
  computeCashFlow,
  maxSafeDiscountPct,
  round2,
  pctChange,
} from "./calculations";
import { runRules, type AdvisorSnapshot } from "./rules";
import { formatParam, renderTemplate, renderFinding } from "./messages";
import { classifyIntent } from "./chat-service";
import type { SaleRec, RefundRec, ExpenseRec } from "./types";

describe("AI Business Advisor — Comprehensive Engine Tests", () => {
  describe("1. Timezone & Date Geometry", () => {
    it("resolves business timezone with fallback to Asia/Colombo", () => {
      expect(resolveTimezone("Asia/Colombo")).toBe("Asia/Colombo");
      expect(resolveTimezone(null, "Asia/Singapore")).toBe("Asia/Singapore");
      expect(resolveTimezone(null, null)).toBe("Asia/Colombo");
    });

    it("formats local date string accurately regardless of UTC", () => {
      // 2026-10-31 20:00:00 UTC is 2026-11-01 01:30:00 in Asia/Colombo (+05:30)
      const dateUtc = new Date("2026-10-31T20:00:00.000Z");
      expect(localDateString(dateUtc, "Asia/Colombo")).toBe("2026-11-01");
    });

    it("creates exact day boundaries for local timezone", () => {
      const bounds = dayBounds("2026-10-26", "Asia/Colombo");
      // 2026-10-26 00:00:00 in Colombo (+05:30) is 2026-10-25 18:30:00Z
      expect(bounds.start.toISOString()).toBe("2026-10-25T18:30:00.000Z");
      // end is start of next day (2026-10-26 18:30:00Z)
      expect(bounds.end.toISOString()).toBe("2026-10-26T18:30:00.000Z");
    });

    it("adds days and measures day distance correctly", () => {
      expect(addDays("2026-10-26", 1)).toBe("2026-10-27");
      expect(addDays("2026-10-26", -7)).toBe("2026-10-19");
      expect(daysBetween("2026-10-19", "2026-10-26")).toBe(7);
    });
  });

  describe("2. Pure Financial & Profitability Calculations", () => {
    it("calculates exact net revenue, COGS, gross profit and margins on costed sales", () => {
      const range = {
        start: new Date("2026-10-01T00:00:00Z"),
        end: new Date("2026-10-31T23:59:59Z"),
      };

      const sales: SaleRec[] = [
        {
          id: "s1",
          status: "COMPLETED",
          createdAt: new Date("2026-10-15T10:00:00Z"),
          subtotal: 1000,
          discountAmount: 100,
          taxAmount: 0,
          serviceCharge: 0,
          total: 900,
          creditAmount: 0,
          payments: [{ method: "CASH", amount: 900, status: "PAID" }],
          items: [
            {
              productId: "p1",
              name: "Product 1",
              quantity: 2,
              unitPrice: 500,
              costPrice: 250, // total cost 500
              discountAmount: 100,
              taxAmount: 0,
              total: 900,
            },
          ],
        },
      ];

      const expenses: ExpenseRec[] = [
        {
          id: "e1",
          categoryName: "Rent",
          amount: 200,
          taxAmount: 0,
          inputVatEligible: false,
          status: "PAID",
          expenseDate: new Date("2026-10-10T00:00:00Z"),
        },
      ];

      const result = computeProfitability({
        range,
        sales,
        refunds: [],
        expenses,
      });

      // Net revenue = 900, COGS = 500, Gross Profit = 400
      expect(result.netRevenue).toBe(900);
      expect(result.cogs).toBe(500);
      expect(result.grossProfit).toBe(400);
      expect(result.grossMarginPct).toBe(44.44);
      expect(result.grossStatus).toBe("COMPLETE");

      // Operating expenses = 200, Net Profit = 200
      expect(result.operatingExpenses).toBe(200);
      expect(result.netProfit).toBe(200);
      expect(result.netMarginPct).toBe(22.22);
    });

    it("correctly flags ESTIMATED and INCOMPLETE when cost coverage is low", () => {
      const range = {
        start: new Date("2026-10-01T00:00:00Z"),
        end: new Date("2026-10-31T23:59:59Z"),
      };

      const sales: SaleRec[] = [
        {
          id: "s2",
          status: "COMPLETED",
          createdAt: new Date("2026-10-15T10:00:00Z"),
          subtotal: 1000,
          discountAmount: 0,
          taxAmount: 0,
          serviceCharge: 0,
          total: 1000,
          creditAmount: 0,
          payments: [{ method: "CASH", amount: 1000, status: "PAID" }],
          items: [
            {
              productId: "p_uncosted",
              name: "Uncosted Product",
              quantity: 1,
              unitPrice: 1000,
              costPrice: 0, // Missing cost
              discountAmount: 0,
              taxAmount: 0,
              total: 1000,
            },
          ],
        },
      ];

      const result = computeProfitability({
        range,
        sales,
        refunds: [],
        expenses: [],
      });

      expect(result.costCoveragePct).toBe(0);
      expect(result.linesMissingCost).toBe(1);
      expect(result.grossStatus).toBe("UNAVAILABLE");
      expect(result.grossProfit).toBeNull();
    });

    it("deducts refunds and restocked inventory costs accurately", () => {
      const range = {
        start: new Date("2026-10-01T00:00:00Z"),
        end: new Date("2026-10-31T23:59:59Z"),
      };

      const sales: SaleRec[] = [
        {
          id: "s1",
          status: "PARTIALLY_REFUNDED",
          createdAt: new Date("2026-10-15T10:00:00Z"),
          subtotal: 1000,
          discountAmount: 0,
          taxAmount: 0,
          serviceCharge: 0,
          total: 1000,
          creditAmount: 0,
          payments: [{ method: "CASH", amount: 1000, status: "PAID" }],
          items: [
            {
              productId: "p1",
              name: "Product 1",
              quantity: 2,
              unitPrice: 500,
              costPrice: 200, // COGS 400
              discountAmount: 0,
              taxAmount: 0,
              total: 1000,
            },
          ],
        },
      ];

      const refunds: RefundRec[] = [
        {
          id: "r1",
          saleId: "s1",
          createdAt: new Date("2026-10-16T10:00:00Z"),
          totalAmount: 500,
          subtotal: 500,
          taxAmount: 0,
          paymentMethod: "CASH",
          restockedCost: 200, // 1 unit restocked
        },
      ];

      const result = computeProfitability({
        range,
        sales,
        refunds,
        expenses: [],
      });

      // Net revenue = 1000 - 500 = 500
      expect(result.netRevenue).toBe(500);
      // Net COGS = 400 - 200 = 200
      expect(result.cogs).toBe(200);
      // Gross profit = 500 - 200 = 300
      expect(result.grossProfit).toBe(300);
    });

    it("computes cash flow separating point of sale receipts from collections and outflows", () => {
      const range = {
        start: new Date("2026-10-01T00:00:00Z"),
        end: new Date("2026-10-31T23:59:59Z"),
      };

      const sales: SaleRec[] = [
        {
          id: "s1",
          status: "COMPLETED",
          createdAt: new Date("2026-10-05T10:00:00Z"),
          subtotal: 1000,
          discountAmount: 0,
          taxAmount: 0,
          serviceCharge: 0,
          total: 1000,
          creditAmount: 400, // 600 collected in cash, 400 credit
          payments: [{ method: "CASH", amount: 600, status: "PAID" }],
          items: [],
        },
      ];

      const cashFlow = computeCashFlow({
        range,
        sales,
        refunds: [],
        expenses: [
          {
            id: "e1",
            categoryName: "Utilities",
            amount: 150,
            taxAmount: 0,
            inputVatEligible: false,
            status: "PAID",
            expenseDate: new Date("2026-10-10T00:00:00Z"),
          },
        ],
        supplierPayments: [
          { amount: 200, paidAt: new Date("2026-10-12T00:00:00Z") },
        ],
        creditCollections: [
          { amount: 100, createdAt: new Date("2026-10-14T00:00:00Z") },
        ],
      });

      expect(cashFlow.inflow.salesReceipts).toBe(600);
      expect(cashFlow.inflow.creditCollections).toBe(100);
      expect(cashFlow.inflow.total).toBe(700);

      expect(cashFlow.outflow.expenses).toBe(150);
      expect(cashFlow.outflow.supplierPayments).toBe(200);
      expect(cashFlow.outflow.total).toBe(350);

      expect(cashFlow.net).toBe(350);
    });
  });

  describe("3. Safe Discount Calculation Engine", () => {
    it("calculates safe discount ceiling enforcing margin floor", () => {
      // Selling price 1000, Cost 600 -> Gross Margin 40%.
      // If minMargin floor is 15%, max discount allowed is:
      // (1000 - 600 / (1 - 0.15)) / 1000 = (1000 - 705.88) / 1000 = ~29.4%
      const discount = maxSafeDiscountPct(1000, 600, 15);
      expect(discount).not.toBeNull();
      expect(discount).toBeCloseTo(29.4, 1);

      // Verify that after this discount, the margin is indeed >= 15%:
      const discountedPrice = 1000 * (1 - (discount as number) / 100);
      const resultingMargin = ((discountedPrice - 600) / discountedPrice) * 100;
      expect(resultingMargin).toBeGreaterThanOrEqual(14.99);
    });

    it("returns null if cost is zero or negative, and 0 if cost exceeds price", () => {
      expect(maxSafeDiscountPct(1000, 0, 15)).toBeNull();
      expect(maxSafeDiscountPct(1000, -100, 15)).toBeNull();
      expect(maxSafeDiscountPct(500, 600, 15)).toBe(0);
    });
  });

  describe("4. Multilingual Message Formatting", () => {
    it("renders currency, percentage, and numbers properly", () => {
      expect(formatParam(125000, "money", { currency: "LKR", lang: "en" })).toContain("125,000");
      expect(formatParam(18.543, "pct", { lang: "en" })).toBe("18.5%");
      expect(formatParam(42, "num", { lang: "en" })).toBe("42");
    });

    it("renders Sinhala and Tamil weekdays", () => {
      expect(formatParam(0, "day", { lang: "si" })).toBe("ඉරිදා");
      expect(formatParam(0, "day", { lang: "ta" })).toBe("ஞாயிறு");
      expect(formatParam(1, "day", { lang: "en" })).toBe("Monday");
    });

    it("renders parameterized findings in English, Sinhala, and Tamil", () => {
      const params = {
        amount: 25000,
        pct: 12.5,
        count: 4,
      };

      const findingEn = renderFinding("REVENUE_DECLINE_SHARP", params, { lang: "en", currency: "LKR" });
      expect(findingEn.title).toBeTruthy();

      const findingSi = renderFinding("REVENUE_DECLINE_SHARP", params, { lang: "si", currency: "LKR" });
      expect(findingSi.title).toBeTruthy();

      const findingTa = renderFinding("REVENUE_DECLINE_SHARP", params, { lang: "ta", currency: "LKR" });
      expect(findingTa.title).toBeTruthy();
    });
  });

  describe("5. Chat Intent Classification", () => {
    it("correctly identifies common business questions in EN, SI, TA", () => {
      expect(classifyIntent("How much did I make today?")).toBe("TODAY_PERFORMANCE");
      expect(classifyIntent("Ada labhaya kiyada?")).toBe("TODAY_PERFORMANCE");
      expect(classifyIntent("What was my gross profit this month?")).toBe("MONTH_PROFIT");
      expect(classifyIntent("Which expense categories are highest?")).toBe("EXPENSES");
      expect(classifyIntent("Are any products selling at a negative margin?")).toBe("MARGINS");
      expect(classifyIntent("Who owes me money and what is overdue?")).toBe("RECEIVABLES");
      expect(classifyIntent("What items are running low on stock?")).toBe("INVENTORY_ALERTS");
      expect(classifyIntent("How is my cash flow today?")).toBe("CASH_FLOW");
      expect(classifyIntent("What recommendations do you have to improve profits?")).toBe("RECOMMENDATIONS");
    });
  });

  describe("6. Empty Database & Edge Case Safety", () => {
    it("handles zero sales and empty database gracefully without NaN or errors", () => {
      const range = {
        start: new Date("2026-10-01T00:00:00Z"),
        end: new Date("2026-10-31T23:59:59Z"),
      };

      const result = computeProfitability({
        range,
        sales: [],
        refunds: [],
        expenses: [],
      });

      expect(result.transactions).toBe(0);
      expect(result.netRevenue).toBe(0);
      expect(result.cogs).toBe(0);
      expect(result.grossProfit).toBeNull();
      expect(result.grossMarginPct).toBeNull();
      expect(result.grossStatus).toBe("UNAVAILABLE");
      expect(result.noActivity).toBe(true);
    });
  });
});
