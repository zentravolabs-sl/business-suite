import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { POForm } from "@/components/purchases/po-form";

export const metadata = {
  title: "New Purchase Order | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function NewPOPage() {
  const tenant = await requireTenant();

  const [suppliers, branches, products] = await Promise.all([
    prisma.supplier.findMany({
      where: { businessId: tenant.businessId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { businessId: tenant.businessId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    costPrice: Number(p.costPrice),
  }));

  const serializedSuppliers = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const serializedBranches = branches.map((b) => ({
    id: b.id,
    name: b.name,
  }));

  return (
    <div className="py-2">
      <POForm
        suppliers={serializedSuppliers}
        branches={serializedBranches}
        products={serializedProducts}
      />
    </div>
  );
}
