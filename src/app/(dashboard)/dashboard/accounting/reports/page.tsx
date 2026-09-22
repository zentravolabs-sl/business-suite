import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { ReportsClient } from "@/components/accounting/reports-client";
import { isNormalDebit } from "@/lib/accounting";

export const metadata = {
  title: "Financial Reports & Statements | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const tenant = await requireTenant();

  const [accounts, business] = await Promise.all([
    prisma.account.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.business.findUnique({
      where: { id: tenant.businessId },
      select: { name: true },
    }),
  ]);

  // 1. P&L Calculation
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
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const pnlData = {
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
  };

  // 2. Balance Sheet Calculation
  const assetAccounts = accounts.filter((a) => a.type === "ASSET");
  const liabilityAccounts = accounts.filter((a) => a.type === "LIABILITY");
  const equityAccounts = accounts.filter((a) => a.type === "EQUITY");

  const currentPeriodNetIncome = netProfit;
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
  const isBalanceSheetBalanced =
    Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.05;

  const balanceSheetData = {
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
    isBalanced: isBalanceSheetBalanced,
  };

  // 3. Trial Balance Calculation
  let totalDebits = 0;
  let totalCredits = 0;

  const trialBalanceRows = accounts.map((acc) => {
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

  const isTrialBalanceBalanced = Math.abs(totalDebits - totalCredits) < 0.05;

  const trialBalanceData = {
    rows: trialBalanceRows,
    totalDebits,
    totalCredits,
    isBalanced: isTrialBalanceBalanced,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <ReportsClient
        businessName={business?.name || "Business"}
        pnl={pnlData}
        balanceSheet={balanceSheetData}
        trialBalance={trialBalanceData}
      />
    </div>
  );
}
