import { describe, expect, it } from "vitest";
import {
  TaxCalculationError,
  TaxCalculationService,
  scaleLineForPartial,
  summarizeLines,
  money,
  type TaxLineInput,
} from "./engine";

const std = (price: number | string, qty: number | string = 1, extra: Partial<TaxLineInput> = {}): TaxLineInput => ({
  description: "Item",
  quantity: qty,
  unitPrice: price,
  treatment: "STANDARD_RATED",
  ratePercent: 18,
  ...extra,
});

describe("TaxCalculationService – pricing modes", () => {
  it("extracts tax from tax-inclusive prices", () => {
    const r = TaxCalculationService.calculate([std(1180)], { pricingMode: "TAX_INCLUSIVE" });
    expect(r.lines[0].taxAmount).toBe("180.00");
    expect(r.lines[0].taxableValue).toBe("1000.00");
    expect(r.totals.grandTotal).toBe("1180.00");
  });

  it("adds tax to tax-exclusive prices", () => {
    const r = TaxCalculationService.calculate([std(1000)], { pricingMode: "TAX_EXCLUSIVE" });
    expect(r.lines[0].taxAmount).toBe("180.00");
    expect(r.totals.netValue).toBe("1000.00");
    expect(r.totals.grandTotal).toBe("1180.00");
  });

  it("supports a per-line pricing override", () => {
    const r = TaxCalculationService.calculate(
      [std(1180, 1, { pricesIncludeTax: true }), std(1000)],
      { pricingMode: "TAX_EXCLUSIVE" }
    );
    expect(r.lines[0].taxAmount).toBe("180.00");
    expect(r.lines[1].taxAmount).toBe("180.00");
    expect(r.totals.grandTotal).toBe("2360.00");
  });

  it("does not hard-code any rate (uses the supplied percentage)", () => {
    const r = TaxCalculationService.calculate([std(1000, 1, { ratePercent: 15 })], { pricingMode: "TAX_EXCLUSIVE" });
    expect(r.lines[0].taxAmount).toBe("150.00");
    const r2 = TaxCalculationService.calculate([std(1000, 1, { ratePercent: "20.5" })], { pricingMode: "TAX_EXCLUSIVE" });
    expect(r2.lines[0].taxAmount).toBe("205.00");
  });
});

describe("TaxCalculationService – treatments", () => {
  it("handles zero-rated, exempt and out-of-scope supplies with no tax", () => {
    const r = TaxCalculationService.calculate(
      [
        std(1000),
        { description: "Export", quantity: 1, unitPrice: 500, treatment: "ZERO_RATED" },
        { description: "Exempt", quantity: 2, unitPrice: 250, treatment: "EXEMPT" },
        { description: "OOS", quantity: 1, unitPrice: 100, treatment: "OUT_OF_SCOPE" },
      ],
      { pricingMode: "TAX_EXCLUSIVE" }
    );
    expect(r.totals.standardRatedValue).toBe("1000.00");
    expect(r.totals.zeroRatedValue).toBe("500.00");
    expect(r.totals.exemptValue).toBe("500.00");
    expect(r.totals.outOfScopeValue).toBe("100.00");
    expect(r.totals.vatableValue).toBe("1500.00");
    expect(r.totals.taxTotal).toBe("180.00");
    expect(r.totals.grandTotal).toBe("2280.00");
    expect(r.breakdown.map((b) => b.treatment)).toEqual(["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"]);
  });

  it("requires a rate for standard-rated supplies", () => {
    expect(() =>
      TaxCalculationService.calculate(
        [{ description: "x", quantity: 1, unitPrice: 10, treatment: "STANDARD_RATED" }],
        { pricingMode: "TAX_EXCLUSIVE" }
      )
    ).toThrowError(TaxCalculationError);
  });

  it("ignores a stray rate on non-standard supplies", () => {
    const r = TaxCalculationService.calculate(
      [{ description: "x", quantity: 1, unitPrice: 100, treatment: "EXEMPT", ratePercent: 18 }],
      { pricingMode: "TAX_EXCLUSIVE" }
    );
    expect(r.totals.taxTotal).toBe("0.00");
  });

  it("groups several rates into separate breakdown rows", () => {
    const r = TaxCalculationService.calculate(
      [std(1000, 1, { ratePercent: 18 }), std(1000, 1, { ratePercent: 8 }), std(500, 1, { ratePercent: 18 })],
      { pricingMode: "TAX_EXCLUSIVE" }
    );
    const std18 = r.breakdown.find((b) => b.ratePercent === "18")!;
    const std8 = r.breakdown.find((b) => b.ratePercent === "8")!;
    expect(std18.taxableValue).toBe("1500.00");
    expect(std18.taxAmount).toBe("270.00");
    expect(std8.taxAmount).toBe("80.00");
  });
});

describe("TaxCalculationService – discounts (applied before tax)", () => {
  it("applies a line percentage discount before tax", () => {
    const r = TaxCalculationService.calculate([std(1000, 1, { discount: { type: "PERCENTAGE", value: 10 } })], {
      pricingMode: "TAX_EXCLUSIVE",
    });
    expect(r.lines[0].taxableValue).toBe("900.00");
    expect(r.lines[0].taxAmount).toBe("162.00");
    expect(r.totals.grandTotal).toBe("1062.00");
  });

  it("applies a fixed line discount to tax-inclusive prices", () => {
    const r = TaxCalculationService.calculate([std(1180, 1, { discount: { type: "FIXED", value: 118 } })], {
      pricingMode: "TAX_INCLUSIVE",
    });
    expect(r.lines[0].netEntered).toBe("1062.00");
    expect(r.lines[0].taxAmount).toBe("162.00");
    expect(r.lines[0].taxableValue).toBe("900.00");
  });

  it("caps fixed discounts at the line value", () => {
    const r = TaxCalculationService.calculate([std(100, 1, { discount: { type: "FIXED", value: 5000 } })], {
      pricingMode: "TAX_EXCLUSIVE",
    });
    expect(r.totals.grandTotal).toBe("0.00");
  });

  it("allocates an invoice discount exactly across lines", () => {
    const r = TaxCalculationService.calculate([std(100), std(100), std(100)], {
      pricingMode: "TAX_EXCLUSIVE",
      invoiceDiscount: { type: "FIXED", value: "10" },
    });
    const alloc = r.lines.reduce((a, l) => a + Number(l.allocatedInvoiceDiscount), 0);
    expect(alloc.toFixed(2)).toBe("10.00");
    expect(r.totals.discountTotal).toBe("10.00");
    expect(r.totals.netValue).toBe("290.00");
    expect(TaxCalculationService.verify(r)).toEqual([]);
  });

  it("rejects discount percentages over 100", () => {
    expect(() =>
      TaxCalculationService.calculate([std(100, 1, { discount: { type: "PERCENTAGE", value: 101 } })], {
        pricingMode: "TAX_EXCLUSIVE",
      })
    ).toThrowError(/exceed 100/);
  });
});

describe("TaxCalculationService – rounding & reconciliation", () => {
  it("line-level rounding rounds each line", () => {
    const lines = [std("0.05"), std("0.05"), std("0.05")];
    const r = TaxCalculationService.calculate(lines, { pricingMode: "TAX_EXCLUSIVE", roundingLevel: "LINE" });
    // 0.05 × 18% = 0.009 → 0.01 per line
    expect(r.totals.taxTotal).toBe("0.03");
  });

  it("invoice-level rounding rounds once and still reconciles to lines", () => {
    const lines = [std("0.05"), std("0.05"), std("0.05")];
    const r = TaxCalculationService.calculate(lines, { pricingMode: "TAX_EXCLUSIVE", roundingLevel: "INVOICE" });
    // 0.027 → 0.03 in total
    expect(r.totals.taxTotal).toBe("0.03");
    expect(r.lines.reduce((a, l) => a + Number(l.taxAmount), 0).toFixed(2)).toBe("0.03");
    expect(TaxCalculationService.verify(r)).toEqual([]);
  });

  it("rounds half-up deterministically", () => {
    const r = TaxCalculationService.calculate([std("0.25", 1, { ratePercent: 10 })], { pricingMode: "TAX_EXCLUSIVE" });
    // 0.025 → 0.03
    expect(r.lines[0].taxAmount).toBe("0.03");
  });

  it("always reconciles across thousands of randomised documents", () => {
    let seed = 123456789;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const treatments = ["STANDARD_RATED", "ZERO_RATED", "EXEMPT", "OUT_OF_SCOPE"] as const;
    const rates = [18, 8, 15, 20.5, 2.5];
    for (let n = 0; n < 1500; n++) {
      const lineCount = 1 + Math.floor(rnd() * 8);
      const lines: TaxLineInput[] = Array.from({ length: lineCount }, () => {
        const treatment = treatments[Math.floor(rnd() * 4)];
        return {
          description: "x",
          quantity: (1 + Math.floor(rnd() * 20)) / (rnd() > 0.7 ? 4 : 1),
          unitPrice: (rnd() * 5000).toFixed(2),
          treatment,
          ratePercent: rates[Math.floor(rnd() * rates.length)],
          discount: rnd() > 0.6 ? { type: rnd() > 0.5 ? "PERCENTAGE" : "FIXED", value: (rnd() * 20).toFixed(2) } : null,
        } as TaxLineInput;
      });
      for (const pricingMode of ["TAX_INCLUSIVE", "TAX_EXCLUSIVE"] as const) {
        for (const roundingLevel of ["LINE", "INVOICE"] as const) {
          const r = TaxCalculationService.calculate(lines, {
            pricingMode,
            roundingLevel,
            invoiceDiscount: rnd() > 0.6 ? { type: "PERCENTAGE", value: (rnd() * 15).toFixed(2) } : null,
          });
          expect(TaxCalculationService.verify(r)).toEqual([]);
          if (pricingMode === "TAX_INCLUSIVE") {
            for (const l of r.lines) expect(l.lineTotal).toBe(l.netEntered);
          }
        }
      }
    }
  });

  it("detects tampering with a stored result", () => {
    const r = TaxCalculationService.calculate([std(1000)], { pricingMode: "TAX_EXCLUSIVE" });
    const tampered = { ...r, totals: { ...r.totals, taxTotal: "1.00" } };
    expect(TaxCalculationService.verify(tampered).length).toBeGreaterThan(0);
  });
});

describe("TaxCalculationService – validation", () => {
  it("rejects negative and non-numeric input", () => {
    expect(() => TaxCalculationService.calculate([std(-1)], { pricingMode: "TAX_EXCLUSIVE" })).toThrowError(/negative/);
    expect(() => TaxCalculationService.calculate([std("abc")], { pricingMode: "TAX_EXCLUSIVE" })).toThrowError(
      TaxCalculationError
    );
    expect(() =>
      TaxCalculationService.calculate([std(1, 1, { ratePercent: 500 })], { pricingMode: "TAX_EXCLUSIVE" })
    ).toThrowError(/cannot exceed/);
  });

  it("rejects an unknown treatment", () => {
    expect(() =>
      TaxCalculationService.calculate([{ ...std(1), treatment: "MAGIC" as never }], { pricingMode: "TAX_EXCLUSIVE" })
    ).toThrowError(/unknown tax treatment/);
  });

  it("returns an empty, zeroed result for no lines", () => {
    const r = TaxCalculationService.calculate([], { pricingMode: "TAX_EXCLUSIVE" });
    expect(r.totals.grandTotal).toBe("0.00");
  });
});

describe("scaleLineForPartial", () => {
  const original = TaxCalculationService.calculate([std(1180, 3)], { pricingMode: "TAX_INCLUSIVE" }).lines[0];

  it("returns the exact original for a full return", () => {
    const s = scaleLineForPartial(original, 3);
    expect(s.taxAmount).toBe(original.taxAmount);
    expect(s.lineTotal).toBe(original.lineTotal);
  });

  it("scales proportionally for partial returns using the historical figures", () => {
    const s = scaleLineForPartial(original, 1);
    expect(s.lineTotal).toBe("1180.00");
    expect(s.taxAmount).toBe("180.00");
    expect(s.taxableValue).toBe("1000.00");
  });

  it("refuses to return more than was sold", () => {
    expect(() => scaleLineForPartial(original, 4)).toThrowError(/exceeds/);
  });
});

describe("helpers", () => {
  it("summarizeLines reproduces totals", () => {
    const r = TaxCalculationService.calculate([std(1000), std(500, 1, { treatment: "EXEMPT" })], {
      pricingMode: "TAX_EXCLUSIVE",
    });
    const s = summarizeLines(r.lines);
    expect(s.totals).toEqual(r.totals);
  });

  it("money helpers are exact", () => {
    expect(money.add("0.1", "0.2")).toBe("0.30");
    expect(money.sub("1.00", "0.99")).toBe("0.01");
    expect(money.sum(["0.1", "0.2", "0.3"])).toBe("0.60");
  });

  it("extractTax / addTax", () => {
    expect(TaxCalculationService.extractTax(1180, 18).tax).toBe("180.00");
    expect(TaxCalculationService.addTax(1000, 18).total).toBe("1180.00");
  });
});
