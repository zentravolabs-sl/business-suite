"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Barcode,
  Boxes,
  DollarSign,
  ShieldCheck,
  Globe,
  Sparkles,
  ArrowLeft,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface ProductFormProps {
  categories: Category[];
  brands: Brand[];
  initialData?: any;
  isEdit?: boolean;
}

export function ProductForm({
  categories,
  brands,
  initialData,
  isEdit = false,
}: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    sku: initialData?.sku || "",
    barcode: initialData?.barcode || "",
    categoryId: initialData?.categoryId || "",
    brandId: initialData?.brandId || "",
    description: initialData?.description || "",
    costPrice: initialData?.costPrice ? Number(initialData.costPrice) : 0,
    retailPrice: initialData?.retailPrice ? Number(initialData.retailPrice) : 0,
    wholesalePrice: initialData?.wholesalePrice ? Number(initialData.wholesalePrice) : 0,
    vipPrice: initialData?.vipPrice ? Number(initialData.vipPrice) : 0,
    minSellingPrice: initialData?.minSellingPrice ? Number(initialData.minSellingPrice) : 0,
    reorderLevel: initialData?.reorderLevel ?? 5,
    isSerialTracked: initialData?.isSerialTracked ?? false,
    warrantyMonths: initialData?.warrantyMonths ?? 12,
    warrantyType: initialData?.warrantyType || "SELLER",
    warrantyTerms: initialData?.warrantyTerms || "",
    isQuickProduct: initialData?.isQuickProduct ?? true,
    onlineVisible: initialData?.onlineVisible ?? true,
    initialStock: 10, // opening stock for new product
  });

  const update = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const generateBarcode = () => {
    // Generate an EAN-13 like numeric code
    const random12 = "20" + Math.floor(1000000000 + Math.random() * 9000000000).toString();
    update("barcode", random12);
    toast.success("Generated Barcode: " + random12);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (formData.retailPrice < 0) {
      toast.error("Retail price cannot be negative");
      return;
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/products/${initialData.id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save product");

      toast.success(
        isEdit ? "Product updated successfully!" : "Product created and stocked!"
      );
      router.push("/dashboard/products");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header & Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/products"
            className="rounded-xl border p-2 hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEdit ? "Edit Product" : "New Master Product"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? "Update pricing, warranty, and barcode specifications."
                : "Create a new inventory item with pricing, barcode, and initial stock."}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {loading ? "Saving..." : isEdit ? "Update Product" : "Save & Add Stock"}
        </button>
      </div>

      {/* Card 1: Basic Information */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Package className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Basic Identification
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Product Title / Model Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Samsung Galaxy S24 Ultra 512GB Titanium Gray"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              SKU (Stock Keeping Unit)
            </label>
            <input
              type="text"
              value={formData.sku}
              onChange={(e) => update("sku", e.target.value)}
              placeholder="Auto-generated if blank (e.g. PRD-00042)"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Barcode / EAN
              </label>
              <button
                type="button"
                onClick={generateBarcode}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" /> Auto-Generate
              </button>
            </div>
            <div className="relative mt-1.5">
              <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => update("barcode", e.target.value)}
                placeholder="Scan with barcode gun or type number"
                className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Category
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => update("categoryId", e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Select Category --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Brand / Manufacturer
            </label>
            <select
              value={formData.brandId}
              onChange={(e) => update("brandId", e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Select Brand --</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description / Notes
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Product specs, features, or shelf location notes..."
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Card 2: Pricing Tiers (in LKR) */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <DollarSign className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Pricing Structure (Sri Lankan Rupee - LKR)
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Retail Selling Price (Rs.) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={formData.retailPrice}
              onChange={(e) => update("retailPrice", parseFloat(e.target.value) || 0)}
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Purchase Cost Price (Rs.)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.costPrice}
              onChange={(e) => update("costPrice", parseFloat(e.target.value) || 0)}
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Wholesale Price (Rs.)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.wholesalePrice}
              onChange={(e) => update("wholesalePrice", parseFloat(e.target.value) || 0)}
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Card 3: Stock & Tracking Settings */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Boxes className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Stock Thresholds & Tracking
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Initial Opening Stock Quantity
              </label>
              <input
                type="number"
                min="0"
                value={formData.initialStock}
                onChange={(e) => update("initialStock", parseInt(e.target.value) || 0)}
                className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Stock will be added to your current active branch.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Low Stock Reorder Alert Level
            </label>
            <input
              type="number"
              min="0"
              value={formData.reorderLevel}
              onChange={(e) => update("reorderLevel", parseInt(e.target.value) || 0)}
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Warning triggered when inventory drops to or below this level.
            </p>
          </div>

          <div className="sm:col-span-2 pt-2 border-t">
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
              <div>
                <div className="text-xs font-semibold">Track Individual Serial Numbers (IMEI / S/N)</div>
                <div className="text-[11px] text-muted-foreground">
                  Essential for mobile phones, laptops, and electronics requiring unique warranty claim tracking.
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.isSerialTracked}
                onChange={(e) => update("isSerialTracked", e.target.checked)}
                className="h-5 w-5 rounded border-muted-foreground text-primary focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card 4: Warranty & POS Shortcuts */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <ShieldCheck className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Warranty & POS Configuration
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Warranty Duration (Months)
            </label>
            <input
              type="number"
              min="0"
              value={formData.warrantyMonths}
              onChange={(e) => update("warrantyMonths", parseInt(e.target.value) || 0)}
              placeholder="e.g. 12 or 24 (0 = No warranty)"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Warranty Type
            </label>
            <select
              value={formData.warrantyType}
              onChange={(e) => update("warrantyType", e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="SELLER">Seller / Company Warranty</option>
              <option value="MANUFACTURER">Manufacturer / Brand Warranty</option>
              <option value="SERVICE">Service Only Warranty</option>
              <option value="EXTENDED">Extended Warranty</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4 pt-2 border-t">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isQuickProduct}
                onChange={(e) => update("isQuickProduct", e.target.checked)}
                className="h-4 w-4 rounded text-primary"
              />
              <span className="text-xs font-medium">
                Add to POS Quick-Access Grid
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.onlineVisible}
                onChange={(e) => update("onlineVisible", e.target.checked)}
                className="h-4 w-4 rounded text-primary"
              />
              <span className="text-xs font-medium">
                Visible on Online E-Commerce Store
              </span>
            </label>
          </div>
        </div>
      </div>
    </form>
  );
}
