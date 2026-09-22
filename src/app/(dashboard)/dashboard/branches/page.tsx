import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { BranchesClient } from "@/components/branches/branches-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Branch Management | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const tenant = await requireTenant();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [branches, users] = await Promise.all([
    prisma.branch.findMany({
      where: { businessId: tenant.businessId },
      orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }],
    }),
    prisma.userBusiness.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  // Fetch per-branch stats
  const stats = await Promise.all(
    branches.map(async (b) => {
      const [monthlySales, stockCount, staffCount] = await Promise.all([
        prisma.sale.aggregate({
          where: {
            businessId: tenant.businessId,
            branchId: b.id,
            status: "COMPLETED",
            createdAt: { gte: monthStart },
          },
          _sum: { total: true },
          _count: { id: true },
        }),
        prisma.stock.count({
          where: { businessId: tenant.businessId, branchId: b.id },
        }),
        prisma.userBusiness.count({
          where: { businessId: tenant.businessId, branchId: b.id, isActive: true },
        }),
      ]);

      return {
        branchId: b.id,
        monthlySales: Number(monthlySales._sum.total || 0),
        monthlyTransactions: monthlySales._count.id,
        stockItems: stockCount,
        staffCount,
      };
    })
  );

  const statsMap = new Map(stats.map((s) => [s.branchId, s]));

  const serializedBranches = branches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    address: b.address,
    city: b.city,
    phone: b.phone,
    email: b.email,
    managerId: b.managerId,
    openingCash: Number(b.openingCash),
    isHeadOffice: b.isHeadOffice,
    isActive: b.isActive,
    ...statsMap.get(b.id),
  }));

  const managers = users.map((ub) => ({ id: ub.user.id, name: ub.user.name }));
  // Deduplicate managers
  const uniqueManagers = Array.from(new Map(managers.map((m) => [m.id, m])).values());

  return (
    <BranchesClient
      initialBranches={serializedBranches}
      managers={uniqueManagers}
    />
  );
}
