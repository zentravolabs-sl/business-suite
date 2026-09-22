import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const productCreateSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  description: z.string().optional(),
  costPrice: z.coerce.number().min(0, "Cost price must be 0 or more"),
  retailPrice: z.coerce.number().min(0, "Retail price must be 0 or more"),
  wholesalePrice: z.coerce.number().min(0).optional().nullable(),
  vipPrice: z.coerce.number().min(0).optional().nullable(),
  minSellingPrice: z.coerce.number().min(0).optional().nullable(),
  reorderLevel: z.coerce.number().int().min(0).default(5),
  isSerialTracked: z.boolean().default(false),
  isBatchTracked: z.boolean().default(false),
  warrantyMonths: z.coerce.number().int().min(0).default(0),
  warrantyType: z.enum(["MANUFACTURER", "SELLER", "SERVICE", "EXTENDED"]).default("SELLER"),
  warrantyTerms: z.string().optional(),
  isQuickProduct: z.boolean().default(false),
  onlineVisible: z.boolean().default(true),
  initialStock: z.coerce.number().int().min(0).default(0),
  branchId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const categoryId = searchParams.get("categoryId");
    const brandId = searchParams.get("brandId");
    const lowStock = searchParams.get("lowStock") === "true";
    const quickOnly = searchParams.get("quickOnly") === "true";
    const branchId = searchParams.get("branchId") || tenant.branchId;

    const where: any = {
      businessId: tenant.businessId,
      deletedAt: null,
      isActive: true,
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (brandId) {
      where.brandId = brandId;
    }

    if (quickOnly) {
      where.isQuickProduct = true;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
        unit: true,
        stocks: branchId
          ? { where: { branchId } }
          : true,
        barcodes: true,
        serialNumbers: {
          where: { status: "IN_STOCK" },
        },
      },
      orderBy: { name: "asc" },
      take: 100,
    });

    let result = products;
    if (lowStock) {
      result = products.filter((p) => {
        const totalStock = p.stocks.reduce((acc, s) => acc + s.quantity, 0);
        return totalStock <= p.reorderLevel;
      });
    }

    return NextResponse.json({ products: result });
  } catch (error: any) {
    console.error("Products GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = productCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Generate SKU if missing
    let sku = data.sku;
    if (!sku) {
      const count = await prisma.product.count({
        where: { businessId: tenant.businessId },
      });
      sku = `PRD-${String(count + 1).padStart(5, "0")}`;
    }

    // Target branch
    const branchId = data.branchId || tenant.branchId;

    const product = await prisma.$transaction(async (tx) => {
      // 1. Create Product
      const newProduct = await tx.product.create({
        data: {
          businessId: tenant.businessId,
          name: data.name,
          sku,
          barcode: data.barcode || null,
          categoryId: data.categoryId || null,
          brandId: data.brandId || null,
          unitId: data.unitId || null,
          description: data.description || null,
          costPrice: data.costPrice,
          retailPrice: data.retailPrice,
          wholesalePrice: data.wholesalePrice || null,
          vipPrice: data.vipPrice || null,
          minSellingPrice: data.minSellingPrice || null,
          reorderLevel: data.reorderLevel,
          isSerialTracked: data.isSerialTracked,
          isBatchTracked: data.isBatchTracked,
          warrantyMonths: data.warrantyMonths,
          warrantyType: data.warrantyType,
          warrantyTerms: data.warrantyTerms || null,
          isQuickProduct: data.isQuickProduct,
          onlineVisible: data.onlineVisible,
          isActive: true,
        },
      });

      // 2. Barcode
      if (data.barcode) {
        await tx.barcode.create({
          data: {
            productId: newProduct.id,
            barcode: data.barcode,
            type: "EAN13",
          },
        });
      }

      // 3. Initial Stock
      if (branchId && data.initialStock > 0) {
        await tx.stock.create({
          data: {
            businessId: tenant.businessId,
            branchId,
            productId: newProduct.id,
            quantity: data.initialStock,
          },
        });

        await tx.stockMovement.create({
          data: {
            businessId: tenant.businessId,
            branchId,
            productId: newProduct.id,
            type: "OPENING_STOCK",
            quantity: data.initialStock,
            quantityBefore: 0,
            quantityAfter: data.initialStock,
            unitCost: data.costPrice,
            notes: "Initial inventory during product setup",
            userId: tenant.userId,
          },
        });
      }

      return newProduct;
    });

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error("Product create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
