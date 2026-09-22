import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { ServiceTicketForm } from "@/components/service/service-ticket-form";

export const metadata = {
  title: "New Service Job Sheet | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function NewServiceTicketPage() {
  const tenant = await requireTenant();

  const [customers, technicians, products] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        businesses: {
          some: { businessId: tenant.businessId },
        },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      select: { id: true, name: true, sku: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <ServiceTicketForm
        customers={customers}
        technicians={technicians}
        products={products}
        branchId={tenant.branchId}
      />
    </div>
  );
}
