"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CreditCard,
  Hash,
  Package,
  Plus,
  QrCode,
  Sparkles,
  Trash2,
  Truck,
  AlertCircle,
  FileText,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  creditBalance: number;
  creditLimit: number;
  paymentTermDays: number;
  phone?: string | null;
}

interface Branch {
  id: string;
  name: string;
  city?: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  costPrice: number;
  retailPrice?: number;
  isSerialTracked?: boolean;
  isBatchTracked?: boolean;
}

interface InitialPO {
  id: string;
  orderNumber: string;
  supplierId: string;
  branchId: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    receivedQty: number;
    unitCost: number;
  }[];
}

interface GRNItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  hasSerial: boolean;
  hasBatch: boolean;
  serialNumbers: string[];
  batchNumber: string;
  expiryDate: string;
  serialInputOpen?: boolean;
}

export function GRNForm({
  suppliers,
  branches,
  products,
  initialPO,
}: {
  suppliers: Supplier[];
  branches: Branch[];
  products: Product[];
  initialPO?: InitialPO | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poIdFromQuery = searchParams.get("poId");

  const [supplierId, setSupplierId] = useState(
    initialPO?.supplierId || suppliers[0]?.id || ""
  );
  const [branchId, setBranchId] = useState(
    initialPO?.branchId || branches[0]?.id || ""
  );
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    const term = suppliers[0]?.paymentTermDays || 30;
    d.setDate(d.getDate() + term);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState(
    initialPO ? `Received against Purchase Order ${initialPO.orderNumber}` : ""
  );

  // Initialize items from PO or default product
  const [items, setItems] = useState<GRNItem[]>(() => {
    if (initialPO && initialPO.items.length > 0) {
      return initialPO.items.map((pi) => {
        const prod = products.find((p) => p.id === pi.productId);
        const remainingQty = Math.max(1, pi.quantity - pi.receivedQty);
        return {
          productId: pi.productId,
          productName: pi.productName,
          quantity: remainingQty,
          unitCost: pi.unitCost,
          hasSerial: !!prod?.isSerialTracked,
          hasBatch: !!prod?.isBatchTracked,
          serialNumbers: [],
          batchNumber: "",
          expiryDate: "",
          serialInputOpen: false,
        };
      });
    }

    const first = products[0];
    return [
      {
        productId: first?.id || "",
        productName: first?.name || "",
        quantity: 10,
        unitCost: first?.costPrice || 0,
        hasSerial: !!first?.isSerialTracked,
        hasBatch: !!first?.isBatchTracked,
        serialNumbers: [],
        batchNumber: "",
        expiryDate: "",
        serialInputOpen: false,
      },
    ];
  });

  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [loading, setLoading] = useState(false);

  // Selected supplier details
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  // Whenever supplier changes, adjust default due date based on paymentTermDays
  const handleSupplierChange = (id: string) => {
    setSupplierId(id);
    const supp = suppliers.find((s) => s.id === id);
    if (supp) {
      const d = new Date(receivedDate || new Date());
      d.setDate(d.getDate() + (supp.paymentTermDays || 30));
      setDueDate(d.toISOString().split("T")[0]);
    }
  };

  const handleProductChange = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === index
          ? {
              ...it,
              productId: prodId,
              productName: prod?.name || "",
              unitCost: prod?.costPrice || 0,
              hasSerial: !!prod?.isSerialTracked,
              hasBatch: !!prod?.isBatchTracked,
              serialNumbers: [],
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

  const handleSerialsChange = (index: number, rawText: string) => {
    const serials = rawText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, serialNumbers: serials } : it))
    );
  };

  const toggleSerialBox = (index: number) => {
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === index ? { ...it, serialInputOpen: !it.serialInputOpen } : it
      )
    );
  };

  const addItem = () => {
    const first = products[0];
    setItems((prev) => [
      ...prev,
      {
        productId: first?.id || "",
        productName: first?.name || "",
        quantity: 5,
        unitCost: first?.costPrice || 0,
        hasSerial: !!first?.isSerialTracked,
        hasBatch: !!first?.isBatchTracked,
        serialNumbers: [],
        batchNumber: "",
        expiryDate: "",
        serialInputOpen: false,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculations
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);
  const total = Math.max(0, subtotal - discountAmount + taxAmount);
  const balance = Math.max(0, total - paidAmount);

  // Payment quick action shortcuts
  const setFullCredit = () => setPaidAmount(0);
  const setFullPayment = () => setPaidAmount(total);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (!branchId) {
      toast.error("Please select a receiving branch");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        branchId,
        supplierId,
        purchaseOrderId: initialPO?.id || poIdFromQuery || null,
        supplierInvoice: supplierInvoice.trim() || null,
        receivedDate: receivedDate || null,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
        discountAmount,
        taxAmount,
        paidAmount,
        paymentMethod: paidAmount > 0 ? paymentMethod : "CREDIT",
        paymentReference: paymentReference.trim() || null,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitCost: it.unitCost,
          batchNumber: it.batchNumber?.trim() || null,
          expiryDate: it.expiryDate || null,
          serialNumbers: it.serialNumbers,
        })),
      };

      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to receive GRN");

      toast.success(
        `GRN ${data.purchase?.grnNumber || "created"} received successfully! Stock updated.`
      );
      router.push("/dashboard/purchases");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/purchases"
            className="rounded-xl border p-2.5 hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Receive Goods (GRN)</h1>
              {initialPO && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-500/20">
                  <FileText className="h-3 w-3" /> PO #{initialPO.orderNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ingest vendor inventory, register serial numbers/batches, and generate payables.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {loading ? "Receiving Stock..." : "Confirm & Post GRN"}
        </button>
      </div>

      {/* Top Details Card */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" /> Delivery & Vendor Information
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Receiving Branch *
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.city ? `(${b.city})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Supplier *
            </label>
            <select
              value={supplierId}
              onChange={(e) => handleSupplierChange(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {selectedSupplier && (
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Terms: {selectedSupplier.paymentTermDays} days</span>
                <span className="text-amber-600 font-medium">
                  Bal: {formatCurrency(selectedSupplier.creditBalance)}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Supplier Invoice / Delivery Note #
            </label>
            <input
              type="text"
              value={supplierInvoice}
              onChange={(e) => setSupplierInvoice(e.target.value)}
              placeholder="e.g. INV-98442"
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Received Date *
            </label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Products Received
            </h2>
            <p className="text-xs text-muted-foreground">
              Add products, verify cost price, and register serialized items.
            </p>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-muted/50 px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Product
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border bg-background/50 p-4 transition-all hover:border-border/80"
            >
              <div className="grid gap-4 sm:grid-cols-12 items-center">
                {/* Product Select */}
                <div className="sm:col-span-5">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Product #{idx + 1}
                  </label>
                  <select
                    value={item.productId}
                    onChange={(e) => handleProductChange(idx, e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(${p.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unit Cost */}
                <div className="sm:col-span-3">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Unit Cost (LKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitCost}
                    onChange={(e) => handleCostChange(idx, Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border bg-background px-2.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Quantity */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Qty Received
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border bg-background px-2.5 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Line Total & Remove */}
                <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-3 pt-4 sm:pt-0">
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Line Total</span>
                    <span className="text-sm font-bold font-mono text-emerald-600">
                      {formatCurrency(item.quantity * item.unitCost)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length <= 1}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Serial numbers & Batch tracker bar */}
              <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSerialBox(idx)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                      item.serialNumbers.length === item.quantity
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                        : item.serialNumbers.length > 0
                        ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <QrCode className="h-3 w-3" />
                    Serials / IMEIs: {item.serialNumbers.length} / {item.quantity}
                  </button>

                  {(item.hasBatch || item.batchNumber) && (
                    <span className="text-[11px] text-muted-foreground">
                      Batch: <strong>{item.batchNumber || "None"}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Batch #"
                    value={item.batchNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, batchNumber: val } : it))
                      );
                    }}
                    className="w-24 rounded border px-2 py-1 text-[11px] bg-background"
                  />
                  <input
                    type="date"
                    title="Expiry Date"
                    value={item.expiryDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, expiryDate: val } : it))
                      );
                    }}
                    className="w-32 rounded border px-2 py-1 text-[11px] bg-background"
                  />
                </div>
              </div>

              {/* Expandable Serial Input Box */}
              {item.serialInputOpen && (
                <div className="mt-3 rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">
                      Enter {item.quantity} Serial Numbers / IMEIs (one per line or comma-separated):
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        item.serialNumbers.length === item.quantity
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }`}
                    >
                      {item.serialNumbers.length} of {item.quantity} captured
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="SN-100293&#10;SN-100294&#10;SN-100295"
                    defaultValue={item.serialNumbers.join("\n")}
                    onChange={(e) => handleSerialsChange(idx, e.target.value)}
                    className="w-full rounded-md border bg-background p-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Financials & Payment Section */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Payment & Credit Terms */}
        <div className="lg:col-span-7 rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Payment on Delivery / Payable
          </h2>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={setFullCredit}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                paidAmount === 0
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 hover:bg-muted text-muted-foreground"
              }`}
            >
              Full Credit (0 Advance)
            </button>
            <button
              type="button"
              onClick={setFullPayment}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                paidAmount === total && total > 0
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-muted/30 hover:bg-muted text-muted-foreground"
              }`}
            >
              Pay Full Amount
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Paid Amount (LKR)
              </label>
              <input
                type="number"
                min="0"
                max={total}
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={paidAmount === 0}
                className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Debit / Credit Card</option>
              </select>
            </div>

            {paidAmount > 0 && (
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Payment Reference / Cheque No.
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. CHQ-48921 or Ref: BOC-Transfer-992"
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {balance > 0 && (
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Payable Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  A Supplier Payable record will be opened for LKR {balance.toLocaleString()} due on this date.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Internal Notes / Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Inspected by inventory manager, batch verified in good condition..."
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Totals Summary Card */}
        <div className="lg:col-span-5 rounded-2xl border bg-card p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Financial Summary
            </h2>

            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Items Subtotal</span>
                <span className="font-mono font-medium text-foreground">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Discount (LKR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="w-28 rounded-lg border bg-background px-2 py-1 text-right font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Tax / VAT (LKR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(Number(e.target.value))}
                  className="w-28 rounded-lg border bg-background px-2 py-1 text-right font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-3 border-t flex justify-between items-baseline font-bold">
                <span className="text-base">Grand Total</span>
                <span className="text-xl font-mono text-primary">
                  {formatCurrency(total)}
                </span>
              </div>

              <div className="flex justify-between items-baseline text-xs text-muted-foreground">
                <span>Paid on Receipt</span>
                <span className="font-mono font-semibold text-emerald-600">
                  {formatCurrency(paidAmount)}
                </span>
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-center justify-between font-bold">
                <span className="text-amber-700 dark:text-amber-400 text-xs">
                  Payable Balance
                </span>
                <span className="font-mono text-base text-amber-700 dark:text-amber-400">
                  {formatCurrency(balance)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {loading ? "Receiving Stock..." : "Confirm & Post GRN"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
