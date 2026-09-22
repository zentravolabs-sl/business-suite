"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Truck,
  ShieldCheck,
  CreditCard,
  PhoneCall,
  Search,
  Package,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { ProductCard, StorefrontProduct } from "@/components/storefront/product-card";
import { ProductDetailModal } from "@/components/storefront/product-detail-modal";

interface StorefrontClientProps {
  store: {
    id: string;
    slug: string;
    name: string;
    tagline?: string | null;
    description?: string | null;
    logo?: string | null;
    banner?: string | null;
    primaryColor: string;
    accentColor: string;
    allowCOD: boolean;
    freeDeliveryThreshold?: number | null;
    business: {
      id: string;
      name: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      city?: string | null;
    };
    deliveryZones: any[];
  };
  initialProducts: StorefrontProduct[];
  categories: { id: string; name: string }[];
}

export function StorefrontClient({
  store,
  initialProducts,
  categories,
}: StorefrontClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [inspectingProduct, setInspectingProduct] = useState<StorefrontProduct | null>(null);

  const filteredProducts = initialProducts.filter((product) => {
    const matchesCategory =
      selectedCategory === "ALL" || product.category?.id === selectedCategory;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.brand && product.brand.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col">
      {/* Dynamic Header */}
      <StorefrontHeader
        store={store}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 w-full">
        {/* Hero Banner */}
        <div
          className="relative rounded-3xl p-6 sm:p-10 text-white overflow-hidden shadow-xl"
          style={{
            background: `linear-gradient(135deg, #0F172A 0%, ${store.primaryColor} 100%)`,
          }}
        >
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/20 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Official Sri Lankan Retail Storefront
            </span>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              {store.name}
            </h1>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-xl">
              {store.tagline ||
                "Browse our catalog of authentic mobile phones, laptops, electronics, and accessories with official warranty and express islandwide delivery."}
            </p>

            {/* Value Proposition Pills */}
            <div className="pt-2 flex flex-wrap gap-2.5 sm:gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10 font-medium">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Islandwide Courier</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10 font-medium">
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>Official Warranty Included</span>
              </div>
              {store.allowCOD && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10 font-medium">
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  <span>Cash on Delivery</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Pills Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === "ALL"
                ? "text-white shadow-sm"
                : "bg-muted/80 text-muted-foreground hover:text-foreground"
            }`}
            style={{
              backgroundColor: selectedCategory === "ALL" ? store.primaryColor : undefined,
            }}
          >
            All Products ({initialProducts.length})
          </button>

          {categories.map((category) => {
            const count = initialProducts.filter((p) => p.category?.id === category.id).length;
            if (count === 0) return null;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === category.id
                    ? "text-white shadow-sm"
                    : "bg-muted/80 text-muted-foreground hover:text-foreground"
                }`}
                style={{
                  backgroundColor:
                    selectedCategory === category.id ? store.primaryColor : undefined,
                }}
              >
                {category.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Product Catalog Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>Catalog Products</span>
              <span className="text-xs text-muted-foreground font-normal">
                ({filteredProducts.length} items available)
              </span>
            </h2>

            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-primary font-medium hover:underline"
              >
                Clear Search Filter
              </button>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground bg-card border rounded-2xl space-y-2">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/30" />
              <p className="font-semibold text-base text-foreground">No matching products found</p>
              <p className="text-xs">Try adjusting your search query or selecting a different category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelectProduct={setInspectingProduct}
                  primaryColor={store.primaryColor}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12 py-10 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-foreground">{store.name}</h4>
            <p className="text-xs leading-relaxed max-w-sm">
              {store.description ||
                "Sri Lanka's trusted retail platform providing genuine electronics, mobile devices, and appliances with certified warranty."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Powered by <strong>Zentravo BMS</strong> Multi-Tenant Retail Engine
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-sm text-foreground">Customer Service & Care</h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/verify-warranty" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  Verify Digital Warranty
                </Link>
              </li>
              <li>
                <Link href="/store/track" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Track Live Order Status
                </Link>
              </li>
              <li>
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-primary" />
                  Islandwide Delivery: 1-4 Business Days
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-sm text-foreground">Contact & Store Location</h4>
            <p className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                {store.business.address || "Flagship Showroom"}, {store.business.city || "Colombo, Sri Lanka"}
              </span>
            </p>
            {store.business.phone && (
              <p className="flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Hotline: {store.business.phone}</span>
              </p>
            )}
            <p className="text-[11px] pt-2">
              © {new Date().getFullYear()} {store.name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Inspect Product Modal */}
      {inspectingProduct && (
        <ProductDetailModal
          product={inspectingProduct}
          storeSlug={store.slug}
          primaryColor={store.primaryColor}
          onClose={() => setInspectingProduct(null)}
        />
      )}
    </div>
  );
}
