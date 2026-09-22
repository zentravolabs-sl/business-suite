import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const campaign = await prisma.campaign.findFirst({
      where: { id, businessId: tenant.businessId },
      include: {
        recipients: {
          include: { customer: { select: { id: true, name: true, phone: true, email: true } } },
          orderBy: { customer: { name: "asc" } },
        },
        products: {
          include: { product: { select: { id: true, name: true, image: true } } },
        },
      },
    });

    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ campaign });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { action, ...updateData } = body;

    // Special action: "send" — simulate sending campaign
    if (action === "send") {
      const campaign = await prisma.campaign.findFirst({
        where: { id, businessId: tenant.businessId },
        include: { recipients: { select: { id: true } } },
      });

      if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

      await prisma.$transaction([
        prisma.campaign.update({
          where: { id },
          data: {
            status: "COMPLETED",
            sentAt: new Date(),
            stats: {
              total: campaign.recipients.length,
              sent: campaign.recipients.length,
              delivered: campaign.recipients.length,
              read: 0,
            },
          },
        }),
        prisma.campaignRecipient.updateMany({
          where: { campaignId: id },
          data: { status: "SENT", sentAt: new Date() },
        }),
      ]);

      return NextResponse.json({ success: true, message: `Campaign sent to ${campaign.recipients.length} recipients` });
    }

    // Regular update
    await prisma.campaign.updateMany({
      where: { id, businessId: tenant.businessId },
      data: {
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.status !== undefined && { status: updateData.status }),
        ...(updateData.message !== undefined && { message: updateData.message }),
        ...(updateData.scheduledAt !== undefined && { scheduledAt: updateData.scheduledAt ? new Date(updateData.scheduledAt) : null }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await prisma.campaign.deleteMany({
      where: { id, businessId: tenant.businessId, status: { in: ["DRAFT", "CANCELLED"] } },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
