"use client";

import { useState, useEffect, useMemo, useRef, useTransition } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  Calendar,
  Layers,
  ShieldAlert,
  ArrowRight,
  BrainCircuit,
  MessageSquare,
  Target,
  Settings2,
  FileText,
  Boxes,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Info,
  Check,
  XCircle,
  Percent,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  Mail,
  Smartphone,
  MessageCircle,
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
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import type { DailyReportData } from "@/lib/advisor/types";

export function AdvisorClient() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Daily reports tab state
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [selectedReportDate, setSelectedReportDate] = useState<string>("");
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Recommendations tab state
  const [recFilter, setRecFilter] = useState<string>("ALL");
  const [recsList, setRecsList] = useState<any[]>([]);

  // Insights tab state
  const [insightCategory, setInsightCategory] = useState<string>("ALL");

  // Chat tab state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatPending, activeTab]);

  // Settings tab state
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Goals tab state
  const [goalMetric, setGoalMetric] = useState("MONTHLY_SALES");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [creatingGoal, setCreatingGoal] = useState(false);

  // Load dashboard data on mount
  useEffect(() => {
    fetchDashboard();
    fetchReports();
    fetchChat();
  }, []);

  async function fetchDashboard() {
    try {
      setRefreshing(true);
      const res = await fetch("/api/advisor/dashboard");
      if (!res.ok) throw new Error("Failed to load advisor dashboard");
      const data = await res.json();
      setDashboardData(data);
      setRecsList(data.recommendations || []);
      setSettingsForm(data.preference || {});
    } catch (err: any) {
      toast.error(err.message || "Failed to load advisor data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchReports() {
    try {
      const res = await fetch("/api/advisor/reports");
      if (res.ok) {
        const data = await res.json();
        setReportsList(data.reports || []);
        if (data.reports?.length > 0 && !selectedReportDate) {
          setSelectedReportDate(data.reports[0].reportDate);
          setSelectedReport(data.reports[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchReportByDate(date: string) {
    setSelectedReportDate(date);
    try {
      const res = await fetch(`/api/advisor/reports?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedReport(data.report);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGenerateReportNow() {
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/advisor/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) throw new Error("Failed to generate report");
      const data = await res.json();
      toast.success("Daily Evening Report generated successfully!");
      fetchReports();
      fetchDashboard();
      if (data.report) {
        setSelectedReport(data.report);
        setSelectedReportDate(data.report.reportDate);
      }
    } catch (err: any) {
      toast.error(err.message || "Could not generate report");
    } finally {
      setGeneratingReport(false);
    }
  }

  async function fetchChat() {
    try {
      const res = await fetch("/api/advisor/chat");
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSendChat(queryToSend?: string) {
    const q = (queryToSend || chatInput).trim();
    if (!q || chatPending) return;

    setChatInput("");
    setChatPending(true);

    // Optimistic user message
    const tempUserMsg = {
      id: "temp-" + Date.now(),
      role: "USER",
      content: q,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) throw new Error("Failed to process message");
      const answer = await res.json();
      setChatMessages((prev) => [
        ...prev,
        {
          id: "advisor-" + Date.now(),
          role: "ADVISOR",
          content: answer.message,
          usedAi: answer.usedAi,
          data: answer.data,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err: any) {
      toast.error(err.message || "Advisor chat failed");
    } finally {
      setChatPending(false);
    }
  }

  async function handleUpdateRecStatus(id: string, status: string) {
    try {
      const res = await fetch("/api/advisor/recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Recommendation marked as ${status.replace("_", " ")}`);
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalTarget) return;
    setCreatingGoal(true);
    try {
      const res = await fetch("/api/advisor/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric: goalMetric,
          targetValue: parseFloat(goalTarget),
          title: goalTitle || goalMetric.replace(/_/g, " "),
        }),
      });
      if (!res.ok) throw new Error("Failed to create goal");
      toast.success("Business target added!");
      setGoalTarget("");
      setGoalTitle("");
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingGoal(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/advisor/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Advisor configuration updated!");
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingSettings(false);
    }
  }

  const snapshot = dashboardData?.snapshot;
  const currency = snapshot?.currency || "LKR";
  const todaySummary = snapshot?.todaySummary;
  const last30 = snapshot?.last30;
  const mtd = snapshot?.mtd;

  const filteredRecs = useMemo(() => {
    if (recFilter === "ALL") return recsList;
    return recsList.filter((r) => r.status === recFilter);
  }, [recsList, recFilter]);

  const filteredInsights = useMemo(() => {
    const list = dashboardData?.insights || [];
    if (insightCategory === "ALL") return list;
    return list.filter((ins: any) => ins.category === insightCategory);
  }, [dashboardData?.insights, insightCategory]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <BrainCircuit className="w-6 h-6 text-primary absolute inset-0 m-auto" />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Computing verified financial intelligence & risk analysis...
        </p>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4 p-8 text-center border rounded-2xl bg-card">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold">Unable to Load Business Intelligence</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Could not fetch financial analytics from the server. Please check your connection or sync metrics.
        </p>
        <Button onClick={fetchDashboard} disabled={refreshing}>
          <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
          Retry Sync
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-xl border border-blue-900/40">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-blue-300 border border-primary/30 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>ZENTRAVO AI BUSINESS ADVISOR</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Executive Financial & Business Intelligence
            </h1>
            <p className="text-sm md:text-base text-blue-200/80 max-w-2xl">
              Verified mathematical models, automated 6:00 PM evening reports, inventory risk controls, and grounded advice tailored for your business.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboard}
              disabled={refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
              Sync Metrics
            </Button>
            <Button
              size="sm"
              onClick={handleGenerateReportNow}
              disabled={generatingReport}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 font-semibold"
            >
              <Send className="w-4 h-4 mr-2" />
              Generate Daily Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("chat")}
              className={cn(
                "backdrop-blur-md font-medium transition-all",
                activeTab === "chat"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-blue-600/30 hover:bg-blue-600/50 text-white border-blue-400/40"
              )}
            >
              <MessageSquare className="w-4 h-4 mr-2 text-blue-300" />
              Ask AI Advisor
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(String(val))}
        className="w-full flex flex-col gap-6"
      >
        <div className="w-full overflow-x-auto p-1 scrollbar-thin">
          <TabsList className="bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl h-auto inline-flex flex-nowrap justify-start items-center gap-1.5 min-w-max">
            <TabsTrigger
              value="overview"
              className={cn(
                "gap-2 py-2 px-3.5 rounded-lg text-xs md:text-sm font-medium transition-all shrink-0",
                activeTab === "overview"
                  ? "bg-primary text-primary-foreground shadow-md font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Activity className="w-4 h-4 shrink-0" /> Overview
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className={cn(
                "gap-2 py-2 px-3.5 rounded-lg text-xs md:text-sm font-medium transition-all shrink-0",
                activeTab === "reports"
                  ? "bg-primary text-primary-foreground shadow-md font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <FileText className="w-4 h-4 shrink-0" /> Daily Reports
            </TabsTrigger>
            <TabsTrigger
              value="insights"
              className={cn(
                "gap-2 py-2 px-3.5 rounded-lg text-xs md:text-sm font-medium transition-all shrink-0",
                activeTab === "insights"
                  ? "bg-primary text-primary-foreground shadow-md font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Financial Insights</span>
              {Boolean(dashboardData?.insights?.length) && (
                <span
                  className={cn(
                    "ml-1 text-[11px] px-1.5 py-0.5 rounded-full font-mono font-semibold",
                    activeTab === "insights"
                      ? "bg-white/20 text-white"
                      : "bg-blue-500/20 text-blue-300"
                  )}
                >
                  {dashboardData.insights.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className={cn(
                "gap-2 py-2 px-3.5 rounded-lg text-xs md:text-sm font-medium transition-all shrink-0",
                activeTab === "inventory"
                  ? "bg-primary text-primary-foreground shadow-md font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Boxes className="w-4 h-4 shrink-0" /> Sales & Margins
            </TabsTrigger>
            <TabsTrigger
              value="recommendations"
              className={cn(
                "gap-2 py-2 px-3.5 rounded-lg text-xs md:text-sm font-medium transition-all shrink-0",
                activeTab === "recommendations"
                  ? "bg-primary text-primary-foreground shadow-md font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Actions</span>
              {Boolean(dashboardData?.recommendations?.length) && (
                <span
                  className={cn(
                    "ml-1 text-[11px] px-1.5 py-0.5 rounded-full font-mono font-semibold",
                    activeTab === "recommendations"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-500/20 text-emerald-300"
                  )}
                >
                  {dashboardData.recommendations.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="goals"
              className={cn(
                "gap-2 py-2 px-3.5 rounded-lg text-xs md:text-sm font-medium transition-all shrink-0",
                activeTab === "goals"
                  ? "bg-primary text-primary-foreground shadow-md font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Target className="w-4 h-4 shrink-0" /> Business Goals
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className={cn(
                "gap-2 py-2 px-3.5 rounded-lg text-xs md:text-sm font-medium transition-all shrink-0",
                activeTab === "chat"
                  ? "bg-primary text-primary-foreground shadow-md font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <MessageSquare className="w-4 h-4 shrink-0" /> Advisor Chat
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className={cn(
                "gap-2 py-2 px-3.5 rounded-lg text-xs md:text-sm font-medium transition-all shrink-0",
                activeTab === "settings"
                  ? "bg-primary text-primary-foreground shadow-md font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Settings2 className="w-4 h-4 shrink-0" /> Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW */}
        {/* ========================================================================= */}
        <TabsContent value="overview" className="space-y-6">
          {/* Executive Briefing Card */}
          <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-background to-indigo-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base md:text-lg">Daily Executive Briefing</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  Today: {snapshot?.today}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm md:text-base font-medium leading-relaxed">
                {todaySummary?.noActivity
                  ? `No transactions recorded yet today (${snapshot?.today || "N/A"}). Prior 30-day daily average net revenue is ${formatCurrency((last30?.netRevenue || 0) / 30, currency)}.`
                  : `Your business generated ${formatCurrency(todaySummary?.netRevenue || 0, currency)} in net revenue across ${formatNumber(todaySummary?.transactions || 0)} transactions today. Gross profit stands at ${typeof todaySummary?.grossProfit === "number" ? formatCurrency(todaySummary.grossProfit, currency) : "Estimated"} (${todaySummary?.grossMarginPct ?? 0}% margin).`}
              </p>
              {Array.isArray(todaySummary?.notes) && todaySummary.notes.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Data Disclosure: {todaySummary.notes.join(" • ")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Primary KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase tracking-wider font-semibold">Today&apos;s Net Revenue</CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {formatCurrency(todaySummary?.netRevenue || 0, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatNumber(todaySummary?.transactions || 0)} sales</span>
                  <span>Avg Ticket: {formatCurrency(todaySummary?.avgTicket || 0, currency)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Gross Profit */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs uppercase tracking-wider font-semibold">Gross Profit & Margin</CardDescription>
                  <Badge variant={todaySummary?.grossStatus === "COMPLETE" ? "default" : "secondary"} className="text-[10px]">
                    {todaySummary?.grossStatus || "ESTIMATED"}
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-bold">
                  {typeof todaySummary?.grossProfit === "number"
                    ? formatCurrency(todaySummary.grossProfit, currency)
                    : "Estimated"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Margin: {typeof todaySummary?.grossMarginPct === "number" ? `${todaySummary.grossMarginPct}%` : "Pending"}</span>
                  <span>Cost Coverage: {todaySummary?.costCoveragePct || 0}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Cash Flow */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase tracking-wider font-semibold">Today&apos;s Cash Movement</CardDescription>
                <CardTitle className={cn("text-2xl font-bold", (snapshot?.cashFlowToday?.net || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {(snapshot?.cashFlowToday?.net || 0) >= 0 ? "+" : ""}
                  {formatCurrency(snapshot?.cashFlowToday?.net || 0, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>In: {formatCurrency(snapshot?.cashFlowToday?.inflow?.total || 0, currency)}</span>
                  <span>Out: {formatCurrency(snapshot?.cashFlowToday?.outflow?.total || 0, currency)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Overdue Receivables */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase tracking-wider font-semibold">Overdue Customer Credit</CardDescription>
                <CardTitle className={cn("text-2xl font-bold", (snapshot?.receivables?.overdueTotal || 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                  {formatCurrency(snapshot?.receivables?.overdueTotal || 0, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{snapshot?.receivables?.overdueCustomers || 0} overdue accounts</span>
                  <span>Total credit: {formatCurrency(snapshot?.receivables?.total || 0, currency)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 30-Day Revenue & Margin Trend Chart */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">30-Day Financial Performance Trend</CardTitle>
                  <CardDescription>Daily verified revenue vs COGS vs operating expenses</CardDescription>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-blue-600" /> Revenue
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-600" /> Gross Profit
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-rose-500" /> Expenses
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={snapshot?.dailySeries || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorGp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => val.slice(5)}
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val) || 0, currency)]}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{
                        borderRadius: "8px",
                        background: "rgba(15, 23, 42, 0.95)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                    <Area type="monotone" dataKey="grossProfit" name="Gross Profit" stroke="#10b981" fillOpacity={1} fill="url(#colorGp)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" fill="none" strokeWidth={1.5} strokeDasharray="3 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top 3 Recommendations of the Day */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Top Recommended Actions Today</CardTitle>
                  <CardDescription>Priority steps identified by the advisor to protect margins and cash flow</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("recommendations")} className="text-xs">
                  View All Actions <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(dashboardData?.recommendations || []).slice(0, 3).map((rec: any) => (
                <div
                  key={rec.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={rec.priority === 1 ? "destructive" : "secondary"}
                        className="text-[10px] uppercase font-bold"
                      >
                        Priority {rec.priority}
                      </Badge>
                      <span className="font-semibold text-sm">{rec.renderedTitle || rec.ruleKey}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.renderedAction}</p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Badge variant="outline" className="text-xs font-medium">
                      {rec.status}
                    </Badge>
                    {rec.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateRecStatus(rec.id, "IN_PROGRESS")}
                        className="h-8 text-xs"
                      >
                        Start
                      </Button>
                    )}
                    {rec.status !== "COMPLETED" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateRecStatus(rec.id, "COMPLETED")}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Done
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {(!dashboardData?.recommendations || dashboardData.recommendations.length === 0) && (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  No urgent actions flagged. Your margins, stock, and credit are operating within healthy parameters!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: DAILY REPORTS */}
        {/* ========================================================================= */}
        <TabsContent value="reports" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Daily Business Reports Archive</h2>
              <p className="text-xs text-muted-foreground">
                Reproducible end-of-day snapshots stored at generation time
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedReportDate}
                onChange={(e) => fetchReportByDate(e.target.value)}
                className="h-9 px-3 text-xs rounded-lg border bg-background"
              >
                {reportsList.map((rep) => (
                  <option key={rep.id} value={rep.reportDate}>
                    {rep.reportDate} ({rep.generatedBy})
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={handleGenerateReportNow} disabled={generatingReport}>
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", generatingReport && "animate-spin")} />
                Regenerate
              </Button>
            </div>
          </div>

          {selectedReport ? (
            <div className="space-y-6">
              {/* Report Header */}
              <Card className="border-primary/20 bg-muted/20">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{selectedReport.kind}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Generated on {new Date(selectedReport.generatedAt).toLocaleString()} via {selectedReport.generatedBy}
                        </span>
                      </div>
                      <CardTitle className="text-xl">
                        Daily Performance for {selectedReport.reportDate}
                      </CardTitle>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedReport.deliveries && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Bell className="w-3.5 h-3.5 text-primary" />
                          <span>Delivered: In-App</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium leading-relaxed">
                    {selectedReport.data?.narrative?.summary || "Report generated."}
                  </p>
                  {selectedReport.aiNarrative && (
                    <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs leading-relaxed space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-primary">
                        <Sparkles className="w-3.5 h-3.5" /> AI Executive Commentary
                      </div>
                      <p className="text-muted-foreground">{selectedReport.aiNarrative}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Comparison Matrix Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Performance Comparisons</CardTitle>
                  <CardDescription>Day vs yesterday vs same day last week vs 30-day baseline</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Metric</th>
                        <th className="py-2.5 px-3 font-bold text-foreground">Report Day</th>
                        <th className="py-2.5 px-3">Yesterday</th>
                        <th className="py-2.5 px-3">Same Day Last Week</th>
                        <th className="py-2.5 px-3">30-Day Daily Avg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="py-2.5 px-3 font-medium">Net Revenue</td>
                        <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(selectedReport.data?.today?.netRevenue || 0, currency)}
                        </td>
                        <td className="py-2.5 px-3">
                          {formatCurrency(selectedReport.data?.yesterday?.netRevenue || 0, currency)}
                        </td>
                        <td className="py-2.5 px-3">
                          {formatCurrency(selectedReport.data?.sameDayLastWeek?.netRevenue || 0, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {formatCurrency(selectedReport.data?.thirtyDayDailyAverage?.netRevenue || 0, currency)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium">Gross Profit</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                          {typeof selectedReport.data?.today?.grossProfit === "number" ? formatCurrency(selectedReport.data.today.grossProfit, currency) : "N/A"}
                        </td>
                        <td className="py-2.5 px-3">
                          {typeof selectedReport.data?.yesterday?.grossProfit === "number" ? formatCurrency(selectedReport.data.yesterday.grossProfit, currency) : "N/A"}
                        </td>
                        <td className="py-2.5 px-3">
                          {typeof selectedReport.data?.sameDayLastWeek?.grossProfit === "number" ? formatCurrency(selectedReport.data.sameDayLastWeek.grossProfit, currency) : "N/A"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {typeof selectedReport.data?.thirtyDayDailyAverage?.grossProfit === "number" ? formatCurrency(selectedReport.data.thirtyDayDailyAverage.grossProfit, currency) : "N/A"}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium">Transactions</td>
                        <td className="py-2.5 px-3 font-bold">
                          {formatNumber(selectedReport.data?.today?.transactions || 0)}
                        </td>
                        <td className="py-2.5 px-3">
                          {formatNumber(selectedReport.data?.yesterday?.transactions || 0)}
                        </td>
                        <td className="py-2.5 px-3">
                          {formatNumber(selectedReport.data?.sameDayLastWeek?.transactions || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {formatNumber(selectedReport.data?.thirtyDayDailyAverage?.transactions || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Cash & Inventory snapshot cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cash Flow Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b">
                      <span>Sales Cash Receipts:</span>
                      <span className="font-semibold">{formatCurrency(selectedReport.data?.cashFlow?.inflow?.salesReceipts || 0, currency)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Credit Collections:</span>
                      <span className="font-semibold">{formatCurrency(selectedReport.data?.cashFlow?.inflow?.creditCollections || 0, currency)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Operating Expenses Paid:</span>
                      <span className="font-semibold text-rose-500">-{formatCurrency(selectedReport.data?.cashFlow?.outflow?.expenses || 0, currency)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Supplier Payments:</span>
                      <span className="font-semibold text-rose-500">-{formatCurrency(selectedReport.data?.cashFlow?.outflow?.supplierPayments || 0, currency)}</span>
                    </div>
                    <div className="flex justify-between pt-1 font-bold">
                      <span>Net Cash Movement:</span>
                      <span className={cn((selectedReport.data?.cashFlow?.net || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {formatCurrency(selectedReport.data?.cashFlow?.net || 0, currency)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Inventory Alerts Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b">
                      <span>Items At / Below Reorder Level:</span>
                      <span className="font-semibold text-amber-600">{selectedReport.data?.inventory?.lowStockCount || 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Out-of-Stock Selling Items:</span>
                      <span className="font-semibold text-rose-600">{selectedReport.data?.inventory?.outOfStockCount || 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Slow Moving Inventory Capital:</span>
                      <span className="font-semibold">{formatCurrency(selectedReport.data?.inventory?.slowMovingValue || 0, currency)}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Excess Inventory Capital:</span>
                      <span className="font-semibold">{formatCurrency(selectedReport.data?.inventory?.excessValue || 0, currency)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border rounded-xl bg-muted/10 space-y-3">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No reports generated yet.</p>
              <Button onClick={handleGenerateReportNow} disabled={generatingReport}>
                Generate First Report
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: FINANCIAL INSIGHTS */}
        {/* ========================================================================= */}
        <TabsContent value="insights" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Rule-Based Findings & Evidence</h2>
              <p className="text-xs text-muted-foreground">
                27+ mathematical rules continuously verifying profitability, cash flow, stock health, and margins
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Category:</span>
              <select
                value={insightCategory}
                onChange={(e) => setInsightCategory(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-lg border bg-background"
              >
                <option value="ALL">All Categories</option>
                <option value="FINANCE">Finance & Cash</option>
                <option value="SALES">Sales & Discounts</option>
                <option value="INVENTORY">Inventory & Stock</option>
                <option value="CUSTOMERS">Customers & Credit</option>
                <option value="DATA_QUALITY">Data Quality</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredInsights.map((ins: any) => (
              <Card key={ins.id} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          ins.severity === "CRITICAL"
                            ? "destructive"
                            : ins.severity === "HIGH"
                            ? "default"
                            : "secondary"
                        }
                        className="text-[10px] font-bold uppercase"
                      >
                        {ins.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {ins.category}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Confidence: {ins.confidence}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{ins.ruleKey}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Detected: {new Date(ins.lastDetectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-base pt-1">{ins.renderedTitle || ins.ruleKey}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs md:text-sm">
                  {/* What Happened */}
                  <div className="space-y-1">
                    <span className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                      What Happened:
                    </span>
                    <p className="text-muted-foreground leading-relaxed">{ins.renderedWhat}</p>
                  </div>

                  {/* Why It Matters */}
                  {ins.renderedWhy && (
                    <div className="space-y-1">
                      <span className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                        Why It Matters:
                      </span>
                      <p className="text-muted-foreground leading-relaxed">{ins.renderedWhy}</p>
                    </div>
                  )}

                  {/* Recommended Next Steps */}
                  {ins.renderedSteps?.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                        Recommended Next Steps:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                        {ins.renderedSteps.map((step: string, idx: number) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Missing Data Disclosure */}
                  {ins.missingData?.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 pt-2 border-t">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Note: Analysis based on partial records ({ins.missingData.join(", ")}).</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {filteredInsights.length === 0 && (
              <div className="text-center py-12 border rounded-xl bg-muted/10 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-medium">No open issues found for this category!</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 4: SALES & MARGINS */}
        {/* ========================================================================= */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Margins & Negative Margins Warning Table */}
            <Card className="col-span-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Product Profit Margins (Last 30 Days)</CardTitle>
                <CardDescription>
                  Tracking gross margin % and highlighting products selling at a loss
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Units Sold</th>
                      <th className="py-2.5 px-3">Revenue</th>
                      <th className="py-2.5 px-3">Cost (COGS)</th>
                      <th className="py-2.5 px-3">Profit</th>
                      <th className="py-2.5 px-3">Gross Margin</th>
                      <th className="py-2.5 px-3">Safe Discount Cap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(snapshot?.margins || []).slice(0, 15).map((m: any) => {
                      const isNegative = m.marginPct !== null && m.marginPct < 0;
                      const isLow = m.marginPct !== null && m.marginPct >= 0 && m.marginPct < 15;
                      // Safe discount calculation: floor margin at 10%
                      const safeCap = m.marginPct !== null && m.marginPct > 10 ? Math.floor(m.marginPct - 10) : 0;

                      return (
                        <tr key={m.productId} className={cn(isNegative && "bg-rose-500/10")}>
                          <td className="py-2.5 px-3 font-medium flex items-center gap-2">
                            {isNegative && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />}
                            <span>{m.name}</span>
                          </td>
                          <td className="py-2.5 px-3">{m.units}</td>
                          <td className="py-2.5 px-3">{formatCurrency(m.revenue, currency)}</td>
                          <td className="py-2.5 px-3">{formatCurrency(m.cost, currency)}</td>
                          <td className={cn("py-2.5 px-3 font-semibold", m.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                            {formatCurrency(m.profit, currency)}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant={isNegative ? "destructive" : isLow ? "secondary" : "default"}
                              className="text-[10px]"
                            >
                              {m.marginPct !== null ? `${m.marginPct}%` : "No Cost"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground font-mono">
                            {m.marginPct !== null ? (safeCap > 0 ? `Max ${safeCap}%` : "No discount") : "Unknown cost"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Immediate Stockout Risks */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Stockout Risks (High Velocity)
                </CardTitle>
                <CardDescription>Fast-selling items projected to run out before normal replenishment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(snapshot?.inventory?.stockoutRisk || []).slice(0, 5).map((item: any) => (
                  <div key={item.productId} className="flex justify-between items-center p-2.5 rounded-lg border bg-card text-xs">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-muted-foreground">Days of cover: {item.daysOfCover ?? "<1"} days</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-500">{item.qty} units left</p>
                      <p className="text-[10px] text-muted-foreground">Order +{item.suggestedReorderQty || 10}</p>
                    </div>
                  </div>
                ))}
                {(!snapshot?.inventory?.stockoutRisk || snapshot.inventory.stockoutRisk.length === 0) && (
                  <p className="text-xs text-muted-foreground py-4 text-center">No fast-selling stockout risks detected.</p>
                )}
              </CardContent>
            </Card>

            {/* Slow Moving Capital */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <Boxes className="w-4 h-4" /> Slow Moving Inventory
                </CardTitle>
                <CardDescription>Capital locked in items with low sales velocity over 60+ days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(snapshot?.inventory?.slowMoving || []).slice(0, 5).map((item: any) => (
                  <div key={item.productId} className="flex justify-between items-center p-2.5 rounded-lg border bg-card text-xs">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-muted-foreground">{item.qty} in stock</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(item.value, currency)}</p>
                      <p className="text-[10px] text-muted-foreground">Tied-up capital</p>
                    </div>
                  </div>
                ))}
                {(!snapshot?.inventory?.slowMoving || snapshot.inventory.slowMoving.length === 0) && (
                  <p className="text-xs text-muted-foreground py-4 text-center">Inventory turnover velocity is optimal.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 5: ACTION TRACKING (RECOMMENDATIONS) */}
        {/* ========================================================================= */}
        <TabsContent value="recommendations" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Advisor Action Tracker</h2>
              <p className="text-xs text-muted-foreground">
                Track status and measure before/after outcomes of advisor suggestions
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border text-xs">
              {(["ALL", "PENDING", "IN_PROGRESS", "COMPLETED", "DISMISSED"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setRecFilter(status)}
                  className={cn(
                    "px-3 py-1 rounded-md transition-colors",
                    recFilter === status ? "bg-background shadow font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredRecs.map((rec: any) => (
              <Card key={rec.id} className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={rec.priority === 1 ? "destructive" : "secondary"}
                        className="text-[10px] uppercase font-bold"
                      >
                        Priority {rec.priority}
                      </Badge>
                      <h3 className="font-semibold text-base">{rec.renderedTitle || rec.ruleKey}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{rec.renderedAction}</p>
                    {rec.renderedWhy && (
                      <p className="text-xs text-muted-foreground/80 pt-1">
                        <span className="font-semibold text-foreground">Why: </span>
                        {rec.renderedWhy}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-start">
                    {rec.status !== "IN_PROGRESS" && rec.status !== "COMPLETED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateRecStatus(rec.id, "IN_PROGRESS")}
                        className="text-xs"
                      >
                        Start Action
                      </Button>
                    )}
                    {rec.status !== "COMPLETED" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateRecStatus(rec.id, "COMPLETED")}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Complete
                      </Button>
                    )}
                    {rec.status !== "DISMISSED" && rec.status !== "COMPLETED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateRecStatus(rec.id, "DISMISSED")}
                        className="text-xs text-muted-foreground hover:text-rose-500"
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>

                {/* History Timeline */}
                {rec.history?.length > 0 && (
                  <div className="pt-3 border-t text-xs space-y-1.5">
                    <span className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">
                      Action History
                    </span>
                    <div className="space-y-1">
                      {rec.history.map((h: any) => (
                        <div key={h.id} className="flex items-center justify-between text-muted-foreground">
                          <span>
                            Status moved to <strong className="text-foreground">{h.toStatus}</strong>: {h.note}
                          </span>
                          <span className="text-[10px]">{new Date(h.createdAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}

            {filteredRecs.length === 0 && (
              <div className="text-center py-12 border rounded-xl bg-muted/10">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">No recommendations in this status filter.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 6: BUSINESS GOALS */}
        {/* ========================================================================= */}
        <TabsContent value="goals" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Goals List */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-bold">Active Targets & Progress</h2>
              <div className="grid grid-cols-1 gap-4">
                {(dashboardData?.goals || []).map((g: any) => {
                  const pct = g.progressPct ?? 0;
                  return (
                    <Card key={g.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant="outline" className="text-[10px] mb-1">
                            {g.metric.replace(/_/g, " ")}
                          </Badge>
                          <h3 className="font-semibold text-base">{g.title || g.metric}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold">{pct}%</span>
                          <p className="text-xs text-muted-foreground">
                            Target: {formatNumber(g.targetValue)}
                          </p>
                        </div>
                      </div>

                      <Progress value={Math.min(100, pct)} className="h-2" />

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Current Value: {g.currentValue !== null ? formatNumber(g.currentValue) : "Tracking..."}</span>
                        <span>{pct >= 100 ? "🎉 Target Met!" : `${Math.max(0, 100 - pct)}% remaining`}</span>
                      </div>
                    </Card>
                  );
                })}

                {(!dashboardData?.goals || dashboardData.goals.length === 0) && (
                  <div className="text-center py-12 border rounded-xl bg-muted/10">
                    <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">No business goals set yet. Add your first target!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Create Goal Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Set a New Business Target</CardTitle>
                <CardDescription>Track monthly milestones with automated progress tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateGoal} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold">Metric</label>
                    <select
                      value={goalMetric}
                      onChange={(e) => setGoalMetric(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border bg-background text-xs"
                    >
                      <option value="MONTHLY_SALES">Monthly Net Sales ({currency})</option>
                      <option value="DAILY_SALES">Daily Sales Target ({currency})</option>
                      <option value="MONTHLY_GROSS_PROFIT">Monthly Gross Profit ({currency})</option>
                      <option value="MONTHLY_EXPENSE_LIMIT">Expense Ceiling Limit ({currency})</option>
                      <option value="STOCK_TURNOVER">Stock Turnover (Turns / Year)</option>
                      <option value="REPEAT_CUSTOMER_SALES">Repeat Customer Sales (%)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold">Target Value</label>
                    <Input
                      type="number"
                      placeholder="e.g. 500000"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold">Custom Title (Optional)</label>
                    <Input
                      placeholder="e.g. December Festive Revenue Target"
                      value={goalTitle}
                      onChange={(e) => setGoalTitle(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={creatingGoal}>
                    {creatingGoal ? "Adding Target..." : "Save Business Target"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 7: ADVISOR CHAT */}
        {/* ========================================================================= */}
        <TabsContent value="chat" className="space-y-6">
          <Card className="flex flex-col h-[600px] border-primary/20 shadow-lg">
            <CardHeader className="pb-3 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Zentravo AI Financial Advisor</CardTitle>
                    <CardDescription className="text-xs">
                      Grounded in verified database numbers • Never invents financial data
                    </CardDescription>
                  </div>
                </div>

                <Badge variant="outline" className="text-xs font-mono">
                  {currency} • {snapshot?.today}
                </Badge>
              </div>
            </CardHeader>

            {/* Chat Transcript Area */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-12 space-y-4">
                  <BrainCircuit className="w-12 h-12 text-primary/40 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base">Ask your Financial Advisor</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Inquire about today&apos;s revenue, gross profit, slow-moving items, customer debts, or safe discounts.
                    </p>
                  </div>

                  {/* Quick Prompts */}
                  <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-lg mx-auto">
                    {[
                      "How much did I make today?",
                      "What was my profit this month?",
                      "Who owes me money?",
                      "What items are running low on stock?",
                      "How is my cash flow today?",
                    ].map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendChat(prompt)}
                        className="text-xs px-3 py-1.5 rounded-full border bg-muted/50 hover:bg-muted text-foreground transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg: any) => {
                const isUser = msg.role === "USER";
                return (
                  <div
                    key={msg.id}
                    className={cn("flex flex-col max-w-[80%] space-y-1", isUser ? "ml-auto items-end" : "items-start")}
                  >
                    <div
                      className={cn(
                        "p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed shadow-sm",
                        isUser
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-muted border rounded-tl-none text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-line">{msg.content}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {!isUser && msg.usedAi && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/30 text-primary">
                          AI Polished
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}

              {chatPending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-2xl max-w-[60%]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Computing verified business figures...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </CardContent>

            {/* Input Box */}
            <div className="p-3 border-t bg-card flex items-center gap-2">
              <Input
                placeholder="Ask about revenue, profits, overdue debtors, inventory risks..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                disabled={chatPending}
                className="text-xs"
              />
              <Button size="sm" onClick={() => handleSendChat()} disabled={chatPending || !chatInput.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 8: ADVISOR SETTINGS */}
        {/* ========================================================================= */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Advisor Configuration</CardTitle>
              <CardDescription>
                Configure automated evening report times, notification delivery channels, and risk thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {settingsForm && (
                <form onSubmit={handleSaveSettings} className="space-y-6 text-xs md:text-sm">
                  {/* Daily Report Delivery */}
                  <div className="space-y-4 p-4 rounded-xl border bg-muted/20">
                    <h3 className="font-semibold text-sm">Automated Evening Business Report</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                        <div>
                          <p className="font-semibold text-xs">Enable Daily Report</p>
                          <p className="text-[11px] text-muted-foreground">Generate report every evening</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settingsForm.dailyReportEnabled ?? true}
                          onChange={(e) => setSettingsForm({ ...settingsForm, dailyReportEnabled: e.target.checked })}
                          className="w-4 h-4 rounded text-primary"
                        />
                      </div>

                      <div className="space-y-1.5 p-3 rounded-lg border bg-background">
                        <label className="font-semibold text-xs">Delivery Time (Local Time)</label>
                        <Input
                          type="time"
                          value={settingsForm.deliveryTime || "18:00"}
                          onChange={(e) => setSettingsForm({ ...settingsForm, deliveryTime: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Delivery Channels */}
                  <div className="space-y-4 p-4 rounded-xl border bg-muted/20">
                    <h3 className="font-semibold text-sm">Delivery Channels</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: "IN_APP", label: "In-App Notifications", icon: Bell },
                        { id: "EMAIL", label: "Email Summary", icon: Mail },
                        { id: "SMS", label: "SMS Alerts", icon: Smartphone },
                        { id: "WHATSAPP", label: "WhatsApp Digest", icon: MessageCircle },
                      ].map((ch) => {
                        const active = (settingsForm.channels || []).includes(ch.id);
                        const Icon = ch.icon;
                        return (
                          <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                            <div className="flex items-center gap-2.5">
                              <Icon className="w-4 h-4 text-primary" />
                              <span className="font-medium text-xs">{ch.label}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={(e) => {
                                const cur = new Set(settingsForm.channels || ["IN_APP"]);
                                if (e.target.checked) cur.add(ch.id);
                                else cur.delete(ch.id);
                                setSettingsForm({ ...settingsForm, channels: Array.from(cur) });
                              }}
                              className="w-4 h-4 rounded text-primary"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI Explanations Opt-In */}
                  <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          AI Natural Language Explanations
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Allow configured AI provider to polish verified financial calculations into executive narratives.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settingsForm.aiExplanationsEnabled ?? false}
                        onChange={(e) => setSettingsForm({ ...settingsForm, aiExplanationsEnabled: e.target.checked })}
                        className="w-4 h-4 rounded text-primary"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={savingSettings}>
                      {savingSettings ? "Saving Settings..." : "Save Preferences"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
