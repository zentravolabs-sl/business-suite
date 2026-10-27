import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { processSaleTransaction } from "@/lib/pos/sale-service";
import { toErrorResponse } from "@/lib/tax/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      items,
      payments,
      customerId,
      notes,
      branchId: reqBranchId,
      offlineId,
      deviceId,
      shiftId,
      invoiceDiscount,
      provisionalReceiptNumber,
    } = body;

    const branchId = reqBranchId || tenant.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch is required for sale" }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart cannot be empty" }, { status: 400 });
    }

    const result = await processSaleTransaction({
      businessId: tenant.businessId,
      branchId,
      userId: tenant.userId,
      deviceId: deviceId || null,
      customerId: customerId || null,
      shiftId: shiftId || null,
      offlineId: offlineId || null,
      provisionalReceiptNumber: provisionalReceiptNumber || null,
      items,
      payments,
      notes,
      invoiceDiscount,
    });

    if (result.status === "FAILED") {
      return NextResponse.json({ error: result.error || "Sale failed" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sale: result.sale,
      alreadyProcessed: result.status === "ALREADY_PROCESSED",
      conflicts: result.conflicts || [],
    });
  } catch (error: any) {
    console.error("POS Sale checkout error:", error);
    return toErrorResponse(error);
  }
}
