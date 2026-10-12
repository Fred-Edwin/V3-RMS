import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useAuthStore } from '@/store/authStore';
import type { RestockListLine } from '../types/attendant';

/**
 * The Attendant's restock list between "Restock list", Search and the supplier page (Q-05: the back end keeps no draft). One list per
 * signed-in person, kept in the browser, and emptied after a successful send. Quantities are whole buy units, as strings (the wire form).
 */
export interface ListLine {
  inventoryItemId: string;
  name: string;
  qty: string;
  buyUnit: string;
  supplierId: string | null;
  supplierName: string | null;
  /** The last price for one buy unit, for the "about KES …" total; null when not known or hidden. */
  unitPrice: string | null;
}

interface RestockListState {
  byUser: Record<string, ListLine[]>;
  add: (userId: string, line: ListLine) => void;
  setQty: (userId: string, inventoryItemId: string, qty: number) => void;
  remove: (userId: string, inventoryItemId: string) => void;
  clear: (userId: string) => void;
}

const NONE: ListLine[] = [];

export const useRestockListStore = create<RestockListState>()(
  persist(
    (set) => ({
      byUser: {},
      add: (userId, line) =>
        set((s) => {
          const mine = s.byUser[userId] ?? NONE;
          if (mine.some((l) => l.inventoryItemId === line.inventoryItemId)) return s;
          return { byUser: { ...s.byUser, [userId]: [...mine, line] } };
        }),
      setQty: (userId, inventoryItemId, qty) =>
        set((s) => {
          const mine = s.byUser[userId] ?? NONE;
          // Below 1 the item leaves the list (the stepper's minus on a quantity of 1).
          const next = qty < 1 ? mine.filter((l) => l.inventoryItemId !== inventoryItemId) : mine.map((l) => (l.inventoryItemId === inventoryItemId ? { ...l, qty: String(Math.min(qty, 999_999)) } : l));
          return { byUser: { ...s.byUser, [userId]: next } };
        }),
      remove: (userId, inventoryItemId) => set((s) => ({ byUser: { ...s.byUser, [userId]: (s.byUser[userId] ?? NONE).filter((l) => l.inventoryItemId !== inventoryItemId) } })),
      clear: (userId) => set((s) => ({ byUser: { ...s.byUser, [userId]: [] } })),
    }),
    { name: 'wendo-purchasing-restock-list', version: 1, partialize: (s) => ({ byUser: s.byUser }) },
  ),
);

export interface RestockList {
  lines: ListLine[];
  count: number;
  has: (inventoryItemId: string) => boolean;
  get: (inventoryItemId: string) => ListLine | undefined;
  add: (line: ListLine) => void;
  setQty: (inventoryItemId: string, qty: number) => void;
  remove: (inventoryItemId: string) => void;
  clear: () => void;
  /** The wire form for review and send. */
  toWire: () => RestockListLine[];
  /** How many different suppliers the list reaches, and what it would cost about (null when no line has a price). */
  summary: { suppliers: number; total: number | null };
}

/** The signed-in person's list. Actions are stable, so they are safe in effect dependencies. */
export function useRestockList(): RestockList {
  const userId = useAuthStore((s) => s.user?.id ?? 'anonymous');
  const lines = useRestockListStore((s) => s.byUser[userId]) ?? NONE;
  const addRaw = useRestockListStore((s) => s.add);
  const setQtyRaw = useRestockListStore((s) => s.setQty);
  const removeRaw = useRestockListStore((s) => s.remove);
  const clearRaw = useRestockListStore((s) => s.clear);
  const add = React.useCallback((line: ListLine) => addRaw(userId, line), [addRaw, userId]);
  const setQty = React.useCallback((id: string, qty: number) => setQtyRaw(userId, id, qty), [setQtyRaw, userId]);
  const remove = React.useCallback((id: string) => removeRaw(userId, id), [removeRaw, userId]);
  const clear = React.useCallback(() => clearRaw(userId), [clearRaw, userId]);
  return React.useMemo(() => {
    const priced = lines.filter((l) => l.unitPrice !== null);
    return {
      lines,
      count: lines.length,
      has: (id: string) => lines.some((l) => l.inventoryItemId === id),
      get: (id: string) => lines.find((l) => l.inventoryItemId === id),
      add,
      setQty,
      remove,
      clear,
      toWire: () => lines.map((l) => ({ inventoryItemId: l.inventoryItemId, qty: l.qty, ...(l.supplierId ? { supplierId: l.supplierId } : {}) })),
      summary: {
        suppliers: new Set(lines.flatMap((l) => (l.supplierId ? [l.supplierId] : []))).size,
        total: priced.length === 0 ? null : priced.reduce((sum, l) => sum + Number.parseFloat(l.unitPrice as string) * Number.parseFloat(l.qty), 0),
      },
    };
  }, [lines, add, setQty, remove, clear]);
}
