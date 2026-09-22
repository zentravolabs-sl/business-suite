import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { recordSupplierPaymentJournalEntry } from "@/lib/accounting";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const paymentCreateSchema = z.object({
  payableId: z.string().min(1, "Payable ID is required"),
  amount: z.coerce.number().positive("Payment amount must be greater than 0"),
  method: z
    .enum([
      "CASH",
      "CARD",
      "BANK_TRANSFER",
      "QR_CODE",
      "CREDIT",
      "CHEQUE",
      "ONLINE",
      "LOYALTY_POINTS",
      "SPLIT",
    ])
    .default("BANK_TRANSFER"),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status");

    const where: any = {
      businessId: tenant.businessId,
    };

    if (supplierId && supplierId !== "ALL") {
      where.supplierId = supplierId;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    const payables = await prisma.supplierPayable.findMany({
      where,
      include: {
        supplier: true,
        purchase: true,
        payments: {
          orderBy: { paidAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ payables });
  } catch (error: any) {
    console.error("Supplier payments GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = paymentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { payableId, amount, method, reference, notes } = parsed.data;

    // Verify payable exists and belongs to this business
    const payable = await prisma.supplierPayable.findFirst({
      where: { id: payableId, businessId: tenant.businessId },
      include: { supplier: true },
    });

    if (!payable) {
      return NextResponse.json({ error: "Payable not found" }, { status: 404 });
    }

    const currentBalance = Number(payable.balance);
    if (amount > currentBalance + 0.01) {
      return NextResponse.json(
        {
          error: `Payment amount (LKR ${amount.toLocaleString()}) cannot exceed outstanding balance (LKR ${currentBalance.toLocaleString()})`,
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const newPaidAmount = Number(payable.paidAmount) + amount;
      const newBalance = Math.max(0, currentBalance - amount);
      const newStatus = newBalance === 0 ? "PAID" : "PARTIAL";

      // 1. Create Supplier Payment record
      const payment = await tx.supplierPayment.create({
        data: {
          businessId: tenant.businessId,
          payableId: payable.id,
          amount: new Prisma.Decimal(amount),
          method,
          reference: reference || null,
          notes: notes || null,
          userId: tenant.userId,
        },
      });

      // 2. Update SupplierPayable
      const updatedPayable = await tx.supplierPayable.update({
        where: { id: payable.id },
        data: {
          paidAmount: new Prisma.Decimal(newPaidAmount),
          balance: new Prisma.Decimal(newBalance),
          status: newStatus,
        },
      });

      // 3. If linked to Purchase, update Purchase and record PurchasePayment
      if (payable.purchaseId) {
        await tx.purchase.update({
          where: { id: payable.purchaseId },
          data: {
            paidAmount: { increment: new Prisma.Decimal(amount) },
            balance: { decrement: new Prisma.Decimal(amount) },
          },
        });

        await tx.purchasePayment.create({
          data: {
            businessId: tenant.businessId,
            purchaseId: payable.purchaseId,
            amount: new Prisma.Decimal(amount),
            method,
            reference: reference || null,
            notes: notes || null,
            userId: tenant.userId,
          },
        });
      }

      // 4. Decrement Supplier credit balance
      await tx.supplier.update({
        where: { id: payable.supplierId },
        data: {
          creditBalance: { decrement: new Prisma.Decimal(amount) },
        },
      });

      // Automated Accounting: Record Double-Entry Disbursement Journal
      try {
        await recordSupplierPaymentJournalEntry({
          tx,
          businessId: tenant.businessId,
          payableId: payable.id,
          grnNumber: payable.purchaseId ? undefined : undefined,
          amount,
          method,
          reference: reference || null,
        });
      } catch (accErr) {
        console.warn("Auto-journal entry error on supplier payment (non-fatal):", accErr);
      }

      return { payment, payable: updatedPayable };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: any) {
    console.error("Supplier payment POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
