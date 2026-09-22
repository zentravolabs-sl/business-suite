import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderNumber = searchParams.get("orderNumber");

    if (!orderNumber) {
      return NextResponse.json(
        { error: "Order reference number is required" },
        { status: 400 }
      );
    }

    const order = await prisma.onlineOrder.findFirst({
      where: {
        orderNumber: {
          equals: orderNumber.trim(),
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        type: true,
        customerName: true,
        deliveryAddress: true,
        deliveryCity: true,
        subtotal: true,
        deliveryFee: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
        delivery: {
          select: {
            driverName: true,
            trackingNo: true,
            status: true,
            assignedAt: true,
            deliveredAt: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: `No order found with reference "${orderNumber}"` },
        { status: 404 }
      );
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Public order tracking error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve order tracking information" },
      { status: 500 }
    );
  }
}
