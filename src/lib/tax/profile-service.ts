import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type {
  TaxPricingMode,
  TaxTreatment,
  VatRegistrationStatus,
  TaxDocumentType,
  SequenceResetPeriod,
  InputVatEligibility,
} from "./constants";

export interface BusinessTaxContext {
  profile: {
    id?: string;
    businessId: string;
    legalName: string;
    registeredAddress: string;
    registeredPhone: string;
    tin: string;
    vatStatus: VatRegistrationStatus;
    vatRegistrationNumber: string;
    vatRegistrationDetails: string;
    registrationEffectiveDate: Date | null;
    classificationCode: string;
    defaultCurrency: string;
    pricingMode: TaxPricingMode;
    roundingLevel: "LINE" | "INVOICE";
    roundingMode: "HALF_UP" | "HALF_EVEN" | "UP" | "DOWN";
    defaultTaxCategoryId: string | null;
    defaultTreatment: TaxTreatment;
    defaultNonTaxDocument: TaxDocumentType;
    showAmountInWords: boolean;
    showPaymentMethod: boolean;
    showLogo: boolean;
    showUnitOfMeasure: boolean;
    invoiceNotes: string;
    paymentTerms: string;
    receiptFooter: string;
    autoPrintReceipt: boolean;
    serialResetPeriod: SequenceResetPeriod;
    serialMinDigits: number;
    inputVatDefaultEligibility: InputVatEligibility;
  };
  business: {
    id: string;
    name: string;
    legalName: string | null;
    address: string | null;
    phone: string | null;
    vatNumber: string | null;
    taxNumber: string | null;
    logo: string | null;
    taxInclusive: boolean;
    taxInvoicingEnabled: boolean;
  };
}

/**
 * Loads the business tax profile, seamlessly bootstrapping from the legacy Business model if not present.
 */
export async function getOrCreateTaxProfile(
  businessId: string,
  tx?: Prisma.TransactionClient
): Promise<BusinessTaxContext> {
  const db = tx ?? prisma;

  let profile = await db.businessTaxProfile.findUnique({
    where: { businessId },
  });

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      legalName: true,
      address: true,
      phone: true,
      vatNumber: true,
      taxNumber: true,
      logo: true,
      taxInclusive: true,
      taxInvoicingEnabled: true,
    },
  });

  if (!business) {
    throw new Error(`Business not found: ${businessId}`);
  }

  if (!profile) {
    const isVat = !!(business.vatNumber && business.vatNumber.trim().length > 0);
    profile = await db.businessTaxProfile.create({
      data: {
        businessId,
        legalName: business.legalName || business.name,
        registeredAddress: business.address || "",
        registeredPhone: business.phone || "",
        tin: business.taxNumber || "",
        vatStatus: isVat ? "REGISTERED" : "NOT_REGISTERED",
        vatRegistrationNumber: business.vatNumber || "",
        classificationCode: "MAIN",
        defaultCurrency: "LKR",
        pricingMode: business.taxInclusive ? "TAX_INCLUSIVE" : "TAX_EXCLUSIVE",
        roundingLevel: "LINE",
        roundingMode: "HALF_UP",
        defaultTreatment: isVat ? "STANDARD_RATED" : "OUT_OF_SCOPE",
        defaultNonTaxDocument: "SALES_INVOICE",
        showAmountInWords: true,
        showPaymentMethod: true,
        showLogo: true,
        showUnitOfMeasure: true,
        serialResetPeriod: "NEVER",
        serialMinDigits: 5,
        inputVatDefaultEligibility: "UNDER_REVIEW",
      },
    });

    // Also ensure default numbering rules exist
    await ensureDefaultNumberingRules(businessId, db);
  }

  return {
    profile: {
      id: profile.id,
      businessId: profile.businessId,
      legalName: profile.legalName || business.legalName || business.name,
      registeredAddress: profile.registeredAddress || business.address || "",
      registeredPhone: profile.registeredPhone || business.phone || "",
      tin: profile.tin || business.taxNumber || "",
      vatStatus: profile.vatStatus as VatRegistrationStatus,
      vatRegistrationNumber: profile.vatRegistrationNumber || business.vatNumber || "",
      vatRegistrationDetails: profile.vatRegistrationDetails || "",
      registrationEffectiveDate: profile.registrationEffectiveDate,
      classificationCode: profile.classificationCode || "MAIN",
      defaultCurrency: profile.defaultCurrency || "LKR",
      pricingMode: profile.pricingMode as TaxPricingMode,
      roundingLevel: profile.roundingLevel as "LINE" | "INVOICE",
      roundingMode: (profile.roundingMode as "HALF_UP" | "HALF_EVEN" | "UP" | "DOWN") || "HALF_UP",
      defaultTaxCategoryId: profile.defaultTaxCategoryId,
      defaultTreatment: profile.defaultTreatment as TaxTreatment,
      defaultNonTaxDocument: profile.defaultNonTaxDocument as TaxDocumentType,
      showAmountInWords: profile.showAmountInWords,
      showPaymentMethod: profile.showPaymentMethod,
      showLogo: profile.showLogo,
      showUnitOfMeasure: profile.showUnitOfMeasure,
      invoiceNotes: profile.invoiceNotes || "",
      paymentTerms: profile.paymentTerms || "",
      receiptFooter: profile.receiptFooter || "",
      autoPrintReceipt: profile.autoPrintReceipt,
      serialResetPeriod: profile.serialResetPeriod as SequenceResetPeriod,
      serialMinDigits: profile.serialMinDigits || 5,
      inputVatDefaultEligibility: profile.inputVatDefaultEligibility as InputVatEligibility,
    },
    business,
  };
}

export async function ensureDefaultNumberingRules(
  businessId: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  const defaults = [
    { documentType: "CREDIT_NOTE", prefix: "CN", minDigits: 6 },
    { documentType: "DEBIT_NOTE", prefix: "DN", minDigits: 6 },
    { documentType: "SALES_INVOICE", prefix: "INV", minDigits: 6 },
    { documentType: "COMMERCIAL_INVOICE", prefix: "CI", minDigits: 6 },
    { documentType: "RECEIPT", prefix: "RCP", minDigits: 6 },
    { documentType: "QUOTATION", prefix: "QT", minDigits: 6 },
    { documentType: "PROFORMA_INVOICE", prefix: "PI", minDigits: 6 },
  ] as const;

  for (const item of defaults) {
    await db.numberingRule.upsert({
      where: {
        businessId_documentType: {
          businessId,
          documentType: item.documentType as TaxDocumentType,
        },
      },
      update: {},
      create: {
        businessId,
        documentType: item.documentType as TaxDocumentType,
        prefix: item.prefix,
        minDigits: item.minDigits,
        resetPeriod: "NEVER",
      },
    });
  }
}
