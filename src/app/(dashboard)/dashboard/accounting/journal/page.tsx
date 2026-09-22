import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { JournalClient, SerializedJournalEntry } from "@/components/accounting/journal-client";

export const metadata = {
  title: "General Journal | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const tenant = await requireTenant();

  const [entries, accounts] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { businessId: tenant.businessId },
      include: {
        lines: {
          include: {
            debitAccount: { select: { id: true, code: true, name: true, type: true } },
            creditAccount: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
      orderBy: { postedAt: "desc" },
      take: 100,
    }),
    prisma.account.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const serializedEntries: SerializedJournalEntry[] = entries.map((e) => ({
    id: e.id,
    entryNumber: e.entryNumber,
    description: e.description,
    reference: e.reference,
    referenceType: e.referenceType,
    isPosted: e.isPosted,
    postedAt: e.postedAt.toISOString(),
    lines: e.lines.map((l) => ({
      id: l.id,
      debitAccountId: l.debitAccountId,
      debitAccount: l.debitAccount,
      creditAccountId: l.creditAccountId,
      creditAccount: l.creditAccount,
      amount: Number(l.amount),
      description: l.description,
    })),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <JournalClient
        initialEntries={serializedEntries}
        accounts={accounts}
      />
    </div>
  );
}
