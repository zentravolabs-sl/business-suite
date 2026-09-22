import React from "react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { StorefrontClient } from "./storefront-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await prisma.onlineStore.findUnique({
    where: { slug },
    select: { name: true, metaTitle: true, metaDescription: true, tagline: true },
  });

  if (!store) return { title: "Store Not Found" };

  return {
    title: store.metaTitle || `${store.name} — Official Online Store | Sri Lanka`,
    description:
      store.metaDescription ||
      store.tagline ||
      `Shop online at ${store.name}. Genuine products, islandwide express delivery, official warranty.`,
  };
}

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const store = await prisma.onlineStore.findUnique({
    where: { slug },
    include: {
      business: {
        select: { id: true, name: true, phone: true, email: true, address: true, city: true },
      },
      deliveryZones: {
        where: { isActive: true },
        orderBy: { fee: "asc" },
      },
    },
  });

  if (!store || !store.isPublished) {
    notFound();
  }

  // Fetch all active products with category, brand, and branch stock
  const products = await prisma.product.findMany({
    where: {
      businessId: store.businessId,
      isActive: true,
    },
    include: {
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      stocks: { select: { quantity: true } },
    },
    orderBy: { name: "asc" },
  });

  // Calculate aggregate stock per product
  const serializedProducts = products.map((p) => {
    const totalStock = p.stocks.reduce((sum, s) => sum + s.quantity, 0);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      description: p.description,
      sellingPrice: Number(p.retailPrice),
      stockQuantity: totalStock,
      warrantyMonths: p.warrantyMonths,
      warrantyType: p.warrantyType,
      category: p.category,
      brand: p.brand,
    };
  });

  const categories = await prisma.category.findMany({
    where: { businessId: store.businessId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

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

  return (
    <StorefrontClient
      store={serializedStore as any}
      initialProducts={serializedProducts}
      categories={categories}
    />
  );
}
