import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { processSaleTransaction, ProcessSaleResult } from "@/lib/pos/sale-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sales, deviceId } = body;

    if (!sales || !Array.isArray(sales) || sales.length === 0) {
      return NextResponse.json({ error: "No sales to sync" }, { status: 400 });
    }

    const results: Array<ProcessSaleResult & { offlineId: string }> = [];

    for (const salePayload of sales) {
      try {
        const branchId = salePayload.branchId || tenant.branchId;
        if (!branchId) {
          results.push({
            offlineId: salePayload.offlineId,
            status: "FAILED",
            error: "Branch ID is required for sale",
          });
          continue;
        }

        const res = await processSaleTransaction({
          businessId: tenant.businessId,
          branchId,
          userId: salePayload.userId || tenant.userId,
          deviceId: salePayload.deviceId || deviceId,
          customerId: salePayload.customerId || null,
          shiftId: salePayload.shiftId || null,
          offlineId: salePayload.offlineId,
          offlineCreatedAt: salePayload.offlineCreatedAt,
          provisionalReceiptNumber: salePayload.provisionalReceiptNumber,
          items: salePayload.items,
          payments: salePayload.payments,
          notes: salePayload.notes,
          invoiceDiscount: salePayload.invoiceDiscount,
        });

        results.push({
          offlineId: salePayload.offlineId,
          ...res,
        });
      } catch (err: any) {
        console.error(`Error syncing sale ${salePayload.offlineId}:`, err);
        results.push({
          offlineId: salePayload.offlineId,
          status: "FAILED",
          error: err.message || "Internal processing error",
        });
      }
    }

    const allSucceeded = results.every(
      (r) => r.status === "SUCCESS" || r.status === "ALREADY_PROCESSED"
    );

    return NextResponse.json({
      success: allSucceeded,
      processedCount: results.length,
      successCount: results.filter(
        (r) => r.status === "SUCCESS" || r.status === "ALREADY_PROCESSED"
      ).length,
      failedCount: results.filter((r) => r.status === "FAILED").length,
      results,
    });
  } catch (error: any) {
    console.error("Batch sync fatal error:", error);
    return NextResponse.json({ error: error.message || "Batch sync failed" }, { status: 500 });
  }
}
