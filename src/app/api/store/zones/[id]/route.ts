import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const zoneUpdateSchema = z.object({
  name: z.string().min(2, "Zone name is required").optional(),
  areas: z.array(z.string()).min(1, "At least one area is required").optional(),
  fee: z.coerce.number().min(0, "Fee cannot be negative").optional(),
  minDays: z.coerce.number().int().min(0).optional(),
  maxDays: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

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
    const store = await prisma.onlineStore.findUnique({
      where: { businessId: tenant.businessId },
    });

    if (!store) {
      return NextResponse.json({ error: "Online store not found" }, { status: 404 });
    }

    const existingZone = await prisma.deliveryZone.findFirst({
      where: { id, storeId: store.id },
    });

    if (!existingZone) {
      return NextResponse.json({ error: "Delivery zone not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = zoneUpdateSchema.parse(body);

    const updated = await prisma.deliveryZone.update({
      where: { id },
      data: validated,
    });

    return NextResponse.json({ zone: updated, message: "Delivery zone updated" });
  } catch (error: any) {
    console.error("Failed to update delivery zone:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update delivery zone" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const store = await prisma.onlineStore.findUnique({
      where: { businessId: tenant.businessId },
    });

    if (!store) {
      return NextResponse.json({ error: "Online store not found" }, { status: 404 });
    }

    const existingZone = await prisma.deliveryZone.findFirst({
      where: { id, storeId: store.id },
    });

    if (!existingZone) {
      return NextResponse.json({ error: "Delivery zone not found" }, { status: 404 });
    }

    await prisma.deliveryZone.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Delivery zone deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete delivery zone:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete delivery zone" },
      { status: 500 }
    );
  }
}
