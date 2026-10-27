import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { ensureDefaultNumberingRules } from "@/lib/tax/profile-service";
import { toErrorResponse } from "@/lib/tax/errors";

export async function GET() {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureDefaultNumberingRules(tenant.businessId);

    const [rules, sequences] = await Promise.all([
      prisma.numberingRule.findMany({
        where: { businessId: tenant.businessId },
        orderBy: { documentType: "asc" },
      }),
      prisma.documentSequence.findMany({
        where: { businessId: tenant.businessId },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return NextResponse.json({ rules, sequences });
  } catch (error) {
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
      tenant.isOwner || hasPermission(tenant.permissions, "tax.edit_settings");
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const { documentType, prefix, minDigits, resetPeriod } = body;

    if (!documentType || !prefix) {
      return NextResponse.json({ error: "Document type and prefix are required" }, { status: 400 });
    }

    const updated = await prisma.numberingRule.upsert({
      where: {
        businessId_documentType: {
          businessId: tenant.businessId,
          documentType,
        },
      },
      update: {
        prefix: prefix.trim().toUpperCase(),
        minDigits: minDigits ? Number(minDigits) : 6,
        resetPeriod: resetPeriod || "NEVER",
        updatedById: tenant.userId,
      },
      create: {
        businessId: tenant.businessId,
        documentType,
        prefix: prefix.trim().toUpperCase(),
        minDigits: minDigits ? Number(minDigits) : 6,
        resetPeriod: resetPeriod || "NEVER",
        updatedById: tenant.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId: tenant.businessId,
        userId: tenant.userId,
        action: "SETTINGS_CHANGE",
        entity: "NumberingRule",
        entityId: updated.id,
        newValue: {
          documentType: updated.documentType,
          prefix: updated.prefix,
          minDigits: updated.minDigits,
          resetPeriod: updated.resetPeriod,
        },
      },
    });

    return NextResponse.json({ success: true, rule: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
