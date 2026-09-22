import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  categoryId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "QR_CODE", "CHEQUE", "ONLINE"]).default("CASH"),
  reference: z.string().optional().nullable(),
  receipt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  expenseDate: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]).default("PAID"),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const branchId = searchParams.get("branchId") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = { businessId: tenant.businessId };
    if (branchId) where.branchId = branchId;
    if (categoryId) where.categoryId = categoryId;
    if (from || to) {
      where.expenseDate = {};
      if (from) where.expenseDate.gte = new Date(from);
      if (to) where.expenseDate.lte = new Date(to);
    }

    const [expenses, total, categories, summary] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true } },
          branch: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { expenseDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
      prisma.expenseCategory.findMany({
        where: { businessId: tenant.businessId },
        orderBy: { name: "asc" },
      }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      expenses: expenses.map((e) => ({
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
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        isSystem: c.isSystem,
      })),
      total,
      totalAmount: Number(summary._sum.amount || 0),
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Expenses GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Check if it's a category creation request
    if (body.type === "category") {
      const cat = await prisma.expenseCategory.create({
        data: {
          businessId: tenant.businessId,
          name: body.name,
          color: body.color || "#6366f1",
          icon: body.icon || null,
        },
      });
      return NextResponse.json({ category: cat }, { status: 201 });
    }

    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Determine branch
    const branchId = data.branchId || tenant.branchId;
    const branches = await prisma.branch.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      take: 1,
      orderBy: { isHeadOffice: "desc" },
    });
    const effectiveBranchId = branchId || branches[0]?.id;
    if (!effectiveBranchId) {
      return NextResponse.json({ error: "No branch found" }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        businessId: tenant.businessId,
        branchId: effectiveBranchId,
        categoryId: data.categoryId || null,
        userId: tenant.userId,
        description: data.description,
        amount: data.amount,
        method: data.method as any,
        reference: data.reference || null,
        receipt: data.receipt || null,
        notes: data.notes || null,
        status: data.status as any,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
      },
      include: {
        category: { select: { name: true, color: true } },
        branch: { select: { name: true } },
      },
    });

    // Create accounting entry if expense is paid
    if (expense.status === "PAID") {
      try {
        const { createExpenseEntry } = await import("@/lib/accounting");
        await createExpenseEntry({
          businessId: tenant.businessId,
          expenseId: expense.id,
          amount: Number(expense.amount),
          description: expense.description,
          method: expense.method,
        });
      } catch (accError) {
        console.warn("Accounting entry failed for expense:", accError);
      }
    }

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error: any) {
    console.error("Expenses POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Verify ownership
    const existing = await prisma.expense.findFirst({
      where: { id, businessId: tenant.businessId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...updates,
        amount: updates.amount !== undefined ? Number(updates.amount) : undefined,
        expenseDate: updates.expenseDate ? new Date(updates.expenseDate) : undefined,
        approvedById: updates.status === "APPROVED" ? tenant.userId : undefined,
        approvedAt: updates.status === "APPROVED" ? new Date() : undefined,
      },
    });

    return NextResponse.json({ expense });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const existing = await prisma.expense.findFirst({
      where: { id, businessId: tenant.businessId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
