"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Package,
  Search,
  Clock,
  Truck,
  CheckCircle2,
  MapPin,
  Phone,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;

    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const res = await fetch(
        `/api/store/track?orderNumber=${encodeURIComponent(orderNumber.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order not found");

      setOrder(data.order);
    } catch (err: any) {
      setError(err.message || "Failed to find order");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { key: "PENDING", label: "Received" },
    { key: "CONFIRMED", label: "Confirmed" },
    { key: "READY", label: "Packed & Ready" },
    { key: "OUT_FOR_DELIVERY", label: "Out For Delivery" },
    { key: "DELIVERED", label: "Delivered" },
  ];

  const statusOrder = [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];
  const currentStatusIndex = order ? statusOrder.indexOf(order.status) : -1;

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Card Header & Lookup Form */}
        <div className="bg-card border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Track Your Sri Lankan Retail Order
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Enter your official Order Reference Number (e.g. ORD-2026-00001) to view live courier status.
            </p>
          </div>

          <form onSubmit={handleTrack} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Order Reference Number *
              </label>
              <div className="relative">
                <Package className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. ORD-2026-00001"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-background text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {loading ? "Searching Tracking Status..." : "Track Live Order"}
            </button>
          </form>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Tracking Result Card */}
        {order && (
          <div className="bg-card border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Order Status
                </span>
                <h2 className="text-xl font-black font-mono text-primary">
                  {order.orderNumber}
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
                {order.status.replace(/_/g, " ")}
              </span>
            </div>

            {/* Stepper Progression */}
            <div className="p-4 bg-muted/40 rounded-2xl border space-y-4">
              <div className="grid grid-cols-5 gap-1 text-center">
                {steps.map((step, idx) => {
                  const stepIdx = statusOrder.indexOf(step.key);
                  const isCompleted =
                    currentStatusIndex >= stepIdx && order.status !== "CANCELLED";

                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-muted border text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-medium text-foreground mt-1">
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {order.delivery?.trackingNo && (
                <div className="mt-3 p-3 bg-background rounded-xl border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    <span>Courier: <strong>{order.delivery.driverName || "Standard Courier"}</strong></span>
                  </div>
                  <span>Waybill: <strong className="font-mono text-primary">{order.delivery.trackingNo}</strong></span>
                </div>
              )}
            </div>

            {/* Items Summary */}
            <div className="space-y-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-muted-foreground block">
                Items in Package
              </span>
              <div className="divide-y divide-border border rounded-xl p-3 bg-background">
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="py-2 flex justify-between">
                    <span>
                      {item.name} <strong className="text-muted-foreground">× {item.quantity}</strong>
                    </span>
                    <span className="font-mono font-bold">
                      Rs. {Number(item.total).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
