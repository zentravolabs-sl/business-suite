"use client";

import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  Package,
  DollarSign,
  AlertTriangle,
  Shield,
  Wrench,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn, formatCurrency } from "@/lib/utils";

// Mock data for the demo dashboard
const salesData = [
  { date: "01 Sep", sales: 145000, profit: 42000 },
  { date: "02 Sep", sales: 189000, profit: 58000 },
  { date: "03 Sep", sales: 127000, profit: 38000 },
  { date: "04 Sep", sales: 243000, profit: 74000 },
  { date: "05 Sep", sales: 198000, profit: 61000 },
  { date: "06 Sep", sales: 312000, profit: 96000 },
  { date: "07 Sep", sales: 278000, profit: 85000 },
];

const topProducts = [
  { name: "Samsung 55\" TV", sales: 12, revenue: 960000 },
  { name: "iPhone 15 Pro", sales: 8, revenue: 1440000 },
  { name: "Dell Laptop", sales: 15, revenue: 975000 },
  { name: "APC UPS 1000VA", sales: 25, revenue: 250000 },
  { name: "Logitech Keyboard", sales: 45, revenue: 135000 },
];

const categoryData = [
  { name: "Electronics", value: 45, color: "#6366f1" },
  { name: "Mobile", value: 28, color: "#8b5cf6" },
  { name: "Computers", value: 18, color: "#a78bfa" },
  { name: "Accessories", value: 9, color: "#c4b5fd" },
];

const metrics = [
  {
    title: "Today's Sales",
    value: 278000,
    change: 12.5,
    trend: "up",
    icon: ShoppingCart,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    subtitle: "42 transactions",
  },
  {
    title: "Today's Profit",
    value: 85240,
    change: 8.3,
    trend: "up",
    icon: TrendingUp,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    subtitle: "30.7% margin",
  },
  {
    title: "New Customers",
    value: 7,
    change: -2.1,
    trend: "down",
    icon: Users,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    subtitle: "286 total this month",
    isCurrency: false,
  },
  {
    title: "Receivables",
    value: 485000,
    change: 5.2,
    trend: "up",
    icon: DollarSign,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    subtitle: "23 customers",
  },
  {
    title: "Pending Orders",
    value: 14,
    change: 40,
    trend: "up",
    icon: Receipt,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    subtitle: "Rs. 186,000 value",
    isCurrency: false,
  },
  {
    title: "Low Stock Items",
    value: 8,
    change: -3,
    trend: "neutral",
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    subtitle: "Needs reorder",
    isCurrency: false,
    isAlert: true,
  },
  {
    title: "Active Warranties",
    value: 342,
    change: 4.1,
    trend: "up",
    icon: Shield,
    color: "text-teal-500",
    bg: "bg-teal-500/10",
    subtitle: "12 expiring soon",
    isCurrency: false,
  },
  {
    title: "Open Tickets",
    value: 9,
    change: -22,
    trend: "down",
    icon: Wrench,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    subtitle: "3 ready for pickup",
    isCurrency: false,
  },
];

const recentSales = [
  { id: "INV-2026-00312", customer: "Kasun Perera", amount: 45000, time: "10:32 AM", method: "CARD", status: "PAID" },
  { id: "INV-2026-00311", customer: "Walk-in Customer", amount: 12500, time: "10:18 AM", method: "CASH", status: "PAID" },
  { id: "INV-2026-00310", customer: "Nimal Silva", amount: 185000, time: "09:55 AM", method: "CREDIT", status: "CREDIT" },
  { id: "INV-2026-00309", customer: "Chamari Fernando", amount: 8750, time: "09:40 AM", method: "QR", status: "PAID" },
  { id: "INV-2026-00308", customer: "Ashan Dias", amount: 95000, time: "09:22 AM", method: "BANK", status: "PAID" },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Receipt,
  AlertTriangle,
  Shield,
  Wrench,
  Package,
};

export interface MetricItem {
  title: string;
  value: number;
  change: number;
  trend: string;
  icon?: string | React.ComponentType<{ className?: string }>;
  iconName?: string;
  color: string;
  bg: string;
  subtitle: string;
  isCurrency?: boolean;
  isAlert?: boolean;
}

function MetricCard({
  title,
  value,
  change,
  trend,
  icon,
  iconName,
  color,
  bg,
  subtitle,
  isCurrency = true,
  isAlert = false,
}: MetricItem) {
  let IconComponent: React.ComponentType<{ className?: string }> = DollarSign;
  if (typeof icon === "string" && ICON_MAP[icon]) {
    IconComponent = ICON_MAP[icon];
  } else if (iconName && ICON_MAP[iconName]) {
    IconComponent = ICON_MAP[iconName];
  } else if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
    IconComponent = icon as React.ComponentType<{ className?: string }>;
  }

  return (
    <div
      className={cn(
        "metric-card bg-card rounded-xl border p-5",
        isAlert && "border-red-200 dark:border-red-900/30"
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("rounded-lg p-2", bg)}>
          <IconComponent className={cn("h-5 w-5", color)} />
        </div>
        <button className="text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold tracking-tight">
          {isCurrency ? formatCurrency(value) : value.toLocaleString()}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {trend !== "neutral" && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              trend === "up" ? "text-emerald-500" : "text-red-500"
            )}
          >
            {trend === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {Math.abs(change)}%
          </div>
        )}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-xl text-xs">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground capitalize">{p.name}:</span>
            <span className="font-semibold">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export interface DashboardProps {
  initialMetrics?: MetricItem[];
  initialSalesData?: any[];
  initialTopProducts?: any[];
  initialRecentSales?: any[];
  businessName?: string;
  branchName?: string;
}

export function DashboardOverview({
  initialMetrics,
  initialSalesData,
  initialTopProducts,
  initialRecentSales,
  businessName,
  branchName,
}: DashboardProps = {}) {
  const activeMetrics = initialMetrics && initialMetrics.length > 0 ? initialMetrics : metrics;
  const activeSalesData = initialSalesData && initialSalesData.length > 0 ? initialSalesData : salesData;
  const activeTopProducts = initialTopProducts && initialTopProducts.length > 0 ? initialTopProducts : topProducts;
  const activeRecentSales = initialRecentSales && initialRecentSales.length > 0 ? initialRecentSales : recentSales;

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {todayStr} — {businessName || "ABC Electronics"}{branchName ? `, ${branchName}` : ", Colombo Branch"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard/pos"
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Open POS
          </a>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {activeMetrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sales trend */}
        <div className="col-span-2 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold">Sales & Profit Trend</h2>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                <span className="text-muted-foreground">Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Profit</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={activeSalesData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2}
                fill="url(#salesGrad)" dot={{ fill: "#6366f1", r: 3 }} />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2}
                fill="url(#profitGrad)" dot={{ fill: "#10b981", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category distribution */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-5">
            <h2 className="text-base font-semibold">Sales by Category</h2>
            <p className="text-xs text-muted-foreground">This month</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => [`${value}%`, "Share"]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {categoryData.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                  <span className="text-muted-foreground">{cat.name}</span>
                </div>
                <span className="font-medium">{cat.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Sales */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Recent Sales</h2>
            <a href="/dashboard/sales" className="text-xs text-primary hover:underline">
              View all
            </a>
          </div>
          <div className="space-y-3">
            {activeRecentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {sale.customer ? sale.customer.charAt(0) : "C"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{sale.customer}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.id} · {sale.time}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(sale.amount)}</p>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      sale.status === "PAID" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                      sale.status === "CREDIT" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}
                  >
                    {sale.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Top Products</h2>
            <a href="/dashboard/reports" className="text-xs text-primary hover:underline">
              View report
            </a>
          </div>
          <div className="space-y-3">
            {activeTopProducts.map((product, i) => (
              <div key={product.name} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-sm font-semibold text-right ml-2">
                      {formatCurrency(product.revenue)}
                    </p>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                      style={{
                        width: `${activeTopProducts[0]?.revenue ? (product.revenue / activeTopProducts[0].revenue) * 100 : 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {product.sales} units sold
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
