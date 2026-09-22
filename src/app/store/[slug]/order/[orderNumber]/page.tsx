import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Package,
  Truck,
  Clock,
  MapPin,
  Phone,
  Printer,
  ShoppingBag,
  ArrowLeft,
  Calendar,
  ShieldCheck,
} from "lucide-react";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; orderNumber: string }>;
}) {
  const { slug, orderNumber } = await params;

  const store = await prisma.onlineStore.findUnique({
    where: { slug },
    select: { name: true, slug: true, primaryColor: true, business: { select: { name: true, phone: true } } },
  });

  if (!store) notFound();

  const order = await prisma.onlineOrder.findFirst({
    where: { orderNumber },
    include: {
      items: true,
      delivery: true,
      branch: { select: { name: true } },
    },
  });

  if (!order) notFound();

  const delivery = order.delivery;

  const steps = [
    { key: "PENDING", label: "Order Received", desc: "Order details received" },
    { key: "CONFIRMED", label: "Confirmed", desc: "Stock allocated & verified" },
    { key: "READY", label: "Packed & Ready", desc: "Dispatched from warehouse" },
    { key: "OUT_FOR_DELIVERY", label: "In Transit", desc: "Out with courier driver" },
    { key: "DELIVERED", label: "Delivered", desc: "Delivered to customer" },
  ];

  const statusOrder = ["PENDING", "CONFIRMED", "PROCESSING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];
  const currentStatusIndex = statusOrder.indexOf(order.status);

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href={`/store/${store.slug}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {store.name}
          </Link>
          <span className="text-xs font-mono text-muted-foreground">
            Receipt #{order.orderNumber}
          </span>
        </div>

        {/* Success Card */}
        <div className="bg-card border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Thank You for Your Order!
            </h1>
            <p className="text-sm text-muted-foreground">
              Your order <strong className="text-primary font-mono">{order.orderNumber}</strong> has been successfully placed.
            </p>
          </div>

          {/* Stepper Progression */}
          <div className="p-4 sm:p-6 bg-muted/40 rounded-2xl border text-left space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              Live Delivery & Fulfillment Timeline
            </h3>

            <div className="grid grid-cols-5 gap-1 text-center">
              {steps.map((step, idx) => {
                const stepIdx = statusOrder.indexOf(step.key);
                const isCompleted = currentStatusIndex >= stepIdx && order.status !== "CANCELLED";
                const isCurrent = order.status === step.key;

                return (
                  <div key={idx} className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                        isCompleted
                          ? "bg-emerald-600 text-white"
                          : "bg-muted border text-muted-foreground"
                      } ${isCurrent ? "ring-4 ring-emerald-500/20" : ""}`}
                    >
                      {isCompleted ? "✓" : idx + 1}
                    </div>
                    <span className="text-[11px] font-bold text-foreground mt-1.5 leading-tight">
                      {step.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground hidden sm:block">
                      {step.desc}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Courier Tracking Details */}
            {delivery && delivery.trackingNo && (
              <div className="mt-4 p-3.5 bg-background rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  <div>
                    <span className="text-muted-foreground">Courier Partner: </span>
                    <strong className="text-foreground font-semibold">
                      {delivery.driverName || "Domestic Courier"}
                    </strong>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Waybill / Tracking No: </span>
                  <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {delivery.trackingNo}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Customer & Destination Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left text-xs bg-muted/20 p-4 rounded-2xl border">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Recipient Details
              </span>
              <p className="font-bold text-sm text-foreground">{order.customerName}</p>
              <p className="text-muted-foreground flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {order.customerPhone}
              </p>
              {order.customerEmail && <p className="text-muted-foreground">{order.customerEmail}</p>}
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Destination
              </span>
              <p className="font-medium text-foreground flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span>{order.deliveryAddress}</span>
              </p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-muted uppercase">
                {order.paymentMethod === "CASH" ? "Cash on Delivery" : order.paymentMethod}
              </span>
            </div>
          </div>

          {/* Purchased Items List */}
          <div className="text-left space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Order Items Breakdown
            </h3>
            <div className="divide-y divide-border border rounded-2xl p-4 bg-background">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-foreground">{item.name}</span>
                    <span className="text-muted-foreground font-mono text-[11px] block">
                      Qty: {item.quantity} × Rs. {Number(item.unitPrice).toLocaleString()}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-foreground">
                    Rs. {Number(item.total).toLocaleString()}
                  </span>
                </div>
              ))}

              <div className="pt-3 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>Rs. {Number(order.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Fee:</span>
                  <span>
                    {Number(order.deliveryFee) === 0 ? "FREE" : `Rs. ${Number(order.deliveryFee).toLocaleString()}`}
                  </span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-foreground border-t pt-2">
                  <span>Grand Total:</span>
                  <span className="text-primary font-mono">
                    Rs. {Number(order.total).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/store/${store.slug}`}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 shadow-sm"
              style={{ backgroundColor: store.primaryColor }}
            >
              Continue Shopping
            </Link>
            <Link
              href="/verify-warranty"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border bg-background hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Check Warranty Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
