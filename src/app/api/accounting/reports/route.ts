import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { isNormalDebit } from "@/lib/accounting";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get("type") || "pnl"; // pnl | balance_sheet | trial_balance
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const accounts = await prisma.account.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      include: {
        parent: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: "asc" },
    });

    // -------------------------------------------------------------
    // 1. TRIAL BALANCE
    // -------------------------------------------------------------
    if (reportType === "trial_balance") {
      let totalDebits = 0;
      let totalCredits = 0;

      const rows = accounts.map((acc) => {
        const bal = Number(acc.balance);
        const normalDebit = isNormalDebit(acc.type);

        let debit = 0;
        let credit = 0;

        if (normalDebit) {
          if (bal >= 0) debit = bal;
          else credit = Math.abs(bal);
        } else {
          if (bal >= 0) credit = bal;
          else debit = Math.abs(bal);
        }

        totalDebits += debit;
        totalCredits += credit;

        return {
          id: acc.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          debit,
          credit,
        };
      });

      const isBalanced = Math.abs(totalDebits - totalCredits) < 0.05;

      return NextResponse.json({
        reportType: "trial_balance",
        asOf: new Date().toISOString(),
        rows,
        totalDebits,
        totalCredits,
        isBalanced,
      });
    }

    // -------------------------------------------------------------
    // 2. PROFIT & LOSS (INCOME STATEMENT)
    // -------------------------------------------------------------
    if (reportType === "pnl") {
      const revenueAccounts = accounts.filter((a) => a.type === "REVENUE");
      const cogsAccounts = accounts.filter((a) => a.type === "COGS");
      const expenseAccounts = accounts.filter((a) => a.type === "EXPENSE");

      const totalRevenue = revenueAccounts.reduce(
        (sum, a) => sum + Math.max(0, Number(a.balance)),
        0
      );

      const totalCogs = cogsAccounts.reduce(
        (sum, a) => sum + Math.max(0, Number(a.balance)),
        0
      );

      const grossProfit = totalRevenue - totalCogs;
      const grossMarginPct =
        totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      const totalExpenses = expenseAccounts.reduce(
        (sum, a) => sum + Math.max(0, Number(a.balance)),
        0
      );

      const netProfit = grossProfit - totalExpenses;
      const netMarginPct =
        totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return NextResponse.json({
        reportType: "pnl",
        generatedAt: new Date().toISOString(),
        from: from || null,
        to: to || null,
        revenue: {
          items: revenueAccounts.map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            amount: Number(a.balance),
          })),
          total: totalRevenue,
        },
        cogs: {
          items: cogsAccounts.map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            amount: Number(a.balance),
          })),
          total: totalCogs,
        },
        grossProfit,
        grossMarginPct,
        expenses: {
          items: expenseAccounts.map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            amount: Number(a.balance),
          })),
          total: totalExpenses,
        },
        netProfit,
        netMarginPct,
      });
    }

    // -------------------------------------------------------------
    // 3. BALANCE SHEET
    // -------------------------------------------------------------
    if (reportType === "balance_sheet") {
      const assetAccounts = accounts.filter((a) => a.type === "ASSET");
      const liabilityAccounts = accounts.filter((a) => a.type === "LIABILITY");
      const equityAccounts = accounts.filter((a) => a.type === "EQUITY");

      // Compute Net Income to include in Equity
      const totalRev = accounts
        .filter((a) => a.type === "REVENUE")
        .reduce((sum, a) => sum + Math.max(0, Number(a.balance)), 0);
      const totalCost = accounts
        .filter((a) => a.type === "COGS" || a.type === "EXPENSE")
        .reduce((sum, a) => sum + Math.max(0, Number(a.balance)), 0);
      const currentPeriodNetIncome = totalRev - totalCost;

      const totalAssets = assetAccounts.reduce(
        (sum, a) => sum + Number(a.balance),
        0
      );

      const totalLiabilities = liabilityAccounts.reduce(
        (sum, a) => sum + Number(a.balance),
        0
      );

      const baseEquity = equityAccounts.reduce(
        (sum, a) => sum + Number(a.balance),
        0
      );

      const totalEquity = baseEquity + currentPeriodNetIncome;
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
      const isBalanced =
        Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.05;

      return NextResponse.json({
        reportType: "balance_sheet",
        asOf: new Date().toISOString(),
        assets: {
          items: assetAccounts.map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            isBankAccount: a.isBankAccount,
            amount: Number(a.balance),
          })),
          total: totalAssets,
        },
        liabilities: {
          items: liabilityAccounts.map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            amount: Number(a.balance),
          })),
          total: totalLiabilities,
        },
        equity: {
          items: equityAccounts.map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            amount: Number(a.balance),
          })),
          currentPeriodNetIncome,
          total: totalEquity,
        },
        totalAssets,
        totalLiabilitiesAndEquity,
        isBalanced,
      });
    }

    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error: any) {
    console.error("Accounting reports error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
