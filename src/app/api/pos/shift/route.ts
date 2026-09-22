import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || tenant.branchId;

    if (!branchId) {
      return NextResponse.json({ error: "No branch selected" }, { status: 400 });
    }

    // Find currently OPEN shift for this user in this branch
    const openShift = await prisma.cashierShift.findFirst({
      where: {
        businessId: tenant.businessId,
        branchId,
        userId: tenant.userId,
        status: "OPEN",
      },
      include: {
        sales: {
          where: { status: "COMPLETED" },
          include: { payments: true },
        },
      },
    });

    if (!openShift) {
      return NextResponse.json({ shift: null });
    }

    // Calculate live drawer totals
    let cashSales = 0;
    let cardSales = 0;
    let otherSales = 0;
    let totalSales = 0;

    for (const sale of openShift.sales) {
      totalSales += Number(sale.total);
      for (const payment of sale.payments) {
        const amt = Number(payment.amount);
        if (payment.method === "CASH") cashSales += amt;
        else if (payment.method === "CARD") cardSales += amt;
        else otherSales += amt;
      }
    }

    const openingCash = Number(openShift.openingCash);
    const expectedCash = openingCash + cashSales;

    return NextResponse.json({
      shift: {
        id: openShift.id,
        openedAt: openShift.openedAt,
        openingCash,
        cashSales,
        cardSales,
        otherSales,
        totalSales,
        expectedCash,
        salesCount: openShift.sales.length,
      },
    });
  } catch (error: any) {
    console.error("POS shift GET error:", error);
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
    const { action, openingCash, closingCash, notes, branchId: reqBranchId } = body;
    const branchId = reqBranchId || tenant.branchId;

    if (!branchId) {
      return NextResponse.json({ error: "No branch selected" }, { status: 400 });
    }

    if (action === "OPEN") {
      // Check if user already has an open shift
      const existing = await prisma.cashierShift.findFirst({
        where: {
          businessId: tenant.businessId,
          branchId,
          userId: tenant.userId,
          status: "OPEN",
        },
      });

      if (existing) {
        return NextResponse.json({ success: true, shift: existing });
      }

      const newShift = await prisma.cashierShift.create({
        data: {
          businessId: tenant.businessId,
          branchId,
          userId: tenant.userId,
          openingCash: Number(openingCash) || 0,
          status: "OPEN",
          notes: notes || "Standard cashier shift opened",
        },
      });

      return NextResponse.json({ success: true, shift: newShift });
    } else if (action === "CLOSE") {
      // Close shift
      const openShift = await prisma.cashierShift.findFirst({
        where: {
          businessId: tenant.businessId,
          branchId,
          userId: tenant.userId,
          status: "OPEN",
        },
        include: {
          sales: {
            where: { status: "COMPLETED" },
            include: { payments: true },
          },
        },
      });

      if (!openShift) {
        return NextResponse.json({ error: "No open shift found to close" }, { status: 404 });
      }

      // Calculate cash in drawer
      let cashSales = 0;
      let totalSales = 0;
      for (const sale of openShift.sales) {
        totalSales += Number(sale.total);
        for (const payment of sale.payments) {
          if (payment.method === "CASH") cashSales += Number(payment.amount);
        }
      }

      const opening = Number(openShift.openingCash);
      const expected = opening + cashSales;
      const counted = Number(closingCash) || 0;
      const difference = counted - expected;

      const closedShift = await prisma.cashierShift.update({
        where: { id: openShift.id },
        data: {
          status: "CLOSED",
          closingCash: counted,
          expectedCash: expected,
          difference,
          totalSales,
          closedAt: new Date(),
          notes: notes || openShift.notes,
        },
      });

      return NextResponse.json({ success: true, shift: closedShift, difference });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POS shift POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
