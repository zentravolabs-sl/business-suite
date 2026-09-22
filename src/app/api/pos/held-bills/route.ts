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
      return NextResponse.json({ heldBills: [] });
    }

    const bills = await prisma.heldBill.findMany({
      where: {
        businessId: tenant.businessId,
        branchId,
      },
      orderBy: { heldAt: "desc" },
    });

    return NextResponse.json({ heldBills: bills });
  } catch (error: any) {
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
    const { name, cartData, customerId, branchId: reqBranchId } = body;
    const branchId = reqBranchId || tenant.branchId;

    if (!branchId) {
      return NextResponse.json({ error: "Branch required" }, { status: 400 });
    }

    const heldBill = await prisma.heldBill.create({
      data: {
        businessId: tenant.businessId,
        branchId,
        customerId: customerId || null,
        name: name || `Bill #${Date.now().toString().slice(-4)}`,
        data: cartData,
      },
    });

    return NextResponse.json({ success: true, heldBill });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Bill ID is required" }, { status: 400 });
    }

    await prisma.heldBill.deleteMany({
      where: { id, businessId: tenant.businessId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
