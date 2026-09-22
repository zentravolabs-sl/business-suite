"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  Banknote,
  QrCode,
  Building2,
  User,
  Check,
  X,
  Plus,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: {
    items: any[];
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
    customerId?: string;
  };
  branchId: string;
  onSaleComplete: (saleData: any) => void;
}

export function PaymentModal({
  open,
  onOpenChange,
  cart,
  branchId,
  onSaleComplete,
}: PaymentModalProps) {
  const [method, setMethod] = useState<"CASH" | "CARD" | "QR_CODE" | "BANK_TRANSFER" | "CREDIT">("CASH");
  const [cashTendered, setCashTendered] = useState<number>(cart.total);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [isSplit, setIsSplit] = useState(false);
  const [cardRef, setCardRef] = useState("");
  const [loading, setLoading] = useState(false);

  // Customer State
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  useEffect(() => {
    if (open) {
      setCashTendered(cart.total);
      setCardAmount(0);
      setIsSplit(false);
    }
  }, [open, cart.total]);

  // Search customers
  useEffect(() => {
    if (customerSearch.length > 1) {
      fetch(`/api/customers?q=${encodeURIComponent(customerSearch)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.customers) setCustomerList(data.customers);
        })
        .catch(() => {});
    } else {
      setCustomerList([]);
    }
  }, [customerSearch]);

  if (!open) return null;

  // Calculate totals
  const totalDue = cart.total;
  let paidAmount = 0;
  let payments: any[] = [];

  if (!isSplit) {
    paidAmount = method === "CASH" ? cashTendered : totalDue;
    payments = [
      {
        method,
        amount: totalDue,
        reference: method === "CARD" ? cardRef : null,
      },
    ];
  } else {
    paidAmount = Number(cashTendered) + Number(cardAmount);
    payments = [];
    if (cashTendered > 0) payments.push({ method: "CASH", amount: cashTendered });
    if (cardAmount > 0) payments.push({ method: "CARD", amount: cardAmount, reference: cardRef });
  }

  const changeDue = Math.max(0, paidAmount - totalDue);
  const remainingDue = Math.max(0, totalDue - paidAmount);

  const handleFastCash = (amount: number) => {
    setCashTendered(amount);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) return;
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName,
          phone: newCustomerPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSelectedCustomer(data.customer);
      setShowAddCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      toast.success("Customer added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add customer");
    }
  };

  const handleCheckout = async () => {
    if (remainingDue > 0 && method !== "CREDIT") {
      toast.error(`Please tender the full amount. Remaining: ${formatCurrency(remainingDue)}`);
      return;
    }

    setLoading(true);
    const offlineId = `OFF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const salePayload = {
      offlineId,
      branchId,
      items: cart.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        sku: i.sku,
        barcode: i.barcode,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        costPrice: i.costPrice,
        discountAmount: i.discountAmount || 0,
        taxAmount: i.taxAmount || 0,
        warrantyMonths: i.warrantyMonths,
        serialNumber: i.serialNumber,
      })),
      payments,
      customerId: selectedCustomer?.id || cart.customerId || null,
      subtotal: cart.subtotal,
      discountAmount: cart.discountAmount,
      taxAmount: cart.taxAmount,
      total: cart.total,
      paidAmount,
      changeAmount: changeDue,
    };

    // If browser is offline, save to offline queue directly
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const stored = JSON.parse(localStorage.getItem("zentravo_offline_sales") || "[]");
        stored.push(salePayload);
        localStorage.setItem("zentravo_offline_sales", JSON.stringify(stored));
        window.dispatchEvent(new Event("offline_sales_updated"));

        const offlineSale = {
          ...salePayload,
          id: offlineId,
          invoiceNumber: offlineId,
          receiptNumber: "RCP-" + offlineId.slice(-6),
          isOffline: true,
          businessName: "ZENTRAVO RETAIL",
          receiptHeader: "*** OFFLINE SALE (PENDING SYNC) ***",
          receiptFooter: "Transaction saved locally. Will sync automatically.",
        };

        toast.warning("Offline Mode: Sale saved locally and will sync when reconnected!");
        onOpenChange(false);
        onSaleComplete(offlineSale);
        return;
      } catch (err: any) {
        toast.error("Failed to store offline sale: " + err.message);
        return;
      } finally {
        setLoading(false);
      }
    }

    try {
      const res = await fetch("/api/pos/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(salePayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");

      toast.success("Sale completed successfully!");
      onOpenChange(false);
      onSaleComplete(data.sale);
    } catch (err: any) {
      // If network failure during fetch, fall back to offline queue
      if (err.name === "TypeError" || (err.message && err.message.includes("fetch"))) {
        try {
          const stored = JSON.parse(localStorage.getItem("zentravo_offline_sales") || "[]");
          stored.push(salePayload);
          localStorage.setItem("zentravo_offline_sales", JSON.stringify(stored));
          window.dispatchEvent(new Event("offline_sales_updated"));

          const offlineSale = {
            ...salePayload,
            id: offlineId,
            invoiceNumber: offlineId,
            receiptNumber: "RCP-" + offlineId.slice(-6),
            isOffline: true,
            businessName: "ZENTRAVO RETAIL",
            receiptHeader: "*** OFFLINE SALE (PENDING SYNC) ***",
            receiptFooter: "Connection dropped. Saved locally.",
          };

          toast.warning("Connection lost: Sale saved locally and queued for sync!");
          onOpenChange(false);
          onSaleComplete(offlineSale);
          return;
        } catch (e: any) {
          toast.error("Offline storage failed: " + e.message);
        }
      } else {
        toast.error(err.message || "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="fixed inset-0" onClick={() => onOpenChange(false)} />

      <div className="relative w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-lg font-bold">Payment & Checkout</h2>
            <p className="text-xs text-muted-foreground">
              {cart.items.length} line item{cart.items.length > 1 ? "s" : ""} in invoice
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Left Column: Payment Methods & Tenders */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {[
                  { id: "CASH", label: "Cash", icon: Banknote },
                  { id: "CARD", label: "Debit/Credit Card", icon: CreditCard },
                  { id: "QR_CODE", label: "LankaQR", icon: QrCode },
                  { id: "BANK_TRANSFER", label: "Bank Transfer", icon: Building2 },
                ].map((pm) => {
                  const Icon = pm.icon;
                  const isSel = !isSplit && method === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => {
                        setIsSplit(false);
                        setMethod(pm.id as any);
                      }}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all",
                        isSel
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Split Tender Toggle */}
              <button
                type="button"
                onClick={() => {
                  setIsSplit(!isSplit);
                  if (!isSplit) {
                    setCashTendered(Math.round(totalDue / 2));
                    setCardAmount(totalDue - Math.round(totalDue / 2));
                  }
                }}
                className={cn(
                  "w-full mt-2 py-1.5 text-xs font-semibold rounded-xl border transition-colors",
                  isSplit
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {isSplit ? "✓ Split Payment (Cash + Card)" : "+ Split Payment"}
              </button>
            </div>

            {/* Fast Cash Buttons (if cash involved) */}
            {(method === "CASH" || isSplit) && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Cash Tendered (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-lg font-extrabold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { label: "Exact", val: totalDue },
                    { label: "Rs. 500", val: 500 },
                    { label: "Rs. 1,000", val: 1000 },
                    { label: "Rs. 5,000", val: 5000 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => handleFastCash(btn.val)}
                      className="rounded-lg border bg-muted/30 py-1.5 text-[11px] font-semibold hover:bg-muted transition-colors"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Card reference if card */}
            {(method === "CARD" || isSplit) && (
              <div className="space-y-2">
                {isSplit && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Card Tendered (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={cardAmount}
                      onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 rounded-xl border bg-background px-3 py-2 text-sm font-bold"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Card Terminal Ref / Approval Code
                  </label>
                  <input
                    type="text"
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    placeholder="e.g. REF-8849"
                    className="w-full mt-1 rounded-xl border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Customer Info & Order Summary */}
          <div className="space-y-4">
            {/* Customer Box */}
            <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Customer
                </span>
                {selectedCustomer ? (
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-[10px] text-destructive hover:underline"
                  >
                    Change
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAddCustomer(!showAddCustomer)}
                    className="text-[10px] text-primary hover:underline font-semibold"
                  >
                    + New Customer
                  </button>
                )}
              </div>

              {selectedCustomer ? (
                <div className="bg-card p-2 rounded-lg border text-xs">
                  <div className="font-bold text-foreground">{selectedCustomer.name}</div>
                  <div className="text-muted-foreground">{selectedCustomer.phone || "No phone"}</div>
                </div>
              ) : showAddCustomer ? (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    placeholder="Customer Name *"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile (e.g. 077 123 4567)"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCustomer}
                    className="w-full rounded-lg bg-primary py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    Save & Select
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by phone or name..."
                    className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs"
                  />
                  {customerList.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border bg-card shadow-xl max-h-36 overflow-y-auto divide-y text-xs">
                      {customerList.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearch("");
                            setCustomerList([]);
                          }}
                          className="p-2 hover:bg-muted cursor-pointer"
                        >
                          <div className="font-semibold">{c.name}</div>
                          <div className="text-muted-foreground text-[10px]">{c.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Walk-in Customer (Guest)
                  </div>
                </div>
              )}
            </div>

            {/* Summary Box */}
            <div className="rounded-xl border bg-card p-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span>{formatCurrency(cart.subtotal)}</span>
              </div>

              {cart.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount:</span>
                  <span>-{formatCurrency(cart.discountAmount)}</span>
                </div>
              )}

              {cart.taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT (18%):</span>
                  <span>+{formatCurrency(cart.taxAmount)}</span>
                </div>
              )}

              <div className="border-t pt-2 flex justify-between text-base font-extrabold">
                <span>Total Payable:</span>
                <span className="text-primary">{formatCurrency(totalDue)}</span>
              </div>

              <div className="border-t pt-2 space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Tendered:</span>
                  <span className="font-semibold">{formatCurrency(paidAmount)}</span>
                </div>

                <div className="flex justify-between text-sm font-extrabold text-emerald-600">
                  <span>Change Due:</span>
                  <span>{formatCurrency(changeDue)}</span>
                </div>

                {remainingDue > 0 && method !== "CREDIT" && (
                  <div className="flex justify-between text-xs font-bold text-rose-500">
                    <span>Remaining Balance:</span>
                    <span>{formatCurrency(remainingDue)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Complete Button */}
            <button
              type="button"
              disabled={loading || (remainingDue > 0 && method !== "CREDIT")}
              onClick={handleCheckout}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Processing Transaction...</span>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Complete Sale & Print (F9)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
