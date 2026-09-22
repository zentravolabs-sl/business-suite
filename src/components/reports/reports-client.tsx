"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  Download,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Tag,
  CheckCircle2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatCurrency } from "@/lib/utils";

interface ReportData {
  period: string;
  summary: {
    revenue: number;
    prevRevenue: number;
    revenueGrowth: number;
    transactions: number;
    prevTransactions: number;
    estimatedProfit: number;
    avgOrderValue: number;
    totalDiscounts: number;
    totalCustomers: number;
    newCustomers: number;
    vipCustomers: number;
    onlineOrders: number;
    openTickets: number;
  };
  salesByBranch: Array<{
    branchId: string;
    branchName: string;
    revenue: number;
    transactions: number;
  }>;
  topProducts: Array<{
    productId: string | null;
    name: string;
    sku?: string | null;
    revenue: number;
    unitsSold: number;
    estimatedProfit: number;
  }>;
  dailyTrend: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
  inventoryHealth: {
    totalStockUnits: number;
    lowStockItems: Array<{
      productName: string;
      branchName: string;
      quantity: number;
      reorderLevel: number;
    }>;
  };
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];

export function ReportsClient() {
  const [period, setPeriod] = useState<"today" | "week" | "month" | "last_month">("month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?period=${p}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(period);
  }, [period]);

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Period", period],
      ["Total Revenue (LKR)", data.summary.revenue.toString()],
      ["Transactions", data.summary.transactions.toString()],
      ["Estimated Gross Profit (LKR)", data.summary.estimatedProfit.toString()],
      ["Average Order Value (LKR)", data.summary.avgOrderValue.toFixed(2)],
      ["New Customers", data.summary.newCustomers.toString()],
      ["Total Discounts (LKR)", data.summary.totalDiscounts.toString()],
      [],
      ["Top Products", "Units Sold", "Revenue (LKR)"],
      ...data.topProducts.map((p) => [p.name, p.unitsSold.toString(), p.revenue.toString()]),
      [],
      ["Branch", "Transactions", "Revenue (LKR)"],
      ...data.salesByBranch.map((b) => [b.branchName, b.transactions.toString(), b.revenue.toString()]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `zentravo_report_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const marginPct =
    data && data.summary.revenue > 0
      ? ((data.summary.estimatedProfit / data.summary.revenue) * 100).toFixed(1)
      : "28.0";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <BarChart3 className="h-4 w-4" />
            </div>
            Analytics & Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time business intelligence across sales, branches, inventory, and customer lifetime value
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center rounded-lg border bg-card p-1 shadow-sm">
            {(
              [
                { key: "today", label: "Today" },
                { key: "week", label: "7 Days" },
                { key: "month", label: "This Month" },
                { key: "last_month", label: "Last Month" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => setPeriod(item.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  period === item.key
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => fetchReports(period)} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card className="shadow-xs border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Revenue
            </span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold tracking-tight">
              {formatCurrency(data?.summary.revenue || 0)}
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-1">
              {(data?.summary.revenueGrowth ?? 0) >= 0 ? (
                <span className="flex items-center text-emerald-600 font-semibold">
                  <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                  +{data?.summary.revenueGrowth}%
                </span>
              ) : (
                <span className="flex items-center text-red-600 font-semibold">
                  <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                  {data?.summary.revenueGrowth}%
                </span>
              )}
              <span className="text-muted-foreground">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        {/* Estimated Gross Profit */}
        <Card className="shadow-xs border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gross Profit
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold tracking-tight">
              {formatCurrency(data?.summary.estimatedProfit || 0)}
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-1">
              <span className="font-semibold text-emerald-600">{marginPct}% margin</span>
              <span className="text-muted-foreground">estimated</span>
            </div>
          </CardContent>
        </Card>

        {/* Transactions & Avg Order Value */}
        <Card className="shadow-xs border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Transactions
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold tracking-tight">
              {data?.summary.transactions.toLocaleString() || 0}
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-1">
              <span className="text-muted-foreground">Avg Ticket:</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(data?.summary.avgOrderValue || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Customers */}
        <Card className="shadow-xs border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Customer Growth
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold tracking-tight">
              {data?.summary.newCustomers.toLocaleString() || 0}
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-1">
              <span className="text-muted-foreground">Total database:</span>
              <span className="font-semibold text-foreground">
                {data?.summary.totalCustomers.toLocaleString() || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trend Area Chart */}
        <Card className="lg:col-span-2 shadow-xs border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Revenue Timeline</CardTitle>
            <CardDescription className="text-xs">
              Daily revenue trajectory and transaction volume for the selected window
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[300px] w-full">
              {data && data.dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.dailyTrend}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `Rs.${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value)), "Revenue"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#revenueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No sales recorded for this period yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Branch Revenue Breakdown */}
        <Card className="shadow-xs border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Branch Performance
            </CardTitle>
            <CardDescription className="text-xs">
              Revenue distribution across operational branches
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[280px] w-full">
              {data && data.salesByBranch.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.salesByBranch}
                    layout="vertical"
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      dataKey="branchName"
                      type="category"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), "Revenue"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No branch sales recorded yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products and Inventory Warning */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Selling Products */}
        <Card className="shadow-xs border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-indigo-500" />
              Top Performing Products
            </CardTitle>
            <CardDescription className="text-xs">
              Highest revenue generators in this reporting window
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-3 py-3 text-center">Qty Sold</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Est. Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data && data.topProducts.length > 0 ? (
                    data.topProducts.slice(0, 5).map((prod, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          <p className="truncate max-w-[200px]">{prod.name}</p>
                          {prod.sku && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              SKU: {prod.sku}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-muted-foreground">
                          {prod.unitsSold}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {formatCurrency(prod.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          {formatCurrency(prod.estimatedProfit)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No product sales recorded in this interval.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock & Inventory Action List */}
        <Card className="shadow-xs border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Inventory Attention Required
            </CardTitle>
            <CardDescription className="text-xs">
              Products below minimum reorder threshold requiring purchase orders
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-3 py-3">Branch</th>
                    <th className="px-3 py-3 text-center">Remaining</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data && data.inventoryHealth.lowStockItems.length > 0 ? (
                    data.inventoryHealth.lowStockItems.slice(0, 5).map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          <p className="truncate max-w-[180px]">{item.productName}</p>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{item.branchName}</td>
                        <td className="px-3 py-3 text-center font-bold text-red-600">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">
                            Critically Low
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-emerald-600 font-medium">
                        <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                        All products are above minimum safety stock levels!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
