"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot, Send, TrendingUp, TrendingDown, Package, Users, Shield,
  Wrench, AlertTriangle, ShoppingCart, Lightbulb, RefreshCw,
  BarChart3, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

interface Insight {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  value?: number | null;
  trend?: string | null;
  recommendation?: string | null;
  actions?: string[];
  metadata?: any;
}

interface AISummary {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  revenueGrowth: number;
  lowStockCount: number;
  expiringWarrantiesCount: number;
  pendingServicesCount: number;
  pendingOrdersCount: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  "What are my top selling products this month?",
  "Which products are running low on stock?",
  "How is my revenue trending?",
  "What warranties are expiring soon?",
  "Are there any pending service tickets?",
  "Give me a business health summary",
  "Which customers owe me money?",
  "What's my profit margin this month?",
];

const INSIGHT_ICONS: Record<string, any> = {
  REVENUE_TREND: TrendingUp,
  STOCK_ALERT: Package,
  WARRANTY_EXPIRY: Shield,
  SERVICE_PENDING: Wrench,
  CUSTOMER_INSIGHT: Users,
  ORDER_ALERT: ShoppingCart,
  CREDIT_ALERT: AlertTriangle,
  PERFORMANCE: BarChart3,
  success: TrendingUp,
  warning: AlertTriangle,
  danger: AlertTriangle,
  info: Lightbulb,
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "border-red-500/30 bg-red-500/5",
  HIGH: "border-amber-500/30 bg-amber-500/5",
  MEDIUM: "border-blue-500/30 bg-blue-500/5",
  LOW: "border-emerald-500/30 bg-emerald-500/5",
  "1": "border-red-500/30 bg-red-500/5",
  "2": "border-amber-500/30 bg-amber-500/5",
  "3": "border-blue-500/30 bg-blue-500/5",
};

const PRIORITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/10 text-red-600 border-red-500/20",
  HIGH: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  MEDIUM: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  LOW: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "1": "bg-red-500/10 text-red-600 border-red-500/20",
  "2": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "3": "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export function AIAssistantClient() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI Business Assistant powered by your real business data. I can analyze your sales, inventory, customers, warranties, and more. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsLoaded, setInsightsLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/ai/insights");
      const data = await res.json();
      if (res.ok) {
        setInsights(data.insights || []);
        setSummary(data.summary || null);
        setInsightsLoaded(true);
      }
    } catch (err) {
      console.error("Failed to load insights:", err);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const handleSend = async (question?: string) => {
    const text = question || inputValue.trim();
    if (!text) return;

    const userMsg: ChatMessage = { role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      const data = await res.json();
      const answer = data.answer || data.response || "I couldn't generate a response at this time.";

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error while processing your request. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            AI Business Assistant
          </h1>
          <p className="text-sm text-muted-foreground">
            Powered by your real business data — no external AI APIs, 100% private
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadInsights} disabled={insightsLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-1.5", insightsLoading && "animate-spin")} />
          Refresh Insights
        </Button>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Revenue</p>
            <p className="text-2xl font-extrabold mt-1">{formatCurrency(summary.todayRevenue)}</p>
            <p className={cn("text-xs mt-1 flex items-center gap-1", summary.revenueGrowth >= 0 ? "text-emerald-600" : "text-red-600")}>
              {summary.revenueGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(summary.revenueGrowth).toFixed(1)}% vs last month
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Low Stock Items</p>
            <p className={cn("text-2xl font-extrabold mt-1", summary.lowStockCount > 0 ? "text-amber-600" : "text-emerald-600")}>
              {summary.lowStockCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Products need restocking</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiring Warranties</p>
            <p className={cn("text-2xl font-extrabold mt-1", summary.expiringWarrantiesCount > 0 ? "text-amber-600" : "text-emerald-600")}>
              {summary.expiringWarrantiesCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Expiring in 30 days</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Services</p>
            <p className={cn("text-2xl font-extrabold mt-1", summary.pendingServicesCount > 0 ? "text-amber-600" : "text-emerald-600")}>
              {summary.pendingServicesCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Service tickets active</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* AI Insights Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Live Business Insights</h2>
            {insightsLoaded && (
              <Badge variant="outline" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {insights.length} insights generated
              </Badge>
            )}
          </div>

          {insightsLoading ? (
            <div className="rounded-2xl border bg-card p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Analyzing your business data...</p>
            </div>
          ) : insights.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No insights yet</p>
              <p className="text-sm text-muted-foreground mt-1">Click "Refresh Insights" to generate AI analysis</p>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((insight, index) => {
                const Icon = INSIGHT_ICONS[insight.type] || Lightbulb;
                const uniqueKey = insight.id || `insight-${insight.type || "item"}-${index}`;
                return (
                  <div
                    key={uniqueKey}
                    className={cn(
                      "rounded-2xl border p-4 transition-all hover:shadow-md",
                      PRIORITY_COLORS[insight.priority] || "border-border bg-card"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl bg-background shadow-sm flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-sm">{insight.title}</p>
                          <span className={cn("text-[10px] rounded-full border px-1.5 py-0.5 font-bold", PRIORITY_BADGE[insight.priority])}>
                            {insight.priority}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{insight.message}</p>
                        {insight.recommendation && (
                          <div className="mt-2 rounded-lg bg-background/80 border px-3 py-2 text-xs text-muted-foreground">
                            💡 {insight.recommendation}
                          </div>
                        )}
                        {insight.value !== null && insight.value !== undefined && (
                          <div className="mt-2 flex items-center gap-1 text-xs font-semibold">
                            {insight.trend === "UP" ? (
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                            ) : insight.trend === "DOWN" ? (
                              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                            ) : null}
                            <span>{typeof insight.value === "number" && insight.value > 1000 ? formatCurrency(insight.value) : insight.value}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Chat Panel */}
        <div className="rounded-2xl border bg-card shadow-sm flex flex-col h-[600px]">
          {/* Chat Header */}
          <div className="flex items-center gap-3 border-b p-4">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm">Zentravo AI</p>
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn("text-[10px] mt-1 opacity-60", msg.role === "user" ? "text-white" : "text-muted-foreground")}>
                    {msg.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
            {QUICK_QUESTIONS.slice(0, 4).map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="text-xs rounded-full border px-3 py-1.5 whitespace-nowrap hover:bg-muted transition-colors shrink-0 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="border-t p-4 flex gap-2">
            <Input
              placeholder="Ask about your business..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
              disabled={loading}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={loading || !inputValue.trim()}
              className="bg-gradient-to-br from-violet-600 to-indigo-600 shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
