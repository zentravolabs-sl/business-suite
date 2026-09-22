"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Clock, Trash2, ArrowRight, X, Play } from "lucide-react";
import { toast } from "sonner";

interface HeldBillsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  onRecallBill: (cartData: any) => void;
}

export function HeldBillsModal({
  open,
  onOpenChange,
  branchId,
  onRecallBill,
}: HeldBillsModalProps) {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/held-bills?branchId=${branchId}`);
      const data = await res.json();
      if (data.heldBills) setBills(data.heldBills);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchBills();
    }
  }, [open, branchId]);

  if (!open) return null;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/pos/held-bills?id=${id}`, { method: "DELETE" });
      setBills((prev) => prev.filter((b) => b.id !== id));
      toast.success("Held bill removed");
    } catch {
      toast.error("Failed to remove bill");
    }
  };

  const handleSelect = (bill: any) => {
    onRecallBill(bill.data);
    onOpenChange(false);
    toast.success(`Recalled: ${bill.name}`);
    // Delete from held bills once recalled
    fetch(`/api/pos/held-bills?id=${bill.id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="fixed inset-0" onClick={() => onOpenChange(false)} />

      <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-base font-bold">Parked / Held Bills</h2>
            <p className="text-xs text-muted-foreground">
              Select a parked customer basket to resume billing.
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-border pt-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading parked bills...</div>
          ) : bills.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No bills currently parked on hold.
            </div>
          ) : (
            bills.map((b) => {
              const items = b.data?.items || [];
              const total = b.data?.total || 0;

              return (
                <div
                  key={b.id}
                  onClick={() => handleSelect(b)}
                  className="flex items-center justify-between p-3.5 hover:bg-muted/30 cursor-pointer rounded-xl transition-colors group"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <span>{b.name}</span>
                      <span className="rounded bg-primary/10 text-primary text-[11px] font-bold px-1.5 py-0.5">
                        {items.length} item{items.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(b.heldAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-sm text-primary">{formatCurrency(total)}</div>
                      <div className="text-[10px] text-muted-foreground">Click to Resume</div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(b.id, e)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-60 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
