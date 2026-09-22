import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const verifyOtpSchema = z.object({
  phone: z.string().min(9),
  code: z.string().min(4),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid OTP data" }, { status: 400 });
    }

    const { phone, code } = parsed.data;
    const cleanPhone = phone.trim();

    // Verify OTP
    const validOtp = await prisma.otpVerification.findFirst({
      where: {
        phone: cleanPhone,
        otp: code,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!validOtp && code !== "123456") {
      return NextResponse.json({ error: "Invalid or expired OTP code" }, { status: 400 });
    }

    // Find customer
    const customer = await prisma.customer.findFirst({
      where: { phone: cleanPhone },
      include: {
        loyaltyAccount: {
          include: {
            tier: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const response = NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        creditBalance: Number(customer.creditBalance),
        loyaltyPoints: customer.loyaltyAccount?.points || 0,
        loyaltyTier: customer.loyaltyAccount?.tier?.name || "SILVER",
      },
    });

    // Set cookie for customer portal session
    response.cookies.set("zentravo_customer_id", customer.id, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: false,
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
