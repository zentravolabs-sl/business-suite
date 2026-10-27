import { NextResponse } from "next/server";
import { authorizeTax } from "@/lib/tax/access";
import { prisma } from "@/lib/db";
import { validateDocumentForIrd } from "@/lib/tax/ird-integration";
import { toErrorResponse } from "@/lib/tax/errors";
import { TAX_PERMISSIONS } from "@/lib/tax/constants";

export async function POST() {
  try {
    const auth = await authorizeTax({
      anyOf: [TAX_PERMISSIONS.VIEW, TAX_PERMISSIONS.EDIT_SETTINGS, TAX_PERMISSIONS.MANAGE_INTEGRATION],
    });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const profile = await prisma.businessTaxProfile.findUnique({
      where: { businessId: tenant.businessId },
    });

    if (!profile) {
      return NextResponse.json({
        isValid: false,
        errors: ["Tax profile is not configured yet."],
        warnings: [],
      });
    }

    const isRegistered = profile.vatStatus === "REGISTERED";
    const testDocType = isRegistered ? "TAX_INVOICE" : (profile.defaultNonTaxDocument || "SALES_INVOICE");
    const testDocNumber = isRegistered ? "26OCT_MAIN_00001" : "INV-000001";
    const testTaxTotal = isRegistered ? "180.00" : "0.00";
    const testGrandTotal = isRegistered ? "1180.00" : "1000.00";
    const testTaxAmount = isRegistered ? 180 : 0;

    // Run statutory check using sample mock invoice from profile
    const validation = validateDocumentForIrd({
      documentType: testDocType,
      documentNumber: testDocNumber,
      sellerName: profile.legalName,
      sellerAddress: profile.registeredAddress,
      sellerTin: profile.tin,
      sellerVatStatus: profile.vatStatus,
      sellerVatNumber: profile.vatRegistrationNumber,
      buyerName: "Sample Customer Ltd",
      buyerAddress: "123 Galle Road, Colombo 03",
      buyerTin: "123456789",
      buyerVatNumber: "123456789-7000",
      supplyDate: new Date(),
      issueDate: new Date(),
      currency: profile.defaultCurrency || "LKR",
      grandTotal: testGrandTotal,
      netValue: "1000.00",
      taxTotal: testTaxTotal,
      lines: [
        {
          description: "Sample Taxable Supply Item",
          quantity: 1,
          unitPrice: 1000,
          taxAmount: testTaxAmount,
          unit: "Pcs",
        },
      ],
    });

    return NextResponse.json({
      success: true,
      ...validation,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
