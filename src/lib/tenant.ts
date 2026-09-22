import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export interface TenantContext {
  userId: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  branchId: string | null;
  roleId: string | null;
  roleName: string | null;
  isOwner: boolean;
  permissions: string[];
}

/**
 * Get current tenant context from the session.
 * Returns null if unauthenticated or user has no business association.
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const businesses = (session.user as any).businesses;
  if (!businesses || !Array.isArray(businesses) || businesses.length === 0) {
    return null;
  }

  // Default to the first business or active business
  const active = businesses[0];

  return {
    userId: session.user.id,
    businessId: active.businessId,
    businessName: active.businessName,
    businessSlug: active.businessSlug,
    branchId: active.branchId || null,
    roleId: active.roleId || null,
    roleName: active.roleName || null,
    isOwner: !!active.isOwner,
    permissions: active.permissions || [],
  };
}

/**
 * Enforce tenant authentication in server components / server actions.
 * Redirects to /login if not authenticated, or /onboarding if no business exists.
 */
export async function requireTenant(): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const tenant = await getTenantContext();
  if (!tenant) {
    redirect("/onboarding");
  }

  return tenant;
}

/**
 * Verify that an entity belongs to the active business
 */
export async function verifyTenantOwnership(
  entityBusinessId: string,
  currentBusinessId: string
): Promise<boolean> {
  return entityBusinessId === currentBusinessId;
}

/**
 * Helper to get business with current branch info
 */
export async function getActiveBusinessWithBranch(businessId: string, branchId?: string | null) {
  return prisma.business.findUnique({
    where: { id: businessId },
    include: {
      branches: {
        where: branchId ? { id: branchId } : { isHeadOffice: true },
      },
      subscription: {
        include: { plan: true },
      },
    },
  });
}
