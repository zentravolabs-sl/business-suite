import Link from "next/link";
import {
  ShieldAlert,
  LayoutDashboard,
  Building2,
  CreditCard,
  ScrollText,
  Sliders,
  LogOut,
  ChevronRight,
  Database,
  ArrowUpRight,
  ToggleLeft,
} from "lucide-react";
import { requireAdminSession } from "@/lib/admin-auth";
import { logoutAdminAction } from "./actions";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminSession();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Super Admin Sidebar */}
      <aside className="flex w-64 flex-col border-r bg-card/60 backdrop-blur-md">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-600/20">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight">Zentravo Admin</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-red-500">
              Root Control
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Platform Management
          </div>

          {[
            { href: "/super-admin", label: "Platform Overview", icon: LayoutDashboard },
            { href: "/super-admin/businesses", label: "Tenants & Businesses", icon: Building2 },
            { href: "/super-admin/modules", label: "Module Controls", icon: ToggleLeft },
            { href: "/super-admin/subscriptions", label: "Plans & Billing", icon: CreditCard },
            { href: "/super-admin/logs", label: "System & Audit Logs", icon: ScrollText },
            { href: "/super-admin/settings", label: "Platform Settings", icon: Sliders },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-6 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Infrastructure
          </div>
          <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                <span>Neon Postgres</span>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Healthy
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Latency: <strong>24ms</strong> • Region: <strong>ap-southeast-1</strong>
            </div>
          </div>
        </div>

        {/* Footer — admin info + logout */}
        <div className="border-t p-3 space-y-2">
          {/* Admin user card */}
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2 bg-red-500/5 border border-red-500/10">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600/20 text-red-500 text-xs font-bold shrink-0">
              {admin.name?.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "SA"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{admin.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{admin.email}</p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <span>Return to Retail App</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>

          {/* Logout form */}
          <form action={logoutAdminAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Root Admin</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">Platform Infrastructure</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All systems operational</span>
            </div>
            <div className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500">
              {admin.name} — Super Admin
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 overflow-y-auto p-6 bg-muted/10">{children}</main>
      </div>
    </div>
  );
}
