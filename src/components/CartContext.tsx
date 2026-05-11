import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Cart, Medicine } from '../types';

interface CartContextType {
  cart: Cart | null;
  addToCart: (medicine: Medicine, pharmacyName: string) => boolean;
  removeFromCart: (medicineId: string) => void;
  updateQuantity: (medicineId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);

  const addToCart = useCallback((medicine: Medicine, pharmacyName: string): boolean => {
    if (cart && cart.pharmacy_id !== medicine.pharmacy_id) {
      return false;
    }

    setCart((prev) => {
      if (!prev) {
        return {
          pharmacy_id: medicine.pharmacy_id,
          pharmacy_name: pharmacyName,
          items: [{ medicine, quantity: 1 }],
        };
      }

      const existing = prev.items.find((i) => i.medicine.id === medicine.id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.medicine.id === medicine.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { ...prev, items: [...prev.items, { medicine, quantity: 1 }] };
    });
    return true;
  }, [cart]);

  const removeFromCart = useCallback((medicineId: string) => {
    setCart((prev) => {
      if (!prev) return null;
      const items = prev.items.filter((i) => i.medicine.id !== medicineId);
      return items.length === 0 ? null : { ...prev, items };
    });
  }, []);

  const updateQuantity = useCallback((medicineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(medicineId);
      return;
    }
    setCart((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((i) =>
          i.medicine.id === medicineId ? { ...i, quantity } : i
        ),
      };
    });
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCart(null), []);

  const totalItems = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const totalPrice = cart?.items.reduce((sum, i) => sum + i.medicine.price * i.quantity, 0) ?? 0;

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
