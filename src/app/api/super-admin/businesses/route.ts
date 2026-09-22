import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { slugify } from "@/lib/utils";

const updateBusinessSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "TRIAL", "CANCELLED", "ONBOARDING"]).optional(),
  name: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  planId: z.string().optional(),
});

const createBusinessSchema = z.object({
  businessName: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
  planId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const { businessName, ownerEmail, ownerPassword, planId } = parsed.data;

    // Ensure email not already taken
    const existing = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
    }

    // Ensure plan exists
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: "Selected plan not found." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(ownerPassword, 10);

    // Generate unique slug
    let baseSlug = slugify(businessName);
    if (!baseSlug) baseSlug = "business";
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.business.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create owner user
      const user = await tx.user.create({
        data: {
          name: businessName + " Admin",
          email: ownerEmail,
          passwordHash,
          status: "ACTIVE",
        },
      });

      // 2. Create business (onboarding NOT complete — owner fills details after first login)
      const business = await tx.business.create({
        data: {
          name: businessName,
          legalName: businessName,
          slug,
          category: "GENERAL_RETAIL",
          email: ownerEmail,
          currency: "LKR",
          currencySymbol: "Rs.",
          timezone: "Asia/Colombo",
          invoicePrefix: "INV",
          receiptPrefix: "RCP",
          warrantyPrefix: "WC",
          servicePrefix: "ST",
          status: "ACTIVE",
          onboardingCompleted: false,
          onboardingStep: 0,
        },
      });

      // 3. Create main branch
      const branch = await tx.branch.create({
        data: {
          businessId: business.id,
          name: "Main Branch",
          code: "MAIN",
          city: "Colombo",
          isHeadOffice: true,
          isActive: true,
        },
      });

      // 4. Create Owner role with all permissions
      const ownerRole = await tx.role.create({
        data: {
          businessId: business.id,
          name: "Owner",
          description: "Full administrative access to all modules and business settings",
          isSystem: true,
        },
      });
      const allPermissions = await tx.permission.findMany();
      if (allPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: allPermissions.map((p) => ({ roleId: ownerRole.id, permissionId: p.id })),
        });
      }

      // 5. Link user to business as owner
      await tx.userBusiness.create({
        data: {
          userId: user.id,
          businessId: business.id,
          branchId: branch.id,
          roleId: ownerRole.id,
          isOwner: true,
          isActive: true,
        },
      });

      // 6. Create subscription (TRIAL)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + (plan.trialDays || 14));
      await tx.subscription.create({
        data: {
          businessId: business.id,
          planId: plan.id,
          status: "TRIAL",
          amount: plan.monthlyPrice,
          billingPeriod: "MONTHLY",
          currency: plan.currency || "LKR",
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndDate,
          trialEndsAt: trialEndDate,
        },
      });

      // 7. Default chart of accounts
      await tx.account.createMany({
        data: [
          { code: "1010", name: "Cash in Hand", type: "ASSET", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
          { code: "1020", name: "Commercial Bank Main A/C", type: "ASSET", isBankAccount: true, isSystem: true, isActive: true, businessId: business.id },
          { code: "1030", name: "Accounts Receivable", type: "ASSET", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
          { code: "1040", name: "Merchandise Inventory", type: "ASSET", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
          { code: "2010", name: "Accounts Payable", type: "LIABILITY", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
          { code: "2020", name: "VAT Payable (18%)", type: "LIABILITY", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
          { code: "3010", name: "Owner Equity / Capital", type: "EQUITY", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
          { code: "3020", name: "Retained Earnings", type: "EQUITY", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
          { code: "4010", name: "Sales Revenue", type: "REVENUE", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
          { code: "5010", name: "Cost of Goods Sold", type: "EXPENSE", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
          { code: "6010", name: "Salaries & Wages", type: "EXPENSE", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
          { code: "6020", name: "Shop Rent", type: "EXPENSE", isBankAccount: false, isSystem: true, isActive: true, businessId: business.id },
        ],
      });

      // 8. Default loyalty tier
      await tx.loyaltyTier.create({
        data: {
          businessId: business.id,
          tier: "SILVER",
          name: "Silver",
          minPoints: 0,
          pointsMultiplier: 1.0,
        },
      });

      return { business, user };
    });

    return NextResponse.json({
      success: true,
      businessId: result.business.id,
      businessName: result.business.name,
      ownerEmail: result.user.email,
    });
  } catch (error: any) {
    console.error("Super Admin Create Business POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
