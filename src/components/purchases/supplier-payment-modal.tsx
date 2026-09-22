"use client";

import { useState } from "react";
import {
  X,
  CreditCard,
  Building2,
  Check,
  AlertCircle,
  Calendar,
  FileText,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

export interface PayableItem {
  id: string;
  grnNumber?: string;
  supplierInvoice?: string;
  supplierName: string;
  supplierId: string;
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate: string | null;
  status: string;
}

export function SupplierPaymentModal({
  payable,
  isOpen,
  onClose,
  onSuccess,
}: {
  payable: PayableItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState<number>(payable?.balance || 0);
  const [method, setMethod] = useState<string>("BANK_TRANSFER");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Sync amount when payable changes
  const [lastPayableId, setLastPayableId] = useState<string | null>(null);
  if (payable && payable.id !== lastPayableId) {
    setLastPayableId(payable.id);
    setAmount(payable.balance);
    setReference("");
    setNotes("");
  }

  if (!isOpen || !payable) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    if (amount > payable.balance + 0.01) {
      toast.error(
        `Amount cannot exceed remaining balance of ${formatCurrency(payable.balance)}`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/purchases/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payableId: payable.id,
          amount,
          method,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment recording failed");

      toast.success(
        `Payment of ${formatCurrency(amount)} recorded for ${payable.supplierName}!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 border border-emerald-500/20">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Record Supplier Payment</h2>
            <p className="text-xs text-muted-foreground">
              Disburse funds and settle vendor payables ledger.
            </p>
          </div>
        </div>

        {/* Invoice / Payable Snapshot */}
        <div className="rounded-xl bg-muted/40 border p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">{payable.supplierName}</span>
            <span className="font-mono text-muted-foreground">
              {payable.grnNumber || "GRN"} {payable.supplierInvoice ? `(${payable.supplierInvoice})` : ""}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
            <div>
              <span className="text-[10px] text-muted-foreground block">Total Invoice</span>
              <span className="font-mono text-xs font-semibold">
                {formatCurrency(payable.amount)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Already Paid</span>
              <span className="font-mono text-xs text-emerald-600 font-semibold">
                {formatCurrency(payable.paidAmount)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">Outstanding Balance</span>
              <span className="font-mono text-xs font-bold text-amber-600">
                {formatCurrency(payable.balance)}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">
                Payment Amount (LKR) *
              </label>
              <button
                type="button"
                onClick={() => setAmount(payable.balance)}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                Pay Full Balance ({formatCurrency(payable.balance)})
              </button>
            </div>
            <input
              type="number"
              min="0.01"
              max={payable.balance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Payment Method *
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Debit / Credit Card</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Reference / Cheque No.
              </label>
              <input
                type="text"
                placeholder="e.g. CHQ-901124 or Ref: RTGS"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Notes / Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Paid via Commercial Bank current account..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || amount <= 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition-all disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {loading ? "Recording..." : `Confirm Payment of ${formatCurrency(amount)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
