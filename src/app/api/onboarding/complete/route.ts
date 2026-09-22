import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const {
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
    } = body;

    // Find the business this user owns
    const userBusiness = await prisma.userBusiness.findFirst({
      where: {
        userId: session.user.id,
        isOwner: true,
      },
      include: { business: true, branch: true },
    });

    if (!userBusiness) {
      return NextResponse.json({ error: "No owned business found for this user." }, { status: 404 });
    }

    const businessId = userBusiness.businessId;

    // Fetch plan if provided
    let selectedPlan = null;
    if (planType) {
      selectedPlan = await prisma.plan.findUnique({ where: { type: planType } });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update business details
      await tx.business.update({
        where: { id: businessId },
        data: {
          category: category || undefined,
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
          city: city || undefined,
          district: district || undefined,
          businessRegNo: businessRegNo || undefined,
          vatNumber: vatNumber || undefined,
          invoicePrefix: invoicePrefix || undefined,
          receiptHeader: receiptHeader || undefined,
          receiptFooter: receiptFooter || undefined,
          taxEnabled: enableVat ?? undefined,
          taxRate: enableVat ? (vatRate ?? 18) : undefined,
          taxName: enableVat ? "VAT" : undefined,
          onboardingCompleted: true,
          onboardingStep: 7,
        },
      });

      // 2. Update the main branch if details provided
      if (branchName || branchCity || branchPhone) {
        await tx.branch.updateMany({
          where: { businessId, isHeadOffice: true },
          data: {
            name: branchName || undefined,
            city: branchCity || undefined,
            phone: branchPhone || undefined,
          },
        });
      }

      // 3. Create VAT tax rate record if enabled
      if (enableVat) {
        const existingTax = await tx.taxRate.findFirst({ where: { businessId, isDefault: true } });
        if (!existingTax) {
          await tx.taxRate.create({
            data: {
              businessId,
              name: "VAT",
              rate: vatRate || 18.0,
              isDefault: true,
              isActive: true,
            },
          });
        } else {
          await tx.taxRate.update({
            where: { id: existingTax.id },
            data: { rate: vatRate || 18.0, isActive: true },
          });
        }
      }

      // 4. Update subscription plan if changed
      if (selectedPlan) {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + (selectedPlan.trialDays || 14));
        await tx.subscription.upsert({
          where: { businessId },
          update: {
            planId: selectedPlan.id,
            amount: selectedPlan.monthlyPrice,
          },
          create: {
            businessId,
            planId: selectedPlan.id,
            status: "TRIAL",
            amount: selectedPlan.monthlyPrice,
            billingPeriod: "MONTHLY",
            currency: selectedPlan.currency || "LKR",
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndDate,
            trialEndsAt: trialEndDate,
          },
        });
      }
    });

    return NextResponse.json({ success: true, message: "Business setup completed successfully." });
  } catch (error: any) {
    console.error("Onboarding complete PATCH error:", error);
    return NextResponse.json({ error: error.message || "Failed to complete setup" }, { status: 500 });
  }
}
