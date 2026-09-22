import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { AccountsClient, SerializedAccount } from "@/components/accounting/accounts-client";

export const metadata = {
  title: "Chart of Accounts | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const tenant = await requireTenant();

  const accounts = await prisma.account.findMany({
    where: { businessId: tenant.businessId, isActive: true },
    include: {
      parent: { select: { id: true, code: true, name: true } },
    },
    orderBy: { code: "asc" },
  });

  const serialized: SerializedAccount[] = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    description: a.description,
    balance: Number(a.balance),
    isSystem: a.isSystem,
    isBankAccount: a.isBankAccount,
    bankName: a.bankName,
    accountNumber: a.accountNumber,
    parentId: a.parentId,
    parent: a.parent,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <AccountsClient initialAccounts={serialized} />
    </div>
  );
}
