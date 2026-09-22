"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Package,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  costPrice: number;
}

interface POItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

export function POForm({
  suppliers,
  branches,
  products,
}: {
  suppliers: Supplier[];
  branches: Branch[];
  products: Product[];
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItem[]>([
    {
      productId: products[0]?.id || "",
      productName: products[0]?.name || "",
      quantity: 10,
      unitCost: products[0]?.costPrice || 0,
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleProductChange = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === index
          ? {
              ...it,
              productId,
              productName: prod?.name || "",
              unitCost: prod?.costPrice || 0,
            }
          : it
      )
    );
  };

  const handleQuantityChange = (index: number, qty: number) => {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, quantity: Math.max(1, qty) } : it))
    );
  };

  const handleCostChange = (index: number, cost: number) => {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, unitCost: Math.max(0, cost) } : it))
    );
  };

  const addItem = () => {
    const firstProd = products[0];
    setItems((prev) => [
      ...prev,
      {
        productId: firstProd?.id || "",
        productName: firstProd?.name || "",
        quantity: 5,
        unitCost: firstProd?.costPrice || 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const total = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/purchases/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          branchId,
          expectedDate: expectedDate || null,
          notes,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitCost: it.unitCost,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create PO");

      toast.success(`Purchase Order created successfully`);
      router.push("/dashboard/purchases/orders");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/purchases/orders"
            className="rounded-xl border p-2 hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Purchase Order</h1>
            <p className="text-xs text-muted-foreground">
              Draft a formal procurement order to send to your vendor.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {loading ? "Creating..." : "Save & Issue PO"}
        </button>
      </div>

      {/* Header Info */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Supplier *
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Delivery Destination Branch *
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Ordered Products
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-3 items-center rounded-xl border bg-muted/10 p-3"
            >
              <div className="col-span-12 sm:col-span-6">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Product
                </label>
                <select
                  value={item.productId}
                  onChange={(e) => handleProductChange(index, e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-4 sm:col-span-2">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Qty
                </label>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                  className="mt-1 w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs font-bold text-center"
                />
              </div>

              <div className="col-span-5 sm:col-span-2">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Unit Cost (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitCost}
                  onChange={(e) => handleCostChange(index, parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs font-bold"
                />
              </div>

              <div className="col-span-3 sm:col-span-2 flex items-center justify-between pt-3">
                <div className="text-right flex-1 font-bold text-xs">
                  {formatCurrency(item.quantity * item.unitCost)}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-1.5 text-muted-foreground hover:text-destructive ml-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Total Summary */}
        <div className="border-t pt-4 flex justify-between items-center text-sm">
          <div className="text-muted-foreground text-xs">
            {items.length} product line{items.length > 1 ? "s" : ""}
          </div>
          <div className="text-right">
            <span className="text-muted-foreground text-xs mr-2">Estimated PO Total:</span>
            <span className="text-xl font-extrabold text-primary">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </form>
  );
}
