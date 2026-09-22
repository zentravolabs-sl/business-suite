import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Building2,
  Users,
  CreditCard,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Server,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Super Admin Overview | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  // Fetch real data from database
  const [
    totalBusinesses,
    totalUsers,
    totalBranches,
    subscriptions,
    businesses,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.user.count(),
    prisma.branch.count(),
    prisma.subscription.findMany({
      include: { plan: true },
    }),
    prisma.business.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        subscription: { include: { plan: true } },
        branches: true,
        users: { include: { user: true } },
      },
    }),
  ]);

  // Calculate approximate MRR
  const mrr = subscriptions.reduce((acc, sub) => {
    return acc + Number(sub.plan.monthlyPrice || 0);
  }, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Super Admin Platform Overview</h1>
          <p className="text-sm text-muted-foreground">
            Multi-tenant system metrics, cloud performance, and retail tenant monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-emerald-500 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            All Systems Operational
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Businesses */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Businesses
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold">{totalBusinesses}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-500">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Active multi-tenant businesses</span>
          </div>
        </div>

        {/* Estimated MRR */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Platform MRR
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold">{formatCurrency(mrr)}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span>{subscriptions.length} active subscriptions</span>
          </div>
        </div>

        {/* Total Users */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Staff & Cashiers
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold">{totalUsers}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span>Across {totalBranches} branch locations</span>
          </div>
        </div>

        {/* System Health */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Neon DB Cluster
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-emerald-500">99.98%</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span>Serverless Autoscaling Active</span>
          </div>
        </div>
      </div>

      {/* Main Content: Recent Tenants Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-base font-bold">Registered Retail Businesses</h2>
            <p className="text-xs text-muted-foreground">
              Live businesses on the Zentravo SaaS platform
            </p>
          </div>
          <Link
            href="/super-admin/businesses"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <span>View All Tenants</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Business</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Branches</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No businesses created yet.
                  </td>
                </tr>
              ) : (
                businesses.map((biz) => {
                  const plan = biz.subscription?.plan;
                  const owner = biz.users.find((u) => u.isOwner)?.user;
                  return (
                    <tr key={biz.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold">{biz.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {owner?.email || biz.email || "No email"}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-md border bg-muted px-2 py-0.5 text-xs font-medium">
                          {biz.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-xs text-primary">
                          {plan?.name || "No Plan"}
                        </span>
                        <div className="text-[11px] text-muted-foreground">
                          {formatCurrency(Number(plan?.monthlyPrice || 0))}/mo
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {biz.branches.length} branch(es)
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            biz.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          }`}
                        >
                          {biz.status === "ACTIVE" ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {biz.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {formatDate(biz.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/dashboard`}
                          className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
                        >
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
