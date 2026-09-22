import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const {
      businessName,
      legalName,
      category,
      email,
      phone,
      address,
      city,
      district,
      businessRegNo,
      vatNumber,
      branchName,
      branchCity,
      branchPhone,
      vatRate,
      enableVat,
      invoicePrefix,
      receiptHeader,
      receiptFooter,
      planType,
      // In case fresh owner credentials are provided
      ownerName,
      ownerEmail,
      ownerPassword,
    } = body;

    if (!businessName) {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    let userId = session?.user?.id;

    // If user is not signed in, create the owner user account
    if (!userId) {
      if (!ownerEmail || !ownerPassword) {
        return NextResponse.json(
          { error: "Owner account credentials are required when not logged in" },
          { status: 400 }
        );
      }

      const existing = await prisma.user.findUnique({
        where: { email: ownerEmail },
      });

      if (existing) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in first." },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(ownerPassword, 10);
      const newUser = await prisma.user.create({
        data: {
          name: ownerName || businessName + " Admin",
          email: ownerEmail,
          passwordHash,
          phone: phone || null,
          status: "ACTIVE",
        },
      });
      userId = newUser.id;
    }

    // Generate unique slug
    let baseSlug = slugify(businessName);
    if (!baseSlug) baseSlug = "business";
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.business.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Fetch the chosen plan
    const selectedPlan = await prisma.plan.findUnique({
      where: { type: planType || "BUSINESS" },
    });

    if (!selectedPlan) {
      return NextResponse.json(
        { error: "Selected plan does not exist" },
        { status: 400 }
      );
    }

    // Run creation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Business
      const business = await tx.business.create({
        data: {
          name: businessName,
          legalName: legalName || businessName,
          slug,
          category: category || "GENERAL_RETAIL",
          email: email || ownerEmail || null,
          phone: phone || null,
          address: address || null,
          city: city || null,
          district: district || null,
          businessRegNo: businessRegNo || null,
          vatNumber: vatNumber || null,
          currency: "LKR",
          currencySymbol: "Rs.",
          timezone: "Asia/Colombo",
          invoicePrefix: invoicePrefix || "INV",
          receiptHeader: receiptHeader || `Welcome to ${businessName}`,
          receiptFooter: receiptFooter || "Thank you for shopping with us! Please come again.",
          status: "ACTIVE",
          onboardingCompleted: true,
          onboardingStep: 7,
        },
      });

      // 2. Create Main Branch
      const branch = await tx.branch.create({
        data: {
          businessId: business.id,
          name: branchName || "Main Branch",
          code: "MAIN",
          city: branchCity || city || "Colombo",
          phone: branchPhone || phone || null,
          address: address || null,
          isHeadOffice: true,
          isActive: true,
        },
      });

      // 3. Create default Owner Role for this business
      const ownerRole = await tx.role.create({
        data: {
          businessId: business.id,
          name: "Owner",
          description: "Full administrative access to all modules and business settings",
          isSystem: true,
        },
      });

      // Assign all permissions to Owner role
      const allPermissions = await tx.permission.findMany();
      if (allPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: allPermissions.map((p) => ({
            roleId: ownerRole.id,
            permissionId: p.id,
          })),
        });
      }

      // 4. Link User to Business as Owner
      await tx.userBusiness.create({
        data: {
          userId: userId!,
          businessId: business.id,
          branchId: branch.id,
          roleId: ownerRole.id,
          isOwner: true,
        },
      });

      // 5. Create Subscription with 14-day trial
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + (selectedPlan.trialDays || 14));

      await tx.subscription.create({
        data: {
          businessId: business.id,
          planId: selectedPlan.id,
          status: "TRIAL",
          amount: selectedPlan.monthlyPrice,
          billingPeriod: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndDate,
          trialEndsAt: trialEndDate,
        },
      });

      // 6. Create Default Chart of Accounts for Sri Lankan Retail
      const defaultAccounts = [
        { code: "1010", name: "Cash in Hand", type: "ASSET" as const, subtype: "CURRENT_ASSET" },
        { code: "1020", name: "Commercial Bank Main A/C", type: "ASSET" as const, subtype: "BANK" },
        { code: "1030", name: "Accounts Receivable", type: "ASSET" as const, subtype: "CURRENT_ASSET" },
        { code: "1040", name: "Merchandise Inventory", type: "ASSET" as const, subtype: "INVENTORY" },
        { code: "2010", name: "Accounts Payable", type: "LIABILITY" as const, subtype: "CURRENT_LIABILITY" },
        { code: "2020", name: "VAT Payable (18%)", type: "LIABILITY" as const, subtype: "TAX_PAYABLE" },
        { code: "2030", name: "SSCL Payable (2.5%)", type: "LIABILITY" as const, subtype: "TAX_PAYABLE" },
        { code: "3010", name: "Owner Equity / Capital", type: "EQUITY" as const, subtype: "EQUITY" },
        { code: "3020", name: "Retained Earnings", type: "EQUITY" as const, subtype: "EQUITY" },
        { code: "4010", name: "Sales Revenue", type: "REVENUE" as const, subtype: "OPERATING_REVENUE" },
        { code: "4020", name: "Service & Repair Revenue", type: "REVENUE" as const, subtype: "OPERATING_REVENUE" },
        { code: "5010", name: "Cost of Goods Sold (COGS)", type: "EXPENSE" as const, subtype: "DIRECT_COST" },
        { code: "6010", name: "Salaries & Wages", type: "EXPENSE" as const, subtype: "OPERATING_EXPENSE" },
        { code: "6020", name: "Shop Rent", type: "EXPENSE" as const, subtype: "OPERATING_EXPENSE" },
        { code: "6030", name: "Electricity & Utilities", type: "EXPENSE" as const, subtype: "OPERATING_EXPENSE" },
        { code: "6040", name: "Delivery & Transportation", type: "EXPENSE" as const, subtype: "OPERATING_EXPENSE" },
        { code: "6050", name: "Bank & Card Machine Charges", type: "EXPENSE" as const, subtype: "FINANCIAL_EXPENSE" },
      ];

      await tx.account.createMany({
        data: defaultAccounts.map((acc) => ({
          businessId: business.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          description: acc.subtype,
          isBankAccount: acc.subtype === "BANK",
          isSystem: true,
          isActive: true,
        })),
      });

      // 7. Create Tax Configuration
      if (enableVat) {
        await tx.taxRate.create({
          data: {
            businessId: business.id,
            name: "VAT",
            rate: vatRate || 18.0,
            isDefault: true,
          },
        });
      }

      // 8. Create default Loyalty Tier
      await tx.loyaltyTier.create({
        data: {
          businessId: business.id,
          tier: "SILVER",
          name: "Silver",
          minPoints: 0,
          pointsMultiplier: 1.0,
        },
      });

      return { business, branch };
    });

    return NextResponse.json({
      success: true,
      message: "Business onboarded successfully",
      businessId: result.business.id,
      businessSlug: result.business.slug,
    });
  } catch (error: any) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
