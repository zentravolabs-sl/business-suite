import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const warrantyCreateSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  customerId: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  warrantyMonths: z.coerce.number().int().positive("Warranty duration must be at least 1 month"),
  type: z.enum(["MANUFACTURER", "SELLER", "SERVICE", "EXTENDED"]).default("SELLER"),
  terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status");

    const where: any = {
      businessId: tenant.businessId,
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { warrantyCode: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { product: { name: { contains: q, mode: "insensitive" } } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { phone: { contains: q, mode: "insensitive" } } },
      ];
    }

    const warranties = await prisma.warranty.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, image: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        claims: {
          select: { id: true, claimNumber: true, status: true, problem: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ warranties });
  } catch (error: any) {
    console.error("Warranties GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = warrantyCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify product belongs to business
    const product = await prisma.product.findFirst({
      where: { id: data.productId, businessId: tenant.businessId },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : new Date();
    const startDate = purchaseDate;
    const endDate = new Date(purchaseDate);
    endDate.setMonth(endDate.getMonth() + data.warrantyMonths);

    // Generate unique warranty code: WC-XXXXXX
    const count = await prisma.warranty.count({ where: { businessId: tenant.businessId } });
    const warrantyCode = `WC-${(count + 1).toString().padStart(6, "0")}`;

    // Link SerialNumber record if serial number provided
    let serialNumberId: string | null = null;
    if (data.serialNumber) {
      const sn = await prisma.serialNumber.findFirst({
        where: {
          businessId: tenant.businessId,
          productId: data.productId,
          serialNumber: data.serialNumber.trim(),
        },
      });
      if (sn) {
        serialNumberId = sn.id;
      }
    }

    const warranty = await prisma.warranty.create({
      data: {
        businessId: tenant.businessId,
        warrantyCode,
        customerId: data.customerId || null,
        productId: data.productId,
        serialNumberId,
        serialNumber: data.serialNumber?.trim() || null,
        purchaseDate,
        warrantyMonths: data.warrantyMonths,
        startDate,
        endDate,
        type: data.type,
        terms: data.terms || product.warrantyTerms || null,
        notes: data.notes || null,
        status: "ACTIVE",
      },
      include: {
        product: true,
        customer: true,
      },
    });

    return NextResponse.json({ success: true, warranty }, { status: 201 });
  } catch (error: any) {
    console.error("Warranty POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
