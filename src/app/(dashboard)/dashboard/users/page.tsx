import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { UsersClient } from "@/components/users/users-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Management | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const tenant = await requireTenant();

  const [userBusinesses, roles, branches] = await Promise.all([
    prisma.userBusiness.findMany({
      where: { businessId: tenant.businessId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        role: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.role.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const users = userBusinesses.map((ub) => ({
    id: ub.user.id,
    userBusinessId: ub.id,
    name: ub.user.name,
    email: ub.user.email,
    phone: ub.user.phone,
    status: ub.user.status,
    isOwner: ub.isOwner,
    isActive: ub.isActive,
    roleId: ub.roleId,
    roleName: ub.role?.name || null,
    branchId: ub.branchId,
    branchName: ub.branch?.name || null,
    lastLoginAt: ub.user.lastLoginAt?.toISOString() || null,
    joinedAt: ub.joinedAt.toISOString(),
  }));

  return (
    <UsersClient
      initialUsers={users}
      roles={roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
