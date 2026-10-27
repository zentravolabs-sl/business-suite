import { Metadata } from "next";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { getOrCreateTaxProfile, ensureDefaultNumberingRules } from "@/lib/tax/profile-service";
import { TaxSettingsClient } from "@/components/settings/tax-settings-client";

export const metadata: Metadata = {
  title: "Tax & Invoicing Settings | Zentravo BMS",
  description: "Sri Lanka Inland Revenue Department compliant tax profile, VAT settings, rates, numbering, and reports",
};

export const dynamic = "force-dynamic";

export default async function TaxSettingsPage() {
  const tenant = await requireTenant();

  const canView =
    tenant.isOwner ||
    hasPermission(tenant.permissions, "tax.view") ||
    hasPermission(tenant.permissions, "settings.view");

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="p-6 text-center rounded-2xl bg-destructive/10 border border-destructive/20 max-w-md">
          <h2 className="text-lg font-semibold text-destructive">Access Restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have permission to view or manage Tax & Invoicing settings. Please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  // Ensure tax profile and default numbering rules are initialized
  const [profileContext] = await Promise.all([
    getOrCreateTaxProfile(tenant.businessId),
    ensureDefaultNumberingRules(tenant.businessId),
  ]);

  const [taxRates, categories, numberingRules, sequences, branches, integration] =
    await Promise.all([
      prisma.taxRate.findMany({
        where: { businessId: tenant.businessId },
        include: {
          versions: {
            orderBy: { effectiveFrom: "desc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.taxCategory.findMany({
        where: { businessId: tenant.businessId },
        include: {
          taxRate: true,
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.numberingRule.findMany({
        where: { businessId: tenant.businessId },
        orderBy: { documentType: "asc" },
      }),
      prisma.documentSequence.findMany({
        where: { businessId: tenant.businessId },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.branch.findMany({
        where: { businessId: tenant.businessId },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.taxIntegrationSetting.findUnique({
        where: { businessId: tenant.businessId },
      }),
    ]);

  const [accounts, accountMappings] = await Promise.all([
    prisma.account.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: "asc" },
    }),
    prisma.taxAccountMapping.findMany({
      where: { businessId: tenant.businessId },
    }),
  ]);

  const mappingMap: Record<string, string> = {};
  for (const m of accountMappings) {
    mappingMap[m.key] = m.accountId;
  }

  // Safe serialization for Client Component
  const initialData = {
    profile: {
      ...profileContext.profile,
      registrationEffectiveDate: profileContext.profile.registrationEffectiveDate
        ? profileContext.profile.registrationEffectiveDate.toISOString().slice(0, 10)
        : null,
    },
    business: profileContext.business,
    accounts,
    accountMappings: mappingMap,
    taxRates: taxRates.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      rate: Number(r.rate),
      treatment: r.treatment,
      isDefault: r.isDefault,
      description: r.description,
      legalReference: r.legalReference,
      versions: r.versions.map((v) => ({
        id: v.id,
        ratePercent: Number(v.ratePercent),
        effectiveFrom: v.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: v.effectiveTo ? v.effectiveTo.toISOString().slice(0, 10) : null,
        note: v.note,
      })),
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      treatment: c.treatment,
      taxRateId: c.taxRateId,
      taxRateName: c.taxRate ? c.taxRate.name : null,
      taxRatePercent: c.taxRate ? Number(c.taxRate.rate) : null,
      isDefault: c.isDefault,
      description: c.description,
      legalReference: c.legalReference,
      productCount: c._count.products,
    })),
    numberingRules: numberingRules.map((r) => ({
      id: r.id,
      documentType: r.documentType,
      prefix: r.prefix,
      suffix: null,
      minDigits: r.minDigits,
      resetPeriod: r.resetPeriod,
      includeBranchCode: false,
      branchPadding: 0,
    })),
    sequences: sequences.map((s) => ({
      id: s.id,
      documentType: s.sequenceKey,
      branchId: null,
      periodKey: s.periodKey,
      currentValue: s.lastNumber,
      lastIssuedAt: s.updatedAt.toISOString(),
      lastResetAt: null,
    })),
    branches,
    integration: integration
      ? {
          id: integration.id,
          enabled: integration.enabled,
          provider: integration.provider,
          environment: integration.environment,
          endpointUrl: integration.endpointUrl || "",
          autoSubmit: integration.autoSubmit,
          maxRetries: integration.maxRetries,
          hasCredentials: !!(integration.clientIdEnc && integration.clientSecretEnc),
          lastValidatedAt: integration.lastValidatedAt ? integration.lastValidatedAt.toISOString() : null,
          lastError: integration.lastError,
        }
      : null,
    canEdit:
      tenant.isOwner || hasPermission(tenant.permissions, "tax.edit_settings"),
  };

  return <TaxSettingsClient initialData={initialData} />;
}
