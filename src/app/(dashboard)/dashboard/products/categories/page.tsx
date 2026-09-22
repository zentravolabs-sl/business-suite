import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { CategoriesClient } from "@/components/products/categories-client";

export const metadata = {
  title: "Categories | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const tenant = await requireTenant();

  const categories = await prisma.category.findMany({
    where: { businessId: tenant.businessId, isActive: true },
    include: {
      _count: {
        select: { products: { where: { deletedAt: null } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const serialized = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description || "",
    productCount: c._count.products,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CategoriesClient initialCategories={serialized} />
    </div>
  );
}
