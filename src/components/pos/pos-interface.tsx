"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Clock,
  DollarSign,
  CreditCard,
  ShieldCheck,
  Maximize2,
  X,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import { ShiftModal } from "./shift-modal";
import { HeldBillsModal } from "./held-bills-modal";
import { PaymentModal } from "./payment-modal";
import { ThermalReceiptModal } from "./thermal-receipt-modal";

export interface PosProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string;
  categoryName: string;
  categoryId: string | null;
  costPrice: number;
  retailPrice: number;
  isSerialTracked: boolean;
  warrantyMonths: number;
  stockQuantity: number;
}

export interface PosCategory {
  id: string;
  name: string;
}

export interface CartItem {
  productId: string;
  name: string;
  sku: string | null;
  barcode: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discountAmount: number;
  taxAmount: number;
  warrantyMonths: number;
  isSerialTracked: boolean;
  serialNumber?: string;
}

interface PosInterfaceProps {
  initialProducts: PosProduct[];
  categories: PosCategory[];
  branches: { id: string; name: string }[];
  activeBranchId: string;
  cashierName: string;
}

export function PosInterface({
  initialProducts,
  categories,
  branches,
  activeBranchId,
  cashierName,
}: PosInterfaceProps) {
  const [branchId, setBranchId] = useState(activeBranchId);
  const [products] = useState<PosProduct[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [shift, setShift] = useState<any | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState<"OPEN" | "CLOSE">("OPEN");
  const [showHeldBills, setShowHeldBills] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Offline mode and sync state
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const updateOfflineCount = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("zentravo_offline_sales") || "[]");
      setOfflineQueueCount(stored.length);
    } catch {
      setOfflineQueueCount(0);
    }
  };

  const syncOfflineSales = async () => {
    if (isSyncing) return;
    try {
      const stored = JSON.parse(localStorage.getItem("zentravo_offline_sales") || "[]");
      if (!stored.length) {
        toast.info("No offline sales to sync.");
        return;
      }
      setIsSyncing(true);
      let successCount = 0;
      const remaining: any[] = [];

      for (const salePayload of stored) {
        try {
          const res = await fetch("/api/pos/sale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(salePayload),
          });
          const data = await res.json();
          if (res.ok || data.alreadyProcessed) {
            successCount++;
          } else {
            remaining.push(salePayload);
          }
        } catch {
          remaining.push(salePayload);
        }
      }

      localStorage.setItem("zentravo_offline_sales", JSON.stringify(remaining));
      setOfflineQueueCount(remaining.length);

      if (successCount > 0) {
        toast.success(`Synced ${successCount} offline sale(s) to server!`);
        fetchShift();
      }
      if (remaining.length > 0) {
        toast.warning(`${remaining.length} sale(s) could not be synced.`);
      }
    } catch (e: any) {
      toast.error("Sync error: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      updateOfflineCount();

      const handleOnline = () => {
        setIsOnline(true);
        toast.success("Internet connection restored. Auto-syncing...");
        syncOfflineSales();
      };
      const handleOffline = () => {
        setIsOnline(false);
        toast.warning("Internet disconnected. POS running in offline mode.");
      };
      const handleUpdateEvent = () => {
        updateOfflineCount();
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      window.addEventListener("offline_sales_updated", handleUpdateEvent);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("offline_sales_updated", handleUpdateEvent);
      };
    }
  }, []);

  // Fetch current shift status
  const fetchShift = async () => {
    try {
      const res = await fetch(`/api/pos/shift?branchId=${branchId}`);
      const data = await res.json();
      setShift(data.shift);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchShift();
  }, [branchId]);

  // Global barcode listener & keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        if (cart.length > 0 && shift) {
          setShowPayment(true);
        }
      } else if (e.key === "Escape" && showReceipt) {
        setShowReceipt(false);
        setCart([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, shift, showReceipt]);

  // Add product to cart
  const addToCart = (product: PosProduct) => {
    if (product.stockQuantity <= 0) {
      toast.error(`"${product.name}" is out of stock in this branch`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          toast.warning(`Maximum available stock reached (${product.stockQuantity})`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            quantity: 1,
            unitPrice: product.retailPrice,
            costPrice: product.costPrice,
            discountAmount: 0,
            taxAmount: 0,
            warrantyMonths: product.warrantyMonths,
            isSerialTracked: product.isSerialTracked,
          },
        ];
      }
    });
  };

  // Barcode scan submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matched = products.find(
      (p) =>
        p.barcode === barcodeInput.trim() ||
        (p.sku && p.sku.toLowerCase() === barcodeInput.trim().toLowerCase())
    );

    if (matched) {
      addToCart(matched);
      toast.success(`Scanned: ${matched.name}`);
      setBarcodeInput("");
    } else {
      toast.error(`No product found for barcode: ${barcodeInput}`);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const product = products.find((p) => p.id === productId);
            const newQty = item.quantity + delta;
            if (product && newQty > product.stockQuantity) {
              toast.warning(`Maximum stock is ${product.stockQuantity}`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const updateSerial = (productId: string, serial: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, serialNumber: serial } : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalDiscount = cart.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  const total = Math.max(0, subtotal - totalDiscount);

  // Park / Hold bill
  const handleHoldBill = async () => {
    if (cart.length === 0) return;
    const name = prompt("Enter customer name or table/counter note for held bill:");
    if (name === null) return;

    try {
      const res = await fetch("/api/pos/held-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          name: name || `Counter Bill (${cart.length} items)`,
          cartData: { items: cart, subtotal, total },
        }),
      });

      if (!res.ok) throw new Error("Failed to park bill");
      toast.success("Bill parked on hold");
      setCart([]);
    } catch {
      toast.error("Failed to hold bill");
    }
  };

  // Filter products for catalog grid
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      p.barcode.includes(search);

    const matchesCat = selectedCategory === "ALL" || p.categoryId === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] overflow-hidden gap-3">
      {/* 1. POS Top Bar */}
      <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm">POS Terminal</span>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Branch selector */}
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="rounded-lg border bg-background px-2.5 py-1 text-xs font-semibold focus:outline-none"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <span className="text-xs text-muted-foreground hidden md:inline">
            Cashier: <strong>{cashierName}</strong>
          </span>
        </div>

        {/* Right actions: Shift control, Offline Sync, & Held bills */}
        <div className="flex items-center gap-2">
          {/* Online / Offline status & Sync button */}
          <div className="flex items-center gap-1.5 mr-1">
            {isOnline ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <Wifi className="h-3 w-3" />
                <span className="hidden sm:inline">Online</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                <WifiOff className="h-3 w-3" />
                <span>Offline</span>
              </span>
            )}

            {offlineQueueCount > 0 && (
              <button
                onClick={syncOfflineSales}
                disabled={isSyncing}
                title="Sync offline transactions to cloud"
                className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-500 text-white px-2.5 py-1 rounded-lg hover:bg-amber-600 transition-colors shadow-xs"
              >
                <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
                <span>Sync {offlineQueueCount} Sale{offlineQueueCount > 1 ? "s" : ""}</span>
              </button>
            )}
          </div>

          {shift ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Shift Active (Drawer: {formatCurrency(shift.expectedCash)})
              </span>
              <button
                onClick={() => {
                  setShiftModalMode("CLOSE");
                  setShowShiftModal(true);
                }}
                className="rounded-lg border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted transition-colors text-muted-foreground"
              >
                Close Shift
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setShiftModalMode("OPEN");
                setShowShiftModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-amber-600 transition-colors animate-bounce"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Open Shift to Start POS
            </button>
          )}

          <button
            onClick={() => setShowHeldBills(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted transition-colors"
          >
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Parked Bills
          </button>
        </div>
      </div>

      {/* 2. Main POS Workspace: Split Left (Catalog) & Right (Cart) */}
      <div className="grid grid-cols-12 gap-3 flex-1 overflow-hidden">
        {/* LEFT PANEL: Barcode, Search, Categories & Product Grid (7 Cols) */}
        <div className="col-span-12 lg:col-span-7 flex flex-col rounded-2xl border bg-card shadow-sm overflow-hidden p-3 gap-3">
          {/* Barcode & Search Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Instant Barcode Scanner Input */}
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan Barcode (Auto-Add)..."
                className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </form>

            {/* Keyword search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by title or SKU..."
                className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                selectedCategory === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              All Items
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  selectedCategory === c.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Product Grid Cards */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filteredProducts.map((p) => {
                const isOut = p.stockQuantity <= 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => !isOut && addToCart(p)}
                    className={cn(
                      "flex flex-col justify-between p-3 rounded-xl border bg-background/50 hover:bg-muted/30 cursor-pointer transition-all active:scale-[0.98] select-none",
                      isOut && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div>
                      <div className="font-semibold text-xs leading-tight line-clamp-2">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{p.sku}</div>
                    </div>

                    <div className="mt-2 pt-2 border-t flex items-center justify-between">
                      <div className="font-extrabold text-xs text-primary">
                        {formatCurrency(p.retailPrice)}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded",
                          isOut
                            ? "bg-red-500/10 text-red-500"
                            : "bg-emerald-500/10 text-emerald-600"
                        )}
                      >
                        {isOut ? "Out" : `${p.stockQuantity}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Active Billing Cart (5 Cols) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col rounded-2xl border bg-card shadow-sm overflow-hidden p-3 gap-3">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Active Bill</span>
              <span className="rounded-full bg-primary/10 text-primary text-xs font-bold px-2 py-0.5">
                {cart.length} item{cart.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleHoldBill}
                className="rounded-lg border px-2 py-1 text-[11px] font-semibold hover:bg-muted disabled:opacity-40"
              >
                Hold Bill
              </button>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setCart([])}
                className="rounded-lg border px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Cart Line Items List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm font-semibold">Cart is Empty</p>
                <p className="text-xs mt-0.5">
                  Scan barcode gun or tap items from the catalog on the left.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.productId}
                  className="rounded-xl border bg-background/60 p-2.5 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-xs leading-tight">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatCurrency(item.unitPrice)} each
                      </div>
                    </div>

                    <div className="font-extrabold text-xs text-primary">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </div>
                  </div>

                  {/* Quantity and Serial assignment controls */}
                  <div className="flex items-center justify-between pt-1 border-t">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="h-6 w-6 rounded-md border flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="h-6 w-6 rounded-md border flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Serial number prompt if serialized */}
                    {item.isSerialTracked ? (
                      <input
                        type="text"
                        value={item.serialNumber || ""}
                        onChange={(e) => updateSerial(item.productId, e.target.value)}
                        placeholder="Scan / Type S/N *"
                        className="rounded-md border bg-card px-2 py-0.5 text-[11px] font-mono text-primary w-28 text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    ) : item.warrantyMonths > 0 ? (
                      <span className="text-[10px] text-indigo-600 font-medium">
                        {item.warrantyMonths}m Warranty
                      </span>
                    ) : null}

                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Footer & Checkout */}
          <div className="rounded-xl border bg-muted/20 p-3 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>

            <div className="border-t pt-1.5 flex justify-between text-base font-extrabold">
              <span>Total Payable:</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>

            <button
              type="button"
              disabled={cart.length === 0 || !shift}
              onClick={() => setShowPayment(true)}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              Pay & Checkout (F9)
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ShiftModal
        open={showShiftModal}
        onOpenChange={setShowShiftModal}
        mode={shiftModalMode}
        currentShift={shift}
        branchId={branchId}
        onSuccess={fetchShift}
      />

      <HeldBillsModal
        open={showHeldBills}
        onOpenChange={setShowHeldBills}
        branchId={branchId}
        onRecallBill={(data) => setCart(data.items || [])}
      />

      <PaymentModal
        open={showPayment}
        onOpenChange={setShowPayment}
        cart={{
          items: cart,
          subtotal,
          discountAmount: totalDiscount,
          taxAmount: 0,
          total,
        }}
        branchId={branchId}
        onSaleComplete={(sale) => {
          setCompletedSale(sale);
          setShowReceipt(true);
        }}
      />

      <ThermalReceiptModal
        open={showReceipt}
        onOpenChange={setShowReceipt}
        sale={completedSale}
        onNewSale={() => {
          setCart([]);
          setCompletedSale(null);
          fetchShift();
        }}
      />
    </div>
  );
}
