import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { z } from "zod";

const storeUpdateSchema = z.object({
  name: z.string().min(2, "Store name is required"),
  slug: z.string().min(2, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
  tagline: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  banner: z.string().optional().nullable(),
  primaryColor: z.string().default("#4F46E5"),
  accentColor: z.string().default("#7C3AED"),
  isPublished: z.boolean().default(true),
  allowCOD: z.boolean().default(true),
  allowCard: z.boolean().default(false),
  allowOnline: z.boolean().default(false),
  deliveryEnabled: z.boolean().default(true),
  pickupEnabled: z.boolean().default(true),
  minimumOrder: z.coerce.number().min(0).default(0),
  freeDeliveryThreshold: z.coerce.number().min(0).default(50000),
  customDomain: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let store = await prisma.onlineStore.findUnique({
      where: { businessId: tenant.businessId },
      include: {
        deliveryZones: {
          orderBy: { fee: "asc" },
        },
      },
    });

    // Auto-create store if doesn't exist yet
    if (!store) {
      const business = await prisma.business.findUnique({
        where: { id: tenant.businessId },
      });

      const baseSlug = business?.slug || "store";

      store = await prisma.onlineStore.create({
        data: {
          businessId: tenant.businessId,
          name: business?.name || "Official Store",
          slug: baseSlug,
          tagline: "Quality Sri Lankan Retail Delivered Directly To Your Door",
          description: "Browse our extensive catalog of genuine products with official warranty, islandwide delivery, and cash on delivery.",
          primaryColor: "#4F46E5",
          accentColor: "#7C3AED",
          isPublished: true,
          allowCOD: true,
          allowCard: false,
          allowOnline: true,
          deliveryEnabled: true,
          pickupEnabled: true,
          minimumOrder: 1500,
          freeDeliveryThreshold: 50000,
          metaTitle: `${business?.name || "Store"} | Official E-Commerce Storefront`,
          metaDescription: "Shop authentic electronics, gadgets, and appliances with islandwide delivery.",
          deliveryZones: {
            create: [
              {
                name: "Colombo Express Delivery",
                areas: ["Colombo 1-15", "Colombo Suburbs", "Dehiwala", "Mount Lavinia", "Nugegoda", "Rajagiriya"],
                fee: 350,
                minDays: 1,
                maxDays: 1,
                isActive: true,
              },
              {
                name: "Greater Colombo & Western Province",
                areas: ["Gampaha", "Kalutara", "Negombo", "Panadura", "Wattala"],
                fee: 450,
                minDays: 1,
                maxDays: 2,
                isActive: true,
              },
              {
                name: "Islandwide Courier (Domex / Pronto)",
                areas: ["Kandy", "Galle", "Matara", "Kurunegala", "Jaffna", "Anuradhapura", "Ratnapura", "Badulla"],
                fee: 650,
                minDays: 2,
                maxDays: 4,
                isActive: true,
              },
              {
                name: "Showroom Store Pickup",
                areas: ["Colombo Flagship Store", "Kandy Branch"],
                fee: 0,
                minDays: 0,
                maxDays: 1,
                isActive: true,
              },
            ],
          },
        },
        include: {
          deliveryZones: {
            orderBy: { fee: "asc" },
          },
        },
      });
    }

    return NextResponse.json({ store });
  } catch (error) {
    console.error("Failed to fetch store settings:", error);
    return NextResponse.json(
      { error: "Failed to load store settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = storeUpdateSchema.parse(body);

    // Check slug collision with another store
    const existingSlug = await prisma.onlineStore.findFirst({
      where: {
        slug: validated.slug,
        businessId: { not: tenant.businessId },
      },
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: "This store URL slug is already taken by another merchant" },
        { status: 400 }
      );
    }

    const updated = await prisma.onlineStore.upsert({
      where: { businessId: tenant.businessId },
      update: {
        ...validated,
        minimumOrder: validated.minimumOrder,
        freeDeliveryThreshold: validated.freeDeliveryThreshold,
      },
      create: {
        businessId: tenant.businessId,
        ...validated,
        minimumOrder: validated.minimumOrder,
        freeDeliveryThreshold: validated.freeDeliveryThreshold,
      },
      include: {
        deliveryZones: true,
      },
    });

    return NextResponse.json({ store: updated, message: "Store settings saved successfully" });
  } catch (error: any) {
    console.error("Failed to update store settings:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to update store settings" },
      { status: 500 }
    );
  }
}
