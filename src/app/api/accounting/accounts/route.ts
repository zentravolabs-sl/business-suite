import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const accountCreateSchema = z.object({
  code: z.string().min(1, "Account code is required"),
  name: z.string().min(2, "Account name is required"),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE", "COGS"]),
  parentId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isBankAccount: z.boolean().default(false),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const q = searchParams.get("q") || "";

    const where: any = {
      businessId: tenant.businessId,
      isActive: true,
    };

    if (type && type !== "ALL") {
      where.type = type;
    }

    if (q) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }

    const accounts = await prisma.account.findMany({
      where,
      include: {
        parent: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error("Accounts GET error:", error);
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
    const parsed = accountCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check code uniqueness within business
    const existing = await prisma.account.findUnique({
      where: {
        businessId_code: {
          businessId: tenant.businessId,
          code: data.code.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Account code '${data.code}' already exists.` },
        { status: 400 }
      );
    }

    const account = await prisma.account.create({
      data: {
        businessId: tenant.businessId,
        code: data.code.trim(),
        name: data.name.trim(),
        type: data.type,
        parentId: data.parentId || null,
        description: data.description || null,
        isBankAccount: data.isBankAccount,
        bankName: data.bankName || null,
        accountNumber: data.accountNumber || null,
        isSystem: false,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error: any) {
    console.error("Account POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
