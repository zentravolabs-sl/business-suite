import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const tier = searchParams.get("tier") || "";
    const vip = searchParams.get("vip") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: any = {
      businessId: tenant.businessId,
      isActive: true,
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { customerCode: { contains: q, mode: "insensitive" } },
      ];
    }

    if (vip) where.isVip = true;

    if (tier) {
      where.loyaltyAccount = {
        tier: { tier },
      };
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          loyaltyAccount: {
            include: { tier: true },
          },
          _count: {
            select: { sales: true, onlineOrders: true, serviceTickets: true },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    // Aggregate stats
    const [totalSpendAgg] = await Promise.all([
      prisma.sale.groupBy({
        by: ["customerId"],
        where: {
          businessId: tenant.businessId,
          customerId: { in: customers.map((c) => c.id) },
          status: "COMPLETED",
        },
        _sum: { total: true },
      }),
    ]);

    const spendMap = new Map(
      totalSpendAgg.map((s) => [s.customerId, Number(s._sum.total || 0)])
    );

    const serialized = customers.map((c) => ({
      id: c.id,
      customerCode: c.customerCode,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      city: c.city,
      district: c.district,
      dateOfBirth: c.dateOfBirth?.toISOString() || null,
      gender: c.gender,
      notes: c.notes,
      creditLimit: Number(c.creditLimit),
      creditBalance: Number(c.creditBalance),
      isVip: c.isVip,
      isActive: c.isActive,
      portalEnabled: c.portalEnabled,
      createdAt: c.createdAt.toISOString(),
      totalSales: c._count.sales + c._count.onlineOrders,
      totalServiceTickets: c._count.serviceTickets,
      totalSpend: spendMap.get(c.id) || 0,
      loyaltyPoints: c.loyaltyAccount?.points || 0,
      lifetimePoints: c.loyaltyAccount?.lifetimePoints || 0,
      loyaltyTier: c.loyaltyAccount?.tier?.name || null,
      loyaltyTierCode: c.loyaltyAccount?.tier?.tier || null,
    }));

    return NextResponse.json({ customers: serialized, total, page, limit });
  } catch (error: any) {
    console.error("Customers GET error:", error);
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
    const { name, phone, email, address, city, district, dateOfBirth, gender, notes, creditLimit, isVip } = body;

    if (!name) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    // Generate customer code
    const count = await prisma.customer.count({ where: { businessId: tenant.businessId } });
    const customerCode = `CUST-${String(count + 1).padStart(4, "0")}`;

    const customer = await prisma.$transaction(async (tx) => {
      const cust = await tx.customer.create({
        data: {
          businessId: tenant.businessId,
          customerCode,
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
          city: city || null,
          district: district || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender || null,
          notes: notes || null,
          creditLimit: creditLimit ? Number(creditLimit) : 0,
          isVip: isVip || false,
          isActive: true,
        },
      });

      // Auto-enroll in loyalty program
      await tx.loyaltyAccount.create({
        data: {
          businessId: tenant.businessId,
          customerId: cust.id,
          points: 0,
          lifetimePoints: 0,
        },
      });

      return cust;
    });

    return NextResponse.json({ success: true, customer });
  } catch (error: any) {
    console.error("Customer POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
