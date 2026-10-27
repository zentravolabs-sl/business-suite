import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { findOverlap } from "@/lib/tax/rates";
import { toErrorResponse } from "@/lib/tax/errors";
import type { TaxTreatment } from "@/lib/tax/constants";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rates = await prisma.taxRate.findMany({
      where: { businessId: tenant.businessId },
      include: {
        versions: {
          orderBy: { effectiveFrom: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ rates });
  } catch (error) {
    console.error("GET tax rates error:", error);
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
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
    const { action } = body;

    if (action === "ADD_VERSION") {
      const { taxRateId, ratePercent, effectiveFrom, effectiveTo, note } = body;
      if (!taxRateId || ratePercent === undefined || !effectiveFrom) {
        return NextResponse.json({ error: "Missing required fields for rate version" }, { status: 400 });
      }

      const rate = await prisma.taxRate.findUnique({
        where: { id: taxRateId },
        include: { versions: true },
      });
      if (!rate || rate.businessId !== tenant.businessId) {
        return NextResponse.json({ error: "Tax rate not found" }, { status: 404 });
      }

      const candidate = {
        id: "new",
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      };

      const overlap = findOverlap(
        rate.versions.map((v) => ({
          id: v.id,
          effectiveFrom: v.effectiveFrom,
          effectiveTo: v.effectiveTo,
        })),
        candidate
      );

      if (overlap) {
        return NextResponse.json(
          { error: "The new rate version overlaps with an existing effective date window" },
          { status: 400 }
        );
      }

      const version = await prisma.taxRateVersion.create({
        data: {
          businessId: tenant.businessId,
          taxRateId,
          ratePercent: new Prisma.Decimal(ratePercent),
          effectiveFrom: candidate.effectiveFrom,
          effectiveTo: candidate.effectiveTo,
          note: note || null,
          createdById: tenant.userId,
        },
      });

      // Update rate's legacy column if this version is currently effective
      const now = new Date();
      if (candidate.effectiveFrom <= now && (!candidate.effectiveTo || now < candidate.effectiveTo)) {
        await prisma.taxRate.update({
          where: { id: taxRateId },
          data: { rate: new Prisma.Decimal(ratePercent) },
        });
      }

      await prisma.auditLog.create({
        data: {
          businessId: tenant.businessId,
          userId: tenant.userId,
          action: "CREATE",
          entity: "TaxRateVersion",
          entityId: version.id,
          newValue: {
            ratePercent: Number(version.ratePercent),
            effectiveFrom: version.effectiveFrom,
          },
          metadata: { taxRateName: rate.name },
        },
      });

      return NextResponse.json({ success: true, version });
    }

    // CREATE NEW TAX RATE
    const { name, code, rate, treatment = "STANDARD_RATED", isDefault = false, description, legalReference, effectiveFrom } = body;
    if (!name || rate === undefined) {
      return NextResponse.json({ error: "Name and rate are required" }, { status: 400 });
    }

    if (isDefault) {
      await prisma.taxRate.updateMany({
        where: { businessId: tenant.businessId },
        data: { isDefault: false },
      });
    }

    const effDate = effectiveFrom ? new Date(effectiveFrom) : new Date("2024-01-01");

    const newRate = await prisma.taxRate.create({
      data: {
        businessId: tenant.businessId,
        name,
        code: code || null,
        rate: new Prisma.Decimal(rate),
        treatment: treatment as TaxTreatment,
        isDefault,
        description: description || null,
        legalReference: legalReference || null,
        versions: {
          create: {
            businessId: tenant.businessId,
            ratePercent: new Prisma.Decimal(rate),
            effectiveFrom: effDate,
            note: "Initial version",
            createdById: tenant.userId,
          },
        },
      },
      include: { versions: true },
    });

    await prisma.auditLog.create({
      data: {
        businessId: tenant.businessId,
        userId: tenant.userId,
        action: "CREATE",
        entity: "TaxRate",
        entityId: newRate.id,
        newValue: {
          name: newRate.name,
          rate: Number(newRate.rate),
          treatment: newRate.treatment,
        },
      },
    });

    return NextResponse.json({ success: true, rate: newRate });
  } catch (error) {
    console.error("POST tax rates error:", error);
    return toErrorResponse(error);
  }
}
