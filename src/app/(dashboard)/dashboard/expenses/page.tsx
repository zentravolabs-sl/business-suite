import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { ExpensesClient } from "@/components/expenses/expenses-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Expense Management | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const tenant = await requireTenant();

  const [expenses, categories, branches, summary] = await Promise.all([
    prisma.expense.findMany({
      where: { businessId: tenant.businessId },
      include: {
        category: { select: { id: true, name: true, color: true } },
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { expenseDate: "desc" },
      take: 100,
    }),
    prisma.expenseCategory.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.expense.aggregate({
      where: { businessId: tenant.businessId },
      _sum: { amount: true },
    }),
  ]);

  const serializedExpenses = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amount: Number(e.amount),
    categoryId: e.categoryId,
    categoryName: e.category?.name || "Uncategorized",
    categoryColor: e.category?.color || "#6366f1",
    branchId: e.branchId,
    branchName: e.branch?.name || null,
    addedBy: e.user?.name || null,
    method: e.method,
    reference: e.reference,
    receipt: e.receipt,
    notes: e.notes,
    status: e.status,
    expenseDate: e.expenseDate.toISOString(),
    createdAt: e.createdAt.toISOString(),
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    isSystem: c.isSystem,
  }));

  return (
    <ExpensesClient
      initialExpenses={serializedExpenses}
      categories={serializedCategories}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      totalAmount={Number(summary._sum.amount || 0)}
    />
  );
}
