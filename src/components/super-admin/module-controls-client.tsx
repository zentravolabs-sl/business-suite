"use client";

import { useState } from "react";
import {
  Receipt,
  Store,
  Shield,
  Wrench,
  Gift,
  Loader2,
  CheckCircle,
  XCircle,
  Settings2,
  Building2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Business {
  id: string;
  name: string;
  category: string;
  status: string;
  ordersEnabled: boolean;
  ecommerceEnabled: boolean;
  warrantyEnabled: boolean;
  serviceEnabled: boolean;
  loyaltyEnabled: boolean;
}

interface Module {
  key: keyof Pick<
    Business,
    "ordersEnabled" | "ecommerceEnabled" | "warrantyEnabled" | "serviceEnabled" | "loyaltyEnabled"
  >;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const MODULES: Module[] = [
  {
    key: "ordersEnabled",
    label: "Orders",
    description: "Online order management and delivery tracking",
    icon: Receipt,
    color: "text-blue-500",
  },
  {
    key: "ecommerceEnabled",
    label: "Online Store",
    description: "Public storefront and e-commerce features",
    icon: Store,
    color: "text-violet-500",
  },
  {
    key: "warrantyEnabled",
    label: "Warranties",
    description: "Warranty issuance, claims and tracking",
    icon: Shield,
    color: "text-emerald-500",
  },
  {
    key: "serviceEnabled",
    label: "Service Center",
    description: "Service tickets, repairs, and routes",
    icon: Wrench,
    color: "text-orange-500",
  },
  {
    key: "loyaltyEnabled",
    label: "Loyalty Program",
    description: "Customer loyalty points and tiers",
    icon: Gift,
    color: "text-pink-500",
  },
];

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  loading?: boolean;
}

function ToggleSwitch({ checked, onChange, loading }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={loading}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-emerald-500" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
      {loading && (
        <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-white" />
      )}
    </button>
  );
}

interface BusinessModuleRowProps {
  business: Business;
}

function BusinessModuleRow({ business: initialBusiness }: BusinessModuleRowProps) {
  const [business, setBusiness] = useState(initialBusiness);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const handleToggle = async (key: Module["key"], value: boolean) => {
    setLoadingKey(key);
    try {
      const res = await fetch(
        `/api/super-admin/businesses/${business.id}/modules`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setBusiness((prev) => ({ ...prev, ...data.business }));
        setSavedKey(key);
        setTimeout(() => setSavedKey(null), 2000);
      }
    } catch (err) {
      console.error("Failed to update module:", err);
    } finally {
      setLoadingKey(null);
    }
  };

  const enabledCount = MODULES.filter((m) => business[m.key]).length;

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Business header */}
      <div className="flex items-center justify-between border-b bg-muted/20 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{business.name}</p>
            <p className="text-xs text-muted-foreground">{business.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium border",
              business.status === "ACTIVE"
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
            )}
          >
            {business.status}
          </span>
          <span className="text-xs text-muted-foreground">
            {enabledCount}/{MODULES.length} modules active
          </span>
        </div>
      </div>

      {/* Module toggles grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-px bg-border">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const isEnabled = business[mod.key];
          const isLoading = loadingKey === mod.key;
          const isSaved = savedKey === mod.key;

          return (
            <div key={mod.key} className="bg-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-muted", isEnabled && "bg-primary/10")}>
                  <Icon className={cn("h-4 w-4 text-muted-foreground", isEnabled && mod.color)} />
                </div>
                <ToggleSwitch
                  checked={isEnabled}
                  onChange={(v) => handleToggle(mod.key, v)}
                  loading={isLoading}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium">{mod.label}</p>
                  {isSaved && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {mod.description}
                </p>
              </div>
              <div
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold self-start",
                  isEnabled
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isEnabled ? (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    Enabled
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    Disabled
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  businesses: Business[];
}

export function ModuleControlsClient({ businesses }: Props) {
  const [search, setSearch] = useState("");

  const filtered = businesses.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalEnabled = businesses.reduce((acc, b) => {
    return acc + MODULES.filter((m) => b[m.key]).length;
  }, 0);
  const totalPossible = businesses.length * MODULES.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Module Controls</h1>
          <p className="text-sm text-muted-foreground">
            Enable or disable features per business tenant. Changes take effect immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span className="text-foreground">{totalEnabled}</span> / {totalPossible} modules active
          </div>
        </div>
      </div>

      {/* Module Legend */}
      <div className="flex flex-wrap gap-3">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.key}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs"
            >
              <Icon className={cn("h-3.5 w-3.5", mod.color)} />
              <span className="font-medium">{mod.label}</span>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Settings2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search businesses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Business list */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
            No businesses found.
          </div>
        ) : (
          filtered.map((biz) => (
            <BusinessModuleRow key={biz.id} business={biz} />
          ))
        )}
      </div>
    </div>
  );
}
