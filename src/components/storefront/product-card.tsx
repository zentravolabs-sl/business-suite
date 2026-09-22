"use client";

import React from "react";
import {
  ShieldCheck,
  Plus,
  ShoppingBag,
  Sparkles,
  Check,
} from "lucide-react";
import { useCart } from "@/context/cart-context";
import { toast } from "sonner";

export interface StorefrontProduct {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  sellingPrice: number;
  costPrice?: number;
  stockQuantity: number;
  warrantyMonths?: number | null;
  warrantyType?: string | null;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
}

interface ProductCardProps {
  product: StorefrontProduct;
  onSelectProduct: (product: StorefrontProduct) => void;
  primaryColor?: string;
}

export function ProductCard({
  product,
  onSelectProduct,
  primaryColor = "#4F46E5",
}: ProductCardProps) {
  const { addItem } = useCart();

  const isOutOfStock = product.stockQuantity <= 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;

    addItem({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      price: product.sellingPrice,
      maxStock: product.stockQuantity,
      warrantyMonths: product.warrantyMonths,
    });

    toast.success(`Added "${product.name}" to cart`);
  };

  return (
    <div
      onClick={() => onSelectProduct(product)}
      className="group bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {product.brand ? (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground border">
              {product.brand.name}
            </span>
          ) : (
            <span className="text-[10px] font-bold text-muted-foreground">
              {product.category?.name || "RETAIL"}
            </span>
          )}

          {/* Stock Indicator */}
          {isOutOfStock ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
              Out of Stock
            </span>
          ) : product.stockQuantity <= 3 ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              Only {product.stockQuantity} Left
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              In Stock
            </span>
          )}
        </div>

        {/* Thumbnail Preview Illustration */}
        <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-muted/30 to-muted/60 border flex items-center justify-center relative overflow-hidden mb-3.5 group-hover:scale-[1.02] transition-transform">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
          {product.warrantyMonths && product.warrantyMonths > 0 && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-background/90 backdrop-blur-sm border text-[10px] font-semibold text-emerald-600 shadow-sm">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>{product.warrantyMonths}M Warranty</span>
            </div>
          )}
        </div>

        {/* Product Information */}
        <h3 className="font-bold text-sm text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {product.sku && (
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
            SKU: {product.sku}
          </p>
        )}
      </div>

      {/* Pricing & Add to Cart */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] text-muted-foreground block leading-none">
            Price (LKR)
          </span>
          <span className="font-extrabold text-base font-mono text-foreground">
            Rs. {product.sellingPrice.toLocaleString()}
          </span>
        </div>

        <button
          onClick={handleQuickAdd}
          disabled={isOutOfStock}
          className="p-2 rounded-xl text-white shadow-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: primaryColor }}
          title={isOutOfStock ? "Out of stock" : "Quick Add to Cart"}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
