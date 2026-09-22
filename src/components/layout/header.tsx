"use client";

import { Bell, Search, Moon, Sun, LogOut, User, Settings, ChevronDown, Globe } from "lucide-react";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { useLanguage } from "@/context/language-context";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n/translations";

export function DashboardHeader() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div
          onClick={() => setShowCommandPalette(true)}
          className="relative w-full cursor-pointer"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            readOnly
            placeholder={t("search.placeholder", "Search products, customers, invoices... (Ctrl+K)")}
            className={cn(
              "w-full rounded-lg border bg-muted/50 py-2 pl-9 pr-4 text-sm cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "placeholder:text-muted-foreground"
            )}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="border rounded px-1">Ctrl</span>
            <span className="border rounded px-1">K</span>
          </kbd>
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Language selector */}
        <div className="relative">
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors hover:bg-muted"
            aria-label="Select language"
          >
            <span className="text-sm">{currentLang.flag}</span>
            <span className="hidden sm:inline">{currentLang.nativeName}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {showLanguageMenu && (
            <div className="absolute right-0 top-11 z-50 w-36 rounded-xl border bg-card shadow-xl animate-scale-in py-1">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLanguageMenu(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors hover:bg-muted",
                    language === lang.code && "bg-primary/10 text-primary font-bold"
                  )}
                >
                  <span className="text-sm">{lang.flag}</span>
                  <span>{lang.nativeName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border bg-card shadow-xl animate-scale-in">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <button className="text-xs text-muted-foreground hover:text-foreground">
                  Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {[
                  {
                    type: "warn",
                    title: "Low Stock Alert",
                    desc: "Samsung 55\" TV has only 2 units left",
                    time: "5m ago",
                  },
                  {
                    type: "info",
                    title: "New Online Order",
                    desc: "Order #ORD-2026-00312 received",
                    time: "12m ago",
                  },
                  {
                    type: "success",
                    title: "Payment Received",
                    desc: "Rs. 45,000 from Kasun Perera",
                    time: "1h ago",
                  },
                  {
                    type: "warn",
                    title: "Warranty Expiring",
                    desc: "3 warranties expire within 7 days",
                    time: "2h ago",
                  },
                ].map((n, i) => (
                  <div
                    key={i}
                    className="flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/50 cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mt-0.5 h-2 w-2 rounded-full shrink-0",
                        n.type === "warn" && "bg-yellow-500",
                        n.type === "info" && "bg-blue-500",
                        n.type === "success" && "bg-green-500"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {n.desc}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {n.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t p-3">
                <button className="w-full text-center text-xs text-primary hover:underline">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors hover:bg-muted"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-bold text-white">
              {userInitials}
            </div>
            <span className="hidden text-sm font-medium sm:block">
              {userName}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border bg-card shadow-xl animate-scale-in">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">
                  {userEmail}
                </p>
              </div>
              <div className="p-1">
                {[
                  { icon: User, label: "My Profile", href: "/dashboard/profile" },
                  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </a>
                ))}
                <button
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CommandPalette
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
      />
    </header>
  );
}
