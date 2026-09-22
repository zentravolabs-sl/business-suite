import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { GRNListClient } from "@/components/purchases/grn-list-client";

export const metadata = {
  title: "Goods Received Notes (GRN) | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const tenant = await requireTenant();

  const [purchases, suppliers, branches] = await Promise.all([
    prisma.purchase.findMany({
      where: { businessId: tenant.businessId },
      include: {
        supplier: true,
        branch: true,
        items: {
          include: { product: true },
        },
        payments: {
          orderBy: { paidAt: "desc" },
        },
        payables: true,
      },
      orderBy: { receivedDate: "desc" },
      take: 100,
    }),
    prisma.supplier.findMany({
      where: { businessId: tenant.businessId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { businessId: tenant.businessId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized = purchases.map((p) => ({
    id: p.id,
    grnNumber: p.grnNumber,
    supplierInvoice: p.supplierInvoice,
    supplierName: p.supplier.name,
    supplierId: p.supplierId,
    branchName: p.branch.name,
    branchId: p.branchId,
    status: p.status,
    subtotal: Number(p.subtotal),
    discountAmount: Number(p.discountAmount),
    taxAmount: Number(p.taxAmount),
    total: Number(p.total),
    paidAmount: Number(p.paidAmount),
    balance: Number(p.balance),
    receivedDate: p.receivedDate.toISOString(),
    notes: p.notes,
    payableId: p.payables[0]?.id || null,
    payments: p.payments.map((pm) => ({
      id: pm.id,
      amount: Number(pm.amount),
      method: pm.method,
      reference: pm.reference,
      paidAt: pm.paidAt.toISOString(),
      notes: pm.notes,
    })),
    items: p.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.product.name,
      quantity: it.quantity,
      unitCost: Number(it.unitCost),
      total: Number(it.total),
      serialNumbers: it.serialNumbers || [],
      batchNumber: it.batchNumber,
      expiryDate: it.expiryDate ? it.expiryDate.toISOString() : null,
    })),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <GRNListClient
        initialPurchases={serialized}
        suppliers={suppliers}
        branches={branches}
      />
    </div>
  );
}
