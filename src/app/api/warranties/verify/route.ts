import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim();

    if (!code) {
      return NextResponse.json(
        { error: "Warranty code or serial number is required" },
        { status: 400 }
      );
    }

    // Lookup by warrantyCode or serialNumber
    const warranty = await prisma.warranty.findFirst({
      where: {
        OR: [
          { warrantyCode: { equals: code, mode: "insensitive" } },
          { serialNumber: { equals: code, mode: "insensitive" } },
        ],
      },
      include: {
        business: {
          select: {
            name: true,
            phone: true,
            email: true,
            address: true,
            logo: true,
          },
        },
        product: {
          select: {
            name: true,
            sku: true,
            image: true,
            description: true,
          },
        },
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!warranty) {
      return NextResponse.json(
        { error: "No warranty record found matching this code or serial number." },
        { status: 404 }
      );
    }

    const now = new Date();
    const endDate = new Date(warranty.endDate);
    const startDate = new Date(warranty.startDate);
    const totalDays = Math.max(
      1,
      Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const daysRemaining = Math.max(
      0,
      Math.round((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
    const isExpired = now > endDate;

    let computedStatus = warranty.status;
    if (warranty.status === "ACTIVE" && isExpired) {
      computedStatus = "EXPIRED";
    }

    return NextResponse.json({
      warranty: {
        id: warranty.id,
        code: warranty.warrantyCode,
        serialNumber: warranty.serialNumber,
        productName: warranty.product.name,
        productSku: warranty.product.sku,
        productImage: warranty.product.image,
        customerName: warranty.customer?.name || "Customer",
        purchaseDate: warranty.purchaseDate,
        startDate: warranty.startDate,
        endDate: warranty.endDate,
        warrantyMonths: warranty.warrantyMonths,
        type: warranty.type,
        status: computedStatus,
        terms: warranty.terms,
        totalDays,
        daysRemaining,
        isExpired,
        businessName: warranty.business.name,
        businessPhone: warranty.business.phone,
        businessEmail: warranty.business.email,
        businessAddress: warranty.business.address,
      },
    });
  } catch (error: any) {
    console.error("Public warranty verify error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
