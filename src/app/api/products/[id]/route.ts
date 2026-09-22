import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const product = await prisma.product.findFirst({
      where: {
        id,
        businessId: tenant.businessId,
        deletedAt: null,
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        stocks: {
          include: { branch: true },
        },
        barcodes: true,
        serialNumbers: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.product.findFirst({
      where: { id, businessId: tenant.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        sku: body.sku,
        barcode: body.barcode || null,
        categoryId: body.categoryId || null,
        brandId: body.brandId || null,
        unitId: body.unitId || null,
        description: body.description || null,
        costPrice: body.costPrice !== undefined ? body.costPrice : undefined,
        retailPrice: body.retailPrice !== undefined ? body.retailPrice : undefined,
        wholesalePrice: body.wholesalePrice || null,
        vipPrice: body.vipPrice || null,
        minSellingPrice: body.minSellingPrice || null,
        reorderLevel: body.reorderLevel !== undefined ? body.reorderLevel : undefined,
        isSerialTracked: body.isSerialTracked !== undefined ? body.isSerialTracked : undefined,
        warrantyMonths: body.warrantyMonths !== undefined ? body.warrantyMonths : undefined,
        warrantyType: body.warrantyType || undefined,
        warrantyTerms: body.warrantyTerms || null,
        isQuickProduct: body.isQuickProduct !== undefined ? body.isQuickProduct : undefined,
        onlineVisible: body.onlineVisible !== undefined ? body.onlineVisible : undefined,
      },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // Soft delete
    await prisma.product.updateMany({
      where: { id, businessId: tenant.businessId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
