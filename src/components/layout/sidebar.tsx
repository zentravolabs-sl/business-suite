"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  BookOpen,
  Receipt,
  Globe,
  Shield,
  Wrench,
  Gift,
  Megaphone,
  BarChart3,
  Bot,
  UserCog,
  GitBranch,
  Settings,
  CreditCard,
  Store,
  ChevronDown,
  ChevronRight,
  Boxes,
  FileText,
  DollarSign,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLanguage } from "@/context/language-context";

interface NavItem {
  title: string;
  i18nKey?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  children?: NavItem[];
  /** If set, this nav item is only shown when the corresponding module flag is true */
  moduleKey?: keyof BusinessModules;
}

interface BusinessModules {
  ordersEnabled: boolean;
  ecommerceEnabled: boolean;
  warrantyEnabled: boolean;
  serviceEnabled: boolean;
  loyaltyEnabled: boolean;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    i18nKey: "nav.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "POS",
    i18nKey: "nav.pos",
    href: "/dashboard/pos",
    icon: ShoppingCart,
  },
  {
    title: "Sales",
    i18nKey: "nav.sales",
    href: "/dashboard/sales",
    icon: FileText,
  },
  {
    title: "Products",
    i18nKey: "nav.products",
    icon: Package,
    children: [
      { title: "All Products", href: "/dashboard/products", icon: Package },
      { title: "Categories", href: "/dashboard/products/categories", icon: Boxes },
      { title: "Brands", href: "/dashboard/products/brands", icon: Package },
    ],
  },
  {
    title: "Inventory",
    i18nKey: "nav.inventory",
    href: "/dashboard/inventory",
    icon: Boxes,
  },
  {
    title: "Purchases",
    i18nKey: "nav.purchases",
    icon: Truck,
    children: [
      { title: "Purchase Orders", href: "/dashboard/purchases/orders", icon: FileText },
      { title: "Goods Received", href: "/dashboard/purchases", icon: Truck },
      { title: "Suppliers", href: "/dashboard/suppliers", icon: Users },
    ],
  },
  {
    title: "CRM",
    i18nKey: "nav.customers",
    icon: Users,
    children: [
      { title: "Customers", href: "/dashboard/customers", icon: Users },
      { title: "Loyalty Program", href: "/dashboard/loyalty", icon: Gift, moduleKey: "loyaltyEnabled" },
      { title: "Marketing", href: "/dashboard/marketing", icon: Megaphone },
    ],
  },
  {
    title: "Accounting",
    i18nKey: "nav.accounting",
    icon: BookOpen,
    children: [
      { title: "Overview", href: "/dashboard/accounting", icon: LayoutDashboard },
      { title: "Accounts", href: "/dashboard/accounting/accounts", icon: BookOpen },
      { title: "Journal", href: "/dashboard/accounting/journal", icon: FileText },
      { title: "Reports", href: "/dashboard/accounting/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Expenses",
    i18nKey: "nav.expenses",
    href: "/dashboard/expenses",
    icon: DollarSign,
  },
  {
    title: "Orders",
    i18nKey: "nav.orders",
    href: "/dashboard/orders",
    icon: Receipt,
    moduleKey: "ordersEnabled",
  },
  {
    title: "Online Store",
    i18nKey: "nav.store",
    href: "/dashboard/store",
    icon: Store,
    moduleKey: "ecommerceEnabled",
  },
  {
    title: "Warranties",
    i18nKey: "nav.warranties",
    href: "/dashboard/warranties",
    icon: Shield,
    moduleKey: "warrantyEnabled",
  },
  {
    title: "Service Center",
    i18nKey: "nav.service",
    href: "/dashboard/service",
    icon: Wrench,
    moduleKey: "serviceEnabled",
  },
  {
    title: "Reports",
    i18nKey: "nav.reports",
    href: "/dashboard/reports",
    icon: BarChart3,
  },
  {
    title: "AI Assistant",
    i18nKey: "nav.ai",
    href: "/dashboard/ai",
    icon: Bot,
    badge: "AI",
  },
  {
    title: "Users",
    i18nKey: "nav.users",
    href: "/dashboard/users",
    icon: UserCog,
  },
  {
    title: "Branches",
    i18nKey: "nav.branches",
    href: "/dashboard/branches",
    icon: GitBranch,
  },
  {
    title: "Settings",
    i18nKey: "nav.settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
  {
    title: "Subscription",
    i18nKey: "nav.subscription",
    href: "/dashboard/subscription",
    icon: CreditCard,
  },
];

interface SidebarNavItemProps {
  item: NavItem;
  level?: number;
  modules: BusinessModules;
}

function SidebarNavItem({ item, level = 0, modules }: SidebarNavItemProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  // Filter children by module flags
  const visibleChildren = item.children?.filter(
    (child) => !child.moduleKey || modules[child.moduleKey]
  );

  const hasChildren = visibleChildren && visibleChildren.length > 0;
  const isActive = item.href
    ? pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
    : visibleChildren?.some(
        (child) => child.href && pathname.startsWith(child.href)
      );

  const title = item.i18nKey ? t(item.i18nKey, item.title) : item.title;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            isActive && "text-sidebar-foreground bg-sidebar-accent"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{title}</span>
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        {isOpen && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
            {visibleChildren?.map((child) => (
              <SidebarNavItem key={child.href || child.title} item={child} level={level + 1} modules={modules} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href ?? "#"}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        isActive && "text-sidebar-primary bg-sidebar-accent shadow-sm",
        level > 0 && "py-2"
      )}
    >
      <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-sidebar-primary")} />
      <span className="flex-1">{title}</span>
      {item.badge && (
        <span className="rounded-full bg-sidebar-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-sidebar-primary">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

const DEFAULT_MODULES: BusinessModules = {
  ordersEnabled: true,
  ecommerceEnabled: false,
  warrantyEnabled: true,
  serviceEnabled: true,
  loyaltyEnabled: false,
};

export function DashboardSidebar() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const activeBusiness = user?.businesses?.[0];
  const businessName = activeBusiness?.businessName || user?.name || "ABC Electronics";
  const branchName = activeBusiness?.branchName || activeBusiness?.roleName || "Main Branch";
  const initials = businessName
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "ZB";

  // Fetch module flags
  const [modules, setModules] = useState<BusinessModules>(DEFAULT_MODULES);
  const [modulesLoaded, setModulesLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch("/api/business/modules")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setModules(data);
        setModulesLoaded(true);
      })
      .catch(() => setModulesLoaded(true));
  }, [session]);

  // Filter top-level nav items by module flags
  const visibleNavItems = navItems.filter(
    (item) => !item.moduleKey || modules[item.moduleKey]
  );

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar-background">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
          <Globe className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-sidebar-foreground">Zentravo</p>
          <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">
            Business Suite
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {!modulesLoaded ? (
          // Skeleton while modules load
          <div className="space-y-1 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-sidebar-accent/30" />
            ))}
          </div>
        ) : (
          visibleNavItems.map((item) => (
            <SidebarNavItem key={item.title} item={item} modules={modules} />
          ))
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-sidebar-accent/50 transition-colors">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">
              {businessName}
            </p>
            <p className="text-[10px] text-sidebar-foreground/60 truncate">
              {branchName}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
