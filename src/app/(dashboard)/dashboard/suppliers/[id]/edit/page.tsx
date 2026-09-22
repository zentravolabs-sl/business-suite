import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { SupplierForm } from "@/components/suppliers/supplier-form";

export const metadata = {
  title: "Edit Supplier | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await requireTenant();
  const { id } = await params;

  const supplier = await prisma.supplier.findFirst({
    where: { id, businessId: tenant.businessId, deletedAt: null },
  });

  if (!supplier) {
    notFound();
  }

  return (
    <div className="py-2">
      <SupplierForm initialData={supplier} isEdit={true} />
    </div>
  );
}
