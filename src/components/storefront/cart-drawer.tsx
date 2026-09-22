"use client";

import React from "react";
import Link from "next/link";
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Truck,
  ShieldCheck,
} from "lucide-react";
import { useCart } from "@/context/cart-context";

interface CartDrawerProps {
  storeSlug: string;
  primaryColor?: string;
}

export function CartDrawer({ storeSlug, primaryColor = "#4F46E5" }: CartDrawerProps) {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeItem,
    totalItems,
    subtotal,
    freeDeliveryProgress,
    remainingForFreeDelivery,
    freeDeliveryThreshold,
  } = useCart();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="bg-card border-l w-full max-w-md h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">Your Cart ({totalItems})</h3>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Delivery Meter */}
          {freeDeliveryThreshold > 0 && (
            <div className="p-3 bg-muted/60 rounded-xl space-y-2 border">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Truck className="w-3.5 h-3.5 text-primary" />
                  {remainingForFreeDelivery === 0 ? (
                    <span className="text-emerald-600 font-bold">
                      🎉 Free Islandwide Delivery Unlocked!
                    </span>
                  ) : (
                    <span>
                      Add{" "}
                      <span className="text-primary font-bold">
                        Rs. {remainingForFreeDelivery.toLocaleString()}
                      </span>{" "}
                      more for FREE delivery
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">{freeDeliveryProgress}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${freeDeliveryProgress}%`,
                    backgroundColor: remainingForFreeDelivery === 0 ? "#10B981" : primaryColor,
                  }}
                />
              </div>
            </div>
          )}

          {/* Items List */}
          <div className="divide-y divide-border overflow-y-auto max-h-[50vh] pr-1">
            {items.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-3">
                <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground/30" />
                <p className="font-medium text-sm">Your shopping cart is empty</p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
                >
                  Explore Products
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.productId} className="py-3.5 flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-xs text-foreground line-clamp-2">
                      {item.name}
                    </h4>
                    {item.warrantyMonths && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium mt-0.5">
                        <ShieldCheck className="w-3 h-3" />
                        {item.warrantyMonths} Mo Warranty
                      </span>
                    )}
                    <div className="text-xs font-bold font-mono text-primary mt-1">
                      Rs. {item.price.toLocaleString()}
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="px-2 py-1 text-muted-foreground hover:bg-muted text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 py-0.5 text-xs font-bold text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="px-2 py-1 text-muted-foreground hover:bg-muted text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-foreground">
                          Rs. {(item.price * item.quantity).toLocaleString()}
                        </span>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-muted-foreground hover:text-rose-600 p-1 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Checkout Section */}
        {items.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({totalItems} items):</span>
                <span className="font-semibold text-foreground">
                  Rs. {subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Estimated Islandwide Delivery:</span>
                <span>
                  {remainingForFreeDelivery === 0 ? (
                    <span className="text-emerald-600 font-bold">FREE</span>
                  ) : (
                    "Calculated at checkout"
                  )}
                </span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-foreground border-t pt-2">
                <span>Total Amount:</span>
                <span className="text-primary">Rs. {subtotal.toLocaleString()}</span>
              </div>
            </div>

            <Link
              href={`/store/${storeSlug}/checkout`}
              onClick={() => setIsCartOpen(false)}
              className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <p className="text-[11px] text-center text-muted-foreground">
              🔒 Safe & Secure Checkout • Cash on Delivery / Bank Transfer
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
