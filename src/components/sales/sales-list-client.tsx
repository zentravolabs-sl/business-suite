"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  Building2,
  Printer,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { toast } from "sonner";
import { ThermalReceiptModal } from "@/components/pos/thermal-receipt-modal";

interface SaleItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  serialNumber: string | null;
  warrantyMonths: number;
}

interface SaleRecord {
  id: string;
  invoiceNumber: string;
  receiptNumber: string | null;
  branchName: string;
  branchId: string;
  customerName: string;
  cashierName: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  status: string;
  createdAt: string;
  payments: { method: string; amount: number; reference: string | null }[];
  items: SaleItem[];
}

interface SalesListClientProps {
  initialSales: SaleRecord[];
  branches: { id: string; name: string }[];
  businessInfo: {
    name: string;
    legalName?: string;
    address?: string;
    phone?: string;
    vatNumber?: string;
    receiptHeader?: string;
    receiptFooter?: string;
  };
}

export function SalesListClient({
  initialSales,
  branches,
  businessInfo,
}: SalesListClientProps) {
  const router = useRouter();
  const [sales, setSales] = useState(initialSales);
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Selected sale for detail modal
  const [activeSale, setActiveSale] = useState<SaleRecord | null>(null);
  const [receiptSale, setReceiptSale] = useState<any | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);

  const filtered = sales.filter((s) => {
    const matchesSearch =
      !search ||
      s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (s.receiptNumber && s.receiptNumber.toLowerCase().includes(search.toLowerCase())) ||
      s.customerName.toLowerCase().includes(search.toLowerCase());

    const matchesBranch = selectedBranch === "ALL" || s.branchId === selectedBranch;
    const matchesStatus = selectedStatus === "ALL" || s.status === selectedStatus;

    return matchesSearch && matchesBranch && matchesStatus;
  });

  const handleRefund = async (sale: SaleRecord) => {
    if (!confirm(`Are you sure you want to process a full refund for Invoice #${sale.invoiceNumber}? Stock will be restocked.`)) {
      return;
    }

    setRefundLoading(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Customer Return & Refund", restock: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");

      toast.success(`Invoice #${sale.invoiceNumber} refunded and stock replenished`);
      setSales((prev) =>
        prev.map((s) => (s.id === sale.id ? { ...s, status: "REFUNDED" } : s))
      );
      if (activeSale?.id === sale.id) {
        setActiveSale((prev) => (prev ? { ...prev, status: "REFUNDED" } : null));
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to refund");
    } finally {
      setRefundLoading(false);
    }
  };

  const openReceiptModal = (s: SaleRecord) => {
    setReceiptSale({
      ...s,
      businessName: businessInfo.name,
      legalName: businessInfo.legalName,
      address: businessInfo.address,
      phone: businessInfo.phone,
      vatNumber: businessInfo.vatNumber,
      receiptHeader: businessInfo.receiptHeader,
      receiptFooter: businessInfo.receiptFooter,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sales & Tax Invoices</h1>
        <p className="text-sm text-muted-foreground">
          View all POS transactions, reprint thermal receipts, and process returns.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number, receipt, or customer..."
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

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Invoice #</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Branch</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Total Amount</th>
                <th className="px-5 py-3.5">Payment</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No sales transactions found.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-xs">{s.invoiceNumber}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(s.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium">{s.branchName}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{s.customerName}</td>
                    <td className="px-5 py-3.5 font-extrabold text-xs text-primary">
                      {formatCurrency(s.total)}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {s.payments.map((p) => p.method).join(", ") || "Cash"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                          s.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-500 border border-red-500/20"
                        )}
                      >
                        {s.status === "COMPLETED" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setActiveSale(s)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openReceiptModal(s)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Reprint Receipt"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail Drawer Modal */}
      {activeSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setActiveSale(null)} />

          <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h2 className="text-base font-bold">Tax Invoice #{activeSale.invoiceNumber}</h2>
                <p className="text-xs text-muted-foreground">{formatDateTime(activeSale.createdAt)}</p>
              </div>
              <button
                onClick={() => setActiveSale(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Customer & Branch info */}
            <div className="grid grid-cols-2 gap-2 text-xs border rounded-xl p-3 bg-muted/20">
              <div>
                <span className="text-muted-foreground">Customer: </span>
                <span className="font-semibold">{activeSale.customerName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Branch: </span>
                <span className="font-semibold">{activeSale.branchName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Cashier: </span>
                <span className="font-semibold">{activeSale.cashierName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status: </span>
                <span className="font-bold">{activeSale.status}</span>
              </div>
            </div>

            {/* Items */}
            <div className="max-h-60 overflow-y-auto divide-y divide-border text-xs">
              {activeSale.items.map((it) => (
                <div key={it.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{it.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {it.quantity} x {formatCurrency(it.unitPrice)}
                      {it.serialNumber && ` • S/N: ${it.serialNumber}`}
                    </div>
                  </div>
                  <div className="font-bold">{formatCurrency(it.total)}</div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="pt-2 border-t space-y-1 text-xs">
              <div className="flex justify-between text-base font-extrabold">
                <span>Net Total:</span>
                <span className="text-primary">{formatCurrency(activeSale.total)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <button
                type="button"
                onClick={() => openReceiptModal(activeSale)}
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-xs font-bold hover:bg-muted transition-colors"
              >
                <Printer className="h-4 w-4" />
                Reprint Receipt
              </button>

              {activeSale.status === "COMPLETED" && (
                <button
                  type="button"
                  disabled={refundLoading}
                  onClick={() => handleRefund(activeSale)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  {refundLoading ? "Refunding..." : "Process Return / Refund"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Modal */}
      {receiptSale && (
        <ThermalReceiptModal
          open={!!receiptSale}
          onOpenChange={(open) => !open && setReceiptSale(null)}
          sale={receiptSale}
          onNewSale={() => setReceiptSale(null)}
        />
      )}
    </div>
  );
}
