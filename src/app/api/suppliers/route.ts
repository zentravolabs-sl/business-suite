import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  supplierCode: z.string().optional(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  creditLimit: z.coerce.number().min(0).default(0),
  paymentTermDays: z.coerce.number().int().min(0).default(30),
  bankName: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
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

    const where: any = {
      businessId: tenant.businessId,
      deletedAt: null,
      isActive: true,
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { contactPerson: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { supplierCode: { contains: q, mode: "insensitive" } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: {
            purchases: true,
            purchaseOrders: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ suppliers });
  } catch (error: any) {
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
    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    let supplierCode = data.supplierCode;
    if (!supplierCode) {
      const count = await prisma.supplier.count({
        where: { businessId: tenant.businessId },
      });
      supplierCode = `SUP-${String(count + 1).padStart(4, "0")}`;
    }

    const supplier = await prisma.supplier.create({
      data: {
        businessId: tenant.businessId,
        supplierCode,
        name: data.name,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        taxNumber: data.taxNumber || null,
        vatNumber: data.vatNumber || null,
        creditLimit: data.creditLimit,
        creditBalance: 0,
        paymentTermDays: data.paymentTermDays,
        bankName: data.bankName || null,
        bankAccount: data.bankAccount || null,
        notes: data.notes || null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, supplier });
  } catch (error: any) {
    console.error("Supplier create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
