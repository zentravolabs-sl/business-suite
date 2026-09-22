"use client";

import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Scale,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ReportItem {
  id: string;
  code: string;
  name: string;
  amount: number;
}

interface PnLData {
  revenue: { items: ReportItem[]; total: number };
  cogs: { items: ReportItem[]; total: number };
  grossProfit: number;
  grossMarginPct: number;
  expenses: { items: ReportItem[]; total: number };
  netProfit: number;
  netMarginPct: number;
}

interface BalanceSheetData {
  assets: { items: (ReportItem & { isBankAccount?: boolean })[]; total: number };
  liabilities: { items: ReportItem[]; total: number };
  equity: { items: ReportItem[]; currentPeriodNetIncome: number; total: number };
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

interface TrialBalanceData {
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export function ReportsClient({
  businessName,
  pnl,
  balanceSheet,
  trialBalance,
}: {
  businessName: string;
  pnl: PnLData;
  balanceSheet: BalanceSheetData;
  trialBalance: TrialBalanceData;
}) {
  const [activeTab, setActiveTab] = useState<"pnl" | "balance_sheet" | "trial_balance">(
    "pnl"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Statements & Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time Profit & Loss, Statement of Financial Position (Balance Sheet), and Trial Balance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted transition-colors shadow-sm"
          >
            <Printer className="h-4 w-4" /> Print Statement
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b text-xs font-semibold">
        <button
          onClick={() => setActiveTab("pnl")}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "pnl"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="h-4 w-4" /> Profit & Loss Statement (P&L)
        </button>
        <button
          onClick={() => setActiveTab("balance_sheet")}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "balance_sheet"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scale className="h-4 w-4" /> Balance Sheet
        </button>
        <button
          onClick={() => setActiveTab("trial_balance")}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "trial_balance"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4" /> Trial Balance
        </button>
      </div>

      {/* TAB 1: PROFIT & LOSS */}
      {activeTab === "pnl" && (
        <div className="space-y-6 max-w-4xl mx-auto print:max-w-none">
          {/* Statement Sheet Card */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div className="text-center pb-4 border-b">
              <h2 className="text-xl font-bold">{businessName}</h2>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                Statement of Profit or Loss (Income Statement)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                For the current operating period • Currency: LKR
              </p>
            </div>

            {/* Revenue Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center justify-between">
                <span>1. Operating Revenue</span>
                <span className="font-mono">{formatCurrency(pnl.revenue.total)}</span>
              </h4>
              <div className="rounded-xl border divide-y bg-background/50 text-xs">
                {pnl.revenue.items.map((it) => (
                  <div key={it.id} className="p-3 flex justify-between">
                    <div>
                      <span className="font-mono text-muted-foreground mr-2">
                        {it.code}
                      </span>
                      <span className="font-semibold">{it.name}</span>
                    </div>
                    <span className="font-mono font-medium">
                      {formatCurrency(it.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost of Sales Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center justify-between">
                <span>2. Cost of Goods Sold (COGS)</span>
                <span className="font-mono">({formatCurrency(pnl.cogs.total)})</span>
              </h4>
              <div className="rounded-xl border divide-y bg-background/50 text-xs">
                {pnl.cogs.items.map((it) => (
                  <div key={it.id} className="p-3 flex justify-between">
                    <div>
                      <span className="font-mono text-muted-foreground mr-2">
                        {it.code}
                      </span>
                      <span className="font-semibold">{it.name}</span>
                    </div>
                    <span className="font-mono font-medium">
                      {formatCurrency(it.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gross Profit Summary Card */}
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center justify-between font-bold">
              <div>
                <span className="text-emerald-700 dark:text-emerald-400 text-sm block">
                  Gross Profit
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Gross Margin: {pnl.grossMarginPct.toFixed(1)}%
                </span>
              </div>
              <span className="text-xl font-mono text-emerald-700 dark:text-emerald-400">
                {formatCurrency(pnl.grossProfit)}
              </span>
            </div>

            {/* Operating Expenses Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center justify-between">
                <span>3. Operating Expenses</span>
                <span className="font-mono">({formatCurrency(pnl.expenses.total)})</span>
              </h4>
              <div className="rounded-xl border divide-y bg-background/50 text-xs">
                {pnl.expenses.items.map((it) => (
                  <div key={it.id} className="p-3 flex justify-between">
                    <div>
                      <span className="font-mono text-muted-foreground mr-2">
                        {it.code}
                      </span>
                      <span className="font-semibold">{it.name}</span>
                    </div>
                    <span className="font-mono font-medium">
                      {formatCurrency(it.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Net Operating Profit / Loss */}
            <div
              className={`rounded-2xl p-5 border flex items-center justify-between ${
                pnl.netProfit >= 0
                  ? "bg-primary/10 border-primary/20"
                  : "bg-rose-500/10 border-rose-500/20"
              }`}
            >
              <div>
                <span className="text-base font-bold text-foreground block">
                  Net Operating Income (Net Profit)
                </span>
                <span className="text-xs text-muted-foreground">
                  Net Margin: {pnl.netMarginPct.toFixed(1)}%
                </span>
              </div>
              <span
                className={`text-2xl font-bold font-mono ${
                  pnl.netProfit >= 0 ? "text-primary" : "text-rose-600"
                }`}
              >
                {formatCurrency(pnl.netProfit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BALANCE SHEET */}
      {activeTab === "balance_sheet" && (
        <div className="space-y-6 max-w-5xl mx-auto print:max-w-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div className="text-center pb-4 border-b">
              <h2 className="text-xl font-bold">{businessName}</h2>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                Statement of Financial Position (Balance Sheet)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                As of {formatDate(new Date().toISOString())} • Currency: LKR
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* ASSETS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600">
                    Assets
                  </h4>
                  <span className="font-mono font-bold text-blue-600 text-sm">
                    {formatCurrency(balanceSheet.totalAssets)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">
                    Current & Liquid Assets
                  </span>
                  <div className="rounded-xl border divide-y bg-background/50">
                    {balanceSheet.assets.items.map((it) => (
                      <div key={it.id} className="p-3 flex justify-between">
                        <div>
                          <span className="font-mono text-muted-foreground mr-2">
                            {it.code}
                          </span>
                          <span className="font-semibold">{it.name}</span>
                        </div>
                        <span className="font-mono font-medium">
                          {formatCurrency(it.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3.5 flex justify-between items-center font-bold">
                  <span className="text-xs text-blue-700 dark:text-blue-400 uppercase">
                    Total Assets
                  </span>
                  <span className="font-mono text-lg text-blue-700 dark:text-blue-400">
                    {formatCurrency(balanceSheet.totalAssets)}
                  </span>
                </div>
              </div>

              {/* LIABILITIES & EQUITY */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-purple-600">
                    Liabilities & Equity
                  </h4>
                  <span className="font-mono font-bold text-purple-600 text-sm">
                    {formatCurrency(balanceSheet.totalLiabilitiesAndEquity)}
                  </span>
                </div>

                {/* Liabilities */}
                <div className="space-y-2 text-xs">
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">
                    Current Liabilities
                  </span>
                  <div className="rounded-xl border divide-y bg-background/50">
                    {balanceSheet.liabilities.items.map((it) => (
                      <div key={it.id} className="p-3 flex justify-between">
                        <div>
                          <span className="font-mono text-muted-foreground mr-2">
                            {it.code}
                          </span>
                          <span className="font-semibold">{it.name}</span>
                        </div>
                        <span className="font-mono font-medium">
                          {formatCurrency(it.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs font-semibold px-1 pt-1 text-muted-foreground">
                    <span>Total Liabilities</span>
                    <span className="font-mono">{formatCurrency(balanceSheet.liabilities.total)}</span>
                  </div>
                </div>

                {/* Equity */}
                <div className="space-y-2 text-xs pt-2">
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">
                    Owner's Equity
                  </span>
                  <div className="rounded-xl border divide-y bg-background/50">
                    {balanceSheet.equity.items.map((it) => (
                      <div key={it.id} className="p-3 flex justify-between">
                        <div>
                          <span className="font-mono text-muted-foreground mr-2">
                            {it.code}
                          </span>
                          <span className="font-semibold">{it.name}</span>
                        </div>
                        <span className="font-mono font-medium">
                          {formatCurrency(it.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="p-3 flex justify-between bg-primary/5">
                      <span className="font-semibold text-primary">
                        Current Period Net Income
                      </span>
                      <span className="font-mono font-bold text-primary">
                        {formatCurrency(balanceSheet.equity.currentPeriodNetIncome)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs font-semibold px-1 pt-1 text-muted-foreground">
                    <span>Total Equity</span>
                    <span className="font-mono">{formatCurrency(balanceSheet.equity.total)}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3.5 flex justify-between items-center font-bold">
                  <span className="text-xs text-purple-700 dark:text-purple-400 uppercase">
                    Total Liabilities & Equity
                  </span>
                  <span className="font-mono text-lg text-purple-700 dark:text-purple-400">
                    {formatCurrency(balanceSheet.totalLiabilitiesAndEquity)}
                  </span>
                </div>
              </div>
            </div>

            {/* Balance Equilibrium Card */}
            <div className="pt-2 border-t flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {balanceSheet.isBalanced ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600 font-bold border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Fundamental Accounting Equation In Balance (Assets = Liabilities + Equity)
                  </span>
                ) : (
                  <span className="rounded-full bg-rose-500/10 px-3 py-1 text-rose-600 font-bold border border-rose-500/20">
                    Equation out of balance
                  </span>
                )}
              </div>
              <span className="text-muted-foreground font-mono">
                Diff: {formatCurrency(Math.abs(balanceSheet.totalAssets - balanceSheet.totalLiabilitiesAndEquity))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRIAL BALANCE */}
      {activeTab === "trial_balance" && (
        <div className="space-y-6 max-w-4xl mx-auto print:max-w-none">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div className="text-center pb-4 border-b">
              <h2 className="text-xl font-bold">{businessName}</h2>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                Trial Balance
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                As of {formatDate(new Date().toISOString())} • Currency: LKR
              </p>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Account Title</th>
                    <th className="px-4 py-3 text-right">Debit (Dr)</th>
                    <th className="px-4 py-3 text-right">Credit (Cr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {trialBalance.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-mono font-semibold">{row.code}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-foreground">{row.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          ({row.type})
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium">
                        {row.debit > 0 ? formatCurrency(row.debit) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium">
                        {row.credit > 0 ? formatCurrency(row.credit) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/60 font-bold border-t text-sm">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 uppercase">
                      Total Ledger Balances
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-600">
                      {formatCurrency(trialBalance.totalDebits)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">
                      {formatCurrency(trialBalance.totalCredits)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="pt-2 border-t flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {trialBalance.isBalanced ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600 font-bold border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Trial Balance is in Equilibrium
                  </span>
                ) : (
                  <span className="rounded-full bg-rose-500/10 px-3 py-1 text-rose-600 font-bold border border-rose-500/20">
                    Trial Balance is Out of Balance
                  </span>
                )}
              </div>
              <span className="font-mono text-muted-foreground">
                Difference: {formatCurrency(Math.abs(trialBalance.totalDebits - trialBalance.totalCredits))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
