import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { ProductForm } from "@/components/products/product-form";

export const metadata = {
  title: "New Product | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const tenant = await requireTenant();

  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="py-2">
      <ProductForm categories={categories} brands={brands} />
    </div>
  );
}
