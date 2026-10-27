/**
 * Access control & authorization helper for the AI Business & Financial Advisor module.
 *
 * Guarantees tenant isolation:
 * - Validates current active session and tenant
 * - Rejects unauthenticated callers with 401
 * - Rejects callers lacking required permission with 403 (owners always pass)
 * - Returns authenticated tenant context for safe data queries
 */

import { NextResponse } from "next/server";
import { getTenantContext, type TenantContext } from "@/lib/tenant";
import { hasAnyPermission } from "@/lib/permissions";

export interface AuthorizeAdvisorOptions {
  /** Any one of these permissions grants access (owners always pass) */
  anyOf?: string[];
  /** When true, only owners can perform the action (e.g. settings updates) */
  requireOwner?: boolean;
}

export const ADVISOR_PERMISSIONS = {
  VIEW: "advisor.view",
  MANAGE: "advisor.manage",
  CHAT: "advisor.chat",
} as const;

export async function authorizeAdvisor(
  opts: AuthorizeAdvisorOptions = {}
): Promise<{ tenant: TenantContext } | { response: NextResponse }> {
  const tenant = await getTenantContext();
  if (!tenant) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (opts.requireOwner && !tenant.isOwner) {
    return {
      response: NextResponse.json(
        { error: "Forbidden: Owner privileges required" },
        { status: 403 }
      ),
    };
  }

  const allowedPermissions = opts.anyOf ?? [
    ADVISOR_PERMISSIONS.VIEW,
    ADVISOR_PERMISSIONS.CHAT,
    "ai.view",
    "ai.query",
    "reports.view",
    "reports.financial",
  ];

  if (!tenant.isOwner && !hasAnyPermission(tenant.permissions, allowedPermissions)) {
    return {
      response: NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      ),
    };
  }

  return { tenant };
}
