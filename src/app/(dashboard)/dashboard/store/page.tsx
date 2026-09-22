import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { StoreSettingsClient } from "@/components/store/store-settings-client";

export const metadata = {
  title: "Online Store Settings | Zentravo BMS",
  description: "Configure online storefront, branding, payments, and Sri Lankan delivery zones",
};

export default async function StoreSettingsPage() {
  const tenant = await requireTenant();

  let store = await prisma.onlineStore.findUnique({
    where: { businessId: tenant.businessId },
    include: {
      deliveryZones: {
        orderBy: { fee: "asc" },
      },
    },
  });

  // If store doesn't exist, create it with default Sri Lankan shipping zones
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
        description:
          "Browse our extensive catalog of genuine products with official warranty, islandwide delivery, and cash on delivery.",
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
        deliveryZones: {
          create: [
            {
              name: "Colombo Express Delivery",
              areas: [
                "Colombo 1-15",
                "Colombo Suburbs",
                "Dehiwala",
                "Mount Lavinia",
                "Nugegoda",
                "Rajagiriya",
              ],
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
              areas: [
                "Kandy",
                "Galle",
                "Matara",
                "Kurunegala",
                "Jaffna",
                "Anuradhapura",
                "Ratnapura",
                "Badulla",
              ],
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

  // Serialize Prisma Decimals for Client Component
  const serializedStore = {
    ...store,
    minimumOrder: store.minimumOrder ? Number(store.minimumOrder) : 0,
    freeDeliveryThreshold: store.freeDeliveryThreshold
      ? Number(store.freeDeliveryThreshold)
      : 50000,
    deliveryZones: store.deliveryZones.map((z) => ({
      ...z,
      fee: Number(z.fee),
    })),
  };

  return <StoreSettingsClient initialStore={serializedStore as any} />;
}
