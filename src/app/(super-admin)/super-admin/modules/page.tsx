import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { ModuleControlsClient } from "@/components/super-admin/module-controls-client";

export const metadata = {
  title: "Module Controls | Zentravo Super Admin",
};

export const dynamic = "force-dynamic";

export default async function ModuleControlsPage() {
  await requireAdminSession();

  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      category: true,
      status: true,
      ordersEnabled: true,
      ecommerceEnabled: true,
      warrantyEnabled: true,
      serviceEnabled: true,
      loyaltyEnabled: true,
    },
  });

  return (
    <ModuleControlsClient
      businesses={businesses.map((b) => ({
        ...b,
        category: b.category as string,
        status: b.status as string,
      }))}
    />
  );
}
