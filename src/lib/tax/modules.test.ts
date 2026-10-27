import { describe, expect, it } from "vitest";
import {
  formatSimpleNumber,
  formatTaxInvoiceSerial,
  getZonedParts,
  isValidTaxInvoiceSerial,
  parseTaxInvoiceSerial,
  sequencePeriodKey,
  NumberingError,
} from "./numbering";
import { amountInWordsLKR } from "./amount-in-words";
import {
  applyCustomerExemption,
  effectiveTreatmentForSupplier,
  isVatRegisteredOn,
  planDocuments,
  validateAdjustmentParent,
  validateBuyerForTaxInvoice,
} from "./document-types";
import { findOverlap, resolveRateVersion } from "./rates";

describe("tax invoice serial YYMMM_QQQQ_XXXXX", () => {
  const date = new Date("2026-10-21T10:00:00+05:30");

  it("formats the serial", () => {
    expect(formatTaxInvoiceSerial({ issueDate: date, classificationCode: "main", sequence: 7 })).toBe("26OCT_MAIN_00007");
  });

  it("uses the Colombo calendar, not UTC (month boundary)", () => {
    // 2026-10-31 20:00 UTC == 2026-11-01 01:30 Colombo
    const d = new Date("2026-10-31T20:00:00Z");
    expect(getZonedParts(d)).toEqual({ year: 2026, month: 11, day: 1 });
    expect(formatTaxInvoiceSerial({ issueDate: d, classificationCode: "A1", sequence: 1 })).toBe("26NOV_A1_00001");
  });

  it("grows beyond 5 digits without truncating", () => {
    expect(formatTaxInvoiceSerial({ issueDate: date, classificationCode: "MAIN", sequence: 123456 })).toBe(
      "26OCT_MAIN_123456"
    );
  });

  it("rejects bad classification codes and sequences", () => {
    expect(() => formatTaxInvoiceSerial({ issueDate: date, classificationCode: "bad code", sequence: 1 })).toThrowError(
      NumberingError
    );
    expect(() => formatTaxInvoiceSerial({ issueDate: date, classificationCode: "", sequence: 1 })).toThrowError(
      NumberingError
    );
    expect(() => formatTaxInvoiceSerial({ issueDate: date, classificationCode: "MAIN", sequence: 0 })).toThrowError(
      NumberingError
    );
  });

  it("never exceeds 40 characters", () => {
    expect(() =>
      formatTaxInvoiceSerial({
        issueDate: date,
        classificationCode: "ABCDEFGHIJKLMNO",
        sequence: Number.MAX_SAFE_INTEGER,
        minDigits: 30,
      })
    ).toThrowError(/exceeds/);
  });

  it("round-trips through parse / validate", () => {
    const s = formatTaxInvoiceSerial({ issueDate: date, classificationCode: "BR01", sequence: 42 });
    expect(parseTaxInvoiceSerial(s)).toEqual({ year: 2026, month: 10, classificationCode: "BR01", sequence: 42 });
    expect(isValidTaxInvoiceSerial(s)).toBe(true);
    expect(isValidTaxInvoiceSerial("26oct_MAIN_00001")).toBe(false);
    expect(isValidTaxInvoiceSerial("26OCT MAIN 00001")).toBe(false);
  });

  it("derives period keys from the reset policy", () => {
    expect(sequencePeriodKey("NEVER", date)).toBe("ALL");
    expect(sequencePeriodKey("YEARLY", date)).toBe("2026");
    expect(sequencePeriodKey("MONTHLY", date)).toBe("2026-10");
  });

  it("formats simple numbers", () => {
    expect(formatSimpleNumber("INV", 12)).toBe("INV-000012");
    expect(formatSimpleNumber("INV-", 12)).toBe("INV-000012");
  });
});

describe("amountInWordsLKR", () => {
  it.each([
    ["0", "Zero Rupees Only"],
    ["1", "One Rupee Only"],
    ["1234.50", "One Thousand Two Hundred Thirty-Four Rupees and Fifty Cents Only"],
    ["100000", "One Hundred Thousand Rupees Only"],
    ["2500000.01", "Two Million Five Hundred Thousand Rupees and One Cent Only"],
    ["19.999", "Twenty Rupees Only"],
  ])("%s", (n, words) => {
    expect(amountInWordsLKR(n)).toBe(words);
  });

  it("rejects garbage", () => {
    expect(() => amountInWordsLKR("abc")).toThrow();
  });
});

describe("document planning", () => {
  const registered = { vatStatus: "REGISTERED" as const, effectiveDate: new Date("2020-01-01") };
  const supply = new Date("2026-10-21");
  const line = (treatment: "STANDARD_RATED" | "ZERO_RATED" | "EXEMPT" | "OUT_OF_SCOPE", tax = "0.00") => ({
    description: treatment,
    treatment,
    taxAmount: tax,
  });

  it("registration respects the effective date", () => {
    expect(isVatRegisteredOn(registered, supply)).toBe(true);
    expect(isVatRegisteredOn({ ...registered, effectiveDate: new Date("2027-01-01") }, supply)).toBe(false);
    expect(isVatRegisteredOn({ vatStatus: "NOT_REGISTERED" }, supply)).toBe(false);
    expect(isVatRegisteredOn({ vatStatus: "PENDING_REGISTRATION" }, supply)).toBe(false);
  });

  it("non-registered supplier never gets a TAX INVOICE and charges out-of-scope", () => {
    const plan = planDocuments({
      supplier: { vatStatus: "NOT_REGISTERED" },
      supplyDate: supply,
      lines: [line("OUT_OF_SCOPE")],
    });
    expect(plan.documents).toHaveLength(1);
    expect(plan.documents[0].documentType).toBe("SALES_INVOICE");
    expect(effectiveTreatmentForSupplier({ vatStatus: "NOT_REGISTERED" }, supply, "STANDARD_RATED")).toBe("OUT_OF_SCOPE");
  });

  it("flags tax on a non-registered supplier", () => {
    const plan = planDocuments({
      supplier: { vatStatus: "NOT_REGISTERED" },
      supplyDate: supply,
      lines: [line("STANDARD_RATED", "18.00")],
    });
    expect(plan.issues.map((i) => i.code)).toContain("TAX_ON_NON_REGISTERED");
  });

  it("registered supplier, all taxable → single TAX_INVOICE", () => {
    const plan = planDocuments({ supplier: registered, supplyDate: supply, lines: [line("STANDARD_RATED", "18"), line("ZERO_RATED")] });
    expect(plan.documents.map((d) => d.documentType)).toEqual(["TAX_INVOICE"]);
  });

  it("splits exempt/out-of-scope away from the TAX INVOICE", () => {
    const plan = planDocuments({
      supplier: registered,
      supplyDate: supply,
      lines: [line("STANDARD_RATED", "18"), line("EXEMPT"), line("OUT_OF_SCOPE")],
    });
    expect(plan.documents).toHaveLength(2);
    const [tax, other] = plan.documents;
    expect(tax.documentType).toBe("TAX_INVOICE");
    expect(tax.lineIndexes).toEqual([0]);
    expect(other.documentType).not.toBe("TAX_INVOICE");
    expect(other.lineIndexes).toEqual([1, 2]);
  });

  it("registered supplier, only exempt → no TAX INVOICE at all", () => {
    const plan = planDocuments({ supplier: registered, supplyDate: supply, lines: [line("EXEMPT")] });
    expect(plan.documents.map((d) => d.documentType)).toEqual(["SALES_INVOICE"]);
  });

  it("quotations are non-fiscal", () => {
    const plan = planDocuments({ supplier: registered, supplyDate: supply, lines: [line("STANDARD_RATED", "18")], requestedType: "QUOTATION" });
    expect(plan.documents[0].documentType).toBe("QUOTATION");
  });

  it("requires TIN for VAT-registered buyers and validates format", () => {
    expect(validateBuyerForTaxInvoice({ isVatRegistered: true }).map((i) => i.code)).toEqual(["BUYER_TIN_REQUIRED"]);
    expect(validateBuyerForTaxInvoice({ tin: "123" }).map((i) => i.code)).toEqual(["BUYER_TIN_INVALID"]);
    expect(validateBuyerForTaxInvoice({ tin: "123456789", isVatRegistered: true })).toEqual([]);
    expect(validateBuyerForTaxInvoice(null)).toEqual([]);
  });

  it("customer exemption needs a valid certificate and only lowers tax", () => {
    const buyer = { exemptionTreatment: "EXEMPT" as const, exemptionCertificate: "CERT-1" };
    expect(applyCustomerExemption("STANDARD_RATED", buyer, supply).treatment).toBe("EXEMPT");
    expect(applyCustomerExemption("STANDARD_RATED", { exemptionTreatment: "EXEMPT" }, supply).overridden).toBe(false);
    expect(
      applyCustomerExemption("STANDARD_RATED", { ...buyer, exemptionValidUntil: new Date("2025-01-01") }, supply).overridden
    ).toBe(false);
    expect(applyCustomerExemption("OUT_OF_SCOPE", buyer, supply).treatment).toBe("OUT_OF_SCOPE");
  });

  it("credit / debit notes need a finalized original invoice", () => {
    expect(validateAdjustmentParent(null)[0].code).toBe("PARENT_REQUIRED");
    expect(validateAdjustmentParent({ documentType: "QUOTATION", status: "FINALIZED" })[0].code).toBe("PARENT_NOT_FISCAL");
    expect(validateAdjustmentParent({ documentType: "TAX_INVOICE", status: "DRAFT" })[0].code).toBe("PARENT_NOT_FINALIZED");
    expect(validateAdjustmentParent({ documentType: "TAX_INVOICE", status: "FINALIZED" })).toEqual([]);
  });
});

describe("rate versions", () => {
  const v = (id: string, from: string, to: string | null, rate: number) => ({
    id,
    taxRateId: "r1",
    ratePercent: rate,
    effectiveFrom: new Date(from),
    effectiveTo: to ? new Date(to) : null,
  });
  const versions = [v("a", "2020-01-01", "2024-01-01", 15), v("b", "2024-01-01", null, 18)];

  it("resolves by supply date", () => {
    expect(resolveRateVersion(versions, new Date("2023-06-01"))?.id).toBe("a");
    expect(resolveRateVersion(versions, new Date("2024-01-01"))?.id).toBe("b");
    expect(resolveRateVersion(versions, new Date("2019-01-01"))).toBeNull();
  });

  it("detects overlaps", () => {
    expect(findOverlap(versions, { id: "c", effectiveFrom: new Date("2023-01-01"), effectiveTo: null })?.id).toBeDefined();
    expect(findOverlap([versions[0]], { id: "c", effectiveFrom: new Date("2024-01-01"), effectiveTo: null })).toBeNull();
  });
});
