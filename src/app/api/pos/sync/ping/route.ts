import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      status: "ONLINE",
      timestamp: Date.now(),
      businessId: tenant.businessId,
      userId: tenant.userId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Ping error" }, { status: 500 });
  }
}
