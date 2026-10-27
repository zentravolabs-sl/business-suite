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
  AlertTriangle,
  WifiOff,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPosDatabase } from "@/lib/pos/offline-db";
import { PosSyncEngine, checkStorageQuota, NetworkReachability } from "@/lib/pos/sync-engine";
import { getOrCreateDeviceId } from "@/lib/pos/device-auth";

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
  businessId?: string;
  reachability?: NetworkReachability;
  syncEngine?: PosSyncEngine | null;
  onSaleComplete: (saleData: any) => void;
}

export function PaymentModal({
  open,
  onOpenChange,
  cart,
  branchId,
  businessId = "default",
  reachability = "ONLINE",
  syncEngine,
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

  const isActuallyOffline = reachability === "OFFLINE" || reachability === "SERVER_UNREACHABLE";

  // Force cash if offline and user had selected card/gateway
  useEffect(() => {
    if (isActuallyOffline && (method === "CARD" || method === "QR_CODE" || method === "BANK_TRANSFER")) {
      setMethod("CASH");
      setIsSplit(false);
    }
  }, [isActuallyOffline, method]);

  // Search customers (Online or IndexedDB fallback)
  useEffect(() => {
    let active = true;

    async function searchCustomers() {
      if (customerSearch.trim().length <= 1) {
        setCustomerList([]);
        return;
      }

      const q = customerSearch.trim().toLowerCase();

      // First check local Dexie database
      try {
        const db = getPosDatabase();
        const localMatches = await db.customers
          .where("businessId")
          .equals(businessId)
          .filter((c) =>
            c.name.toLowerCase().includes(q) ||
            (!!c.phone && c.phone.includes(q))
          )
          .limit(10)
          .toArray();

        if (active && localMatches.length > 0) {
          setCustomerList(localMatches);
        }
      } catch {
        // Continue
      }

      // If online, also query live server
      if (!isActuallyOffline) {
        try {
          const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
          if (res.ok) {
            const data = await res.json();
            if (active && data.customers) {
              setCustomerList(data.customers);
            }
          }
        } catch {
          // Keep local results
        }
      }
    }

    searchCustomers();
    return () => {
      active = false;
    };
  }, [customerSearch, isActuallyOffline, businessId]);

  // Synchronize total amounts when modal opens or total changes
  useEffect(() => {
    if (open) {
      setCashTendered(cart.total);
      setCardAmount(0);
      setIsSplit(false);
      setMethod("CASH");
      setSelectedCustomer(null);
      setCustomerSearch("");
    }
  }, [open, cart.total]);

  if (!open) return null;

  const totalDue = cart.total;
  const paidAmount = isSplit
    ? Number(cashTendered || 0) + Number(cardAmount || 0)
    : method === "CASH"
    ? Number(cashTendered || 0)
    : totalDue;

  const changeDue = Math.max(0, paidAmount - totalDue);
  const remainingDue = Math.max(0, totalDue - paidAmount);

  const handleFastCash = (amount: number) => {
    setCashTendered(amount);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) return;

    const newCust = {
      id: `CUST-LOCAL-${Date.now()}`,
      businessId,
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim() || null,
      email: null,
      tin: null,
      vatRegistrationNumber: null,
      isVatRegistered: false,
      creditLimit: 0,
      creditBalance: 0,
      address: null,
      loyaltyPoints: 0,
      updatedAt: Date.now(),
    };

    // Save to local IndexedDB
    try {
      const db = getPosDatabase();
      await db.customers.put(newCust);
    } catch {
      // ignore
    }

    // If online, push to server
    if (!isActuallyOffline) {
      try {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newCustomerName.trim(),
            phone: newCustomerPhone.trim(),
          }),
        });
        const data = await res.json();
        if (data.customer) {
          setSelectedCustomer(data.customer);
          setShowAddCustomer(false);
          setNewCustomerName("");
          setNewCustomerPhone("");
          toast.success("Customer added");
          return;
        }
      } catch {
        // Fall back to local customer
      }
    }

    setSelectedCustomer(newCust);
    setShowAddCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    toast.success("Customer saved locally");
  };

  const handleCheckout = async () => {
    if (remainingDue > 0 && method !== "CREDIT") {
      toast.error(`Please tender the full amount. Remaining: ${formatCurrency(remainingDue)}`);
      return;
    }

    if (isActuallyOffline && (method === "CARD" || method === "QR_CODE" || method === "BANK_TRANSFER")) {
      toast.error("Electronic payment providers are unavailable offline. Please tender in cash.");
      return;
    }

    setLoading(true);

    // Check storage quota before accepting sale
    const quotaCheck = await checkStorageQuota();
    if (!quotaCheck.safe) {
      toast.error(quotaCheck.warning || "Device storage quota reached! Cannot accept new sales.");
      setLoading(false);
      return;
    }

    const offlineId = crypto.randomUUID();
    const provisionalReceiptNumber = `PROV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const deviceId = getOrCreateDeviceId();

    const payments = isSplit
      ? [
          { method: "CASH", amount: Number(cashTendered || 0) },
          { method: "CARD", amount: Number(cardAmount || 0), reference: cardRef || null },
        ]
      : [
          {
            method,
            amount: method === "CASH" ? Number(cashTendered || 0) : totalDue,
            reference: cardRef || null,
          },
        ];

    const salePayload = {
      offlineId,
      branchId,
      businessId,
      deviceId,
      userId: "cashier",
      provisionalReceiptNumber,
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
        total: (i.quantity * i.unitPrice) - (i.discountAmount || 0),
        warrantyMonths: i.warrantyMonths,
        serialNumber: i.serialNumber,
        pricesIncludeTax: i.pricesIncludeTax ?? false,
      })),
      payments,
      customerId: selectedCustomer?.id || cart.customerId || null,
      customerName: selectedCustomer?.name || null,
      subtotal: cart.subtotal,
      discountAmount: cart.discountAmount,
      taxAmount: cart.taxAmount,
      total: cart.total,
      paidAmount,
      changeAmount: changeDue,
      creditAmount: method === "CREDIT" ? totalDue : 0,
    };

    // If terminal is offline or server unreachable, save to IndexedDB queue directly
    if (isActuallyOffline) {
      try {
        const engine = syncEngine || new PosSyncEngine(businessId);
        await engine.createOfflineSale(salePayload);

        const offlineReceiptSale = {
          ...salePayload,
          id: offlineId,
          invoiceNumber: provisionalReceiptNumber,
          receiptNumber: provisionalReceiptNumber,
          provisionalReceiptNumber,
          isOffline: true,
          businessName: "ZENTRAVO BMS",
          receiptHeader: "*** OFFLINE SALES RECEIPT (PROVISIONAL) ***",
          receiptFooter: "Transaction saved locally. Will synchronize automatically when connected.",
          customer: selectedCustomer,
        };

        toast.warning("Offline Mode: Sale saved locally in IndexedDB & queued for automatic sync!");
        onOpenChange(false);
        onSaleComplete(offlineReceiptSale);
        return;
      } catch (err: any) {
        toast.error("Failed to store offline sale: " + err.message);
        return;
      } finally {
        setLoading(false);
      }
    }

    // When online, attempt immediate sync via /api/pos/sale
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
      // Network failure or sudden disconnect during fetch: fallback gracefully to local queue
      try {
        const engine = syncEngine || new PosSyncEngine(businessId);
        await engine.createOfflineSale(salePayload);

        const fallbackSale = {
          ...salePayload,
          id: offlineId,
          invoiceNumber: provisionalReceiptNumber,
          receiptNumber: provisionalReceiptNumber,
          provisionalReceiptNumber,
          isOffline: true,
          businessName: "ZENTRAVO BMS",
          receiptHeader: "*** OFFLINE SALES RECEIPT (PROVISIONAL) ***",
          receiptFooter: "Network dropped during payment. Safely persisted locally.",
          customer: selectedCustomer,
        };

        toast.warning("Network dropped: Sale saved safely to offline queue!");
        onOpenChange(false);
        onSaleComplete(fallbackSale);
      } catch (e: any) {
        toast.error("Offline storage failed: " + e.message);
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
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Payment & Checkout</h2>
              {isActuallyOffline && (
                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30">
                  <WifiOff className="h-3 w-3" />
                  Offline Mode
                </span>
              )}
            </div>
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

        {isActuallyOffline && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Server unreachable. Transaction will be stored in durable local IndexedDB and synced automatically when connection restores.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Left Column: Payment Methods & Tenders */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {[
                  { id: "CASH", label: "Cash", icon: Banknote, offlineAllowed: true },
                  { id: "CARD", label: "Debit/Credit Card", icon: CreditCard, offlineAllowed: false },
                  { id: "QR_CODE", label: "LankaQR", icon: QrCode, offlineAllowed: false },
                  { id: "BANK_TRANSFER", label: "Bank Transfer", icon: Building2, offlineAllowed: false },
                ].map((pm) => {
                  const Icon = pm.icon;
                  const isSel = !isSplit && method === pm.id;
                  const isDisabled = isActuallyOffline && !pm.offlineAllowed;

                  return (
                    <button
                      key={pm.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        setIsSplit(false);
                        setMethod(pm.id as any);
                      }}
                      className={cn(
                        "flex flex-col items-start gap-1 p-3 rounded-xl border text-xs font-semibold transition-all relative",
                        isSel
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                          : isDisabled
                          ? "opacity-50 cursor-not-allowed bg-muted/40 border-dashed"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{pm.label}</span>
                      </div>
                      {isDisabled && (
                        <span className="text-[9px] text-amber-600 font-medium">Offline Unavailable</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Split Tender Toggle */}
              {!isActuallyOffline && (
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
              )}
            </div>

            {/* Fast Cash Buttons */}
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

            {/* Card amount if split */}
            {isSplit && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Card Amount (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cardAmount}
                  onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {/* Card reference input */}
            {(method === "CARD" || isSplit) && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Card / Approval Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Last 4 digits or Auth Code"
                  value={cardRef}
                  onChange={(e) => setCardRef(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>

          {/* Right Column: Customer Info & Order Summary */}
          <div className="space-y-4 flex flex-col justify-between">
            {/* Customer Box */}
            <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span>Customer (Optional)</span>
                </div>
                {selectedCustomer ? (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-[11px] text-destructive hover:underline"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddCustomer(!showAddCustomer)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    + New Customer
                  </button>
                )}
              </div>

              {selectedCustomer ? (
                <div className="text-xs">
                  <div className="font-bold text-foreground">{selectedCustomer.name}</div>
                  <div className="text-muted-foreground">{selectedCustomer.phone || "No phone"}</div>
                </div>
              ) : showAddCustomer ? (
                <div className="space-y-2 pt-1 animate-fade-in">
                  <input
                    type="text"
                    placeholder="Customer Name *"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full rounded-lg border bg-background px-2.5 py-1 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Phone number"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full rounded-lg border bg-background px-2.5 py-1 text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddCustomer(false)}
                      className="px-2 py-1 text-xs text-muted-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateCustomer}
                      className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search customer by name/phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {customerList.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-36 overflow-y-auto rounded-lg border bg-card p-1 shadow-lg">
                      {customerList.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearch("");
                            setCustomerList([]);
                          }}
                          className="p-1.5 hover:bg-muted rounded text-xs cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-semibold">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground">{c.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Calculations Box */}
            <div className="rounded-xl border bg-card p-4 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span>{formatCurrency(cart.subtotal)}</span>
              </div>
              {cart.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount:</span>
                  <span>-{formatCurrency(cart.discountAmount)}</span>
                </div>
              )}
              {cart.taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax Total:</span>
                  <span>+{formatCurrency(cart.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-sm pt-2 border-t text-foreground">
                <span>Total Amount:</span>
                <span className="text-primary text-base">{formatCurrency(totalDue)}</span>
              </div>

              {/* Tender & Change */}
              <div className="pt-2 border-t space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Tendered:</span>
                  <span>{formatCurrency(paidAmount)}</span>
                </div>
                {changeDue > 0 && (
                  <div className="flex justify-between font-bold text-emerald-600 text-sm">
                    <span>Change Due:</span>
                    <span>{formatCurrency(changeDue)}</span>
                  </div>
                )}
                {remainingDue > 0 && method !== "CREDIT" && (
                  <div className="flex justify-between font-bold text-destructive">
                    <span>Remaining Due:</span>
                    <span>{formatCurrency(remainingDue)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Complete Sale Button */}
            <button
              type="button"
              disabled={loading || (remainingDue > 0 && method !== "CREDIT")}
              onClick={handleCheckout}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm shadow-lg transition-all",
                loading || (remainingDue > 0 && method !== "CREDIT")
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : isActuallyOffline
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              )}
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>
                    {isActuallyOffline
                      ? `Complete Offline Sale (${formatCurrency(totalDue)})`
                      : `Complete Sale (${formatCurrency(totalDue)})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
