"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Building2,
  FileSpreadsheet,
  Receipt,
  ShieldCheck,
  Wrench,
  Store,
  BarChart3,
  Bot,
  Settings,
  Plus,
  ArrowRight,
  BookOpen,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Quick Action" | "Reports" | "Accounting";
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => void;
  keywords: string[];
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items: CommandItem[] = [
    // Navigation
    {
      id: "nav-pos",
      title: "Point of Sale (POS)",
      category: "Navigation",
      icon: ShoppingCart,
      href: "/dashboard/pos",
      keywords: ["pos", "cashier", "checkout", "billing", "register"],
    },
    {
      id: "nav-products",
      title: "Products & Catalog",
      category: "Navigation",
      icon: Package,
      href: "/dashboard/products",
      keywords: ["products", "items", "stock", "barcodes", "categories"],
    },
    {
      id: "nav-inventory",
      title: "Inventory & Stock Control",
      category: "Navigation",
      icon: Boxes,
      href: "/dashboard/inventory",
      keywords: ["inventory", "stock", "warehouses", "transfers", "adjustments"],
    },
    {
      id: "nav-customers",
      title: "Customer Directory & Credit",
      category: "Navigation",
      icon: Users,
      href: "/dashboard/customers",
      keywords: ["customers", "clients", "credit", "receivables", "loyalty"],
    },
    {
      id: "nav-suppliers",
      title: "Suppliers & Purchasing",
      category: "Navigation",
      icon: Building2,
      href: "/dashboard/purchases",
      keywords: ["suppliers", "purchases", "grn", "po", "vendors"],
    },
    {
      id: "nav-accounting",
      title: "Accounting Overview",
      category: "Accounting",
      icon: FileSpreadsheet,
      href: "/dashboard/accounting",
      keywords: ["accounting", "finance", "ledger", "overview"],
    },
    {
      id: "nav-coa",
      title: "Chart of Accounts (COA)",
      category: "Accounting",
      icon: BookOpen,
      href: "/dashboard/accounting/accounts",
      keywords: ["chart of accounts", "gl", "ledger", "assets", "liabilities", "equity"],
    },
    {
      id: "nav-journal",
      title: "General Journal & Vouchers",
      category: "Accounting",
      icon: FileText,
      href: "/dashboard/accounting/journal",
      keywords: ["journal", "double entry", "debit", "credit", "vouchers"],
    },
    {
      id: "nav-financial-statements",
      title: "Financial Statements (P&L, Balance Sheet, Trial Balance)",
      category: "Accounting",
      icon: BarChart3,
      href: "/dashboard/accounting/reports",
      keywords: ["financial statements", "pnl", "profit and loss", "balance sheet", "trial balance", "income statement"],
    },
    {
      id: "nav-expenses",
      title: "Expense Management",
      category: "Navigation",
      icon: Receipt,
      href: "/dashboard/expenses",
      keywords: ["expenses", "petty cash", "bills", "costs"],
    },
    {
      id: "nav-warranty",
      title: "Warranty Tracker & Claims",
      category: "Navigation",
      icon: ShieldCheck,
      href: "/dashboard/warranties",
      keywords: ["warranty", "claims", "serial numbers", "guarantee"],
    },
    {
      id: "nav-service",
      title: "Repair & Service Center",
      category: "Navigation",
      icon: Wrench,
      href: "/dashboard/service",
      keywords: ["service", "repair", "tickets", "technicians", "rma"],
    },
    {
      id: "nav-store",
      title: "Online E-Commerce Storefront",
      category: "Navigation",
      icon: Store,
      href: "/dashboard/store",
      keywords: ["store", "ecommerce", "online", "shop", "orders"],
    },
    {
      id: "nav-reports",
      title: "Business Reports & Analytics",
      category: "Reports",
      icon: BarChart3,
      href: "/dashboard/reports",
      keywords: ["reports", "analytics", "sales report", "tax", "vat"],
    },
    {
      id: "nav-ai",
      title: "Zentravo AI Business Assistant",
      category: "Navigation",
      icon: Bot,
      href: "/dashboard/ai",
      keywords: ["ai", "assistant", "copilot", "forecast", "gpt"],
    },
    {
      id: "nav-settings",
      title: "System & Business Settings",
      category: "Navigation",
      icon: Settings,
      href: "/dashboard/settings",
      keywords: ["settings", "branches", "taxes", "receipt", "users"],
    },
    // Quick actions
    {
      id: "action-new-sale",
      title: "Start New POS Sale",
      category: "Quick Action",
      icon: Plus,
      href: "/dashboard/pos?action=new",
      keywords: ["new sale", "create invoice", "quick billing"],
    },
    {
      id: "action-add-product",
      title: "Add New Product",
      category: "Quick Action",
      icon: Plus,
      href: "/dashboard/products/new",
      keywords: ["add product", "create item", "new product"],
    },
    {
      id: "action-new-ticket",
      title: "Create Repair Service Ticket",
      category: "Quick Action",
      icon: Plus,
      href: "/dashboard/service/new",
      keywords: ["new repair", "service ticket", "technician job"],
    },
    {
      id: "action-new-journal",
      title: "Post Journal Entry Voucher",
      category: "Quick Action",
      icon: Plus,
      href: "/dashboard/accounting/journal",
      keywords: ["new journal", "manual entry", "voucher", "adjustment"],
    },
  ];

  const filteredItems = items.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Handle arrow navigation inside dialog
  useEffect(() => {
    function handleNavigation(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredItems[selectedIndex]);
      }
    }

    window.addEventListener("keydown", handleNavigation);
    return () => window.removeEventListener("keydown", handleNavigation);
  }, [open, filteredItems, selectedIndex]);

  const handleSelect = (item: CommandItem) => {
    onOpenChange(false);
    if (item.action) {
      item.action();
    } else if (item.href) {
      startTransition(() => {
        router.push(item.href!);
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-background/80 backdrop-blur-sm animate-fade-in p-4">
      {/* Backdrop click */}
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl rounded-2xl border bg-card shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search anything in Zentravo..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No matching commands found.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-left transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg border",
                        isSelected
                          ? "bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium leading-none">{item.title}</div>
                      <div
                        className={cn(
                          "mt-1 text-[11px]",
                          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {item.category}
                      </div>
                    </div>
                  </div>
                  <ArrowRight
                    className={cn(
                      "h-4 w-4 opacity-0 transition-opacity",
                      isSelected && "opacity-100"
                    )}
                  />
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border bg-background px-1 py-0.5">↑</kbd>{" "}
              <kbd className="rounded border bg-background px-1 py-0.5">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="rounded border bg-background px-1 py-0.5">↵</kbd> to select
            </span>
          </div>
          <span>Zentravo Universal Search</span>
        </div>
      </div>
    </div>
  );
}
