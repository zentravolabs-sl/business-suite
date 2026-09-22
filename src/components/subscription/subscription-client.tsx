"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  CheckCircle2,
  Zap,
  Building2,
  Users,
  Package,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Clock,
  Download,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatCurrency } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  type: string;
  description: string | null;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  maxBranches: number;
  maxUsers: number;
  maxProducts: number;
  aiAssistant: boolean;
  ecommerce: boolean;
  loyalty: boolean;
  marketing: boolean;
  advancedReports: boolean;
  features?: any;
}

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    billingPeriod: "MONTHLY" | "ANNUAL";
    amount: number;
    currency: string;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    plan: Plan | null;
    invoices: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      paidAt: string | null;
      invoiceUrl: string | null;
      periodStart: string;
      periodEnd: string;
      createdAt: string;
    }>;
  } | null;
  plans: Plan[];
  usage: {
    branches: { current: number; max: number };
    users: { current: number; max: number };
    products: { current: number; max: number };
  };
}

export function SubscriptionClient() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.subscription?.billingPeriod) {
          setBillingPeriod(json.subscription.billingPeriod);
        }
      }
    } catch (err) {
      console.error("Failed to load subscription:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const handleSelectPlan = async (planId: string) => {
    setUpdatingPlanId(planId);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingPeriod }),
      });
      if (res.ok) {
        setSuccessMsg("Subscription plan updated successfully!");
        await fetchSubscription();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Failed to change plan:", err);
    } finally {
      setUpdatingPlanId(null);
    }
  };

  const currentPlan = data?.subscription?.plan;
  const isTrial = data?.subscription?.status === "TRIAL";

  // Compute trial days remaining
  const trialDaysLeft = data?.subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(data.subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
              <CreditCard className="h-4 w-4" />
            </div>
            Subscription & Billing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your SaaS tier, branch quotas, team licenses, and invoice history
          </p>
        </div>

        {/* Billing period toggle */}
        <div className="flex items-center gap-3 bg-muted/60 p-1.5 rounded-xl border">
          <button
            onClick={() => setBillingPeriod("MONTHLY")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              billingPeriod === "MONTHLY"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingPeriod("ANNUAL")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
              billingPeriod === "ANNUAL"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Annual Billing</span>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5 py-0 border-emerald-500/20">
              Save 20%
            </Badge>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Current Plan & Quotas Banner */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Current Plan Overview */}
        <Card className="lg:col-span-1 border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current Plan
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "font-bold text-xs uppercase px-2 py-0.5",
                  isTrial
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                )}
              >
                {data?.subscription?.status || "ACTIVE"}
              </Badge>
            </div>
            <CardTitle className="text-2xl font-black tracking-tight mt-1 flex items-center gap-2">
              {currentPlan?.name || "Starter Tier"}
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
            </CardTitle>
            <CardDescription className="text-xs">
              {isTrial ? `${trialDaysLeft} days remaining in free trial` : "Billed " + (billingPeriod === "ANNUAL" ? "annually" : "monthly")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-background/80 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Current Billing Rate</p>
              <p className="text-xl font-extrabold">
                {formatCurrency(data?.subscription?.amount || currentPlan?.monthlyPrice || 4500)}
                <span className="text-xs font-normal text-muted-foreground"> / {data?.subscription?.billingPeriod === "ANNUAL" ? "year" : "month"}</span>
              </p>
            </div>
            {data?.subscription?.currentPeriodEnd && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>Renewal: {new Date(data.subscription.currentPeriodEnd).toLocaleDateString("en-LK", { dateStyle: "medium" })}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quota & Usage Meters */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Workspace Resource Usage</CardTitle>
            <CardDescription className="text-xs">
              Current consumption versus plan allowances
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Branches Usage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Active Branches
                </span>
                <span className="font-semibold">
                  {data?.usage.branches.current || 1} / {data?.usage.branches.max ?? 1}
                </span>
              </div>
              <Progress
                value={
                  data?.usage.branches.max
                    ? Math.min(100, ((data.usage.branches.current || 1) / data.usage.branches.max) * 100)
                    : 100
                }
                className="h-2"
              />
            </div>

            {/* Users Usage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  Staff Members & Logins
                </span>
                <span className="font-semibold">
                  {data?.usage.users.current || 1} / {data?.usage.users.max ?? 5}
                </span>
              </div>
              <Progress
                value={
                  data?.usage.users.max
                    ? Math.min(100, ((data.usage.users.current || 1) / data.usage.users.max) * 100)
                    : 20
                }
                className="h-2"
              />
            </div>

            {/* Products Usage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  Products Catalog Items
                </span>
                <span className="font-semibold">
                  {data?.usage.products.current || 0} / {data?.usage.products.max ?? 500}
                </span>
              </div>
              <Progress
                value={
                  data?.usage.products.max
                    ? Math.min(100, ((data.usage.products.current || 0) / data.usage.products.max) * 100)
                    : 0
                }
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Plans Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Available Subscription Tiers</h2>
          <p className="text-sm text-muted-foreground">
            Upgrade or switch tiers at any time. Unused time is prorated.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {(data?.plans || []).map((plan) => {
            const isCurrent = currentPlan?.id === plan.id;
            const price = billingPeriod === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "flex flex-col relative transition-all duration-200 hover:shadow-md",
                  isCurrent && "border-2 border-primary shadow-xs ring-2 ring-primary/20"
                )}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground font-bold px-3 py-0.5 text-[10px] uppercase">
                      Current Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-bold">{plan.name}</CardTitle>
                  <CardDescription className="text-xs min-h-[32px]">
                    {plan.description || "Comprehensive retail operations package"}
                  </CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl font-extrabold tracking-tight">
                      {formatCurrency(price)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {" "}/ {billingPeriod === "ANNUAL" ? "year" : "month"}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3 text-xs border-t pt-4">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Up to {plan.maxBranches} Branch{plan.maxBranches > 1 ? "es" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Up to {plan.maxUsers} Staff Users</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Up to {plan.maxProducts.toLocaleString()} Products</span>
                  </div>
                  {plan.aiAssistant && (
                    <div className="flex items-center gap-2 font-medium text-primary">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>AI Business Insights Assistant</span>
                    </div>
                  )}
                  {plan.ecommerce && (
                    <div className="flex items-center gap-2 font-medium">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Online Storefront & Orders</span>
                    </div>
                  )}
                  {plan.loyalty && (
                    <div className="flex items-center gap-2 font-medium">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Customer Loyalty & Points</span>
                    </div>
                  )}
                  {plan.marketing && (
                    <div className="flex items-center gap-2 font-medium">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>WhatsApp & SMS Campaigns</span>
                    </div>
                  )}
                  {plan.advancedReports && (
                    <div className="flex items-center gap-2 font-medium">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Advanced Financial Auditing</span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2">
                  <Button
                    variant={isCurrent ? "outline" : "default"}
                    className="w-full text-xs font-semibold"
                    disabled={isCurrent || updatingPlanId === plan.id}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {isCurrent
                      ? "Active Plan"
                      : updatingPlanId === plan.id
                      ? "Updating..."
                      : "Upgrade to " + plan.name}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment & Invoices Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Payment Methods Card */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Payment Methods
            </CardTitle>
            <CardDescription className="text-xs">
              Sri Lankan local and international payment gateways supported
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-semibold text-foreground">PayHere Gateway</p>
                <p className="text-muted-foreground text-[11px]">Visa, Mastercard, Frimi, Genie</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">Active</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-semibold text-foreground">Direct Bank Transfer</p>
                <p className="text-muted-foreground text-[11px]">Commercial Bank / Sampath Bank</p>
              </div>
              <Badge variant="outline" className="text-[10px]">Available</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-semibold text-foreground">LankaQR</p>
                <p className="text-muted-foreground text-[11px]">Central Bank of Sri Lanka QR</p>
              </div>
              <Badge variant="outline" className="text-[10px]">Instant</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Invoice History */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Billing History & Receipts</CardTitle>
            <CardDescription className="text-xs">
              Tax-compliant invoices and payment confirmations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Invoice ID</th>
                    <th className="px-4 py-3">Billing Period</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data?.subscription?.invoices && data.subscription.invoices.length > 0 ? (
                    data.subscription.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-foreground">
                          INV-{inv.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(inv.periodStart).toLocaleDateString("en-LK", { month: "short", day: "numeric" })} -{" "}
                          {new Date(inv.periodEnd).toLocaleDateString("en-LK", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No previous billing invoices found for this account.
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
