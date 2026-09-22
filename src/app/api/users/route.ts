import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
  roleId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  isOwner: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userBusinesses = await prisma.userBusiness.findMany({
      where: { businessId: tenant.businessId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    // Also fetch all roles and branches for the business
    const [roles, branches] = await Promise.all([
      prisma.role.findMany({
        where: { businessId: tenant.businessId },
        orderBy: { name: "asc" },
      }),
      prisma.branch.findMany({
        where: { businessId: tenant.businessId, isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const users = userBusinesses.map((ub) => ({
      id: ub.user.id,
      userBusinessId: ub.id,
      name: ub.user.name,
      email: ub.user.email,
      phone: ub.user.phone,
      status: ub.user.status,
      isOwner: ub.isOwner,
      isActive: ub.isActive,
      roleId: ub.roleId,
      roleName: ub.role?.name || null,
      branchId: ub.branchId,
      branchName: ub.branch?.name || null,
      lastLoginAt: ub.user.lastLoginAt?.toISOString() || null,
      joinedAt: ub.joinedAt.toISOString(),
    }));

    return NextResponse.json({
      users,
      roles: roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem })),
      branches: branches.map((b) => ({ id: b.id, name: b.name })),
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
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Check for existing user by email or phone
    let existingUser = null;
    if (data.email) {
      existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    }

    let userId: string;

    if (existingUser) {
      // Link existing user to this business
      const existingLink = await prisma.userBusiness.findFirst({
        where: { userId: existingUser.id, businessId: tenant.businessId },
      });
      if (existingLink) {
        return NextResponse.json({ error: "User already belongs to this business" }, { status: 400 });
      }
      userId = existingUser.id;
    } else {
      // Create new user
      const passwordHash = data.password
        ? await bcrypt.hash(data.password, 12)
        : await bcrypt.hash(Math.random().toString(36), 12);

      const newUser = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          passwordHash,
          status: "ACTIVE",
        },
      });
      userId = newUser.id;
    }

    // Create the UserBusiness link
    const userBusiness = await prisma.userBusiness.create({
      data: {
        userId,
        businessId: tenant.businessId,
        branchId: data.branchId || null,
        roleId: data.roleId || null,
        isOwner: data.isOwner,
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
        role: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      user: {
        id: userBusiness.user.id,
        userBusinessId: userBusiness.id,
        name: userBusiness.user.name,
        email: userBusiness.user.email,
        status: userBusiness.user.status,
        isOwner: userBusiness.isOwner,
        isActive: userBusiness.isActive,
        roleId: userBusiness.roleId,
        roleName: userBusiness.role?.name || null,
        branchId: userBusiness.branchId,
        branchName: userBusiness.branch?.name || null,
        joinedAt: userBusiness.joinedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Users POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { userBusinessId, userId, roleId, branchId, isActive, name, status } = body;

    if (!userBusinessId && !userId) {
      return NextResponse.json({ error: "userBusinessId or userId required" }, { status: 400 });
    }

    // Verify the user belongs to this business
    const ub = await prisma.userBusiness.findFirst({
      where: userBusinessId
        ? { id: userBusinessId, businessId: tenant.businessId }
        : { userId, businessId: tenant.businessId },
    });
    if (!ub) return NextResponse.json({ error: "User not found in this business" }, { status: 404 });

    // Update UserBusiness
    await prisma.userBusiness.update({
      where: { id: ub.id },
      data: {
        roleId: roleId !== undefined ? roleId : ub.roleId,
        branchId: branchId !== undefined ? branchId : ub.branchId,
        isActive: isActive !== undefined ? isActive : ub.isActive,
      },
    });

    // Update User record if name or status provided
    if (name || status) {
      await prisma.user.update({
        where: { id: ub.userId },
        data: {
          name: name || undefined,
          status: status || undefined,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const userBusinessId = searchParams.get("userBusinessId");

    if (!userBusinessId) return NextResponse.json({ error: "userBusinessId required" }, { status: 400 });

    const ub = await prisma.userBusiness.findFirst({
      where: { id: userBusinessId, businessId: tenant.businessId },
    });

    if (!ub) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (ub.isOwner) return NextResponse.json({ error: "Cannot remove the business owner" }, { status: 400 });

    await prisma.userBusiness.delete({ where: { id: userBusinessId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
