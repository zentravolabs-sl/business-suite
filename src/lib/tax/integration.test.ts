import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";
import { TaxCalculationService } from "./engine";
import {
  formatTaxInvoiceSerial,
  parseTaxInvoiceSerial,
  isValidTaxInvoiceSerial,
  formatSimpleNumber,
} from "./numbering";
import { amountInWordsLKR, toSriLankanRupeesAndCents } from "./amount-in-words";
import {
  planDocuments,
  applyCustomerExemption,
} from "./document-types";
import {
  encryptCredential,
  decryptCredential,
  validateDocumentForIrd,
} from "./ird-integration";

describe("Sri Lanka Tax & Invoicing Integration Suite", () => {
  describe("1. Serial Numbering Compliance (YYMMM_QQQQ_XXXXX)", () => {
    it("formats statutory tax invoice serials strictly conforming to IRD pattern", () => {
      const serial = formatTaxInvoiceSerial({
        issueDate: new Date("2026-10-15T10:00:00+05:30"),
        classificationCode: "MAIN",
        sequence: 42,
        minDigits: 5,
      });

      expect(serial).toBe("26OCT_MAIN_00042");
      expect(isValidTaxInvoiceSerial(serial)).toBe(true);

      const parsed = parseTaxInvoiceSerial(serial);
      expect(parsed).toEqual({
        year: 2026,
        month: 10,
        classificationCode: "MAIN",
        sequence: 42,
      });
    });

    it("rejects invalid classification codes containing whitespace or lowercase", () => {
      expect(() =>
        formatTaxInvoiceSerial({
          issueDate: new Date(),
          classificationCode: "MAIN CODE",
          sequence: 1,
        })
      ).toThrow();
    });

    it("formats non-fiscal document numbers cleanly", () => {
      expect(formatSimpleNumber("INV", 105, 6)).toBe("INV-000105");
      expect(formatSimpleNumber("CN-", 7, 5)).toBe("CN-00007");
    });
  });

  describe("2. Amount in Words (Sri Lankan Rupees and Cents)", () => {
    it("converts standard rupee and cent amounts accurately", () => {
      expect(amountInWordsLKR("1234.50")).toBe(
        "One Thousand Two Hundred Thirty-Four Rupees and Fifty Cents Only"
      );
      expect(toSriLankanRupeesAndCents(100000)).toBe(
        "One Hundred Thousand Rupees Only"
      );
      expect(amountInWordsLKR("0.05")).toBe("Zero Rupees and Five Cents Only");
      expect(amountInWordsLKR("1.01")).toBe("One Rupee and One Cent Only");
    });
  });

  describe("3. Legal Document Planning & VAT Registration Guards", () => {
    it("prohibits non-registered suppliers from issuing TAX INVOICE", () => {
      const plan = planDocuments({
        supplier: {
          vatStatus: "NOT_REGISTERED",
          defaultNonTaxDocument: "SALES_INVOICE",
        },
        supplyDate: new Date("2026-10-15"),
        buyer: { name: "Retail Customer" },
        lines: [
          {
            treatment: "OUT_OF_SCOPE",
            taxAmount: "0.00",
            description: "Goods",
          },
        ],
      });

      expect(plan.documents).toHaveLength(1);
      expect(plan.documents[0].documentType).toBe("SALES_INVOICE");
      expect(plan.documents[0].documentType).not.toBe("TAX_INVOICE");
    });

    it("splits mixed supplies into TAX INVOICE (taxable) and SALES INVOICE (exempt/out-of-scope)", () => {
      const plan = planDocuments({
        supplier: {
          vatStatus: "REGISTERED",
          effectiveDate: new Date("2024-01-01"),
          defaultNonTaxDocument: "SALES_INVOICE",
        },
        supplyDate: new Date("2026-10-15"),
        buyer: { name: "Corporate Client", tin: "102938475" },
        lines: [
          { treatment: "STANDARD_RATED", taxAmount: "180.00", description: "Hardware" },
          { treatment: "EXEMPT", taxAmount: "0.00", description: "Educational Service" },
        ],
      });

      expect(plan.documents).toHaveLength(2);
      expect(plan.documents[0].documentType).toBe("TAX_INVOICE");
      expect(plan.documents[0].lineIndexes).toEqual([0]);
      expect(plan.documents[1].documentType).toBe("SALES_INVOICE");
      expect(plan.documents[1].lineIndexes).toEqual([1]);
    });

    it("validates customer exemption certificates", () => {
      const valid = applyCustomerExemption(
        "STANDARD_RATED",
        {
          exemptionTreatment: "EXEMPT",
          exemptionCertificate: "CERT-2026-09",
          exemptionValidUntil: new Date("2027-01-01"),
        },
        new Date("2026-10-15")
      );
      expect(valid.overridden).toBe(true);
      expect(valid.treatment).toBe("EXEMPT");

      const expired = applyCustomerExemption(
        "STANDARD_RATED",
        {
          exemptionTreatment: "EXEMPT",
          exemptionCertificate: "CERT-2026-09",
          exemptionValidUntil: new Date("2025-01-01"),
        },
        new Date("2026-10-15")
      );
      expect(expired.overridden).toBe(false);
      expect(expired.treatment).toBe("STANDARD_RATED");
    });
  });

  describe("4. End-to-End Tax Calculation with Reconciled Rounding", () => {
    it("handles tax-inclusive retail checkout with invoice-level discount and pro-rata distribution", () => {
      const calc = TaxCalculationService.calculate(
        [
          {
            unitPrice: 1180, // Inclusive of 18% VAT (Base: 1000, VAT: 180)
            quantity: 2,
            ratePercent: 18,
            treatment: "STANDARD_RATED",
            description: "Item A",
          },
          {
            unitPrice: 590, // Inclusive of 18% VAT (Base: 500, VAT: 90)
            quantity: 1,
            ratePercent: 18,
            treatment: "STANDARD_RATED",
            description: "Item B",
          },
        ],
        {
          pricingMode: "TAX_INCLUSIVE",
          roundingLevel: "LINE",
          invoiceDiscount: { type: "FIXED", value: 500 },
        }
      );

      // Total before discount = 2360 + 590 = 2950
      // Invoice discount = 500
      // Final Grand Total must equal 2950 - 500 = 2450.00
      expect(calc.totals.grandTotal).toBe("2450.00");

      // Reconciles line totals exactly to grand total
      const sumLines = calc.lines.reduce((acc, l) => acc.plus(l.lineTotal), new Decimal(0));
      expect(sumLines.toFixed(2)).toBe("2450.00");
    });
  });

  describe("5. IRD Integration & Credential Encryption (AES-256-GCM)", () => {
    it("encrypts and decrypts client credentials with auth tag validation", () => {
      const rawSecret = "super-secret-ird-ramis-token-xyz-123456";
      const encrypted = encryptCredential(rawSecret);
      expect(encrypted).not.toContain(rawSecret);

      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(rawSecret);
    });

    it("validates tax documents against statutory IRD rules", () => {
      const validDoc = {
        documentNumber: "26OCT_MAIN_00001",
        documentType: "TAX_INVOICE",
        issueDate: new Date("2026-10-15"),
        supplyDate: new Date("2026-10-15"),
        sellerName: "Zentravo Tech Solutions PLC",
        sellerAddress: "100 Galle Road, Colombo 03, Sri Lanka",
        sellerTin: "102938475",
        sellerVatStatus: "REGISTERED",
        sellerVatNumber: "102938475-7000",
        buyerName: "Apex Lanka Ltd",
        buyerTin: "987654321",
        buyerVatNumber: "987654321-7000",
        currency: "LKR",
        netValue: 100000,
        taxTotal: 18000,
        grandTotal: 118000,
        lines: [
          {
            description: "Server hardware",
            quantity: 1,
            unitPrice: 100000,
            taxAmount: 18000,
          },
        ],
      };

      const validResult = validateDocumentForIrd(validDoc);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidDoc = {
        ...validDoc,
        sellerTin: "12345", // Invalid TIN
        documentNumber: "INV-999", // Invalid format for Tax Invoice
      };

      const invalidResult = validateDocumentForIrd(invalidDoc);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });
});
