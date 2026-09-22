"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Truck,
  ArrowUpDown,
  Filter,
  Eye,
  CreditCard,
  Printer,
  X,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  QrCode,
  Package,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SupplierPaymentModal, PayableItem } from "./supplier-payment-modal";

export interface SerializedPurchaseItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
  serialNumbers: string[];
  batchNumber?: string | null;
  expiryDate?: string | null;
}

export interface SerializedPayment {
  id: string;
  amount: number;
  method: string;
  reference?: string | null;
  paidAt: string;
  notes?: string | null;
}

export interface SerializedPurchase {
  id: string;
  grnNumber: string;
  supplierInvoice?: string | null;
  supplierName: string;
  supplierId: string;
  branchName: string;
  branchId: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balance: number;
  receivedDate: string;
  notes?: string | null;
  items: SerializedPurchaseItem[];
  payments: SerializedPayment[];
  payableId?: string | null;
}

export function GRNListClient({
  initialPurchases,
  suppliers,
  branches,
}: {
  initialPurchases: SerializedPurchase[];
  suppliers: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [purchases, setPurchases] = useState<SerializedPurchase[]>(initialPurchases);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("ALL");
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Detail Modal State
  const [activePurchase, setActivePurchase] = useState<SerializedPurchase | null>(null);

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activePayable, setActivePayable] = useState<PayableItem | null>(null);

  // Filtered purchases
  const filtered = useMemo(() => {
    return purchases.filter((p) => {
      const matchSearch =
        p.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.supplierInvoice &&
          p.supplierInvoice.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.supplierName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchSupplier =
        selectedSupplier === "ALL" || p.supplierId === selectedSupplier;
      const matchBranch = selectedBranch === "ALL" || p.branchId === selectedBranch;

      let matchStatus = true;
      if (selectedStatus === "PAID") {
        matchStatus = p.balance <= 0;
      } else if (selectedStatus === "OUTSTANDING") {
        matchStatus = p.balance > 0;
      }

      return matchSearch && matchSupplier && matchBranch && matchStatus;
    });
  }, [purchases, searchTerm, selectedSupplier, selectedBranch, selectedStatus]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalCount = purchases.length;
    const totalValue = purchases.reduce((sum, p) => sum + p.total, 0);
    const totalOutstanding = purchases.reduce((sum, p) => sum + p.balance, 0);
    const totalPaid = purchases.reduce((sum, p) => sum + p.paidAmount, 0);
    return { totalCount, totalValue, totalOutstanding, totalPaid };
  }, [purchases]);

  const handleOpenPayment = (p: SerializedPurchase) => {
    setActivePayable({
      id: p.payableId || p.id,
      grnNumber: p.grnNumber,
      supplierInvoice: p.supplierInvoice || undefined,
      supplierName: p.supplierName,
      supplierId: p.supplierId,
      amount: p.total,
      paidAmount: p.paidAmount,
      balance: p.balance,
      dueDate: null,
      status: p.balance === 0 ? "PAID" : "PENDING",
    });
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goods Received Notes (GRN)</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track vendor stock intake, supplier invoices, serial tracking, and outstanding payables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/purchases/orders"
            className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors shadow-sm"
          >
            <FileText className="h-4 w-4" /> Purchase Orders
          </Link>
          <Link
            href="/dashboard/purchases/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
          >
            <Plus className="h-4 w-4" /> New GRN
          </Link>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Total GRNs Received
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{stats.totalCount}</span>
            <span className="rounded-full bg-blue-500/10 p-1.5 text-blue-600">
              <Truck className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Total Procurement Value
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono">
              {formatCurrency(stats.totalValue)}
            </span>
            <span className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Paid to Suppliers
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-emerald-600">
              {formatCurrency(stats.totalPaid)}
            </span>
            <span className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Outstanding Payables
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-amber-600">
              {formatCurrency(stats.totalOutstanding)}
            </span>
            <span className="rounded-full bg-amber-500/10 p-1.5 text-amber-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search GRN #, invoice, supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="OUTSTANDING">Outstanding Balance</option>
              <option value="PAID">Fully Settled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">GRN #</th>
                <th className="px-4 py-3">Supplier & Invoice</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Received Date</th>
                <th className="px-4 py-3 text-right">Total (LKR)</th>
                <th className="px-4 py-3 text-right">Paid (LKR)</th>
                <th className="px-4 py-3 text-right">Balance Due</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <Truck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No goods received notes found</p>
                    <p className="text-xs">
                      Try adjusting your filters or create a new GRN.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-4 py-3.5 font-mono font-bold text-foreground">
                      <button
                        onClick={() => setActivePurchase(p)}
                        className="hover:underline text-primary"
                      >
                        {p.grnNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-foreground">{p.supplierName}</div>
                      {p.supplierInvoice ? (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          Inv: {p.supplierInvoice}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          No inv #
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{p.branchName}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {formatDate(p.receivedDate)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold">
                      {formatCurrency(p.total)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-emerald-600 font-semibold">
                      {formatCurrency(p.paidAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono">
                      {p.balance > 0 ? (
                        <span className="font-bold text-amber-600">
                          {formatCurrency(p.balance)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0.00</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {p.balance <= 0 ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
                          Settled
                        </span>
                      ) : p.paidAmount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-500/20">
                          Partial
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-500/20">
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActivePurchase(p)}
                          className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="View GRN Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {p.balance > 0 && (
                          <button
                            onClick={() => handleOpenPayment(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/10 border border-emerald-600/20 px-2.5 py-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                            title="Pay Supplier"
                          >
                            <CreditCard className="h-3 w-3" />
                            Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRN Detail Modal / Drawer */}
      {activePurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl space-y-6">
            <button
              onClick={() => setActivePurchase(null)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-mono">
                    {activePurchase.grnNumber}
                  </h2>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                    {activePurchase.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Received on {formatDate(activePurchase.receivedDate)} at{" "}
                  {activePurchase.branchName}
                </p>
              </div>
            </div>

            {/* Vendor Details */}
            <div className="rounded-xl border bg-muted/30 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Supplier
                </span>
                <span className="font-bold text-foreground">
                  {activePurchase.supplierName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Supplier Invoice
                </span>
                <span className="font-mono font-medium">
                  {activePurchase.supplierInvoice || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Branch
                </span>
                <span className="font-medium">{activePurchase.branchName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Outstanding Balance
                </span>
                <span className="font-mono font-bold text-amber-600">
                  {formatCurrency(activePurchase.balance)}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Items Received (
                {activePurchase.items.length})
              </h3>
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b text-[10px] font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Cost (LKR)</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activePurchase.items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-foreground">
                            {it.productName}
                          </div>
                          {it.serialNumbers && it.serialNumbers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {it.serialNumbers.map((sn, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono"
                                >
                                  <QrCode className="h-2.5 w-2.5 text-primary" />
                                  {sn}
                                </span>
                              ))}
                            </div>
                          )}
                          {it.batchNumber && (
                            <span className="text-[10px] text-muted-foreground mt-0.5 block">
                              Batch: {it.batchNumber}{" "}
                              {it.expiryDate ? `(Exp: ${it.expiryDate.split("T")[0]})` : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {formatCurrency(it.unitCost)}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold">
                          {it.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">
                          {formatCurrency(it.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financials & Payments Log */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 space-y-2 text-xs">
                <span className="font-bold text-muted-foreground uppercase text-[10px] block">
                  Payment Ledger
                </span>
                {activePurchase.payments.length === 0 ? (
                  <p className="text-muted-foreground text-[11px] italic">
                    No payments disbursed yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {activePurchase.payments.map((pm) => (
                      <div
                        key={pm.id}
                        className="flex items-center justify-between border-b pb-1 last:border-0"
                      >
                        <div>
                          <span className="font-semibold">{pm.method}</span>
                          {pm.reference && (
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              Ref: {pm.reference}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-emerald-600">
                          {formatCurrency(pm.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{formatCurrency(activePurchase.subtotal)}</span>
                </div>
                {activePurchase.discountAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="font-mono">
                      -{formatCurrency(activePurchase.discountAmount)}
                    </span>
                  </div>
                )}
                {activePurchase.taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span className="font-mono">
                      +{formatCurrency(activePurchase.taxAmount)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between font-bold text-sm">
                  <span>Grand Total</span>
                  <span className="font-mono text-primary">
                    {formatCurrency(activePurchase.total)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Total Paid</span>
                  <span className="font-mono">{formatCurrency(activePurchase.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-amber-600 font-bold">
                  <span>Remaining Balance</span>
                  <span className="font-mono">{formatCurrency(activePurchase.balance)}</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
              >
                <Printer className="h-4 w-4" /> Print GRN Note
              </button>
              {activePurchase.balance > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleOpenPayment(activePurchase);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-all"
                >
                  <CreditCard className="h-4 w-4" /> Record Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Supplier Payment Modal */}
      <SupplierPaymentModal
        payable={activePayable}
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setActivePayable(null);
        }}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
