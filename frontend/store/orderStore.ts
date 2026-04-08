import { create } from 'zustand';
import type { OrderSummary, PrepStation } from '@/types/order';

export interface CartItem {
  lineId: string; // unique per cart line — allows multiple lines of the same menuItemId
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
  addToCart: (item: Omit<CartItem, 'lineId'>) => void;
  setCart: (items: CartItem[]) => void;
  removeFromCart: (lineId: string) => void;
  updateCartQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const selectCartTotal = (cart: CartItem[]): number =>
  cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

export const selectCartCount = (cart: CartItem[]): number =>
  cart.reduce((sum, item) => sum + item.quantity, 0);

// Sum quantities across all lines for the same menuItemId (for tile badge display)
export const selectCartQuantityByItem = (cart: CartItem[], menuItemId: string): number =>
  cart.filter((item) => item.menuItemId === menuItemId).reduce((sum, item) => sum + item.quantity, 0);

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
    set((state) => ({
      // Always append a new line — each tap is a separate prep ticket on the KDS
      cart: [...state.cart, { ...item, lineId: crypto.randomUUID() }],
    })),

  setCart: (items) => set({ cart: items }),

  removeFromCart: (lineId) =>
    set((state) => ({
      cart: state.cart.filter((entry) => entry.lineId !== lineId),
    })),

  updateCartQuantity: (lineId, quantity) =>
    set((state) => ({
      cart:
        quantity <= 0
          ? state.cart.filter((entry) => entry.lineId !== lineId)
          : state.cart.map((entry) =>
              entry.lineId === lineId ? { ...entry, quantity } : entry,
            ),
    })),

  clearCart: () => set({ cart: [] }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

