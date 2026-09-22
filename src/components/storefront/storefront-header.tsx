"use client";

import React from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Search,
  Truck,
  ShieldCheck,
  Phone,
  Store,
  MapPin,
  Clock,
} from "lucide-react";
import { useCart } from "@/context/cart-context";

interface StorefrontHeaderProps {
  store: {
    slug: string;
    name: string;
    tagline?: string | null;
    logo?: string | null;
    primaryColor: string;
    accentColor: string;
    allowCOD: boolean;
    freeDeliveryThreshold?: number | null;
  };
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function StorefrontHeader({
  store,
  searchQuery,
  onSearchChange,
}: StorefrontHeaderProps) {
  const { totalItems, subtotal, setIsCartOpen } = useCart();

  const freeThreshold = Number(store.freeDeliveryThreshold) || 50000;

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border transition-colors">
      {/* Top Announcement Bar */}
      <div
        className="text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-4 flex-wrap"
        style={{
          background: `linear-gradient(90deg, ${store.primaryColor} 0%, ${store.accentColor} 100%)`,
        }}
      >
        <span className="flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" />
          Free Islandwide Delivery on Orders Over Rs. {freeThreshold.toLocaleString()}
        </span>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Official Sri Lanka Genuine Warranty
        </span>
        {store.allowCOD && (
          <>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">Cash on Delivery Available Islandwide</span>
          </>
        )}
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <Link
          href={`/store/${store.slug}`}
          className="flex items-center gap-3 group shrink-0"
        >
          {store.logo ? (
            <img
              src={store.logo}
              alt={store.name}
              className="w-10 h-10 rounded-xl object-contain border bg-white p-1"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md text-base transition-transform group-hover:scale-105"
              style={{ backgroundColor: store.primaryColor }}
            >
              {store.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-extrabold text-lg sm:text-xl tracking-tight text-foreground flex items-center gap-2">
              <span>{store.name}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase">
                Official
              </span>
            </div>
            {store.tagline && (
              <p className="text-[11px] text-muted-foreground hidden md:block max-w-sm truncate">
                {store.tagline}
              </p>
            )}
          </div>
        </Link>

        {/* Universal Search Bar */}
        <div className="flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search products, brands, models..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-all"
            />
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/store/track"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Clock className="w-4 h-4 text-primary" />
            Track Order
          </Link>

          {/* Cart Trigger Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl border bg-background hover:bg-muted transition-all shadow-sm group"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
              {totalItems > 0 && (
                <span
                  className="absolute -top-2 -right-2 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow"
                  style={{ backgroundColor: store.primaryColor }}
                >
                  {totalItems}
                </span>
              )}
            </div>

            <div className="hidden lg:block text-left text-xs">
              <span className="text-[10px] text-muted-foreground block leading-none">
                My Cart
              </span>
              <span className="font-bold font-mono text-foreground leading-tight">
                Rs. {subtotal.toLocaleString()}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="px-4 pb-3 sm:hidden">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search phones, laptops, electronics..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border bg-muted/50 text-xs focus:outline-none focus:bg-background"
          />
        </div>
      </div>
    </header>
  );
}
