import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId") || req.cookies.get("zentravo_customer_id")?.value;

    if (!customerId) {
      return NextResponse.json({ error: "Customer not authenticated" }, { status: 401 });
    }

    const [customer, warranties, serviceTickets, sales, onlineOrders] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          loyaltyAccount: {
            include: {
              tier: true,
              transactions: {
                orderBy: { createdAt: "desc" },
                take: 10,
              },
            },
          },
          business: {
            select: {
              name: true,
              phone: true,
              email: true,
              address: true,
            },
          },
        },
      }),
      prisma.warranty.findMany({
        where: { customerId },
        include: {
          product: { select: { name: true, sku: true, image: true } },
          claims: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.serviceTicket.findMany({
        where: { customerId },
        include: {
          updates: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sale.findMany({
        where: { customerId, status: "COMPLETED" },
        include: {
          items: true,
          payments: true,
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.onlineOrder.findMany({
        where: { customerId },
        include: {
          items: true,
          delivery: true,
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        creditBalance: Number(customer.creditBalance),
        loyalty: customer.loyaltyAccount
          ? {
              points: customer.loyaltyAccount.points,
              tier: customer.loyaltyAccount.tier?.name || "SILVER",
              transactions: customer.loyaltyAccount.transactions.map((t) => ({
                id: t.id,
                type: t.type,
                points: t.points,
                description: t.notes || `Loyalty ${t.type}`,
                date: t.createdAt.toISOString(),
              })),
            }
          : null,
        merchant: customer.business,
      },
      warranties: warranties.map((w) => ({
        id: w.id,
        warrantyNumber: w.warrantyCode,
        productName: w.product?.name || "Product",
        serialNumber: w.serialNumber,
        status: w.status,
        type: w.type,
        startDate: w.startDate.toISOString(),
        endDate: w.endDate.toISOString(),
        months: w.warrantyMonths,
        claims: w.claims.map((c) => ({
          id: c.id,
          claimNumber: c.claimNumber,
          issueDescription: c.description || c.problem,
          status: c.status,
          resolution: c.resolution,
          createdAt: c.createdAt.toISOString(),
        })),
      })),
      serviceTickets: serviceTickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        itemType: t.deviceName || "Device",
        brand: "",
        model: t.deviceName || "Equipment",
        serialNumber: t.serialNumber,
        reportedIssue: t.issue,
        diagnosis: t.description || t.notes,
        status: t.status,
        priority: t.priority,
        estimatedCost: Number(t.estimatedCost || 0),
        finalCost: Number(t.finalCost || 0),
        estimatedCompletion: t.estimatedCompletionAt?.toISOString() || null,
        branchName: "Service Center",
        branchPhone: customer.business?.phone || "",
        updates: (t.updates || []).map((u: any) => ({
          status: u.status,
          notes: u.notes,
          createdAt: u.createdAt.toISOString(),
        })),
        createdAt: t.createdAt.toISOString(),
      })),
      sales: sales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        date: s.createdAt.toISOString(),
        total: Number(s.total),
        discountAmount: Number(s.discountAmount),
        branchName: s.branch?.name,
        paymentMethod: s.payments[0]?.method || "CASH",
        items: s.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
        })),
      })),
      onlineOrders: onlineOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        date: o.createdAt.toISOString(),
        status: o.status,
        total: Number(o.total),
        deliveryAddress: o.deliveryAddress,
        deliveryCity: o.deliveryCity,
        trackingNo: o.delivery?.trackingNo,
        items: o.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
        })),
      })),
    });
  } catch (error: any) {
    console.error("Portal data error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
