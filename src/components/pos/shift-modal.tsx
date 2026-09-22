"use client";

import { useState } from "react";
import { DollarSign, AlertTriangle, Check, X, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface ShiftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "OPEN" | "CLOSE";
  currentShift?: {
    id: string;
    openedAt: string;
    openingCash: number;
    cashSales: number;
    cardSales: number;
    otherSales: number;
    totalSales: number;
    expectedCash: number;
    salesCount: number;
  } | null;
  branchId: string;
  onSuccess: () => void;
}

export function ShiftModal({
  open,
  onOpenChange,
  mode,
  currentShift,
  branchId,
  onSuccess,
}: ShiftModalProps) {
  const [openingCash, setOpeningCash] = useState(5000);
  const [closingCash, setClosingCash] = useState(currentShift?.expectedCash || 0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/pos/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "OPEN",
          openingCash,
          notes,
          branchId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open shift");

      toast.success("Cashier shift opened successfully! Cash drawer ready.");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/pos/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLOSE",
          closingCash,
          notes,
          branchId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to close shift");

      const diff = data.difference;
      if (diff === 0) {
        toast.success("Shift closed! Drawer reconciled with 0 difference.");
      } else if (diff > 0) {
        toast.info(`Shift closed! Cash overage: +${formatCurrency(diff)}`);
      } else {
        toast.warning(`Shift closed! Cash shortage: ${formatCurrency(diff)}`);
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const expected = currentShift?.expectedCash || 0;
  const difference = closingCash - expected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="fixed inset-0" onClick={() => onOpenChange(false)} />

      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-base font-bold">
              {mode === "OPEN" ? "Open Cashier Shift" : "Close Cashier Shift & Drawer Audit"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {mode === "OPEN"
                ? "Enter starting opening float to enable POS billing."
                : "Count cash in drawer and reconcile total sales."}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "OPEN" ? (
          <form onSubmit={handleOpenShift} className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Opening Cash Drawer Float (Rs.) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={openingCash}
                onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-base font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                The cash placed in the register for giving change (typically Rs. 5,000).
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Opening Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional shift notes..."
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border px-4 py-2 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-md"
              >
                <Check className="h-4 w-4" />
                {loading ? "Opening..." : "Open Drawer & Start POS"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCloseShift} className="space-y-4 pt-4">
            {/* Shift Breakdown */}
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening Float:</span>
                <span className="font-semibold">{formatCurrency(currentShift?.openingCash || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Cash Sales:</span>
                <span className="font-semibold text-emerald-500">
                  +{formatCurrency(currentShift?.cashSales || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Card / QR Sales:</span>
                <span className="font-semibold">
                  {formatCurrency((currentShift?.cardSales || 0) + (currentShift?.otherSales || 0))}
                </span>
              </div>
              <div className="border-t pt-1.5 flex justify-between font-bold">
                <span>Expected Cash in Drawer:</span>
                <span className="text-primary text-sm">{formatCurrency(expected)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Actual Counted Cash in Drawer (Rs.) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={closingCash}
                onChange={(e) => setClosingCash(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Reconciliation Difference Alert */}
            <div
              className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold ${
                difference === 0
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                  : difference > 0
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-600"
                  : "bg-red-500/10 border-red-500/20 text-red-600"
              }`}
            >
              <span>Discrepancy (Counted - Expected):</span>
              <span>
                {difference === 0
                  ? "Balanced (Rs. 0.00)"
                  : difference > 0
                  ? `+${formatCurrency(difference)} Over`
                  : `${formatCurrency(difference)} Short`}
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Closing Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for any over/shortage or handover comments..."
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border px-4 py-2 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-destructive px-5 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 shadow-md"
              >
                <Check className="h-4 w-4" />
                {loading ? "Closing..." : "Reconcile & Close Shift"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
