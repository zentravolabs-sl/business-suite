import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import {
  AccountingOverviewClient,
  AccountingOverviewKPIs,
  RecentJournalEntry,
} from "@/components/accounting/overview-client";

export const metadata = {
  title: "Accounting Overview | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function AccountingOverviewPage() {
  const tenant = await requireTenant();

  const [accounts, recentEntries] = await Promise.all([
    prisma.account.findMany({
      where: { businessId: tenant.businessId, isActive: true },
    }),
    prisma.journalEntry.findMany({
      where: { businessId: tenant.businessId },
      include: {
        lines: true,
      },
      orderBy: { postedAt: "desc" },
      take: 8,
    }),
  ]);

  // Compute KPIs
  const revenueAccs = accounts.filter((a) => a.type === "REVENUE");
  const cogsAccs = accounts.filter((a) => a.type === "COGS");
  const expenseAccs = accounts.filter((a) => a.type === "EXPENSE");
  const assetAccs = accounts.filter((a) => a.type === "ASSET");
  const liabilityAccs = accounts.filter((a) => a.type === "LIABILITY");
  const equityAccs = accounts.filter((a) => a.type === "EQUITY");

  const totalRevenue = revenueAccs.reduce(
    (sum, a) => sum + Math.max(0, Number(a.balance)),
    0
  );
  const totalCogs = cogsAccs.reduce(
    (sum, a) => sum + Math.max(0, Number(a.balance)),
    0
  );
  const grossProfit = totalRevenue - totalCogs;
  const grossMarginPct =
    totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const totalExpenses = expenseAccs.reduce(
    (sum, a) => sum + Math.max(0, Number(a.balance)),
    0
  );
  const netProfit = grossProfit - totalExpenses;
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const cashAndBankBalance = accounts
    .filter(
      (a) =>
        a.type === "ASSET" &&
        (a.isBankAccount || a.code.startsWith("10") || a.code.startsWith("11"))
    )
    .reduce((sum, a) => sum + Number(a.balance), 0);

  const accountsReceivable = Number(
    accounts.find((a) => a.code === "1200")?.balance || 0
  );

  const accountsPayable = Number(
    accounts.find((a) => a.code === "2000")?.balance || 0
  );

  const totalAssets = assetAccs.reduce((sum, a) => sum + Number(a.balance), 0);
  const totalLiabilities = liabilityAccs.reduce(
    (sum, a) => sum + Number(a.balance),
    0
  );
  const totalEquity =
    equityAccs.reduce((sum, a) => sum + Number(a.balance), 0) + netProfit;

  const kpis: AccountingOverviewKPIs = {
    totalRevenue,
    totalCogs,
    grossProfit,
    grossMarginPct,
    totalExpenses,
    netProfit,
    netMarginPct,
    cashAndBankBalance,
    accountsReceivable,
    accountsPayable,
    totalAssets,
    totalLiabilities,
    totalEquity,
  };

  const serializedRecent: RecentJournalEntry[] = recentEntries.map((e) => ({
    id: e.id,
    entryNumber: e.entryNumber,
    description: e.description,
    reference: e.reference,
    referenceType: e.referenceType,
    postedAt: e.postedAt.toISOString(),
    totalAmount: e.lines.reduce((sum, l) => sum + Number(l.amount), 0),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <AccountingOverviewClient kpis={kpis} recentEntries={serializedRecent} />
    </div>
  );
}
