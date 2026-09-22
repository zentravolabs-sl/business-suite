"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Shield,
  Wrench,
  ShoppingBag,
  Gift,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/portal/login";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoginPage) {
      const storedName = localStorage.getItem("zentravo_customer_name");
      const storedId = localStorage.getItem("zentravo_customer_id");
      if (!storedId && typeof window !== "undefined" && !document.cookie.includes("zentravo_customer_id")) {
        router.push("/portal/login");
      } else {
        setCustomerName(storedName || "Customer");
      }
    }
  }, [isLoginPage, router]);

  const handleLogout = () => {
    localStorage.removeItem("zentravo_customer_id");
    localStorage.removeItem("zentravo_customer_name");
    document.cookie = "zentravo_customer_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/portal/login");
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  const navLinks = [
    { href: "/portal", label: "Overview", icon: LayoutDashboard },
    { href: "/portal/warranties", label: "My Warranties", icon: Shield },
    { href: "/portal/services", label: "Repairs & Services", icon: Wrench },
    { href: "/portal/orders", label: "Purchase History", icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Portal Navbar */}
      <header className="sticky top-0 z-40 w-full border-b bg-card/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/portal" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <span className="font-black text-base tracking-tight">Zentravo</span>
                <span className="text-[10px] ml-1.5 uppercase tracking-wider font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                  Customer Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Customer profile / actions */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <Gift className="h-3.5 w-3.5 text-amber-600" />
              <span>Loyalty Member</span>
            </div>

            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-muted-foreground hover:text-destructive">
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Log Out
            </Button>
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-9 w-9"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b bg-card p-4 space-y-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{customerName}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-destructive">
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Log Out
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Portal Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/40 py-6 text-center text-xs text-muted-foreground">
        <p>© 2026 Zentravo BMS — Self-Service Customer Experience</p>
      </footer>
    </div>
  );
}
