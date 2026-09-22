"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  AlertTriangle,
  Barcode,
  Edit,
  Trash2,
  Boxes,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProductItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string;
  categoryName: string;
  categoryId: string | null;
  brandName: string;
  brandId: string | null;
  costPrice: number;
  retailPrice: number;
  reorderLevel: number;
  isSerialTracked: boolean;
  warrantyMonths: number;
  warrantyType: string | null;
  stockQuantity: number;
  inStockSerialsCount: number;
  isActive: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface BrandItem {
  id: string;
  name: string;
}

export function ProductListClient({
  initialProducts,
  categories,
  brands,
}: {
  initialProducts: ProductItem[];
  categories: CategoryItem[];
  brands: BrandItem[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Filter products
  const filtered = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search));

    const matchesCat = selectedCategory === "ALL" || p.categoryId === selectedCategory;
    const matchesBrand = selectedBrand === "ALL" || p.brandId === selectedBrand;
    const matchesLowStock = !filterLowStock || p.stockQuantity <= p.reorderLevel;

    return matchesSearch && matchesCat && matchesBrand && matchesLowStock;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete product");

      toast.success(`"${name}" was deleted successfully`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete product");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name, SKU, or barcode..."
            className="w-full rounded-xl border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="rounded-xl border bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Brand Filter */}
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            aria-label="Filter by brand"
            className="rounded-xl border bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Low Stock Filter Button */}
          <button
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
              filterLowStock
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                : "bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Low Stock Only
          </button>
        </div>
      </div>

      {/* Product List Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Product & SKU</th>
                <th className="px-5 py-3.5">Category & Brand</th>
                <th className="px-5 py-3.5">Selling Price</th>
                <th className="px-5 py-3.5">Cost Price</th>
                <th className="px-5 py-3.5">Current Stock</th>
                <th className="px-5 py-3.5">Warranty</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Boxes className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">No products found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Try adjusting your search query or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isLow = item.stockQuantity <= item.reorderLevel;
                  const isOut = item.stockQuantity === 0;

                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      {/* Product Name & SKU */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">{item.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span>{item.sku || "No SKU"}</span>
                          {item.barcode && (
                            <span className="flex items-center gap-0.5 font-mono text-[11px]">
                              <Barcode className="h-3 w-3" />
                              {item.barcode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category & Brand */}
                      <td className="px-5 py-4">
                        <div className="text-xs font-medium text-foreground">
                          {item.categoryName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{item.brandName}</div>
                      </td>

                      {/* Selling Price */}
                      <td className="px-5 py-4 font-semibold text-primary">
                        {formatCurrency(item.retailPrice)}
                      </td>

                      {/* Cost Price */}
                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {formatCurrency(item.costPrice)}
                      </td>

                      {/* Current Stock */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold",
                              isOut
                                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                : isLow
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            )}
                          >
                            {isOut ? (
                              <XCircle className="h-3 w-3" />
                            ) : isLow ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {item.stockQuantity} in stock
                          </span>
                        </div>
                        {item.isSerialTracked && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {item.inStockSerialsCount} tracked serials
                          </div>
                        )}
                      </td>

                      {/* Warranty */}
                      <td className="px-5 py-4">
                        {item.warrantyMonths > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {item.warrantyMonths}m {item.warrantyType?.toLowerCase()}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No Warranty</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/products/${item.id}/edit`}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Edit Product"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
