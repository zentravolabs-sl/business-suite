import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const branchSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  managerId: z.string().optional().nullable(),
  openingCash: z.number().default(0),
  isHeadOffice: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const branches = await prisma.branch.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { name: "asc" },
    });

    // Fetch stats per branch
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = await Promise.all(
      branches.map(async (b) => {
        const [monthlySales, stockCount, staffCount] = await Promise.all([
          prisma.sale.aggregate({
            where: { businessId: tenant.businessId, branchId: b.id, status: "COMPLETED", createdAt: { gte: monthStart } },
            _sum: { total: true },
            _count: { id: true },
          }),
          prisma.stock.aggregate({
            where: { businessId: tenant.businessId, branchId: b.id },
            _sum: { quantity: true },
            _count: { id: true },
          }),
          prisma.userBusiness.count({
            where: { businessId: tenant.businessId, branchId: b.id, isActive: true },
          }),
        ]);

        return {
          branchId: b.id,
          monthlySales: Number(monthlySales._sum.total || 0),
          monthlyTransactions: monthlySales._count.id,
          stockItems: stockCount._count.id,
          totalStock: stockCount._sum.quantity || 0,
          staffCount,
        };
      })
    );

    const statsMap = new Map(stats.map((s) => [s.branchId, s]));

    // Also get user list for manager assignment
    const users = await prisma.userBusiness.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        address: b.address,
        city: b.city,
        phone: b.phone,
        email: b.email,
        managerId: b.managerId,
        openingCash: Number(b.openingCash),
        isHeadOffice: b.isHeadOffice,
        isActive: b.isActive,
        ...statsMap.get(b.id),
      })),
      managers: users.map((ub) => ({ id: ub.user.id, name: ub.user.name })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = branchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Generate code if not provided
    const code = data.code || data.name.toUpperCase().replace(/\s+/g, "-").substring(0, 6);

    const branch = await prisma.branch.create({
      data: {
        businessId: tenant.businessId,
        name: data.name,
        code,
        address: data.address || null,
        city: data.city || null,
        phone: data.phone || null,
        email: data.email || null,
        managerId: data.managerId || null,
        openingCash: data.openingCash,
        isHeadOffice: data.isHeadOffice,
        isActive: true,
      },
    });

    return NextResponse.json({ branch }, { status: 201 });
  } catch (error: any) {
    console.error("Branch POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const existing = await prisma.branch.findFirst({
      where: { id, businessId: tenant.businessId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name: updates.name || existing.name,
        code: updates.code || existing.code,
        address: updates.address !== undefined ? updates.address : existing.address,
        city: updates.city !== undefined ? updates.city : existing.city,
        phone: updates.phone !== undefined ? updates.phone : existing.phone,
        email: updates.email !== undefined ? updates.email : existing.email,
        managerId: updates.managerId !== undefined ? updates.managerId : existing.managerId,
        openingCash: updates.openingCash !== undefined ? updates.openingCash : existing.openingCash,
        isHeadOffice: updates.isHeadOffice !== undefined ? updates.isHeadOffice : existing.isHeadOffice,
        isActive: updates.isActive !== undefined ? updates.isActive : existing.isActive,
      },
    });

    return NextResponse.json({ branch });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const branch = await prisma.branch.findFirst({
      where: { id, businessId: tenant.businessId },
    });
    if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (branch.isHeadOffice) return NextResponse.json({ error: "Cannot delete head office branch" }, { status: 400 });

    // Soft deactivate instead of hard delete to preserve data
    await prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
