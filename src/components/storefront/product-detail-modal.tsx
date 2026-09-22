"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Plus,
  Minus,
  CheckCircle2,
  Tag,
  Barcode,
  Share2,
} from "lucide-react";
import { StorefrontProduct } from "./product-card";
import { useCart } from "@/context/cart-context";
import { toast } from "sonner";

interface ProductDetailModalProps {
  product: StorefrontProduct;
  storeSlug: string;
  primaryColor?: string;
  onClose: () => void;
}

export function ProductDetailModal({
  product,
  storeSlug,
  primaryColor = "#4F46E5",
  onClose,
}: ProductDetailModalProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  const isOutOfStock = product.stockQuantity <= 0;
  const maxAvailable = Math.max(1, product.stockQuantity);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addItem(
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.sellingPrice,
        maxStock: product.stockQuantity,
        warrantyMonths: product.warrantyMonths,
      },
      quantity
    );
    toast.success(`Added ${quantity} x "${product.name}" to cart`);
    onClose();
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    addItem(
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.sellingPrice,
        maxStock: product.stockQuantity,
        warrantyMonths: product.warrantyMonths,
      },
      quantity
    );
    onClose();
    router.push(`/store/${storeSlug}/checkout`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-150 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left: Product Media Gallery */}
          <div className="space-y-3">
            <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-muted/40 to-muted/80 border flex items-center justify-center relative overflow-hidden">
              <ShoppingBag className="w-20 h-20 text-muted-foreground/30" />

              {product.warrantyMonths && product.warrantyMonths > 0 && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/90 backdrop-blur-sm border text-xs font-semibold text-emerald-600 shadow-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{product.warrantyMonths} Months Official Warranty</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <Truck className="w-4 h-4 text-primary" />
                <span>Islandwide Delivery & In-store Pickup Available</span>
              </div>
              <p className="text-[11px]">
                Orders placed before 2:00 PM are dispatched same-day with standard courier delivery across Sri Lanka.
              </p>
            </div>
          </div>

          {/* Right: Details & Purchase Options */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {product.brand && (
                  <span className="text-xs font-extrabold uppercase tracking-wider text-primary">
                    {product.brand.name}
                  </span>
                )}
                {product.category && (
                  <span className="text-xs text-muted-foreground">• {product.category.name}</span>
                )}
              </div>

              <h2 className="text-xl font-bold tracking-tight text-foreground leading-snug">
                {product.name}
              </h2>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                {product.sku && (
                  <span className="font-mono flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    SKU: {product.sku}
                  </span>
                )}
                {product.barcode && (
                  <span className="font-mono flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5" />
                    {product.barcode}
                  </span>
                )}
              </div>
            </div>

            {/* Price Block */}
            <div className="p-4 bg-muted/40 rounded-2xl border space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block">
                Official Retail Price
              </span>
              <div className="text-2xl font-black font-mono text-foreground">
                Rs. {product.sellingPrice.toLocaleString()}
              </div>
              <p className="text-[11px] text-emerald-600 font-medium">
                Inclusive of all applicable Sri Lankan duties & taxes
              </p>
            </div>

            {/* Stock Availability */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Availability:</span>
              {isOutOfStock ? (
                <span className="font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded">
                  Out of Stock
                </span>
              ) : (
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  In Stock ({product.stockQuantity} available)
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
                  Description
                </span>
                <p className="line-clamp-3 leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* Quantity Stepper */}
            {!isOutOfStock && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Select Quantity:
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border rounded-xl overflow-hidden bg-background">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-2 text-muted-foreground hover:bg-muted text-sm"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-4 py-1 text-sm font-bold text-foreground font-mono">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(maxAvailable, q + 1))}
                      className="px-3 py-2 text-muted-foreground hover:bg-muted text-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Total: <strong className="font-mono text-foreground">Rs. {(product.sellingPrice * quantity).toLocaleString()}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-3 border-t flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex-1 py-3 px-4 rounded-xl border border-input bg-background hover:bg-muted font-bold text-xs text-foreground transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
              >
                <ShoppingBag className="w-4 h-4" />
                Add to Cart
              </button>

              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className="flex-1 py-3 px-4 rounded-xl text-white font-bold text-xs shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ backgroundColor: primaryColor }}
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
