"use client";

import React from "react";
import { Printer, X, Package, Truck, Phone, MapPin, Calendar } from "lucide-react";

interface PackingSlipModalProps {
  order: any;
  businessName?: string;
  onClose: () => void;
}

export function PackingSlipModal({ order, businessName = "Zentravo Retail", onClose }: PackingSlipModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const delivery = order.delivery;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between border-b pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">Dispatch Packing Slip & Invoice</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Slip
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted text-sm font-semibold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Packing Slip Area */}
        <div className="border border-dashed border-border rounded-xl p-6 bg-background space-y-6 font-sans text-foreground print:border-none print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight uppercase">{businessName}</h2>
              <p className="text-xs text-muted-foreground">Order Dispatch & Warehouse Fulfillment</p>
              <p className="text-xs text-muted-foreground">Colombo, Sri Lanka</p>
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold font-mono text-primary">{order.orderNumber}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                <Calendar className="w-3 h-3" />
                {new Date(order.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-muted uppercase tracking-wider">
                {order.type} ORDER
              </span>
            </div>
          </div>

          {/* Customer & Delivery Coordinates */}
          <div className="grid grid-cols-2 gap-4 p-3.5 bg-muted/40 rounded-xl text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Deliver To Customer:
              </span>
              <p className="font-bold text-sm text-foreground">{order.customerName}</p>
              <p className="text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {order.customerPhone}
              </p>
              {order.customerEmail && <p className="text-muted-foreground">{order.customerEmail}</p>}
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Delivery Destination:
              </span>
              <p className="font-medium text-foreground flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span>
                  {order.deliveryAddress || "Showroom Pickup"}
                  {order.deliveryCity ? `, ${order.deliveryCity}` : ""}
                </span>
              </p>
              {order.deliveryNotes && (
                <p className="text-amber-600 font-medium italic mt-1">
                  Note: {order.deliveryNotes}
                </p>
              )}
            </div>
          </div>

          {/* Courier & Dispatch Info */}
          <div className="flex items-center justify-between p-3 rounded-lg border text-xs">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              <div>
                <span className="text-muted-foreground">Assigned Courier: </span>
                <span className="font-semibold text-foreground">
                  {delivery?.driverName || "Standard Dispatch / In-house"}
                </span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Tracking Number: </span>
              <span className="font-mono font-bold text-foreground">
                {delivery?.trackingNo || "Pending Barcode"}
              </span>
            </div>
          </div>

          {/* Line Items Checklist */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Package Contents & Verification Checklist
            </h4>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/60 text-muted-foreground font-semibold">
                  <th className="py-2 px-2 w-8 text-center">Check</th>
                  <th className="py-2 px-2">Item Description</th>
                  <th className="py-2 px-2">SKU</th>
                  <th className="py-2 px-2 text-center">Qty</th>
                  <th className="py-2 px-2 text-right">Price</th>
                  <th className="py-2 px-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-muted/30">
                    <td className="py-2 px-2 text-center">
                      <span className="inline-block w-3.5 h-3.5 border rounded border-foreground/40" />
                    </td>
                    <td className="py-2 px-2 font-medium text-foreground">{item.name}</td>
                    <td className="py-2 px-2 font-mono text-muted-foreground text-[11px]">
                      {item.sku || "—"}
                    </td>
                    <td className="py-2 px-2 text-center font-bold">{item.quantity}</td>
                    <td className="py-2 px-2 text-right font-mono">
                      Rs. {Number(item.unitPrice).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-semibold">
                      Rs. {Number(item.total).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals & Payment Method */}
          <div className="border-t pt-3 flex items-start justify-between text-xs">
            <div className="space-y-1">
              <span className="text-muted-foreground">Payment Method: </span>
              <span className="font-bold text-foreground">
                {order.paymentMethod === "CASH" ? "Cash on Delivery (COD)" : order.paymentMethod}
              </span>
              <p className="text-[11px] text-muted-foreground">
                Payment Status:{" "}
                <span className={order.paymentStatus === "PAID" ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                  {order.paymentStatus}
                </span>
              </p>
              {order.paymentMethod === "CASH" && order.paymentStatus !== "PAID" && (
                <div className="mt-1 p-2 bg-amber-500/10 border border-amber-500/20 rounded font-bold text-amber-700 text-xs">
                  COLLECT COD AMOUNT: Rs. {Number(order.total).toLocaleString()}
                </div>
              )}
            </div>

            <div className="text-right space-y-1 w-48 font-mono">
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
              <div className="flex justify-between text-sm font-extrabold text-foreground border-t pt-1">
                <span>Total Due:</span>
                <span className="text-primary">Rs. {Number(order.total).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Footer Barcode / Signoff */}
          <div className="pt-4 border-t flex items-center justify-between text-[11px] text-muted-foreground">
            <div>
              <span>Packed By: ____________________</span>
            </div>
            <div>
              <span>Courier Signature: ____________________</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
