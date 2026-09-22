"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface CartItem {
  productId: string;
  name: string;
  sku?: string | null;
  image?: string | null;
  price: number;
  quantity: number;
  maxStock: number;
  warrantyMonths?: number | null;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  freeDeliveryThreshold: number;
  setFreeDeliveryThreshold: (threshold: number) => void;
  freeDeliveryProgress: number;
  remainingForFreeDelivery: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({
  children,
  storeSlug,
  initialFreeDeliveryThreshold = 50000,
}: {
  children: React.ReactNode;
  storeSlug: string;
  initialFreeDeliveryThreshold?: number;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(initialFreeDeliveryThreshold);
  const [isHydrated, setIsHydrated] = useState(false);

  const storageKey = `zentravo_cart_${storeSlug}`;

  // Hydrate cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch {
      // Ignore localStorage errors
    } finally {
      setIsHydrated(true);
    }
  }, [storageKey]);

  // Persist items to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Ignore localStorage write errors
    }
  }, [items, isHydrated, storageKey]);

  const addItem = (item: Omit<CartItem, "quantity">, quantity: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, item.maxStock || 999);
        return prev.map((i) =>
          i.productId === item.productId ? { ...i, quantity: newQty } : i
        );
      } else {
        const initialQty = Math.min(quantity, item.maxStock || 999);
        return [...prev, { ...item, quantity: Math.max(1, initialQty) }];
      }
    });
    setIsCartOpen(true);
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => {
        if (i.productId === productId) {
          const clamped = Math.min(quantity, i.maxStock || 999);
          return { ...i, quantity: clamped };
        }
        return i;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  };

  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);

  const freeDeliveryProgress = freeDeliveryThreshold > 0
    ? Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100))
    : 100;

  const remainingForFreeDelivery = freeDeliveryThreshold > 0
    ? Math.max(0, freeDeliveryThreshold - subtotal)
    : 0;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        isCartOpen,
        setIsCartOpen,
        freeDeliveryThreshold,
        setFreeDeliveryThreshold,
        freeDeliveryProgress,
        remainingForFreeDelivery,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
