import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const claimCreateSchema = z.object({
  warrantyId: z.string().min(1, "Warranty ID is required"),
  problem: z.string().min(3, "Problem description is required"),
  description: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  preferredDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const warrantyId = searchParams.get("warrantyId");

    const where: any = {
      businessId: tenant.businessId,
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (warrantyId) {
      where.warrantyId = warrantyId;
    }

    const claims = await prisma.warrantyClaim.findMany({
      where,
      include: {
        warranty: {
          include: {
            product: true,
            customer: true,
          },
        },
        updates: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ claims });
  } catch (error: any) {
    console.error("Warranty claims GET error:", error);
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
    const parsed = claimCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify warranty exists and belongs to business
    const warranty = await prisma.warranty.findFirst({
      where: { id: data.warrantyId, businessId: tenant.businessId },
      include: { customer: true },
    });

    if (!warranty) {
      return NextResponse.json({ error: "Warranty record not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const count = await tx.warrantyClaim.count({
        where: { businessId: tenant.businessId },
      });
      const claimNumber = `CLM-${year}-${(count + 1).toString().padStart(4, "0")}`;

      // Create WarrantyClaim
      const claim = await tx.warrantyClaim.create({
        data: {
          businessId: tenant.businessId,
          warrantyId: data.warrantyId,
          claimNumber,
          problem: data.problem.trim(),
          description: data.description?.trim() || null,
          contactName: data.contactName?.trim() || warranty.customer?.name || null,
          contactPhone: data.contactPhone?.trim() || warranty.customer?.phone || null,
          preferredDate: data.preferredDate ? new Date(data.preferredDate) : null,
          notes: data.notes?.trim() || null,
          status: "SUBMITTED",
        },
      });

      // Log initial update
      await tx.warrantyClaimUpdate.create({
        data: {
          claimId: claim.id,
          status: "SUBMITTED",
          notes: `Warranty claim logged by ${data.contactName || "customer"}: ${data.problem}`,
          userId: tenant.userId,
        },
      });

      // Update warranty status to CLAIMED
      await tx.warranty.update({
        where: { id: warranty.id },
        data: { status: "CLAIMED" },
      });

      return claim;
    });

    return NextResponse.json({ success: true, claim: result }, { status: 201 });
  } catch (error: any) {
    console.error("Warranty claim POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
