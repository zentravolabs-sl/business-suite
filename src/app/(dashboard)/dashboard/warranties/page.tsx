import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { WarrantyClient, SerializedWarranty } from "@/components/warranties/warranty-client";

export const metadata = {
  title: "Warranty Tracker & Claims | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function WarrantiesPage() {
  const tenant = await requireTenant();

  const [warranties, products, customers] = await Promise.all([
    prisma.warranty.findMany({
      where: { businessId: tenant.businessId },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        customer: { select: { id: true, name: true, phone: true } },
        claims: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.product.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      select: { id: true, name: true, sku: true, warrantyMonths: true },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedWarranties: SerializedWarranty[] = warranties.map((w) => ({
    id: w.id,
    code: w.warrantyCode,
    serialNumber: w.serialNumber,
    productName: w.product.name,
    productId: w.productId,
    customerName: w.customer?.name || null,
    customerPhone: w.customer?.phone || null,
    customerId: w.customerId,
    purchaseDate: w.purchaseDate.toISOString(),
    startDate: w.startDate.toISOString(),
    endDate: w.endDate.toISOString(),
    warrantyMonths: w.warrantyMonths,
    type: w.type,
    status: w.status,
    terms: w.terms,
    claimsCount: w.claims.length,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <WarrantyClient
        initialWarranties={serializedWarranties}
        products={products}
        customers={customers}
      />
    </div>
  );
}
