import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { SalesListClient } from "@/components/sales/sales-list-client";

export const metadata = {
  title: "Sales & Invoices | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const tenant = await requireTenant();

  const [sales, branches, business] = await Promise.all([
    prisma.sale.findMany({
      where: { businessId: tenant.businessId },
      include: {
        customer: true,
        branch: true,
        user: true,
        payments: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.branch.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.business.findUnique({
      where: { id: tenant.businessId },
    }),
  ]);

  const serializedSales = sales.map((s) => ({
    id: s.id,
    invoiceNumber: s.invoiceNumber,
    receiptNumber: s.receiptNumber,
    branchName: s.branch.name,
    branchId: s.branchId,
    customerName: s.customer?.name || "Walk-in Guest",
    cashierName: s.user?.name || "Cashier",
    subtotal: Number(s.subtotal),
    discountAmount: Number(s.discountAmount),
    taxAmount: Number(s.taxAmount),
    total: Number(s.total),
    paidAmount: Number(s.paidAmount),
    changeAmount: Number(s.changeAmount),
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    payments: s.payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      reference: p.reference,
    })),
    items: s.items.map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
      serialNumber: i.serialNumber,
      warrantyMonths: i.warrantyMonths || 0,
    })),
  }));

  const serializedBranches = branches.map((b) => ({
    id: b.id,
    name: b.name,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <SalesListClient
        initialSales={serializedSales}
        branches={serializedBranches}
        businessInfo={{
          name: business?.name || "Zentravo BMS",
          legalName: business?.legalName || undefined,
          address: business?.address || undefined,
          phone: business?.phone || undefined,
          vatNumber: business?.vatNumber || undefined,
          receiptHeader: business?.receiptHeader || undefined,
          receiptFooter: business?.receiptFooter || undefined,
        }}
      />
    </div>
  );
}
