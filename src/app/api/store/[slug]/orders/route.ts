import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const onlineOrderSchema = z.object({
  customerName: z.string().min(2, "Customer name is required"),
  customerPhone: z.string().min(9, "Valid phone number is required"),
  customerEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  type: z.enum(["DELIVERY", "PICKUP"]).default("DELIVERY"),
  deliveryAddress: z.string().optional().nullable(),
  deliveryCity: z.string().optional().nullable(),
  deliveryNotes: z.string().optional().nullable(),
  zoneId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD"]).default("CASH"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
      })
    )
    .min(1, "Order must contain at least one item"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const store = await prisma.onlineStore.findUnique({
      where: { slug },
      include: {
        business: {
          include: {
            branches: {
              where: { isHeadOffice: true },
              take: 1,
            },
          },
        },
        deliveryZones: true,
      },
    });

    if (!store || !store.isPublished) {
      return NextResponse.json(
        { error: "Online storefront is not available" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validated = onlineOrderSchema.parse(body);

    if (validated.type === "DELIVERY" && !validated.deliveryAddress) {
      return NextResponse.json(
        { error: "Delivery address is required for delivery orders" },
        { status: 400 }
      );
    }

    // Fetch products from database to ensure genuine pricing and stock availability
    const productIds = validated.items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        businessId: store.businessId,
        isActive: true,
      },
    });

    if (dbProducts.length !== productIds.length) {
      return NextResponse.json(
        { error: "One or more requested products are unavailable or discontinued" },
        { status: 400 }
      );
    }

    // Calculate item pricing
    let subtotal = 0;
    const orderItemsData: {
      productId: string;
      name: string;
      sku: string | null;
      quantity: number;
      unitPrice: number;
      total: number;
    }[] = [];

    for (const requestedItem of validated.items) {
      const product = dbProducts.find((p) => p.id === requestedItem.productId)!;
      const unitPrice = Number(product.retailPrice);
      const lineTotal = unitPrice * requestedItem.quantity;
      subtotal += lineTotal;

      orderItemsData.push({
        productId: product.id,
        name: product.name,
        sku: product.sku || null,
        quantity: requestedItem.quantity,
        unitPrice,
        total: lineTotal,
      });
    }

    // Check minimum order amount
    const minOrder = Number(store.minimumOrder || 0);
    if (minOrder > 0 && subtotal < minOrder) {
      return NextResponse.json(
        { error: `Minimum order amount is Rs. ${minOrder.toLocaleString()}` },
        { status: 400 }
      );
    }

    // Calculate delivery fee
    let deliveryFee = 0;
    let selectedZone = null;

    if (validated.type === "DELIVERY") {
      if (validated.zoneId) {
        selectedZone = store.deliveryZones.find((z) => z.id === validated.zoneId);
      }
      if (!selectedZone && store.deliveryZones.length > 0) {
        // Match by city or pick first zone
        selectedZone =
          store.deliveryZones.find((z) =>
            z.areas.some(
              (a) =>
                validated.deliveryCity &&
                a.toLowerCase().includes(validated.deliveryCity.toLowerCase())
            )
          ) || store.deliveryZones[0];
      }

      const zoneFee = selectedZone ? Number(selectedZone.fee) : 350;
      const freeThreshold = Number(store.freeDeliveryThreshold || 0);

      if (freeThreshold > 0 && subtotal >= freeThreshold) {
        deliveryFee = 0;
      } else {
        deliveryFee = zoneFee;
      }
    }

    const total = subtotal + deliveryFee;

    // Generate unique sequential order number: ORD-YYYY-XXXXX
    const year = new Date().getFullYear();
    const orderPrefix = `ORD-${year}-`;
    const lastOrder = await prisma.onlineOrder.findFirst({
      where: {
        businessId: store.businessId,
        orderNumber: { startsWith: orderPrefix },
      },
      orderBy: { orderNumber: "desc" },
    });

    let nextSeq = 1;
    if (lastOrder && lastOrder.orderNumber.startsWith(orderPrefix)) {
      const parts = lastOrder.orderNumber.split("-");
      const currentSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(currentSeq)) {
        nextSeq = currentSeq + 1;
      }
    }
    const orderNumber = `${orderPrefix}${String(nextSeq).padStart(5, "0")}`;

    // Link or create CRM Customer
    let customer = await prisma.customer.findFirst({
      where: {
        businessId: store.businessId,
        phone: validated.customerPhone,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId: store.businessId,
          name: validated.customerName,
          phone: validated.customerPhone,
          email: validated.customerEmail || null,
          address: validated.deliveryAddress || null,
          city: validated.deliveryCity || null,
        },
      });
    }

    const branchId =
      validated.branchId ||
      store.business.branches[0]?.id ||
      null;

    // Create OnlineOrder with atomic transaction
    const newOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.onlineOrder.create({
        data: {
          businessId: store.businessId,
          branchId,
          storeId: store.id,
          zoneId: selectedZone?.id || null,
          customerId: customer?.id || null,
          orderNumber,
          status: "PENDING",
          type: validated.type,
          customerName: validated.customerName,
          customerPhone: validated.customerPhone,
          customerEmail: validated.customerEmail || null,
          deliveryAddress: validated.deliveryAddress || null,
          deliveryCity: validated.deliveryCity || null,
          deliveryNotes: validated.deliveryNotes || null,
          subtotal,
          deliveryFee,
          discountAmount: 0,
          taxAmount: 0,
          total,
          paymentMethod: validated.paymentMethod,
          paymentStatus: "PENDING",
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Create linked Delivery record
      await tx.delivery.create({
        data: {
          orderId: order.id,
          status: "PENDING",
          notes: validated.deliveryNotes || null,
        },
      });

      return order;
    });

    return NextResponse.json(
      {
        success: true,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        total: newOrder.total,
        message: "Order placed successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Online order submission error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid order information" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to place order. Please try again." },
      { status: 500 }
    );
  }
}
