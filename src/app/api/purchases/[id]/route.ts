import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const purchase = await prisma.purchase.findFirst({
      where: { id, businessId: tenant.businessId },
      include: {
        supplier: true,
        branch: true,
        purchaseOrder: true,
        items: {
          include: { product: true },
        },
        payments: {
          orderBy: { paidAt: "desc" },
        },
        payables: {
          include: {
            payments: {
              orderBy: { paidAt: "desc" },
            },
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    return NextResponse.json({ purchase });
  } catch (error: any) {
    console.error("Purchase detail GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
