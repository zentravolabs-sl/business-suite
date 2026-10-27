import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { encryptCredential } from "@/lib/tax/ird-integration";
import { toErrorResponse } from "@/lib/tax/errors";
import type { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [settings, submissions] = await Promise.all([
      prisma.taxIntegrationSetting.findUnique({
        where: { businessId: tenant.businessId },
      }),
      prisma.irdSubmission.findMany({
        where: { businessId: tenant.businessId },
        include: {
          document: {
            select: {
              documentNumber: true,
              documentType: true,
              grandTotal: true,
              issueDate: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      settings: settings
        ? {
            id: settings.id,
            enabled: settings.enabled,
            provider: settings.provider,
            environment: settings.environment,
            endpointUrl: settings.endpointUrl,
            autoSubmit: settings.autoSubmit,
            maxRetries: settings.maxRetries,
            hasCredentials: !!(settings.clientIdEnc && settings.clientSecretEnc),
            lastValidatedAt: settings.lastValidatedAt,
            lastError: settings.lastError,
          }
        : null,
      submissions: submissions.map((s) => ({
        id: s.id,
        documentNumber: s.document.documentNumber,
        documentType: s.document.documentType,
        grandTotal: Number(s.document.grandTotal),
        issueDate: s.document.issueDate.toISOString().slice(0, 10),
        status: s.status,
        attempts: s.attempts,
        validationErrors: s.validationErrors,
        lastError: s.lastError,
        createdAt: s.createdAt.toISOString(),
      })),
      disclaimer:
        "The Inland Revenue Department of Sri Lanka has announced future RAMIS e-invoicing integration. Zentravo provides validation, schema compliance, queue management, and secure credential storage. Outbound submission endpoints will be activated when IRD issues public technical specifications.",
    });
  } catch (error) {
    console.error("GET tax integration error:", error);
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canEdit =
      tenant.isOwner || hasPermission(tenant.permissions, "tax.manage_integration");
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const { enabled, environment, endpointUrl, clientId, clientSecret, autoSubmit, maxRetries } = body;

    const data: Prisma.TaxIntegrationSettingUncheckedUpdateInput = {
      enabled: !!enabled,
      environment: environment || "SANDBOX",
      endpointUrl: endpointUrl ? endpointUrl.trim() : null,
      autoSubmit: !!autoSubmit,
      maxRetries: maxRetries ? Number(maxRetries) : 5,
      updatedById: tenant.userId,
    };

    if (clientId && clientSecret) {
      data.clientIdEnc = encryptCredential(clientId.trim());
      data.clientSecretEnc = encryptCredential(clientSecret.trim());
      data.credentialsUpdatedAt = new Date();
    }

    const updated = await prisma.taxIntegrationSetting.upsert({
      where: { businessId: tenant.businessId },
      update: data,
      create: {
        businessId: tenant.businessId,
        provider: "IRD_RAMIS",
        enabled: data.enabled as boolean,
        environment: data.environment as string,
        endpointUrl: data.endpointUrl as string | null,
        autoSubmit: data.autoSubmit as boolean,
        maxRetries: data.maxRetries as number,
        clientIdEnc: data.clientIdEnc as string | null,
        clientSecretEnc: data.clientSecretEnc as string | null,
        credentialsUpdatedAt: data.credentialsUpdatedAt as Date | null,
        updatedById: tenant.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId: tenant.businessId,
        userId: tenant.userId,
        action: "SETTINGS_CHANGE",
        entity: "TaxIntegrationSetting",
        entityId: updated.id,
        newValue: {
          enabled: updated.enabled,
          environment: updated.environment,
          endpointUrl: updated.endpointUrl,
        },
      },
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    console.error("PUT tax integration error:", error);
    return toErrorResponse(error);
  }
}
