import "dotenv/config";
import { describe, it, expect } from "vitest";
import {
  formatBusinessDate,
  formatBusinessDateDisplay,
  parseBusinessDateRange,
  businessDayStart,
  businessDayEnd,
  businessMonthKey,
  businessQuarterKey,
  DateRangeError,
} from "./dates";
import {
  allocateProportionally,
  computeCreditLine,
  computeDocumentHash,
  stableStringify,
} from "./adjustments";
import { aggregateTaxSummary } from "./tax-reports";
import { TaxError } from "./errors";

describe("Sri Lanka Tax System Upgrade Unit Tests", () => {
  describe("1. Business Dates & Calendar (Asia/Colombo +05:30)", () => {
    it("formats dates in Colombo time zone regardless of server UTC time", () => {
      // 2026-10-31T20:00:00.000Z is 2026-11-01T01:30:00.000+05:30 in Colombo
      const lateNightUtc = new Date("2026-10-31T20:00:00.000Z");
      expect(formatBusinessDate(lateNightUtc)).toBe("2026-11-01");
      expect(formatBusinessDateDisplay(lateNightUtc)).toBe("01/11/2026");
      expect(businessMonthKey(lateNightUtc)).toBe("2026-11");
      expect(businessQuarterKey(lateNightUtc)).toBe("2026-Q4");
    });

    it("creates exact inclusive start and end of business day in Colombo", () => {
      const start = businessDayStart("2026-10-26");
      const end = businessDayEnd("2026-10-26");

      // Colombo 00:00:00 is 18:30:00 UTC on the previous calendar day
      expect(start.toISOString()).toBe("2026-10-25T18:30:00.000Z");
      // Colombo 23:59:59.999 is 18:29:59.999 UTC on the same calendar day
      expect(end.toISOString()).toBe("2026-10-26T18:29:59.999Z");
    });

    it("parses valid date ranges and rejects reversed dates", () => {
      const range = parseBusinessDateRange("2026-10-01", "2026-10-31");
      expect(range.start).not.toBeNull();
      expect(range.end).not.toBeNull();
      expect(range.start!.getTime()).toBeLessThan(range.end!.getTime());

      expect(() => parseBusinessDateRange("2026-10-31", "2026-10-01")).toThrow(DateRangeError);
      expect(() => parseBusinessDateRange("invalid-date", "2026-10-31")).toThrow(DateRangeError);
    });
  });

  describe("2. Adjustments, Allocation & Immutability Hashes", () => {
    it("allocates amounts proportionally using largest remainder without cent leak", () => {
      // Allocate 100.00 across 3 equal weights
      const weights = [10, 10, 10];
      const result = allocateProportionally(weights, 100);
      expect(result).toHaveLength(3);
      expect(result).toEqual(["33.34", "33.33", "33.33"]);
      const sum = result.reduce((a, b) => a + Number(b), 0);
      expect(sum).toBe(100);
    });

    it("computes exact remaining exhaust on final refund line", () => {
      const parent = {
        quantity: "5",
        grossAmount: "500.00",
        discountAmount: "0.00",
        taxableValue: "500.00",
        taxAmount: "90.00",
        lineTotal: "590.00",
      };

      const credited0 = {
        quantity: "0",
        taxableValue: "0.00",
        taxAmount: "0.00",
        grossAmount: "0.00",
        discountAmount: "0.00",
        lineTotal: "0.00",
      };

      // First partial refund of 2 units
      const creditLine1 = computeCreditLine(parent, credited0, 2);
      expect(creditLine1.quantity).toBe("2");
      expect(creditLine1.taxableValue).toBe("200.00");
      expect(creditLine1.taxAmount).toBe("36.00");
      expect(creditLine1.lineTotal).toBe("236.00");
      expect(creditLine1.exhaustsLine).toBe(false);

      // Remaining refund of 3 units (exact exhaust of remainder)
      const credited1 = {
        quantity: "2",
        taxableValue: "200.00",
        taxAmount: "36.00",
        grossAmount: "200.00",
        discountAmount: "0.00",
        lineTotal: "236.00",
      };
      const creditLine2 = computeCreditLine(parent, credited1, 3);
      expect(creditLine2.quantity).toBe("3");
      expect(creditLine2.taxableValue).toBe("300.00");
      expect(creditLine2.taxAmount).toBe("54.00");
      expect(creditLine2.lineTotal).toBe("354.00");
      expect(creditLine2.exhaustsLine).toBe(true);

      const totalRefunded = Number(creditLine1.lineTotal) + Number(creditLine2.lineTotal);
      expect(totalRefunded).toBe(590);
    });

    it("rejects credit notes exceeding remaining refundable quantity", () => {
      const parent = {
        quantity: "5",
        grossAmount: "500.00",
        discountAmount: "0.00",
        taxableValue: "500.00",
        taxAmount: "90.00",
        lineTotal: "590.00",
      };

      const credited = {
        quantity: "2",
        taxableValue: "200.00",
        taxAmount: "36.00",
        grossAmount: "200.00",
        discountAmount: "0.00",
        lineTotal: "236.00",
      };

      expect(() => computeCreditLine(parent, credited, 4)).toThrow(TaxError);
    });

    it("generates deterministic SHA-256 hash for document immutability verification", () => {
      const payloadA = { b: 2, a: 1, c: { y: 20, x: 10 } };
      const payloadB = { a: 1, c: { x: 10, y: 20 }, b: 2 };
      expect(stableStringify(payloadA)).toBe(stableStringify(payloadB));

      const hashA = computeDocumentHash(payloadA);
      const hashB = computeDocumentHash(payloadB);
      expect(hashA).toBe(hashB);
      expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("3. Real-Time Statutory Tax Reporting Engine", () => {
    it("aggregates sales and purchase documents accurately into statutory boxes", () => {
      const outputDocs = [
        {
          documentType: "TAX_INVOICE",
          grossTotal: "1180.00",
          discountTotal: "0.00",
          netValue: "1000.00",
          standardRatedValue: "1000.00",
          zeroRatedValue: "0.00",
          exemptValue: "0.00",
          outOfScopeValue: "0.00",
          taxTotal: "180.00",
          grandTotal: "1180.00",
          lines: [
            {
              treatment: "STANDARD_RATED",
              ratePercent: "18.00",
              taxableValue: "1000.00",
              taxAmount: "180.00",
            },
          ],
        },
        {
          documentType: "SALES_INVOICE",
          grossTotal: "500.00",
          discountTotal: "0.00",
          netValue: "500.00",
          standardRatedValue: "0.00",
          zeroRatedValue: "500.00",
          exemptValue: "0.00",
          outOfScopeValue: "0.00",
          taxTotal: "0.00",
          grandTotal: "500.00",
          lines: [
            {
              treatment: "ZERO_RATED",
              ratePercent: "0.00",
              taxableValue: "500.00",
              taxAmount: "0.00",
            },
          ],
        },
        {
          documentType: "CREDIT_NOTE",
          grossTotal: "236.00",
          discountTotal: "0.00",
          netValue: "200.00",
          standardRatedValue: "200.00",
          zeroRatedValue: "0.00",
          exemptValue: "0.00",
          outOfScopeValue: "0.00",
          taxTotal: "36.00",
          grandTotal: "236.00",
        },
      ];

      const inputDocs = [
        {
          documentType: "PURCHASE_INVOICE",
          grandTotal: "708.00",
          taxTotal: "108.00",
          inputVatEligibility: "ELIGIBLE",
        },
        {
          documentType: "EXPENSE_INVOICE",
          grandTotal: "354.00",
          taxTotal: "54.00",
          inputVatEligibility: "INELIGIBLE",
        },
      ];

      const summary = aggregateTaxSummary(outputDocs, inputDocs);

      expect(summary.outputVat.outputVatTotal).toBe("180.00");
      expect(summary.outputVat.standardRatedTaxable).toBe("1000.00");
      expect(summary.outputVat.zeroRatedTaxable).toBe("500.00");
      expect(summary.adjustments.creditNoteVatReversed).toBe("36.00");
      expect(summary.inputVat.eligibleInputVat).toBe("108.00");
      expect(summary.inputVat.ineligibleInputVat).toBe("54.00");
      expect(summary.inputVat.totalInputVat).toBe("162.00");
      expect(summary.netTaxPayable.netOutputVat).toBe("144.00"); // 180 - 36
      expect(summary.netTaxPayable.eligibleInputVatDeduction).toBe("108.00");
      expect(summary.netTaxPayable.payableToIrd).toBe("36.00"); // 144 - 108
    });
  });
});
