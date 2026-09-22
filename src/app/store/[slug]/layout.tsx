import React from "react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CartProvider } from "@/context/cart-context";
import { CartDrawer } from "@/components/storefront/cart-drawer";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const store = await prisma.onlineStore.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      primaryColor: true,
      freeDeliveryThreshold: true,
      isPublished: true,
    },
  });

  if (!store || !store.isPublished) {
    notFound();
  }

  const freeThreshold = store.freeDeliveryThreshold
    ? Number(store.freeDeliveryThreshold)
    : 50000;

  return (
    <CartProvider
      storeSlug={store.slug}
      initialFreeDeliveryThreshold={freeThreshold}
    >
      <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        {children}
        <CartDrawer storeSlug={store.slug} primaryColor={store.primaryColor} />
      </div>
    </CartProvider>
  );
}
