import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { PosInterface } from "@/components/pos/pos-interface";

export const metadata = {
  title: "POS Terminal | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const tenant = await requireTenant();

  const [products, categories, branches, user] = await Promise.all([
    prisma.product.findMany({
      where: {
        businessId: tenant.businessId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        category: true,
        stocks: {
          where: tenant.branchId ? { branchId: tenant.branchId } : undefined,
        },
        barcodes: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: tenant.userId },
    }),
  ]);

  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode || p.barcodes[0]?.barcode || "",
    categoryName: p.category?.name || "General",
    categoryId: p.categoryId,
    costPrice: Number(p.costPrice),
    retailPrice: Number(p.retailPrice),
    isSerialTracked: p.isSerialTracked,
    warrantyMonths: p.warrantyMonths || 0,
    stockQuantity: p.stocks.reduce((acc, s) => acc + s.quantity, 0),
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const serializedBranches = branches.map((b) => ({
    id: b.id,
    name: b.name,
  }));

  return (
    <PosInterface
      initialProducts={serializedProducts}
      categories={serializedCategories}
      branches={serializedBranches}
      activeBranchId={tenant.branchId || branches[0]?.id || ""}
      cashierName={user?.name || "Cashier"}
    />
  );
}
