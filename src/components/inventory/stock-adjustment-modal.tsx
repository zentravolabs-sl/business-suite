"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, X } from "lucide-react";
import { toast } from "sonner";

interface StockAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    sku: string | null;
    currentStock: number;
    branchId: string;
    branchName: string;
  };
  branches: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function StockAdjustmentModal({
  open,
  onOpenChange,
  product,
  branches,
  onSuccess,
}: StockAdjustmentModalProps) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(product.branchId || branches[0]?.id || "");
  const [type, setType] = useState<"ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGE" | "EXPIRY_WRITE_OFF">("ADJUSTMENT_IN");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      toast.error("Quantity must be at least 1");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          branchId,
          type,
          quantity,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to adjust stock");

      toast.success("Stock adjustment recorded successfully");
      onOpenChange(false);
      if (onSuccess) onSuccess();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="fixed inset-0" onClick={() => onOpenChange(false)} />

      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-base font-bold">Adjust Inventory Stock</h2>
            <p className="text-xs text-muted-foreground">{product.name}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Adjustment Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ADJUSTMENT_IN">Stock In / Correction (Increase +)</option>
              <option value="ADJUSTMENT_OUT">Stock Out / Discrepancy (Decrease -)</option>
              <option value="DAMAGE">Damaged Goods (Decrease -)</option>
              <option value="EXPIRY_WRITE_OFF">Expired / Write-Off (Decrease -)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Quantity to Adjust
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Reason / Audit Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Physical stock count check, damaged during transit..."
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border px-3.5 py-2 text-xs font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {loading ? "Recording..." : "Apply Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
