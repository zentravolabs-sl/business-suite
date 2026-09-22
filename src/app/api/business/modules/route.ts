import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

// GET /api/business/modules
// Returns current business's module enable/disable flags — used by the sidebar
export async function GET() {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: tenant.businessId },
      select: {
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
    console.error("[business/modules] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
