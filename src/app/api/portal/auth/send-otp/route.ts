import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const sendOtpSchema = z.object({
  phone: z.string().min(9),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
    }

    const cleanPhone = parsed.data.phone.trim();

    // Look for customer across businesses
    let customer = await prisma.customer.findFirst({
      where: { phone: cleanPhone },
    });

    if (!customer) {
      // Find default business to link customer to
      const defaultBiz = await prisma.business.findFirst({ where: { status: "ACTIVE" } });
      if (!defaultBiz) {
        return NextResponse.json({ error: "No active merchant found" }, { status: 404 });
      }

      customer = await prisma.customer.create({
        data: {
          businessId: defaultBiz.id,
          name: "Customer " + cleanPhone.slice(-4),
          phone: cleanPhone,
          isActive: true,
        },
      });

      // Also create loyalty account
      await prisma.loyaltyAccount.create({
        data: {
          businessId: defaultBiz.id,
          customerId: customer.id,
          points: 50, // Welcome bonus
          lifetimePoints: 50,
        },
      });
    }

    // Generate 6-digit OTP (fixed 123456 in dev/demo, or random)
    const code = "123456";
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.otpVerification.create({
      data: {
        phone: cleanPhone,
        otp: code,
        purpose: "CUSTOMER_LOGIN",
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${cleanPhone}. (Use demo code: 123456)`,
      devOtp: code,
      customerId: customer.id,
    });
  } catch (error: any) {
    console.error("Send OTP error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
