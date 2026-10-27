import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import type { TaxTreatment } from "@/lib/tax/constants";
import { toErrorResponse } from "@/lib/tax/errors";

export async function GET() {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let categories = await prisma.taxCategory.findMany({
      where: { businessId: tenant.businessId },
      include: {
        taxRate: true,
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Auto-seed default tax categories if none exist
    if (categories.length === 0) {
      const defaultRate = await prisma.taxRate.findFirst({
        where: { businessId: tenant.businessId, isDefault: true },
      });

      const seeds: Array<{
        name: string;
        code: string;
        treatment: TaxTreatment;
        taxRateId: string | null;
        isDefault: boolean;
        description: string;
      }> = [
        {
          name: "Standard Rated Goods & Services",
          code: "STD",
          treatment: "STANDARD_RATED",
          taxRateId: defaultRate?.id || null,
          isDefault: true,
          description: "Standard VAT supplies subject to prevailing standard rate (e.g. 18%)",
        },
        {
          name: "Zero-Rated Supplies",
          code: "ZERO",
          treatment: "ZERO_RATED",
          taxRateId: null,
          isDefault: false,
          description: "Supplies taxed at 0% with input tax deduction rights (e.g. direct exports)",
        },
        {
          name: "Exempt Supplies",
          code: "EXEMPT",
          treatment: "EXEMPT",
          taxRateId: null,
          isDefault: false,
          description: "Supplies exempt under First Schedule to the VAT Act (no tax charged, no input credit)",
        },
        {
          name: "Out of Scope Supplies",
          code: "OOS",
          treatment: "OUT_OF_SCOPE",
          taxRateId: null,
          isDefault: false,
          description: "Non-taxable activities or supplies made by non-registered businesses",
        },
      ];

      for (const s of seeds) {
        await prisma.taxCategory.create({
          data: {
            businessId: tenant.businessId,
            name: s.name,
            code: s.code,
            treatment: s.treatment,
            taxRateId: s.taxRateId,
            isDefault: s.isDefault,
            description: s.description,
          },
        });
      }

      categories = await prisma.taxCategory.findMany({
        where: { businessId: tenant.businessId },
        include: {
          taxRate: true,
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json({ categories });
  } catch (error) {
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
    const { id, name, code, treatment, taxRateId, description, legalReference, isDefault } = body;

    if (!name || !code || !treatment) {
      return NextResponse.json({ error: "Name, code, and tax treatment are required" }, { status: 400 });
    }

    if (isDefault) {
      await prisma.taxCategory.updateMany({
        where: { businessId: tenant.businessId },
        data: { isDefault: false },
      });
    }

    if (id) {
      const updated = await prisma.taxCategory.update({
        where: { id },
        data: {
          name,
          code: code.trim().toUpperCase(),
          treatment,
          taxRateId: taxRateId || null,
          description: description || null,
          legalReference: legalReference || null,
          isDefault: !!isDefault,
        },
      });
      return NextResponse.json({ success: true, category: updated });
    }

    const created = await prisma.taxCategory.create({
      data: {
        businessId: tenant.businessId,
        name,
        code: code.trim().toUpperCase(),
        treatment,
        taxRateId: taxRateId || null,
        description: description || null,
        legalReference: legalReference || null,
        isDefault: !!isDefault,
      },
    });

    return NextResponse.json({ success: true, category: created });
  } catch (error) {
    return toErrorResponse(error);
  }
}
