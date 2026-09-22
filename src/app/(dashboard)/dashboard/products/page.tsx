import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Barcode,
  Edit,
  Trash2,
  Boxes,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { ProductListClient } from "@/components/products/product-list-client";

export const metadata = {
  title: "Products & Catalog | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const tenant = await requireTenant();

  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: {
        businessId: tenant.businessId,
        deletedAt: null,
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        stocks: {
          where: tenant.branchId ? { branchId: tenant.branchId } : undefined,
        },
        barcodes: true,
        serialNumbers: {
          where: { status: "IN_STOCK" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serialize Prisma Decimals for client component
  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode || p.barcodes[0]?.barcode || "",
    categoryName: p.category?.name || "Uncategorized",
    categoryId: p.categoryId,
    brandName: p.brand?.name || "Generic",
    brandId: p.brandId,
    costPrice: Number(p.costPrice),
    retailPrice: Number(p.retailPrice),
    reorderLevel: p.reorderLevel,
    isSerialTracked: p.isSerialTracked,
    warrantyMonths: p.warrantyMonths || 0,
    warrantyType: p.warrantyType,
    stockQuantity: p.stocks.reduce((sum, s) => sum + s.quantity, 0),
    inStockSerialsCount: p.serialNumbers.length,
    isActive: p.isActive,
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const serializedBrands = brands.map((b) => ({
    id: b.id,
    name: b.name,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products & Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Manage your master inventory items, retail prices, barcodes, and serial warranties.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/products/categories"
            className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-colors"
          >
            <Boxes className="h-4 w-4 text-muted-foreground" />
            Categories
          </Link>

          <Link
            href="/dashboard/products/brands"
            className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-colors"
          >
            <Tag className="h-4 w-4 text-muted-foreground" />
            Brands
          </Link>

          <Link
            href="/dashboard/products/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </div>
      </div>

      {/* Interactive Client Table */}
      <ProductListClient
        initialProducts={serializedProducts}
        categories={serializedCategories}
        brands={serializedBrands}
      />
    </div>
  );
}
