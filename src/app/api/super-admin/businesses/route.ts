import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateBusinessSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "TRIAL", "CANCELLED", "ONBOARDING"]).optional(),
  name: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  planId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || undefined;

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const [businesses, plans] = await Promise.all([
      prisma.business.findMany({
        where,
        include: {
          subscription: {
            include: { plan: true },
          },
          branches: {
            select: { id: true, name: true, isHeadOffice: true },
          },
          users: {
            include: {
              user: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
          _count: {
            select: {
              sales: true,
              products: true,
              customers: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const serialized = businesses.map((b) => {
      const owner = b.users.find((u) => u.isOwner)?.user || b.users[0]?.user;
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        category: b.category,
        status: b.status,
        email: b.email,
        phone: b.phone,
        city: b.city,
        ownerName: owner?.name || "Unassigned",
        ownerEmail: owner?.email || b.email,
        ownerPhone: owner?.phone || b.phone,
        branchesCount: b.branches.length,
        usersCount: b.users.length,
        productsCount: b._count.products,
        salesCount: b._count.sales,
        customersCount: b._count.customers,
        plan: b.subscription?.plan?.name || "No Plan",
        planType: b.subscription?.plan?.type || "STARTER",
        subscriptionStatus: b.subscription?.status || "TRIAL",
        createdAt: b.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ businesses: serialized, plans });
  } catch (error: any) {
    console.error("Super Admin Businesses GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = updateBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const { id, status, name, email, phone, planId } = parsed.data;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (name) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    const updated = await prisma.business.update({
      where: { id },
      data: updateData,
    });

    // If planId provided, update subscription
    if (planId) {
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (plan) {
        await prisma.subscription.upsert({
          where: { businessId: id },
          update: {
            planId: plan.id,
            amount: plan.monthlyPrice,
          },
          create: {
            businessId: id,
            planId: plan.id,
            amount: plan.monthlyPrice,
            currency: plan.currency,
            status: "ACTIVE",
          },
        });
      }
    }

    return NextResponse.json({ success: true, business: updated });
  } catch (error: any) {
    console.error("Super Admin Businesses PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
