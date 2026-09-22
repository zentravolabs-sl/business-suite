"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Search,
  AlertTriangle,
  ScrollText,
  Building2,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { StockAdjustmentModal } from "./stock-adjustment-modal";

interface ProductStockItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string;
  categoryName: string;
  brandName: string;
  costPrice: number;
  retailPrice: number;
  reorderLevel: number;
  isSerialTracked: boolean;
  stocks: {
    branchId: string;
    branchName: string;
    quantity: number;
  }[];
}

interface BranchItem {
  id: string;
  name: string;
}

export function InventoryClient({
  initialProducts,
  branches,
}: {
  initialProducts: ProductStockItem[];
  branches: BranchItem[];
}) {
  const [products] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Selected product for adjustment modal
  const [adjustingProduct, setAdjustingProduct] = useState<{
    id: string;
    name: string;
    sku: string | null;
    currentStock: number;
    branchId: string;
    branchName: string;
  } | null>(null);

  // Calculations
  const getProductStock = (p: ProductStockItem) => {
    if (selectedBranch === "ALL") {
      return p.stocks.reduce((sum, s) => sum + s.quantity, 0);
    }
    const branchStock = p.stocks.find((s) => s.branchId === selectedBranch);
    return branchStock ? branchStock.quantity : 0;
  };

  const filtered = products.filter((p) => {
    const stock = getProductStock(p);
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      p.barcode.includes(search);

    const matchesLowStock = !filterLowStock || stock <= p.reorderLevel;

    return matchesSearch && matchesLowStock;
  });

  // KPI Metrics
  const totalUnits = products.reduce((acc, p) => acc + getProductStock(p), 0);
  const totalCostValue = products.reduce(
    (acc, p) => acc + getProductStock(p) * p.costPrice,
    0
  );
  const totalRetailValue = products.reduce(
    (acc, p) => acc + getProductStock(p) * p.retailPrice,
    0
  );
  const lowStockCount = products.filter(
    (p) => getProductStock(p) <= p.reorderLevel
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory & Stock Control</h1>
          <p className="text-sm text-muted-foreground">
            Multi-branch real-time stock levels, inventory audits, and valuation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/inventory/movements"
            className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-colors"
          >
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            Stock Movements Log
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Stock Units
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold">{totalUnits} units</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Across {selectedBranch === "ALL" ? "all branches" : "selected branch"}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Stock Cost Valuation
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold">{formatCurrency(totalCostValue)}</div>
          <div className="mt-1 text-xs text-muted-foreground">At supplier cost</div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Retail Valuation
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold">{formatCurrency(totalRetailValue)}</div>
          <div className="mt-1 text-xs text-emerald-500 font-medium">
            Margin: {formatCurrency(totalRetailValue - totalCostValue)}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Low Stock Items
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-amber-600">{lowStockCount} items</div>
          <div className="mt-1 text-xs text-muted-foreground">At or below reorder level</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name, SKU, or barcode..."
            className="w-full rounded-xl border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Branch Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border bg-background px-3 py-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              aria-label="Filter by branch"
              className="bg-transparent text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

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
            Low Stock ({lowStockCount})
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Product & SKU</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Retail Price</th>
                <th className="px-5 py-3.5">Cost Price</th>
                <th className="px-5 py-3.5">Stock Level</th>
                <th className="px-5 py-3.5">Total Valuation</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Boxes className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">No items found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const qty = getProductStock(item);
                  const isLow = qty <= item.reorderLevel;
                  const isOut = qty === 0;

                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.sku || "No SKU"}</div>
                      </td>

                      <td className="px-5 py-4 text-xs font-medium text-muted-foreground">
                        {item.categoryName}
                      </td>

                      <td className="px-5 py-4 font-semibold text-primary">
                        {formatCurrency(item.retailPrice)}
                      </td>

                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {formatCurrency(item.costPrice)}
                      </td>

                      <td className="px-5 py-4">
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
                          {qty} units
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs font-semibold">
                        {formatCurrency(qty * item.retailPrice)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => {
                            const currentBranch =
                              selectedBranch !== "ALL"
                                ? branches.find((b) => b.id === selectedBranch)
                                : branches[0];
                            setAdjustingProduct({
                              id: item.id,
                              name: item.name,
                              sku: item.sku,
                              currentStock: qty,
                              branchId: currentBranch?.id || "",
                              branchName: currentBranch?.name || "",
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted transition-colors"
                        >
                          <SlidersHorizontal className="h-3 w-3" />
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Dialog */}
      {adjustingProduct && (
        <StockAdjustmentModal
          open={!!adjustingProduct}
          onOpenChange={(open) => !open && setAdjustingProduct(null)}
          product={adjustingProduct}
          branches={branches}
        />
      )}
    </div>
  );
}
