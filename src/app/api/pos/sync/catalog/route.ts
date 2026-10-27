import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || tenant.branchId;

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    const [products, categories, customers, business] = await Promise.all([
      prisma.product.findMany({
        where: {
          businessId: tenant.businessId,
          deletedAt: null,
          isActive: true,
        },
        include: {
          category: true,
          stocks: {
            where: { branchId },
          },
          barcodes: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.category.findMany({
        where: { businessId: tenant.businessId, isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.customer.findMany({
        where: { businessId: tenant.businessId, deletedAt: null },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          tin: true,
          vatRegistrationNumber: true,
          isVatRegistered: true,
          creditLimit: true,
          creditBalance: true,
          address: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.business.findUnique({
        where: { id: tenant.businessId },
        select: {
          id: true,
          name: true,
          legalName: true,
          taxEnabled: true,
          taxInclusive: true,
          allowNegativeStock: true,
          invoicePrefix: true,
          receiptPrefix: true,
        },
      }),
    ]);

    const serializedProducts = products.map((p) => {
      const stock = p.stocks.find((s) => s.branchId === branchId);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || p.barcodes[0]?.barcode || "",
        categoryId: p.categoryId,
        categoryName: p.category?.name || "General",
        costPrice: Number(p.costPrice),
        retailPrice: Number(p.retailPrice),
        stockQuantity: stock?.quantity || 0,
        isSerialTracked: p.isSerialTracked,
        warrantyMonths: p.warrantyMonths || 0,
        pricesIncludeTax: business?.taxInclusive ?? false,
      };
    });

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      business,
      products: serializedProducts,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      customers: customers.map((cust) => ({
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        email: cust.email,
        tin: cust.tin,
        vatRegistrationNumber: cust.vatRegistrationNumber,
        isVatRegistered: cust.isVatRegistered,
        creditLimit: Number(cust.creditLimit || 0),
        creditBalance: Number(cust.creditBalance || 0),
        address: cust.address,
      })),
    });
  } catch (error: any) {
    console.error("POS Catalog Sync Error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync catalog" }, { status: 500 });
  }
}
