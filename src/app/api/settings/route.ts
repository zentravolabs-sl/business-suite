import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  businessRegNo: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  currency: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  invoicePrefix: z.string().optional(),
  receiptPrefix: z.string().optional(),
  quotationPrefix: z.string().optional(),
  purchaseOrderPrefix: z.string().optional(),
  warrantyPrefix: z.string().optional(),
  servicePrefix: z.string().optional(),
  taxEnabled: z.boolean().optional(),
  taxRate: z.number().optional().nullable(),
  taxName: z.string().optional().nullable(),
  taxInclusive: z.boolean().optional(),
  invoiceFooter: z.string().optional().nullable(),
  receiptHeader: z.string().optional().nullable(),
  receiptFooter: z.string().optional().nullable(),
  thankYouMessage: z.string().optional().nullable(),
  whatsappEnabled: z.boolean().optional(),
  whatsappNumber: z.string().optional().nullable(),
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  loyaltyEnabled: z.boolean().optional(),
  loyaltyPointsPerLkr: z.number().optional().nullable(),
  warrantyEnabled: z.boolean().optional(),
  ecommerceEnabled: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await prisma.business.findUnique({
      where: { id: tenant.businessId },
      select: {
        id: true,
        name: true,
        legalName: true,
        slug: true,
        category: true,
        status: true,
        logo: true,
        email: true,
        phone: true,
        website: true,
        address: true,
        city: true,
        district: true,
        province: true,
        country: true,
        postalCode: true,
        businessRegNo: true,
        taxNumber: true,
        vatNumber: true,
        currency: true,
        currencySymbol: true,
        language: true,
        timezone: true,
        dateFormat: true,
        invoicePrefix: true,
        receiptPrefix: true,
        quotationPrefix: true,
        purchaseOrderPrefix: true,
        warrantyPrefix: true,
        servicePrefix: true,
        taxEnabled: true,
        taxRate: true,
        taxName: true,
        taxInclusive: true,
        invoiceFooter: true,
        receiptHeader: true,
        receiptFooter: true,
        thankYouMessage: true,
        whatsappEnabled: true,
        whatsappNumber: true,
        smsEnabled: true,
        emailEnabled: true,
        loyaltyEnabled: true,
        loyaltyPointsPerLkr: true,
        warrantyEnabled: true,
        ecommerceEnabled: true,
        nextInvoiceNumber: true,
        nextWarrantyNumber: true,
        nextServiceNumber: true,
        createdAt: true,
      },
    });

    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    return NextResponse.json({
      ...business,
      taxRate: business.taxRate !== null ? Number(business.taxRate) : null,
      loyaltyPointsPerLkr: business.loyaltyPointsPerLkr !== null ? Number(business.loyaltyPointsPerLkr) : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    const business = await prisma.business.update({
      where: { id: tenant.businessId },
      data: {
        ...data,
        taxRate: data.taxRate !== undefined ? data.taxRate : undefined,
        loyaltyPointsPerLkr: data.loyaltyPointsPerLkr !== undefined ? data.loyaltyPointsPerLkr : undefined,
      },
    });

    return NextResponse.json({ success: true, business });
  } catch (error: any) {
    console.error("Settings PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
