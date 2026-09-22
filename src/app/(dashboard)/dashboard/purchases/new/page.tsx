import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { GRNForm } from "@/components/purchases/grn-form";

export const metadata = {
  title: "Receive Goods (GRN) | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function NewGRNPage({
  searchParams,
}: {
  searchParams: Promise<{ poId?: string }>;
}) {
  const tenant = await requireTenant();
  const { poId } = await searchParams;

  const [suppliers, branches, products, po] = await Promise.all([
    prisma.supplier.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { businessId: tenant.businessId },
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
        isSerialTracked: true,
        isBatchTracked: true,
      },
      orderBy: { name: "asc" },
    }),
    poId
      ? prisma.purchaseOrder.findFirst({
          where: { id: poId, businessId: tenant.businessId },
          include: {
            items: {
              include: { product: true },
            },
          },
        })
      : null,
  ]);

  const serializedSuppliers = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    creditBalance: Number(s.creditBalance),
    creditLimit: Number(s.creditLimit),
    paymentTermDays: s.paymentTermDays,
    phone: s.phone,
  }));

  const serializedBranches = branches.map((b) => ({
    id: b.id,
    name: b.name,
    city: b.city,
  }));

  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    costPrice: Number(p.costPrice),
    retailPrice: Number(p.retailPrice),
    isSerialTracked: p.isSerialTracked,
    isBatchTracked: p.isBatchTracked,
  }));

  const serializedPO = po
    ? {
        id: po.id,
        orderNumber: po.orderNumber,
        supplierId: po.supplierId,
        branchId: po.branchId,
        items: po.items.map((it) => ({
          productId: it.productId,
          productName: it.product.name,
          quantity: it.quantity,
          receivedQty: it.receivedQty,
          unitCost: Number(it.unitCost),
        })),
      }
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <GRNForm
        suppliers={serializedSuppliers}
        branches={serializedBranches}
        products={serializedProducts}
        initialPO={serializedPO}
      />
    </div>
  );
}
