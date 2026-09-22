"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  CreditCard,
  Building2,
  ShieldCheck,
  ShoppingBag,
  MapPin,
  Phone,
  User,
  Mail,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useCart } from "@/context/cart-context";
import { toast } from "sonner";

const SRI_LANKAN_DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Mullaitivu",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
];

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const {
    items,
    totalItems,
    subtotal,
    clearCart,
    freeDeliveryThreshold,
  } = useCart();

  const [loadingStore, setLoadingStore] = useState(true);
  const [store, setStore] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderType, setOrderType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [district, setDistrict] = useState("Colombo");
  const [streetAddress, setStreetAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");

  // Load store settings & delivery zones
  useEffect(() => {
    async function loadStore() {
      try {
        const res = await fetch("/api/store/settings");
        const data = await res.json();
        if (res.ok && data.store) {
          setStore(data.store);
        }
      } catch (err) {
        console.error("Failed to load store for checkout", err);
      } finally {
        setLoadingStore(false);
      }
    }
    loadStore();
  }, [slug]);

  // Calculate Delivery Fee dynamically
  let deliveryFee = 0;
  let matchedZone: any = null;

  if (orderType === "DELIVERY" && store?.deliveryZones) {
    const isFree = freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold;
    if (!isFree) {
      // Find zone matching selected district or fallback
      matchedZone =
        store.deliveryZones.find((z: any) =>
          z.areas.some((a: string) => a.toLowerCase().includes(district.toLowerCase()))
        ) || store.deliveryZones[0];

      deliveryFee = matchedZone ? Number(matchedZone.fee) : 350;
    }
  }

  const grandTotal = subtotal + deliveryFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Please provide your name and phone number");
      return;
    }

    if (orderType === "DELIVERY" && !streetAddress.trim()) {
      toast.error("Please provide your delivery address");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || null,
        type: orderType,
        deliveryAddress: orderType === "DELIVERY" ? `${streetAddress}, ${district}` : "Showroom Pickup",
        deliveryCity: orderType === "DELIVERY" ? district : "Colombo Showroom",
        deliveryNotes: deliveryNotes.trim() || null,
        zoneId: matchedZone?.id || null,
        paymentMethod,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      };

      const res = await fetch(`/api/store/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to place order");
      }

      // Order created successfully
      clearCart();
      toast.success("Order placed successfully!");
      router.push(`/store/${slug}/order/${data.orderNumber}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to complete order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingStore) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-muted-foreground">
        Loading checkout details...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={`/store/${slug}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Catalog
          </Link>
          <div className="text-xs font-mono text-muted-foreground">
            {store?.name || "Official Store"} • Secure Checkout
          </div>
        </div>

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Form Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Customer Info */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-bold text-base flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                1. Customer Contact Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Kasun Perera"
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Mobile Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 077 123 4567"
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    Courier driver will contact this number for delivery.
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="kasun@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Step 2: Delivery Method */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                2. Fulfillment Method & Sri Lankan Address
              </h2>

              {/* Delivery Type Selector */}
              <div className="grid grid-cols-2 gap-3">
                <label
                  onClick={() => setOrderType("DELIVERY")}
                  className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                    orderType === "DELIVERY"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-foreground">
                      Islandwide Delivery
                    </span>
                    <Truck className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Direct courier delivery to your doorstep (1-3 days).
                  </span>
                </label>

                <label
                  onClick={() => setOrderType("PICKUP")}
                  className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                    orderType === "PICKUP"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-foreground">
                      Store Pickup (Free)
                    </span>
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Collect from our showroom in Colombo.
                  </span>
                </label>
              </div>

              {/* Delivery Address Fields */}
              {orderType === "DELIVERY" && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        District *
                      </label>
                      <select
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      >
                        {SRI_LANKAN_DISTRICTS.map((d) => (
                          <option key={d} value={d}>
                            {d} District
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        City / Town *
                      </label>
                      <input
                        type="text"
                        required
                        value={deliveryCity}
                        onChange={(e) => setDeliveryCity(e.target.value)}
                        placeholder="e.g. Nugegoda / Dehiwala / Kandy"
                        className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Street Address / House No *
                    </label>
                    <input
                      type="text"
                      required
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="e.g. No. 45/2, Galle Road"
                      className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Delivery Landmarks / Special Instructions
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="e.g. Near supermarket, yellow gate"
                      className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Payment Method */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-bold text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                3. Payment Method
              </h2>

              <div className="space-y-3">
                {/* Cash on Delivery */}
                <label
                  onClick={() => setPaymentMethod("CASH")}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "CASH"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === "CASH"}
                    onChange={() => setPaymentMethod("CASH")}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-bold text-sm block text-foreground">
                      Cash on Delivery (COD)
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed block mt-0.5">
                      Pay cash or card to the courier delivery agent upon receiving your package at your doorstep.
                    </span>
                  </div>
                </label>

                {/* Direct Bank Transfer */}
                <label
                  onClick={() => setPaymentMethod("BANK_TRANSFER")}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "BANK_TRANSFER"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === "BANK_TRANSFER"}
                    onChange={() => setPaymentMethod("BANK_TRANSFER")}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <div className="w-full">
                    <span className="font-bold text-sm block text-foreground">
                      Direct Bank Transfer / LankaQR
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed block mt-0.5">
                      Transfer directly to our Sri Lankan commercial bank account and mention your Order #.
                    </span>

                    {paymentMethod === "BANK_TRANSFER" && (
                      <div className="mt-3 p-3 bg-muted/60 rounded-lg text-xs space-y-1.5 border">
                        <div className="font-semibold text-foreground">Bank Account Details:</div>
                        <p className="font-mono">Bank: Commercial Bank of Ceylon PLC</p>
                        <p className="font-mono">Account Name: ABC Electronics Pvt Ltd</p>
                        <p className="font-mono font-bold text-primary">Account No: 1000 2345 6789</p>
                        <p className="font-mono">Branch: Colombo Fort (001)</p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="space-y-6">
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4 sticky top-24">
              <h3 className="font-bold text-base flex items-center justify-between border-b pb-3">
                <span>Order Summary</span>
                <span className="text-xs font-normal text-muted-foreground">
                  ({totalItems} items)
                </span>
              </h3>

              {/* Items List */}
              <div className="divide-y divide-border max-h-64 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.productId} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="pr-2">
                      <p className="font-semibold text-foreground line-clamp-1">{item.name}</p>
                      <p className="text-muted-foreground font-mono text-[11px]">
                        Qty: {item.quantity} × Rs. {item.price.toLocaleString()}
                      </p>
                    </div>
                    <div className="font-mono font-bold text-foreground shrink-0">
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Cost Calculation */}
              <div className="border-t pt-3 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-medium text-foreground">
                    Rs. {subtotal.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery ({orderType === "PICKUP" ? "Pickup" : district}):</span>
                  <span>
                    {deliveryFee === 0 ? (
                      <span className="text-emerald-600 font-bold">FREE</span>
                    ) : (
                      `Rs. ${deliveryFee.toLocaleString()}`
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-base font-extrabold text-foreground border-t pt-2">
                  <span>Grand Total:</span>
                  <span className="text-primary font-mono">
                    Rs. {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || items.length === 0}
                className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm shadow-md hover:opacity-95 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: store?.primaryColor || "#4F46E5" }}
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? "Placing Your Order..." : "Confirm & Place Order"}
              </button>

              <div className="p-3 bg-muted/40 rounded-xl space-y-1 text-[11px] text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Official Warranty Protected
                </p>
                <p>
                  All devices are serialized and covered by authentic Sri Lankan warranty terms.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
