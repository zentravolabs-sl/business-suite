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

    const customer = await prisma.customer.findFirst({
      where: { id, businessId: tenant.businessId },
      include: {
        loyaltyAccount: {
          include: {
            tier: true,
            transactions: {
              orderBy: { createdAt: "desc" },
              take: 20,
              include: { sale: { select: { invoiceNumber: true } } },
            },
          },
        },
        creditTransactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        sales: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            items: { take: 5 },
            payments: true,
          },
        },
        serviceTickets: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        warranties: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { product: { select: { name: true } } },
        },
        onlineOrders: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const totalSpend = customer.sales.reduce((sum, s) => sum + Number(s.total), 0);

    return NextResponse.json({
      customer: {
        ...customer,
        creditLimit: Number(customer.creditLimit),
        creditBalance: Number(customer.creditBalance),
        dateOfBirth: customer.dateOfBirth?.toISOString() || null,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
        totalSpend,
        sales: customer.sales.map((s) => ({
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          total: Number(s.total),
          status: s.status,
          createdAt: s.createdAt.toISOString(),
          itemCount: s.items.length,
          paymentMethods: s.payments.map((p) => p.method),
        })),
        serviceTickets: customer.serviceTickets.map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          deviceModel: t.deviceName || "Unknown Device",
          status: t.status,
          createdAt: t.createdAt.toISOString(),
        })),
        warranties: customer.warranties.map((w) => ({
          id: w.id,
          warrantyCode: w.warrantyCode,
          productName: w.product?.name || "—",
          status: w.status,
          expiresAt: w.endDate.toISOString(),
        })),
        loyaltyAccount: customer.loyaltyAccount
          ? {
              points: customer.loyaltyAccount.points,
              lifetimePoints: customer.loyaltyAccount.lifetimePoints,
              tierName: customer.loyaltyAccount.tier?.name || "No Tier",
              tierCode: customer.loyaltyAccount.tier?.tier || null,
              transactions: customer.loyaltyAccount.transactions.map((t) => ({
                id: t.id,
                type: t.type,
                points: t.points,
                balance: t.balance,
                notes: t.notes,
                invoiceNumber: t.sale?.invoiceNumber || null,
                createdAt: t.createdAt.toISOString(),
              })),
            }
          : null,
        creditTransactions: customer.creditTransactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          balance: Number(t.balance),
          notes: t.notes,
          createdAt: t.createdAt.toISOString(),
        })),
        onlineOrders: customer.onlineOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          total: Number(o.total),
          status: o.status,
          createdAt: o.createdAt.toISOString(),
        })),
      },
    });
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
    const { name, phone, email, address, city, district, dateOfBirth, gender, notes, creditLimit, isVip, portalEnabled } = body;

    await prisma.customer.updateMany({
      where: { id, businessId: tenant.businessId },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(district !== undefined && { district }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(gender !== undefined && { gender }),
        ...(notes !== undefined && { notes }),
        ...(creditLimit !== undefined && { creditLimit: Number(creditLimit) }),
        ...(isVip !== undefined && { isVip }),
        ...(portalEnabled !== undefined && { portalEnabled }),
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

    await prisma.customer.updateMany({
      where: { id, businessId: tenant.businessId },
      data: { isActive: false, deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
