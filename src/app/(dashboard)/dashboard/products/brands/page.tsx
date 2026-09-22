import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { BrandsClient } from "@/components/products/brands-client";

export const metadata = {
  title: "Brands | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const tenant = await requireTenant();

  const brands = await prisma.brand.findMany({
    where: { businessId: tenant.businessId, isActive: true },
    include: {
      _count: {
        select: { products: { where: { deletedAt: null } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const serialized = brands.map((b) => ({
    id: b.id,
    name: b.name,
    productCount: b._count.products,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BrandsClient initialBrands={serialized} />
    </div>
  );
}
