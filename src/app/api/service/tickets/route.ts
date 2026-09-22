import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const ticketCreateSchema = z.object({
  branchId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  technicianId: z.string().optional().nullable(),
  deviceName: z.string().min(2, "Device name or model is required"),
  serialNumber: z.string().optional().nullable(),
  issue: z.string().min(3, "Reported issue is required"),
  description: z.string().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  estimatedCost: z.coerce.number().min(0).default(0),
  isWarranty: z.boolean().default(false),
  warrantyId: z.string().optional().nullable(),
  estimatedCompletionAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const technicianId = searchParams.get("technicianId");

    const where: any = {
      businessId: tenant.businessId,
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (priority && priority !== "ALL") {
      where.priority = priority;
    }

    if (technicianId && technicianId !== "ALL") {
      where.technicianId = technicianId;
    }

    if (q) {
      where.OR = [
        { ticketNumber: { contains: q, mode: "insensitive" } },
        { deviceName: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { issue: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { phone: { contains: q, mode: "insensitive" } } },
      ];
    }

    const tickets = await prisma.serviceTicket.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        product: { select: { id: true, name: true, sku: true } },
        parts: true,
        updates: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ tickets });
  } catch (error: any) {
    console.error("Service tickets GET error:", error);
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
    const parsed = ticketCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const count = await tx.serviceTicket.count({
        where: { businessId: tenant.businessId },
      });
      const ticketNumber = `SRV-${year}-${(count + 1).toString().padStart(5, "0")}`;

      const ticket = await tx.serviceTicket.create({
        data: {
          businessId: tenant.businessId,
          branchId: data.branchId || tenant.branchId || null,
          customerId: data.customerId || null,
          productId: data.productId || null,
          technicianId: data.technicianId || null,
          ticketNumber,
          deviceName: data.deviceName.trim(),
          serialNumber: data.serialNumber?.trim() || null,
          issue: data.issue.trim(),
          description: data.description?.trim() || null,
          status: "RECEIVED",
          priority: data.priority,
          estimatedCost: new Prisma.Decimal(data.estimatedCost),
          finalCost: new Prisma.Decimal(data.estimatedCost),
          isWarranty: data.isWarranty,
          warrantyId: data.warrantyId || null,
          estimatedCompletionAt: data.estimatedCompletionAt
            ? new Date(data.estimatedCompletionAt)
            : null,
          notes: data.notes?.trim() || null,
        },
        include: {
          customer: true,
          product: true,
        },
      });

      // Initial update log
      await tx.serviceTicketUpdate.create({
        data: {
          ticketId: ticket.id,
          status: "RECEIVED",
          notes: `Service ticket created for ${ticket.deviceName}. Issue: ${ticket.issue}`,
          userId: tenant.userId,
        },
      });

      return ticket;
    });

    return NextResponse.json({ success: true, ticket: result }, { status: 201 });
  } catch (error: any) {
    console.error("Service ticket POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
