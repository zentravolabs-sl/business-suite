import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { SettingsClient } from "@/components/settings/settings-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business Settings | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tenant = await requireTenant();

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
    },
  });

  if (!business) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Business not found.</p>
      </div>
    );
  }

  const serializedBusiness = {
    ...business,
    taxRate: business.taxRate !== null ? Number(business.taxRate) : null,
    loyaltyPointsPerLkr: business.loyaltyPointsPerLkr !== null ? Number(business.loyaltyPointsPerLkr) : null,
  };

  return <SettingsClient business={serializedBusiness} />;
}
