import { create } from 'zustand';
import type { OrderSummary, PrepStation } from '@/types/order';

export interface CartItem {
  prepStation: PrepStation;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
}

interface OrderStore {
  activeOrders: OrderSummary[];
  cart: CartItem[];
  isLoading: boolean;
  error: string | null;
  setActiveOrders: (orders: OrderSummary[]) => void;
  addOrderRealTime: (order: OrderSummary) => void;
  updateOrderRealTime: (orderId: string, updates: Partial<OrderSummary>) => void;
  removeOrderFromActive: (orderId: string) => void;
  addToCart: (item: CartItem) => void;
  setCart: (items: CartItem[]) => void;
  removeFromCart: (menuItemId: string) => void;
  updateCartQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const selectCartTotal = (cart: CartItem[]): number =>
  cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

export const selectCartCount = (cart: CartItem[]): number =>
  cart.reduce((sum, item) => sum + item.quantity, 0);

export const selectCartQuantityByItem = (cart: CartItem[], menuItemId: string): number =>
  cart.find((item) => item.menuItemId === menuItemId)?.quantity ?? 0;

export const useOrderStore = create<OrderStore>((set) => ({
  activeOrders: [],
  cart: [],
  isLoading: false,
  error: null,

  setActiveOrders: (orders) => set({ activeOrders: orders }),

  addOrderRealTime: (order) =>
    set((state) => ({
      activeOrders: [order, ...state.activeOrders],
    })),

  updateOrderRealTime: (orderId, updates) =>
    set((state) => ({
      activeOrders: state.activeOrders.map((order) =>
        order.id === orderId ? { ...order, ...updates } : order,
      ),
    })),

  removeOrderFromActive: (orderId) =>
    set((state) => ({
      activeOrders: state.activeOrders.filter((order) => order.id !== orderId),
    })),

  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((entry) => entry.menuItemId === item.menuItemId);

      if (!existing) {
        return { cart: [...state.cart, item] };
      }

      return {
        cart: state.cart.map((entry) =>
          entry.menuItemId === item.menuItemId
            ? {
                ...entry,
                quantity: entry.quantity + item.quantity,
                notes: item.notes ?? entry.notes,
              }
            : entry,
        ),
      };
    }),

  setCart: (items) => set({ cart: items }),

  removeFromCart: (menuItemId) =>
    set((state) => ({
      cart: state.cart.filter((entry) => entry.menuItemId !== menuItemId),
    })),

  updateCartQuantity: (menuItemId, quantity) =>
    set((state) => ({
      cart:
        quantity <= 0
          ? state.cart.filter((entry) => entry.menuItemId !== menuItemId)
          : state.cart.map((entry) =>
              entry.menuItemId === menuItemId ? { ...entry, quantity } : entry,
            ),
    })),

  clearCart: () => set({ cart: [] }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

