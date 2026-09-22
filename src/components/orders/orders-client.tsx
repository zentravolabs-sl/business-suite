"use client";

import React, { useState } from "react";
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  AlertTriangle,
  Search,
  Printer,
  ChevronRight,
  Phone,
  MapPin,
  Calendar,
  X,
  RefreshCw,
  ExternalLink,
  DollarSign,
  User,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PackingSlipModal } from "./packing-slip-modal";

interface OrderItem {
  id: string;
  productId: string;
  name: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface DeliveryInfo {
  id: string;
  driverName?: string | null;
  driverPhone?: string | null;
  trackingNo?: string | null;
  status: string;
  assignedAt?: string | null;
  deliveredAt?: string | null;
  notes?: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryAddress?: string | null;
  deliveryCity?: string | null;
  deliveryNotes?: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  confirmedAt?: string | null;
  readyAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  items: OrderItem[];
  delivery?: DeliveryInfo | null;
  branch?: { id: string; name: string } | null;
}

const SRI_LANKAN_COURIERS = [
  "Domex Courier",
  "Pronto Lanka",
  "Koombiyo Delivery",
  "Prompt Xpress",
  "Fardar Express",
  "Certis Lanka",
  "In-house Store Driver",
];

export function OrdersClient({
  initialOrders,
  businessName,
}: {
  initialOrders: Order[];
  businessName: string;
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeStatus, setActiveStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  // Courier Dispatch Form State
  const [courierName, setCourierName] = useState("Domex Courier");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = activeStatus === "ALL" || o.status === activeStatus;
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone.includes(searchQuery) ||
      (o.deliveryCity && o.deliveryCity.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // KPI calculations
  const totalOrders = orders.length;
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const processingCount = orders.filter((o) =>
    ["CONFIRMED", "PROCESSING", "READY"].includes(o.status)
  ).length;
  const inTransitCount = orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length;
  const deliveredCount = orders.filter((o) =>
    ["DELIVERED", "COMPLETED"].includes(o.status)
  ).length;
  const totalRevenue = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.total), 0);

  const handleUpdateStatus = async (
    orderId: string,
    nextStatus: string,
    customData: any = {}
  ) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          ...customData,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update order status");

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...data.order } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...data.order } : null));
      }

      toast.success(`Order ${nextStatus.replace(/_/g, " ")} successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "CONFIRMED":
        return "bg-sky-500/10 text-sky-600 border-sky-500/20";
      case "PROCESSING":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "READY":
        return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
      case "OUT_FOR_DELIVERY":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "DELIVERED":
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border rounded-2xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Package className="w-7 h-7 text-primary" />
            Online Order Management & Fulfillment
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track web store orders, manage stock reservations, and fulfill islandwide Sri Lankan deliveries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-background hover:bg-muted text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            Refresh Feed
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Orders
          </span>
          <div className="text-2xl font-black text-foreground">{totalOrders}</div>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-1 border-amber-500/30">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
            Pending Confirm
          </span>
          <div className="text-2xl font-black text-amber-600">{pendingCount}</div>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            In Processing
          </span>
          <div className="text-2xl font-black text-blue-600">{processingCount}</div>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">
            Out for Delivery
          </span>
          <div className="text-2xl font-black text-purple-600">{inTransitCount}</div>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
            Delivered
          </span>
          <div className="text-2xl font-black text-emerald-600">{deliveredCount}</div>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Online Volume
          </span>
          <div className="text-lg sm:text-xl font-black text-primary truncate">
            Rs. {totalRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Pipeline Navigation & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            { key: "ALL", label: "All Orders", count: totalOrders },
            { key: "PENDING", label: "Pending", count: pendingCount },
            { key: "CONFIRMED", label: "Confirmed", count: orders.filter((o) => o.status === "CONFIRMED").length },
            { key: "PROCESSING", label: "Processing", count: orders.filter((o) => o.status === "PROCESSING").length },
            { key: "READY", label: "Ready", count: orders.filter((o) => o.status === "READY").length },
            { key: "OUT_FOR_DELIVERY", label: "In Transit", count: inTransitCount },
            { key: "DELIVERED", label: "Delivered", count: deliveredCount },
            { key: "CANCELLED", label: "Cancelled", count: orders.filter((o) => o.status === "CANCELLED").length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeStatus === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeStatus === tab.key ? "bg-white/20 text-white" : "bg-background/80 text-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Order #, Customer, Phone..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3.5 px-4">Order Ref</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Destination</th>
                <th className="py-3.5 px-4">Items</th>
                <th className="py-3.5 px-4 text-right">Total (LKR)</th>
                <th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4">Fulfillment Status</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-medium text-base">No online orders found</p>
                    <p className="text-xs">Incoming customer orders will appear here in real-time.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      {order.orderNumber}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground">{order.customerName}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {order.customerPhone}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className="font-medium text-foreground">
                        {order.deliveryCity || (order.type === "PICKUP" ? "Showroom Pickup" : "Islandwide")}
                      </span>
                      {order.type === "PICKUP" && (
                        <span className="block text-[10px] text-primary font-bold">PICKUP</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium">
                      {order.items.reduce((acc, i) => acc + i.quantity, 0)} units ({order.items.length} sku)
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                      Rs. {Number(order.total).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className="font-medium text-foreground block">
                        {order.paymentMethod === "CASH" ? "Cash on Delivery" : order.paymentMethod}
                      </span>
                      <span
                        className={`inline-block text-[10px] font-bold uppercase px-1.5 py-0.2 rounded mt-0.5 ${
                          order.paymentStatus === "PAID"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(
                          order.status
                        )}`}
                      >
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fulfillment & Order Details Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-card border-l w-full max-w-2xl h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold font-mono text-primary">
                      {selectedOrder.orderNumber}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(
                        selectedOrder.status
                      )}`}
                    >
                      {selectedOrder.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    Placed on {new Date(selectedOrder.createdAt).toLocaleString("en-GB")}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPrintOrder(selectedOrder)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-background hover:bg-muted text-xs font-medium"
                    title="Print Dispatch Packing Slip"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Packing Slip
                  </button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Status Progression Stepper */}
              <div className="bg-muted/40 border rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Order Fulfillment Pipeline
                </span>

                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    { label: "Received", step: "PENDING" },
                    { label: "Confirmed", step: "CONFIRMED" },
                    { label: "Packed", step: "READY" },
                    { label: "In Transit", step: "OUT_FOR_DELIVERY" },
                    { label: "Delivered", step: "DELIVERED" },
                  ].map((s, idx) => {
                    const isCurrent = selectedOrder.status === s.step;
                    const orderStatuses = [
                      "PENDING",
                      "CONFIRMED",
                      "PROCESSING",
                      "READY",
                      "OUT_FOR_DELIVERY",
                      "DELIVERED",
                    ];
                    const currentIndex = orderStatuses.indexOf(selectedOrder.status);
                    const stepIndex = orderStatuses.indexOf(s.step);
                    const isPassed = currentIndex >= stepIndex && selectedOrder.status !== "CANCELLED";

                    return (
                      <div key={idx} className="flex flex-col items-center">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isPassed
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted border text-muted-foreground"
                          }`}
                        >
                          {isPassed ? "✓" : idx + 1}
                        </div>
                        <span className="text-[11px] font-medium text-foreground mt-1">
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Stepper Next Action Buttons */}
                <div className="pt-2 border-t flex flex-wrap items-center gap-2">
                  {selectedOrder.status === "PENDING" && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, "CONFIRMED")}
                      disabled={updating}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm Order & Deduct Inventory
                    </button>
                  )}

                  {selectedOrder.status === "CONFIRMED" && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, "PROCESSING")}
                      disabled={updating}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow"
                    >
                      <Package className="w-4 h-4" />
                      Start Warehouse Picking & Packing
                    </button>
                  )}

                  {selectedOrder.status === "PROCESSING" && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, "READY")}
                      disabled={updating}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Ready for Dispatch
                    </button>
                  )}

                  {selectedOrder.status === "OUT_FOR_DELIVERY" && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, "DELIVERED")}
                      disabled={updating}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Delivered (Confirm COD Payment)
                    </button>
                  )}

                  {selectedOrder.status !== "CANCELLED" && selectedOrder.status !== "DELIVERED" && (
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            "Are you sure you want to cancel this order? Any deducted inventory will be automatically returned to stock."
                          )
                        ) {
                          handleUpdateStatus(selectedOrder.id, "CANCELLED");
                        }
                      }}
                      disabled={updating}
                      className="py-2.5 px-4 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 font-semibold text-xs transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>

              {/* Courier Dispatch Box (When Ready or In Transit) */}
              {(selectedOrder.status === "READY" || selectedOrder.status === "CONFIRMED" || selectedOrder.status === "OUT_FOR_DELIVERY") && (
                <div className="bg-card border rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    Courier Dispatch & Waybill Assignment
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Courier Partner
                      </label>
                      <select
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border bg-background text-xs"
                      >
                        {SRI_LANKAN_COURIERS.map((c, i) => (
                          <option key={i} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Waybill / Tracking No.
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="e.g. DMX-893472"
                        className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-mono"
                      />
                    </div>
                  </div>

                  {selectedOrder.status !== "OUT_FOR_DELIVERY" && (
                    <button
                      onClick={() =>
                        handleUpdateStatus(selectedOrder.id, "OUT_FOR_DELIVERY", {
                          driverName: courierName,
                          trackingNo: trackingNumber || `TRK-${Date.now().toString().slice(-6)}`,
                          driverPhone: driverPhone || null,
                        })
                      }
                      disabled={updating}
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow"
                    >
                      <Truck className="w-4 h-4" />
                      Handover to Courier & Set Out For Delivery
                    </button>
                  )}
                </div>
              )}

              {/* Customer Coordinates */}
              <div className="bg-card border rounded-2xl p-4 space-y-3 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-muted-foreground">
                  Customer & Shipping Destination
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">Customer Name</span>
                    <p className="font-bold text-foreground text-sm">{selectedOrder.customerName}</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {selectedOrder.customerPhone}
                    </p>
                    {selectedOrder.customerEmail && (
                      <p className="text-muted-foreground">{selectedOrder.customerEmail}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground block">Destination</span>
                    <p className="font-medium text-foreground flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>
                        {selectedOrder.deliveryAddress || "Showroom Collection"}
                        {selectedOrder.deliveryCity ? `, ${selectedOrder.deliveryCity}` : ""}
                      </span>
                    </p>
                    {selectedOrder.deliveryNotes && (
                      <p className="text-amber-600 italic">
                        Note: {selectedOrder.deliveryNotes}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Itemized Order Line Items */}
              <div className="bg-card border rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Purchased Items ({selectedOrder.items.length})
                </h4>

                <div className="divide-y divide-border">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="text-muted-foreground font-mono text-[11px]">
                          SKU: {item.sku || "—"} • Qty: {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-foreground">
                          Rs. {Number(item.total).toLocaleString()}
                        </span>
                        <span className="block text-[11px] text-muted-foreground font-mono">
                          @ Rs. {Number(item.unitPrice).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Breakdown */}
                <div className="pt-3 border-t space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>Rs. {Number(selectedOrder.subtotal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Fee:</span>
                    <span>
                      {Number(selectedOrder.deliveryFee) === 0
                        ? "FREE"
                        : `Rs. ${Number(selectedOrder.deliveryFee).toLocaleString()}`}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-base text-foreground border-t pt-2">
                    <span>Total Amount:</span>
                    <span className="text-primary">
                      Rs. {Number(selectedOrder.total).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t flex items-center justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 rounded-xl border text-sm font-medium hover:bg-muted"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Dispatch Packing Slip Modal */}
      {printOrder && (
        <PackingSlipModal
          order={printOrder}
          businessName={businessName}
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  );
}
