import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { SuppliersClient } from "@/components/suppliers/suppliers-client";

export const metadata = {
  title: "Suppliers & Vendors | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const tenant = await requireTenant();

  const suppliers = await prisma.supplier.findMany({
    where: { businessId: tenant.businessId, deletedAt: null, isActive: true },
    include: {
      _count: {
        select: { purchases: true, purchaseOrders: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const serialized = suppliers.map((s) => ({
    id: s.id,
    supplierCode: s.supplierCode || "SUP",
    name: s.name,
    contactPerson: s.contactPerson || "-",
    phone: s.phone || "-",
    email: s.email || "-",
    city: s.city || "Colombo",
    creditLimit: Number(s.creditLimit),
    creditBalance: Number(s.creditBalance),
    paymentTermDays: s.paymentTermDays,
    bankName: s.bankName,
    bankAccount: s.bankAccount,
    totalPurchases: s._count.purchases,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <SuppliersClient initialSuppliers={serialized} />
    </div>
  );
}
