import { NextRequest, NextResponse } from "next/server";
import { authorizeAdvisor } from "@/lib/advisor/access";
import {
  clearChatHistory,
  getChatHistory,
  processAdvisorChat,
} from "@/lib/advisor/chat-service";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const messages = await getChatHistory(tenant.businessId, limit);
    return NextResponse.json({ messages });
  } catch (err: any) {
    console.error("[advisor/chat] GET error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch chat messages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const body = await req.json();
    const query = body.query || body.message;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const answer = await processAdvisorChat(tenant.businessId, tenant.userId, query);
    return NextResponse.json(answer);
  } catch (err: any) {
    console.error("[advisor/chat] POST error:", err);
    return NextResponse.json({ error: err?.message || "Failed to process chat query" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authorizeAdvisor();
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    await clearChatHistory(tenant.businessId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[advisor/chat] DELETE error:", err);
    return NextResponse.json({ error: err?.message || "Failed to clear chat history" }, { status: 500 });
  }
}
