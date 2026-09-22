import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { InventoryClient } from "@/components/inventory/inventory-client";

export const metadata = {
  title: "Inventory & Stock Control | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const tenant = await requireTenant();

  const [products, branches] = await Promise.all([
    prisma.product.findMany({
      where: {
        businessId: tenant.businessId,
        deletedAt: null,
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        stocks: {
          include: { branch: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode || "",
    categoryName: p.category?.name || "General",
    brandName: p.brand?.name || "Generic",
    costPrice: Number(p.costPrice),
    retailPrice: Number(p.retailPrice),
    reorderLevel: p.reorderLevel,
    isSerialTracked: p.isSerialTracked,
    stocks: p.stocks.map((s) => ({
      branchId: s.branchId,
      branchName: s.branch.name,
      quantity: s.quantity,
    })),
  }));

  const serializedBranches = branches.map((b) => ({
    id: b.id,
    name: b.name,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <InventoryClient
        initialProducts={serializedProducts}
        branches={serializedBranches}
      />
    </div>
  );
}
