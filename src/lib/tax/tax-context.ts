import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  TaxCalculationService,
  type TaxLineInput,
  type TaxCalculationResult,
  type DiscountSpec,
} from "./engine";
import { getOrCreateTaxProfile, type BusinessTaxContext } from "./profile-service";
import { resolveRateVersion, type RateVersionLike } from "./rates";
import { applyCustomerExemption, effectiveTreatmentForSupplier } from "./document-types";
import { TaxError } from "./errors";
import type { TaxTreatment, TaxPricingMode } from "./constants";

export interface PrepareTaxLinesItem {
  productId?: string | null;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  discount?: DiscountSpec | null;
  /** Explicit treatment override (e.g. a delivery charge). */
  treatment?: TaxTreatment | null;
  taxRatePercent?: number | string | null;
  taxRateId?: string | null;
  taxCategoryId?: string | null;
  pricesIncludeTax?: boolean;
  meta?: Record<string, unknown>;
}

export interface PrepareTaxLinesInput {
  businessId: string;
  branchId?: string | null;
  customerId?: string | null;
  supplyDate?: Date;
  pricingMode?: TaxPricingMode;
  invoiceDiscount?: DiscountSpec | null;
  items: PrepareTaxLinesItem[];
}

type RateWithVersions = {
  id: string;
  name: string;
  rate: Prisma.Decimal;
  isActive: boolean;
  isDefault: boolean;
  versions: {
    id: string;
    taxRateId: string;
    ratePercent: Prisma.Decimal;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    isActive: boolean;
  }[];
};

interface ResolvedRate {
  ratePercent: string;
  rateRef: { taxRateId: string; taxRateVersionId: string | null; name: string };
}

/**
 * Resolves the percentage that applies on `supplyDate` from effective-dated configuration.
 * Never falls back to a hard-coded percentage: a missing configuration is an error the
 * business must fix under Settings → Tax & Invoicing → Tax Rates.
 */
export function resolveConfiguredRate(rate: RateWithVersions, supplyDate: Date, label: string): ResolvedRate {
  if (!rate.isActive) {
    throw new TaxError("TAX_RATE_INACTIVE", `Tax rate "${rate.name}" used by ${label} is inactive`);
  }
  const versions: RateVersionLike[] = rate.versions.map((v) => ({
    id: v.id,
    taxRateId: v.taxRateId,
    ratePercent: v.ratePercent.toString(),
    effectiveFrom: v.effectiveFrom,
    effectiveTo: v.effectiveTo,
    isActive: v.isActive,
  }));

  if (versions.length === 0) {
    // Legacy rate without versions: its single stored percentage applies.
    return {
      ratePercent: rate.rate.toString(),
      rateRef: { taxRateId: rate.id, taxRateVersionId: null, name: rate.name },
    };
  }
  const version = resolveRateVersion(versions, supplyDate);
  if (!version) {
    throw new TaxError(
      "NO_EFFECTIVE_RATE",
      `Tax rate "${rate.name}" has no version in effect on ${supplyDate.toISOString().slice(0, 10)} (needed for ${label}). Add an effective-dated version under Tax Rates.`
    );
  }
  return {
    ratePercent: String(version.ratePercent),
    rateRef: { taxRateId: rate.id, taxRateVersionId: version.id, name: rate.name },
  };
}

const rateInclude = {
  versions: { where: { isActive: true } },
} satisfies Prisma.TaxRateInclude;

export async function calculateTaxForSale(
  input: PrepareTaxLinesInput,
  tx?: Prisma.TransactionClient
): Promise<{
  calculation: TaxCalculationResult;
  taxContext: BusinessTaxContext;
  preparedLines: TaxLineInput[];
  customer: Awaited<ReturnType<typeof loadCustomer>>;
}> {
  const db = tx ?? prisma;
  const taxContext = await getOrCreateTaxProfile(input.businessId, db);
  const supplyDate = input.supplyDate ?? new Date();

  // Tenant-scoped customer lookup (a foreign customer id must never resolve).
  let customer: Awaited<ReturnType<typeof loadCustomer>> = null;
  if (input.customerId) {
    customer = await loadCustomer(db, input.businessId, input.customerId);
    if (!customer) throw new TaxError("CUSTOMER_NOT_FOUND", "Customer not found", 404);
  }

  const productIds = [
    ...new Set(
      input.items
        .map((i) => i.productId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds }, businessId: input.businessId },
        include: {
          taxCategory: { include: { taxRate: { include: rateInclude } } },
          taxRate: { include: rateInclude },
        },
      })
    : [];
  if (products.length !== productIds.length) {
    throw new TaxError("PRODUCT_NOT_FOUND", "One or more products were not found for this business", 404);
  }
  const productMap = new Map(products.map((p) => [p.id, p]));

  const businessRates = await db.taxRate.findMany({
    where: { businessId: input.businessId, isActive: true },
    include: rateInclude,
  });
  const rateMap = new Map(businessRates.map((r) => [r.id, r]));
  const defaultRate = businessRates.find((r) => r.isDefault) ?? null;

  const categories = await db.taxCategory.findMany({
    where: { businessId: input.businessId, isActive: true },
    include: { taxRate: { include: rateInclude } },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const profileCategory = taxContext.profile.defaultTaxCategoryId
    ? categoryMap.get(taxContext.profile.defaultTaxCategoryId) ?? null
    : categories.find((c) => c.isDefault) ?? null;

  const supplierStatus = {
    vatStatus: taxContext.profile.vatStatus,
    effectiveDate: taxContext.profile.registrationEffectiveDate,
  };

  const preparedLines: TaxLineInput[] = input.items.map((item, idx) => {
    const label = `"${item.description}"`;
    const product = item.productId ? productMap.get(item.productId) ?? null : null;
    const explicitCategory = item.taxCategoryId ? categoryMap.get(item.taxCategoryId) ?? null : null;
    const category = explicitCategory ?? product?.taxCategory ?? profileCategory;

    // 1. Treatment
    const treatment: TaxTreatment =
      item.treatment ??
      (category?.treatment as TaxTreatment | undefined) ??
      (product?.taxRate?.treatment as TaxTreatment | undefined) ??
      taxContext.profile.defaultTreatment ??
      "STANDARD_RATED";

    // 2. Rate (only meaningful for standard-rated supplies)
    let ratePercent = "0";
    let rateRef: { taxRateId?: string | null; taxRateVersionId?: string | null; name?: string | null } | null = null;

    if (treatment === "STANDARD_RATED") {
      const rateObj: RateWithVersions | null =
        (item.taxRateId ? rateMap.get(item.taxRateId) ?? null : null) ??
        category?.taxRate ??
        product?.taxRate ??
        defaultRate;

      if (rateObj) {
        const resolved = resolveConfiguredRate(rateObj, supplyDate, label);
        ratePercent = resolved.ratePercent;
        rateRef = resolved.rateRef;
      } else if (item.taxRatePercent !== undefined && item.taxRatePercent !== null) {
        ratePercent = String(item.taxRatePercent);
      } else {
        throw new TaxError(
          "NO_TAX_RATE",
          `No tax rate is configured for ${label}. Create a default rate (or assign a tax category) under Settings → Tax & Invoicing → Tax Rates.`
        );
      }
    }

    // 3. Customer-level exemption (certificate-backed only, never increases tax)
    let finalTreatment = treatment;
    let exemptionReason: string | undefined;
    if (customer) {
      const result = applyCustomerExemption(
        treatment,
        {
          exemptionTreatment: customer.taxExemptionTreatment as "EXEMPT" | "ZERO_RATED" | null,
          exemptionCertificate: customer.exemptionCertificate,
          exemptionValidUntil: customer.exemptionValidUntil,
          exemptionReason: customer.exemptionReason,
        },
        supplyDate
      );
      finalTreatment = result.treatment;
      if (result.overridden) exemptionReason = result.reason;
    }

    // 4. Supplier registration status always wins: a non-registered supplier never charges VAT.
    finalTreatment = effectiveTreatmentForSupplier(supplierStatus, supplyDate, finalTreatment);
    const charging = finalTreatment === "STANDARD_RATED";

    return {
      key: `line_${idx}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      treatment: finalTreatment,
      ratePercent: charging ? ratePercent : "0",
      rateRef: charging ? rateRef : null,
      pricesIncludeTax: item.pricesIncludeTax,
      meta: {
        ...item.meta,
        productId: item.productId ?? undefined,
        taxCategoryId: category?.id,
        taxCategoryName: category?.name,
        exemptionReason,
      },
    };
  });

  const pricingMode = input.pricingMode ?? taxContext.profile.pricingMode;

  const calculation = TaxCalculationService.calculate(preparedLines, {
    pricingMode,
    roundingLevel: taxContext.profile.roundingLevel,
    roundingMode: taxContext.profile.roundingMode,
    currencyDecimals: 2,
    invoiceDiscount: input.invoiceDiscount,
  });

  return { calculation, taxContext, preparedLines, customer };
}

async function loadCustomer(
  db: Prisma.TransactionClient | typeof prisma,
  businessId: string,
  customerId: string
) {
  return db.customer.findFirst({
    where: { id: customerId, businessId },
    select: {
      id: true,
      name: true,
      tin: true,
      vatRegistrationNumber: true,
      isVatRegistered: true,
      address: true,
      phone: true,
      creditLimit: true,
      creditBalance: true,
      taxExemptionTreatment: true,
      exemptionCertificate: true,
      exemptionValidUntil: true,
      exemptionReason: true,
    },
  });
}
