import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";

    const where: any = { businessId: tenant.businessId };
    if (status) where.status = status;

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { recipients: true } },
        products: {
          include: { product: { select: { name: true, image: true } } },
          take: 3,
        },
      },
    });

    const [totalSent, totalDraft, totalScheduled, totalCustomers] = await Promise.all([
      prisma.campaign.count({ where: { businessId: tenant.businessId, status: "COMPLETED" } }),
      prisma.campaign.count({ where: { businessId: tenant.businessId, status: "DRAFT" } }),
      prisma.campaign.count({ where: { businessId: tenant.businessId, status: "SCHEDULED" } }),
      prisma.customer.count({ where: { businessId: tenant.businessId, isActive: true } }),
    ]);

    return NextResponse.json({
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        channel: c.channel,
        status: c.status,
        subject: c.subject,
        message: c.message,
        imageUrl: c.imageUrl,
        scheduledAt: c.scheduledAt?.toISOString() || null,
        sentAt: c.sentAt?.toISOString() || null,
        targetAll: c.targetAll,
        targetTier: c.targetTier,
        stats: c.stats,
        recipientCount: c._count.recipients,
        products: c.products.map((p) => ({
          productId: p.productId,
          name: p.product.name,
          imageUrl: p.product.image,
        })),
        createdAt: c.createdAt.toISOString(),
      })),
      stats: { totalSent, totalDraft, totalScheduled, totalCustomers },
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
    const {
      name, type, channel, subject, message, imageUrl,
      scheduledAt, targetAll, targetTier, filters, productIds,
    } = body;

    if (!name || !type || !channel || !message) {
      return NextResponse.json({ error: "name, type, channel, and message are required" }, { status: 400 });
    }

    // Determine recipients
    const recipientWhere: any = {
      businessId: tenant.businessId,
      isActive: true,
    };

    if (!targetAll && targetTier) {
      recipientWhere.loyaltyAccount = { tier: { tier: targetTier } };
    }

    const recipients = await prisma.customer.findMany({
      where: recipientWhere,
      select: { id: true },
    });

    const campaign = await prisma.campaign.create({
      data: {
        businessId: tenant.businessId,
        name,
        type,
        channel,
        status: scheduledAt ? "SCHEDULED" : "DRAFT",
        subject: subject || null,
        message,
        imageUrl: imageUrl || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        targetAll: targetAll || false,
        targetTier: targetTier || null,
        filters: filters || null,
        stats: { total: recipients.length, sent: 0, delivered: 0, read: 0 },
        recipients: {
          create: recipients.map((c) => ({
            customerId: c.id,
            status: "PENDING",
          })),
        },
        ...(productIds && productIds.length > 0 && {
          products: {
            create: productIds.map((pid: string) => ({ productId: pid })),
          },
        }),
      },
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
    console.error("Campaign POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
