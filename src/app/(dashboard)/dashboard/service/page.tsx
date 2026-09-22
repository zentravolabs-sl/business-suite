import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import {
  ServiceTicketsClient,
  SerializedTicket,
  InventoryProduct,
} from "@/components/service/service-tickets-client";

export const metadata = {
  title: "Repair & Service Center | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function ServicePage() {
  const tenant = await requireTenant();

  const [tickets, technicians, products, stocks] = await Promise.all([
    prisma.serviceTicket.findMany({
      where: { businessId: tenant.businessId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        product: { select: { id: true, name: true, sku: true } },
        parts: true,
        updates: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: {
        businesses: {
          some: { businessId: tenant.businessId },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        costPrice: true,
        retailPrice: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.stock.findMany({
      where: { businessId: tenant.businessId },
      select: { productId: true, quantity: true },
    }),
  ]);

  // Aggregate stock qty per product
  const stockMap: Record<string, number> = {};
  stocks.forEach((s) => {
    stockMap[s.productId] = (stockMap[s.productId] || 0) + s.quantity;
  });

  const serializedProducts: InventoryProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    costPrice: Number(p.costPrice),
    retailPrice: Number(p.retailPrice),
    stockQty: stockMap[p.id] || 0,
  }));

  const serializedTickets: SerializedTicket[] = tickets.map((t) => {
    const tech = technicians.find((u) => u.id === t.technicianId);
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      deviceName: t.deviceName || "Device",
      serialNumber: t.serialNumber,
      issue: t.issue,
      description: t.description,
      status: t.status,
      priority: t.priority,
      customerName: t.customer?.name || null,
      customerPhone: t.customer?.phone || null,
      technicianName: tech?.name || null,
      technicianId: t.technicianId,
      estimatedCost: Number(t.estimatedCost || 0),
      finalCost: Number(t.finalCost || 0),
      laborCost: Number(t.laborCost || 0),
      partsCost: Number(t.partsCost || 0),
      isWarranty: t.isWarranty,
      isPaid: t.isPaid,
      receivedAt: t.receivedAt.toISOString(),
      estimatedCompletionAt: t.estimatedCompletionAt
        ? t.estimatedCompletionAt.toISOString()
        : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      deliveredAt: t.deliveredAt ? t.deliveredAt.toISOString() : null,
      parts: t.parts.map((p) => ({
        id: p.id,
        productId: p.productId,
        partName: p.partName,
        quantity: p.quantity,
        unitCost: Number(p.unitCost),
        sellingPrice: Number(p.sellingPrice),
        total: Number(p.total),
        fromInventory: p.fromInventory,
      })),
      updates: t.updates.map((u) => ({
        id: u.id,
        status: u.status,
        notes: u.notes,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <ServiceTicketsClient
        initialTickets={serializedTickets}
        technicians={technicians}
        inventoryProducts={serializedProducts}
      />
    </div>
  );
}
