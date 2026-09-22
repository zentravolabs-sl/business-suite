import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { OrdersClient } from "@/components/orders/orders-client";

export const metadata = {
  title: "Online Orders & Fulfillment | Zentravo BMS",
  description: "Track, manage and fulfill online e-commerce customer orders with Sri Lankan courier dispatch",
};

export default async function OrdersPage() {
  const tenant = await requireTenant();

  const [orders, business] = await Promise.all([
    prisma.onlineOrder.findMany({
      where: { businessId: tenant.businessId },
      include: {
        items: true,
        delivery: true,
        zone: true,
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.business.findUnique({
      where: { id: tenant.businessId },
      select: { name: true },
    }),
  ]);

  // Serialize Prisma Decimals for Client Component
  const serializedOrders = orders.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    confirmedAt: o.confirmedAt?.toISOString() || null,
    readyAt: o.readyAt?.toISOString() || null,
    deliveredAt: o.deliveredAt?.toISOString() || null,
    cancelledAt: o.cancelledAt?.toISOString() || null,
    subtotal: Number(o.subtotal),
    deliveryFee: Number(o.deliveryFee),
    discountAmount: Number(o.discountAmount),
    taxAmount: Number(o.taxAmount),
    total: Number(o.total),
    items: o.items.map((i) => ({
      ...i,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    delivery: o.delivery
      ? {
          ...o.delivery,
          assignedAt: o.delivery.assignedAt?.toISOString() || null,
          deliveredAt: o.delivery.deliveredAt?.toISOString() || null,
        }
      : null,
  }));

  return (
    <OrdersClient
      initialOrders={serializedOrders as any}
      businessName={business?.name || "Zentravo Retail"}
    />
  );
}
