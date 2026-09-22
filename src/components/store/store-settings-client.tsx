"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Store,
  ExternalLink,
  Save,
  Truck,
  CreditCard,
  Palette,
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Building2,
  DollarSign,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface DeliveryZone {
  id: string;
  name: string;
  areas: string[];
  fee: number | any;
  minDays: number;
  maxDays: number;
  isActive: boolean;
}

interface OnlineStoreData {
  id: string;
  businessId: string;
  slug: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  primaryColor: string;
  accentColor: string;
  customDomain?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  isPublished: boolean;
  allowCOD: boolean;
  allowCard: boolean;
  allowOnline: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  minimumOrder?: number | any | null;
  freeDeliveryThreshold?: number | any | null;
  deliveryZones: DeliveryZone[];
}

export function StoreSettingsClient({ initialStore }: { initialStore: OnlineStoreData }) {
  const [store, setStore] = useState<OnlineStoreData>(initialStore);
  const [activeTab, setActiveTab] = useState<"profile" | "commerce" | "zones">("profile");
  const [saving, setSaving] = useState(false);

  // New Zone Modal state
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [newZone, setNewZone] = useState({
    name: "",
    areas: "",
    fee: 350,
    minDays: 1,
    maxDays: 2,
    isActive: true,
  });

  const handleSaveStore = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/store/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: store.name,
          slug: store.slug,
          tagline: store.tagline || "",
          description: store.description || "",
          logo: store.logo || "",
          banner: store.banner || "",
          primaryColor: store.primaryColor || "#4F46E5",
          accentColor: store.accentColor || "#7C3AED",
          isPublished: store.isPublished,
          allowCOD: store.allowCOD,
          allowCard: store.allowCard,
          allowOnline: store.allowOnline,
          deliveryEnabled: store.deliveryEnabled,
          pickupEnabled: store.pickupEnabled,
          minimumOrder: Number(store.minimumOrder) || 0,
          freeDeliveryThreshold: Number(store.freeDeliveryThreshold) || 50000,
          customDomain: store.customDomain || "",
          metaTitle: store.metaTitle || "",
          metaDescription: store.metaDescription || "",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      setStore((prev) => ({ ...prev, ...data.store }));
      toast.success("Online storefront settings updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZone.name.trim() || !newZone.areas.trim()) {
      toast.error("Please fill in zone name and areas");
      return;
    }

    try {
      const areasList = newZone.areas.split(",").map((a) => a.trim()).filter(Boolean);
      const res = await fetch("/api/store/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newZone.name,
          areas: areasList,
          fee: Number(newZone.fee),
          minDays: Number(newZone.minDays),
          maxDays: Number(newZone.maxDays),
          isActive: newZone.isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create zone");

      setStore((prev) => ({
        ...prev,
        deliveryZones: [...prev.deliveryZones, data.zone],
      }));

      setShowZoneModal(false);
      setNewZone({ name: "", areas: "", fee: 350, minDays: 1, maxDays: 2, isActive: true });
      toast.success("Delivery zone created successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to create delivery zone");
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm("Are you sure you want to delete this delivery zone?")) return;
    try {
      const res = await fetch(`/api/store/zones/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete zone");

      setStore((prev) => ({
        ...prev,
        deliveryZones: prev.deliveryZones.filter((z) => z.id !== id),
      }));
      toast.success("Delivery zone removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete zone");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Store className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Online Store Settings</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  store.isPublished
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                }`}
              >
                {store.isPublished ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live & Published
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" />
                    Draft / Unpublished
                  </>
                )}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your public e-commerce shop, branding, delivery rates, and payment options.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/store/${store.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-input bg-background hover:bg-muted font-medium text-sm transition-colors shadow-sm"
          >
            <ExternalLink className="w-4 h-4 text-primary" />
            Launch Live Storefront
          </Link>
          <button
            onClick={handleSaveStore}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving Changes..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "profile"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Palette className="w-4 h-4" />
          Store Profile & Branding
        </button>
        <button
          onClick={() => setActiveTab("commerce")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "commerce"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payments & Order Policies
        </button>
        <button
          onClick={() => setActiveTab("zones")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "zones"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck className="w-4 h-4" />
          Sri Lankan Delivery Zones ({store.deliveryZones.length})
        </button>
      </div>

      {/* Tab 1: Store Profile & Branding */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                General Store Identity
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Store Display Name *
                  </label>
                  <input
                    type="text"
                    value={store.name}
                    onChange={(e) => setStore({ ...store, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    placeholder="e.g. ABC Electronics Colombo"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Store URL Slug *
                  </label>
                  <div className="flex rounded-xl border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="bg-muted px-3 py-2.5 text-xs text-muted-foreground border-r flex items-center">
                      /store/
                    </span>
                    <input
                      type="text"
                      value={store.slug}
                      onChange={(e) =>
                        setStore({
                          ...store,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                        })
                      }
                      className="w-full px-3 py-2.5 bg-transparent text-sm focus:outline-none"
                      placeholder="abc-electronics"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Store Tagline
                </label>
                <input
                  type="text"
                  value={store.tagline || ""}
                  onChange={(e) => setStore({ ...store, tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  placeholder="Official Distributor of Premium Smartphones & Electronics"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  About Store / Description
                </label>
                <textarea
                  rows={3}
                  value={store.description || ""}
                  onChange={(e) => setStore({ ...store, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  placeholder="Sri Lanka's trusted tech retail showroom offering authentic products with genuine company warranty..."
                />
              </div>
            </div>

            {/* Visual Branding */}
            <div className="bg-card border rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                Color Theme & Media
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={store.primaryColor}
                      onChange={(e) => setStore({ ...store, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded-xl border cursor-pointer bg-transparent p-1"
                    />
                    <input
                      type="text"
                      value={store.primaryColor}
                      onChange={(e) => setStore({ ...store, primaryColor: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border bg-background text-sm uppercase font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={store.accentColor}
                      onChange={(e) => setStore({ ...store, accentColor: e.target.value })}
                      className="w-10 h-10 rounded-xl border cursor-pointer bg-transparent p-1"
                    />
                    <input
                      type="text"
                      value={store.accentColor}
                      onChange={(e) => setStore({ ...store, accentColor: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border bg-background text-sm uppercase font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Store Logo URL
                  </label>
                  <input
                    type="url"
                    value={store.logo || ""}
                    onChange={(e) => setStore({ ...store, logo: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm"
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Store Banner Image URL
                  </label>
                  <input
                    type="url"
                    value={store.banner || ""}
                    onChange={(e) => setStore({ ...store, banner: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm"
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Preview Card */}
          <div className="space-y-6">
            <div className="bg-card border rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Live Storefront Card Preview
              </h3>

              <div className="rounded-2xl border overflow-hidden shadow-sm bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow"
                    style={{ backgroundColor: store.primaryColor }}
                  >
                    {store.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-base leading-tight">{store.name}</h4>
                    <p className="text-xs text-slate-300">zentravo.lk/store/{store.slug}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2">
                  {store.tagline || "Browse our catalog of authentic Sri Lankan retail products."}
                </p>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Islandwide Delivery
                  </span>
                  <span>{store.deliveryZones.length} Shipping Zones</span>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-xl space-y-2 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Storefront URL:
                </p>
                <div className="flex items-center justify-between bg-background p-2 rounded border font-mono text-foreground break-all">
                  <span>/store/{store.slug}</span>
                  <Link
                    href={`/store/${store.slug}`}
                    target="_blank"
                    className="text-primary hover:underline ml-2"
                  >
                    Open
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Payments & Order Policies */}
      {activeTab === "commerce" && (
        <div className="max-w-3xl space-y-6">
          <div className="bg-card border rounded-2xl p-6 space-y-6">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              Store Publication Status
            </h3>

            <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border">
              <div>
                <p className="font-medium text-sm">Publish Store to Public</p>
                <p className="text-xs text-muted-foreground">
                  Allow customers to browse your products and checkout online.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={store.isPublished}
                  onChange={(e) => setStore({ ...store, isPublished: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Accepted Payment Methods
              </h4>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3.5 bg-background border rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={store.allowCOD}
                    onChange={(e) => setStore({ ...store, allowCOD: e.target.checked })}
                    className="mt-1 rounded text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-medium text-sm block">Cash on Delivery (COD)</span>
                    <span className="text-xs text-muted-foreground">
                      Customer pays cash or card upon receiving items from courier driver.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 bg-background border rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={store.allowOnline}
                    onChange={(e) => setStore({ ...store, allowOnline: e.target.checked })}
                    className="mt-1 rounded text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-medium text-sm block">
                      Direct Bank Transfer / LankaQR
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Displays your Sri Lankan Commercial/Sampath/HNB Bank details with payment slip reference instructions.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Order Economics & Free Shipping
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Minimum Order Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={store.minimumOrder || 0}
                    onChange={(e) =>
                      setStore({ ...store, minimumOrder: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm"
                    placeholder="1500"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Orders below this subtotal will be prevented from checkout.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Free Delivery Threshold (Rs.)
                  </label>
                  <input
                    type="number"
                    value={store.freeDeliveryThreshold || 50000}
                    onChange={(e) =>
                      setStore({
                        ...store,
                        freeDeliveryThreshold: Number(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm"
                    placeholder="50000"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Orders exceeding this subtotal automatically receive Rs. 0 delivery.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Delivery Zones */}
      {activeTab === "zones" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Sri Lankan Shipping & Delivery Zones</h3>
              <p className="text-xs text-muted-foreground">
                Set shipping fees and estimated turnaround for specific districts and areas.
              </p>
            </div>
            <button
              onClick={() => setShowZoneModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Delivery Zone
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {store.deliveryZones.map((zone) => (
              <div
                key={zone.id}
                className="bg-card border rounded-2xl p-5 shadow-sm space-y-4 relative group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-base text-foreground">{zone.name}</h4>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      {zone.minDays === 0 && zone.maxDays <= 1
                        ? "Same Day"
                        : `${zone.minDays}-${zone.maxDays} Business Days`}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary">
                      {Number(zone.fee) === 0 ? "FREE" : `Rs. ${Number(zone.fee).toLocaleString()}`}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Covered Locations:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {zone.areas.map((area, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      zone.isActive ? "text-emerald-600" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        zone.isActive ? "bg-emerald-500" : "bg-muted-foreground"
                      }`}
                    />
                    {zone.isActive ? "Active Zone" : "Disabled"}
                  </span>

                  <button
                    onClick={() => handleDeleteZone(zone.id)}
                    className="text-muted-foreground hover:text-rose-600 p-1 rounded transition-colors"
                    title="Delete zone"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Delivery Zone Modal */}
      {showZoneModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                Add Delivery Zone
              </h3>
              <button
                onClick={() => setShowZoneModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddZone} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Zone Title *
                </label>
                <input
                  type="text"
                  required
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border bg-background text-sm"
                  placeholder="e.g. Southern Province Express (Galle & Matara)"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Covered Areas / Cities (comma separated) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={newZone.areas}
                  onChange={(e) => setNewZone({ ...newZone, areas: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border bg-background text-sm"
                  placeholder="Galle, Matara, Hikkaduwa, Weligama, Unawatuna"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                    Fee (Rs.) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newZone.fee}
                    onChange={(e) => setNewZone({ ...newZone, fee: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl border bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                    Min Days
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newZone.minDays}
                    onChange={(e) =>
                      setNewZone({ ...newZone, minDays: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                    Max Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newZone.maxDays}
                    onChange={(e) =>
                      setNewZone({ ...newZone, maxDays: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border bg-background text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowZoneModal(false)}
                  className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
                >
                  Create Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
