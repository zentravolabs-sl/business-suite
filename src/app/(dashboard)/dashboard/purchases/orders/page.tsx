import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { OrdersClient } from "@/components/purchases/orders-client";

export const metadata = {
  title: "Purchase Orders | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const tenant = await requireTenant();

  const orders = await prisma.purchaseOrder.findMany({
    where: { businessId: tenant.businessId },
    include: {
      supplier: true,
      branch: true,
      items: {
        include: { product: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const serialized = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    supplierName: o.supplier.name,
    supplierId: o.supplierId,
    branchName: o.branch.name,
    branchId: o.branchId,
    status: o.status,
    total: Number(o.total),
    expectedDate: o.expectedDate ? o.expectedDate.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    itemCount: o.items.length,
    items: o.items.map((it) => ({
      id: it.id,
      productName: it.product.name,
      quantity: it.quantity,
      receivedQty: it.receivedQty,
      unitCost: Number(it.unitCost),
      total: Number(it.total),
    })),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <OrdersClient initialOrders={serialized} />
    </div>
  );
}
