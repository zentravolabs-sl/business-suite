import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

// PATCH /api/super-admin/businesses/[id]/modules
// Updates enabled/disabled modules for a specific business
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const {
      ordersEnabled,
      ecommerceEnabled,
      warrantyEnabled,
      serviceEnabled,
      loyaltyEnabled,
    } = body;

    const data: Record<string, boolean> = {};
    if (typeof ordersEnabled === "boolean") data.ordersEnabled = ordersEnabled;
    if (typeof ecommerceEnabled === "boolean") data.ecommerceEnabled = ecommerceEnabled;
    if (typeof warrantyEnabled === "boolean") data.warrantyEnabled = warrantyEnabled;
    if (typeof serviceEnabled === "boolean") data.serviceEnabled = serviceEnabled;
    if (typeof loyaltyEnabled === "boolean") data.loyaltyEnabled = loyaltyEnabled;

    const business = await prisma.business.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        ordersEnabled: true,
        ecommerceEnabled: true,
        warrantyEnabled: true,
        serviceEnabled: true,
        loyaltyEnabled: true,
      },
    });

    return NextResponse.json({ success: true, business });
  } catch (error: any) {
    console.error("[super-admin/modules] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/super-admin/businesses/[id]/modules
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const business = await prisma.business.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ordersEnabled: true,
        ecommerceEnabled: true,
        warrantyEnabled: true,
        serviceEnabled: true,
        loyaltyEnabled: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json(business);
  } catch (error: any) {
    console.error("[super-admin/modules] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
