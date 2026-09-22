"use client";

import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  Plus,
  Scale,
  TrendingUp,
  Wallet,
  ArrowRight,
  Truck,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface AccountingOverviewKPIs {
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number;
  totalExpenses: number;
  netProfit: number;
  netMarginPct: number;
  cashAndBankBalance: number;
  accountsReceivable: number;
  accountsPayable: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface RecentJournalEntry {
  id: string;
  entryNumber: string;
  description: string;
  reference?: string | null;
  referenceType?: string | null;
  postedAt: string;
  totalAmount: number;
}

export function AccountingOverviewClient({
  kpis,
  recentEntries,
}: {
  kpis: AccountingOverviewKPIs;
  recentEntries: RecentJournalEntry[];
}) {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting & Financials</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time double-entry general ledger, automated journal entries, and financial statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/accounting/journal"
            className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-colors shadow-sm"
          >
            <FileText className="h-4 w-4" /> General Journal
          </Link>
          <Link
            href="/dashboard/accounting/reports"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
          >
            <BarChart3 className="h-4 w-4" /> Financial Statements
          </Link>
        </div>
      </div>

      {/* KPI Cards Row 1: Profitability */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Operating Revenue
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-emerald-600">
              {formatCurrency(kpis.totalRevenue)}
            </span>
            <span className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Cost of Sales (COGS)
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-amber-600">
              {formatCurrency(kpis.totalCogs)}
            </span>
            <span className="rounded-full bg-amber-500/10 p-1.5 text-amber-600">
              <Truck className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Gross Profit
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-xl font-bold font-mono">
                {formatCurrency(kpis.grossProfit)}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {kpis.grossMarginPct.toFixed(1)}% Margin
              </span>
            </div>
            <span className="rounded-full bg-blue-500/10 p-1.5 text-blue-600">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Net Operating Income
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span
                className={`text-xl font-bold font-mono ${
                  kpis.netProfit >= 0 ? "text-primary" : "text-rose-600"
                }`}
              >
                {formatCurrency(kpis.netProfit)}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {kpis.netMarginPct.toFixed(1)}% Net Margin
              </span>
            </div>
            <span className="rounded-full bg-primary/10 p-1.5 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Row 2: Liquidity & Balances */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Liquid Cash & Bank
            </span>
            <span className="mt-1 text-2xl font-bold font-mono text-foreground block">
              {formatCurrency(kpis.cashAndBankBalance)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Cash in Hand + Bank Accounts
            </span>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
            <Wallet className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Accounts Receivable (AR)
            </span>
            <span className="mt-1 text-2xl font-bold font-mono text-blue-600 block">
              {formatCurrency(kpis.accountsReceivable)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Owed by Credit Customers
            </span>
          </div>
          <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-600">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Accounts Payable (AP)
            </span>
            <span className="mt-1 text-2xl font-bold font-mono text-amber-600 block">
              {formatCurrency(kpis.accountsPayable)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Outstanding Vendor Payables
            </span>
          </div>
          <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600">
            <Truck className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/accounting/accounts"
          className="group rounded-2xl border bg-card p-4 shadow-sm hover:border-primary/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="font-bold text-sm mt-3">Chart of Accounts</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Inspect GL structure, code hierarchy, and balances.
          </p>
        </Link>

        <Link
          href="/dashboard/accounting/journal"
          className="group rounded-2xl border bg-card p-4 shadow-sm hover:border-primary/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600">
              <FileText className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="font-bold text-sm mt-3">General Journal</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Post balanced debit/credit adjustments and manual entries.
          </p>
        </Link>

        <Link
          href="/dashboard/accounting/reports"
          className="group rounded-2xl border bg-card p-4 shadow-sm hover:border-primary/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="font-bold text-sm mt-3">Profit & Loss</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Monthly income statements and gross margin analysis.
          </p>
        </Link>

        <Link
          href="/dashboard/accounting/reports"
          className="group rounded-2xl border bg-card p-4 shadow-sm hover:border-primary/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
              <Scale className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="font-bold text-sm mt-3">Balance Sheet</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Assets vs Liabilities and Equity financial position.
          </p>
        </Link>
      </div>

      {/* Recent Journal Entries Live Feed */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Recent General Journal Entries
            </h2>
            <p className="text-xs text-muted-foreground">
              Automated entries created by POS sales, inventory intake, and disbursements.
            </p>
          </div>
          <Link
            href="/dashboard/accounting/journal"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[10px] font-semibold uppercase text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-2.5">Entry #</th>
                <th className="px-4 py-2.5">Posted Date</th>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Reference</th>
                <th className="px-4 py-2.5 text-right">Amount (LKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No journal entries recorded yet.
                  </td>
                </tr>
              ) : (
                recentEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      {e.entryNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(e.postedAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {e.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                        {e.referenceType || "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {e.reference || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {formatCurrency(e.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
