import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { ProductForm } from "@/components/products/product-form";

export const metadata = {
  title: "Edit Product | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await requireTenant();
  const { id } = await params;

  const [product, categories, brands] = await Promise.all([
    prisma.product.findFirst({
      where: {
        id,
        businessId: tenant.businessId,
        deletedAt: null,
      },
    }),
    prisma.category.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="py-2">
      <ProductForm
        categories={categories}
        brands={brands}
        initialData={product}
        isEdit={true}
      />
    </div>
  );
}
