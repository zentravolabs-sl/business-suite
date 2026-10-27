import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { createExpenseEntry } from "@/lib/accounting";
import { issueInputDocument, type InputDocumentLine } from "@/lib/tax/document-service";
import { allocateDocumentNumber } from "@/lib/tax/sequence-service";
import { toErrorResponse, TaxError } from "@/lib/tax/errors";

const expenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  taxableAmount: z.number().optional().nullable(),
  taxAmount: z.number().optional().default(0),
  taxRatePercent: z.number().optional().nullable(),
  inputVatEligibility: z.enum(["ELIGIBLE", "INELIGIBLE", "UNDER_REVIEW"]).optional().default("UNDER_REVIEW"),
  vendorName: z.string().optional().nullable(),
  vendorTin: z.string().optional().nullable(),
  vendorInvoiceNo: z.string().optional().nullable(),
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
        inputVatEligibility: e.inputVatEligibility,
        taxAmount: Number(e.taxAmount || 0),
        vendorName: e.vendorName,
        vendorTin: e.vendorTin,
        vendorInvoiceNo: e.vendorInvoiceNo,
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
    return toErrorResponse(error);
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

    const expenseDate = data.expenseDate ? new Date(data.expenseDate) : new Date();
    const taxableAmount =
      data.taxableAmount !== undefined && data.taxableAmount !== null
        ? data.taxableAmount
        : data.amount - (data.taxAmount || 0);

    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          businessId: tenant.businessId,
          branchId: effectiveBranchId,
          categoryId: data.categoryId || null,
          userId: tenant.userId,
          description: data.description,
          amount: data.amount,
          taxableAmount,
          taxAmount: data.taxAmount || 0,
          taxRatePercent: data.taxRatePercent || null,
          inputVatEligibility: data.inputVatEligibility as any,
          vendorName: data.vendorName || null,
          vendorTin: data.vendorTin || null,
          vendorInvoiceNo: data.vendorInvoiceNo || null,
          method: data.method as any,
          reference: data.reference || null,
          receipt: data.receipt || null,
          notes: data.notes || null,
          status: data.status as any,
          expenseDate,
        },
        include: {
          category: { select: { name: true, color: true } },
          branch: { select: { name: true } },
        },
      });

      // Record INPUT TaxDocument if tax applies or Input VAT is tracked
      if (data.taxAmount > 0 || data.inputVatEligibility === "ELIGIBLE") {
        const expNumAlloc = await allocateDocumentNumber(tx, {
          businessId: tenant.businessId,
          documentType: "EXPENSE",
          prefix: "EXP",
          issueDate: expenseDate,
          resetPeriod: "YEARLY",
        });

        const line: InputDocumentLine = {
          description: data.description,
          quantity: 1,
          unitPrice: taxableAmount,
          taxableValue: taxableAmount.toFixed(2),
          taxAmount: (data.taxAmount || 0).toFixed(2),
          ratePercent: data.taxRatePercent || (taxableAmount > 0 ? ((data.taxAmount || 0) / taxableAmount) * 100 : 0),
          treatment: (data.taxAmount || 0) > 0 ? "STANDARD_RATED" : "OUT_OF_SCOPE",
        };

        await issueInputDocument(tx, {
          businessId: tenant.businessId,
          branchId: effectiveBranchId,
          documentType: data.vendorTin ? "TAX_INVOICE" : "COMMERCIAL_INVOICE",
          documentNumber: expNumAlloc.documentNumber,
          externalDocumentNo: data.vendorInvoiceNo || null,
          issueDate: expenseDate,
          supplyDate: expenseDate,
          supplier: {
            name: data.vendorName || "Expense Vendor",
            tin: data.vendorTin || null,
          },
          buyerName: tenant.businessName,
          pricesIncludeTax: false,
          inputVatEligibility: data.inputVatEligibility as any,
          expenseId: exp.id,
          lines: [line],
          paidAmount: data.amount,
          paymentMethod: data.method,
          notes: data.notes,
          createdById: tenant.userId,
        });
      }

      // Record Double-Entry Accounting entry if expense is marked PAID
      if (exp.status === "PAID") {
        await createExpenseEntry({
          tx,
          businessId: tenant.businessId,
          expenseId: exp.id,
          amount: Number(exp.amount),
          taxAmount: Number(data.taxAmount || 0),
          inputVatEligible: data.inputVatEligibility === "ELIGIBLE",
          description: exp.description,
          method: exp.method,
        });
      }

      return exp;
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error: any) {
    console.error("Expenses POST error:", error);
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, description, notes, categoryId, receipt, reference, status, inputVatEligibility } = body;

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const existing = await prisma.expense.findFirst({
      where: { id, businessId: tenant.businessId },
    });
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (description !== undefined) updateData.description = description;
      if (notes !== undefined) updateData.notes = notes;
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (receipt !== undefined) updateData.receipt = receipt;
      if (reference !== undefined) updateData.reference = reference;

      if (status !== undefined) {
        updateData.status = status;
        if (status === "APPROVED") {
          updateData.approvedById = tenant.userId;
          updateData.approvedAt = new Date();
        }
      }

      // If transitioning to PAID, trigger accounting
      const becomingPaid = existing.status !== "PAID" && status === "PAID";

      const updated = await tx.expense.update({
        where: { id },
        data: updateData,
      });

      if (becomingPaid) {
        await createExpenseEntry({
          tx,
          businessId: tenant.businessId,
          expenseId: updated.id,
          amount: Number(updated.amount),
          taxAmount: Number(updated.taxAmount || 0),
          inputVatEligible: updated.inputVatEligibility === "ELIGIBLE",
          description: updated.description,
          method: updated.method,
        });
      }

      return updated;
    });

    return NextResponse.json({ expense: result });
  } catch (error: any) {
    return toErrorResponse(error);
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
    if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    if (existing.status === "PAID") {
      return NextResponse.json(
        { error: "Paid expenses with general ledger or tax postings cannot be deleted. Review or cancel instead." },
        { status: 400 }
      );
    }

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return toErrorResponse(error);
  }
}
