import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTax, clientIp } from "@/lib/tax/access";
import { getOrCreateTaxProfile } from "@/lib/tax/profile-service";
import { toErrorResponse, TaxError } from "@/lib/tax/errors";
import {
  TIN_PATTERN,
  CLASSIFICATION_CODE_PATTERN,
  VAT_REGISTRATION_STATUSES,
  TAX_PRICING_MODES,
  ROUNDING_LEVELS,
  SEQUENCE_RESET_PERIODS,
  INPUT_VAT_ELIGIBILITY,
  TAX_PERMISSIONS,
  type VatRegistrationStatus,
  type TaxPricingMode,
  type RoundingLevel,
  type SequenceResetPeriod,
  type InputVatEligibility,
} from "@/lib/tax/constants";

export async function GET() {
  try {
    const auth = await authorizeTax({
      anyOf: [TAX_PERMISSIONS.VIEW, TAX_PERMISSIONS.EDIT_SETTINGS],
    });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const context = await getOrCreateTaxProfile(tenant.businessId);
    return NextResponse.json(context);
  } catch (error) {
    console.error("GET tax profile error:", error);
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await authorizeTax({
      anyOf: [TAX_PERMISSIONS.EDIT_SETTINGS],
    });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const body = await req.json();

    // 1. Validate Enums
    const vatStatus = body.vatStatus || "NOT_REGISTERED";
    if (!VAT_REGISTRATION_STATUSES.includes(vatStatus as VatRegistrationStatus)) {
      throw new TaxError(
        "INVALID_VAT_STATUS",
        `Invalid VAT status: "${vatStatus}". Expected one of: ${VAT_REGISTRATION_STATUSES.join(", ")}`
      );
    }

    const pricingMode = body.pricingMode || "TAX_INCLUSIVE";
    if (!TAX_PRICING_MODES.includes(pricingMode as TaxPricingMode)) {
      throw new TaxError(
        "INVALID_PRICING_MODE",
        `Invalid pricing mode: "${pricingMode}". Expected one of: ${TAX_PRICING_MODES.join(", ")}`
      );
    }

    const roundingLevel = body.roundingLevel || "LINE";
    if (!ROUNDING_LEVELS.includes(roundingLevel as RoundingLevel)) {
      throw new TaxError(
        "INVALID_ROUNDING_LEVEL",
        `Invalid rounding level: "${roundingLevel}". Expected one of: ${ROUNDING_LEVELS.join(", ")}`
      );
    }

    const serialResetPeriod = body.serialResetPeriod || "NEVER";
    if (!SEQUENCE_RESET_PERIODS.includes(serialResetPeriod as SequenceResetPeriod)) {
      throw new TaxError(
        "INVALID_RESET_PERIOD",
        `Invalid serial reset period: "${serialResetPeriod}". Expected one of: ${SEQUENCE_RESET_PERIODS.join(", ")}`
      );
    }

    const inputVatDefaultEligibility = body.inputVatDefaultEligibility || "UNDER_REVIEW";
    if (!INPUT_VAT_ELIGIBILITY.includes(inputVatDefaultEligibility as InputVatEligibility)) {
      throw new TaxError(
        "INVALID_INPUT_VAT_ELIGIBILITY",
        `Invalid Input VAT default eligibility: "${inputVatDefaultEligibility}". Expected one of: ${INPUT_VAT_ELIGIBILITY.join(", ")}`
      );
    }

    // 2. Validate TIN
    const tin = body.tin ? body.tin.trim() : null;
    if (tin && !TIN_PATTERN.test(tin)) {
      throw new TaxError(
        "INVALID_TIN",
        "TIN must be exactly 9 digits as per Sri Lanka Inland Revenue Department requirements"
      );
    }

    // 3. Mandatory fields for VAT-registered businesses
    if (vatStatus === "REGISTERED") {
      if (!tin) {
        throw new TaxError(
          "TIN_REQUIRED_FOR_VAT",
          "Taxpayer Identification Number (TIN) is legally mandatory for VAT-registered persons"
        );
      }
      if (!body.vatRegistrationNumber || !body.vatRegistrationNumber.trim()) {
        throw new TaxError(
          "VAT_NUMBER_REQUIRED",
          "VAT Registration Number is mandatory when status is REGISTERED"
        );
      }
      if (!body.registrationEffectiveDate) {
        throw new TaxError(
          "EFFECTIVE_DATE_REQUIRED",
          "Tax registration effective date is mandatory for VAT-registered persons"
        );
      }
    }

    // 4. Validate Classification Code
    const code = (body.classificationCode || "MAIN").trim().toUpperCase();
    if (!CLASSIFICATION_CODE_PATTERN.test(code)) {
      throw new TaxError(
        "INVALID_CLASSIFICATION_CODE",
        "Tax invoice classification code must be 1 to 15 alphanumeric characters without spaces"
      );
    }

    // 5. Load existing profile
    const existing = await prisma.businessTaxProfile.findUnique({
      where: { businessId: tenant.businessId },
    });

    // Guard: transition from REGISTERED -> NOT_REGISTERED requires confirmation note
    if (existing?.vatStatus === "REGISTERED" && vatStatus === "NOT_REGISTERED") {
      if (!body.deregistrationReason?.trim()) {
        throw new TaxError(
          "DEREGISTRATION_REASON_REQUIRED",
          "A formal deregistration reason is required to switch status from VAT-registered to non-registered"
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.businessTaxProfile.upsert({
        where: { businessId: tenant.businessId },
        update: {
          legalName: body.legalName,
          registeredAddress: body.registeredAddress,
          registeredPhone: body.registeredPhone,
          tin,
          vatStatus: vatStatus as VatRegistrationStatus,
          vatRegistrationNumber: body.vatRegistrationNumber ? body.vatRegistrationNumber.trim() : null,
          vatRegistrationDetails: body.vatRegistrationDetails || null,
          registrationEffectiveDate: body.registrationEffectiveDate
            ? new Date(body.registrationEffectiveDate)
            : null,
          classificationCode: code,
          pricingMode: pricingMode as TaxPricingMode,
          roundingLevel: roundingLevel as RoundingLevel,
          roundingMode: body.roundingMode || "HALF_UP",
          defaultTaxCategoryId: body.defaultTaxCategoryId || null,
          defaultTreatment: body.defaultTreatment || "STANDARD_RATED",
          defaultNonTaxDocument: body.defaultNonTaxDocument || "SALES_INVOICE",
          showAmountInWords: body.showAmountInWords ?? true,
          showPaymentMethod: body.showPaymentMethod ?? true,
          showLogo: body.showLogo ?? true,
          showUnitOfMeasure: body.showUnitOfMeasure ?? true,
          invoiceNotes: body.invoiceNotes || null,
          paymentTerms: body.paymentTerms || null,
          receiptFooter: body.receiptFooter || null,
          autoPrintReceipt: body.autoPrintReceipt ?? false,
          serialResetPeriod: serialResetPeriod as SequenceResetPeriod,
          serialMinDigits: body.serialMinDigits ? Number(body.serialMinDigits) : 5,
          inputVatDefaultEligibility: inputVatDefaultEligibility as InputVatEligibility,
          updatedById: tenant.userId,
        },
        create: {
          businessId: tenant.businessId,
          legalName: body.legalName,
          registeredAddress: body.registeredAddress,
          registeredPhone: body.registeredPhone,
          tin,
          vatStatus: vatStatus as VatRegistrationStatus,
          vatRegistrationNumber: body.vatRegistrationNumber ? body.vatRegistrationNumber.trim() : null,
          vatRegistrationDetails: body.vatRegistrationDetails || null,
          registrationEffectiveDate: body.registrationEffectiveDate
            ? new Date(body.registrationEffectiveDate)
            : null,
          classificationCode: code,
          defaultCurrency: "LKR",
          pricingMode: pricingMode as TaxPricingMode,
          roundingLevel: roundingLevel as RoundingLevel,
          roundingMode: body.roundingMode || "HALF_UP",
          defaultTaxCategoryId: body.defaultTaxCategoryId || null,
          defaultTreatment: body.defaultTreatment || "STANDARD_RATED",
          defaultNonTaxDocument: body.defaultNonTaxDocument || "SALES_INVOICE",
          showAmountInWords: body.showAmountInWords ?? true,
          showPaymentMethod: body.showPaymentMethod ?? true,
          showLogo: body.showLogo ?? true,
          showUnitOfMeasure: body.showUnitOfMeasure ?? true,
          invoiceNotes: body.invoiceNotes || null,
          paymentTerms: body.paymentTerms || null,
          receiptFooter: body.receiptFooter || null,
          autoPrintReceipt: body.autoPrintReceipt ?? false,
          serialResetPeriod: serialResetPeriod as SequenceResetPeriod,
          serialMinDigits: body.serialMinDigits ? Number(body.serialMinDigits) : 5,
          inputVatDefaultEligibility: inputVatDefaultEligibility as InputVatEligibility,
          updatedById: tenant.userId,
        },
      });

      // Mirror key fields to Business table for backwards compatibility
      await tx.business.update({
        where: { id: tenant.businessId },
        data: {
          legalName: body.legalName,
          address: body.registeredAddress,
          phone: body.registeredPhone,
          taxNumber: tin,
          vatNumber: body.vatRegistrationNumber ? body.vatRegistrationNumber.trim() : null,
          taxInclusive: pricingMode === "TAX_INCLUSIVE",
        },
      });

      // Record AuditLog
      await tx.auditLog.create({
        data: {
          businessId: tenant.businessId,
          userId: tenant.userId,
          action: "SETTINGS_CHANGE",
          entity: "BusinessTaxProfile",
          entityId: up.id,
          oldValue: existing ? { ...existing } : undefined,
          newValue: { ...up },
          metadata: {
            section: "tax_profile",
            ip: clientIp(req),
            deregistrationReason: body.deregistrationReason || null,
          },
        },
      });

      return up;
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (error) {
    console.error("PUT tax profile error:", error);
    return toErrorResponse(error);
  }
}
