import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const zoneCreateSchema = z.object({
  name: z.string().min(2, "Zone name is required"),
  areas: z.array(z.string()).min(1, "At least one area is required"),
  fee: z.coerce.number().min(0, "Fee cannot be negative"),
  minDays: z.coerce.number().int().min(0).default(1),
  maxDays: z.coerce.number().int().min(0).default(3),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.onlineStore.findUnique({
      where: { businessId: tenant.businessId },
    });

    if (!store) {
      return NextResponse.json({ error: "Online store not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = zoneCreateSchema.parse(body);

    const zone = await prisma.deliveryZone.create({
      data: {
        storeId: store.id,
        name: validated.name,
        areas: validated.areas,
        fee: validated.fee,
        minDays: validated.minDays,
        maxDays: validated.maxDays,
        isActive: validated.isActive,
      },
    });

    return NextResponse.json({ zone, message: "Delivery zone created successfully" }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create delivery zone:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to create delivery zone" },
      { status: 500 }
    );
  }
}
