/**
 * Authorization + feature-gate helper shared by every /api/tax/* route.
 *
 *  - Authenticates the tenant (never trusts client supplied tenant ids).
 *  - Requires one of the supplied permissions (owners always pass).
 *  - Enforces the per-business "Tax & Invoicing" feature module while refusing to let it
 *    be switched off for a VAT-registered business: mandatory tax controls cannot be
 *    disabled to bypass compliance.
 */
import { NextResponse } from "next/server";
import { getTenantContext, type TenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { hasAnyPermission } from "@/lib/permissions";

export interface TaxModuleState {
  taxInvoicingEnabled: boolean;
  vatStatus?: string | null;
}

/**
 * The module is *effectively* active when the business flag is on, or when the business is
 * VAT-registered / has a registration pending — those businesses cannot opt out.
 */
export function isTaxModuleActive(state: TaxModuleState): boolean {
  if (state.vatStatus === "REGISTERED" || state.vatStatus === "PENDING_REGISTRATION") return true;
  return state.taxInvoicingEnabled;
}

export async function loadTaxModuleState(businessId: string): Promise<TaxModuleState> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { taxInvoicingEnabled: true, taxProfile: { select: { vatStatus: true } } },
  });
  return {
    taxInvoicingEnabled: business?.taxInvoicingEnabled ?? true,
    vatStatus: business?.taxProfile?.vatStatus ?? null,
  };
}

export interface AuthorizeTaxOptions {
  /** Any one of these permissions grants access (owners always pass). */
  anyOf: string[];
  /** When true (default) the Tax & Invoicing module must be active for the business. */
  requireModule?: boolean;
}

export async function authorizeTax(
  opts: AuthorizeTaxOptions
): Promise<{ tenant: TenantContext } | { response: NextResponse }> {
  const tenant = await getTenantContext();
  if (!tenant) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!tenant.isOwner && !hasAnyPermission(tenant.permissions, opts.anyOf)) {
    return {
      response: NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 }),
    };
  }
  if (opts.requireModule !== false) {
    const state = await loadTaxModuleState(tenant.businessId);
    if (!isTaxModuleActive(state)) {
      return {
        response: NextResponse.json(
          { error: "The Tax & Invoicing module is not enabled for this business", code: "MODULE_DISABLED" },
          { status: 403 }
        ),
      };
    }
  }
  return { tenant };
}

/** Best-effort client IP for audit metadata. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
