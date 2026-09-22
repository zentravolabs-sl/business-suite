import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ticket = await prisma.serviceTicket.findFirst({
      where: { id, businessId: tenant.businessId },
      include: {
        customer: true,
        product: true,
        parts: true,
        updates: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Service ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ticket });
  } catch (error: any) {
    console.error("Service ticket GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const ticket = await prisma.serviceTicket.findFirst({
      where: { id, businessId: tenant.businessId },
      include: { parts: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {};

      if (body.technicianId !== undefined) updateData.technicianId = body.technicianId || null;
      if (body.priority !== undefined) updateData.priority = body.priority;
      if (body.isPaid !== undefined) updateData.isPaid = Boolean(body.isPaid);
      if (body.notes !== undefined) updateData.notes = body.notes;

      // Cost updates
      const partsSum = ticket.parts.reduce((sum, p) => sum + Number(p.total), 0);
      const laborCost =
        body.laborCost !== undefined ? Number(body.laborCost) : Number(ticket.laborCost || 0);
      updateData.laborCost = new Prisma.Decimal(laborCost);
      updateData.partsCost = new Prisma.Decimal(partsSum);
      updateData.finalCost = new Prisma.Decimal(laborCost + partsSum);

      // Status updates
      if (body.status && body.status !== ticket.status) {
        updateData.status = body.status;

        if (body.status === "COMPLETED" || body.status === "READY") {
          updateData.completedAt = new Date();
        }
        if (body.status === "DELIVERED") {
          updateData.deliveredAt = new Date();
        }

        // Log history update
        await tx.serviceTicketUpdate.create({
          data: {
            ticketId: ticket.id,
            status: body.status,
            notes: body.updateNotes || `Status progressed to ${body.status}`,
            userId: tenant.userId,
          },
        });
      }

      const updated = await tx.serviceTicket.update({
        where: { id: ticket.id },
        data: updateData,
        include: {
          customer: true,
          product: true,
          parts: true,
          updates: { orderBy: { createdAt: "desc" } },
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, ticket: result });
  } catch (error: any) {
    console.error("Service ticket PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
