"use client";

import { useSession } from "next-auth/react";
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions } from "@/lib/permissions";

export function usePermissions() {
  const { data: session, status } = useSession();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const activeBusiness = user?.businesses?.[0];
  const permissions: string[] = activeBusiness?.permissions || [];
  const isOwner: boolean = activeBusiness?.isOwner ?? false;
  const roleName: string = activeBusiness?.roleName ?? "";

  return {
    permissions,
    isOwner,
    roleName,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    can: (permission: Permission | string) => isOwner || hasPermission(permissions, permission),
    canAny: (perms: (Permission | string)[]) => isOwner || hasAnyPermission(permissions, perms),
    canAll: (perms: (Permission | string)[]) => isOwner || hasAllPermissions(permissions, perms),
  };
}
