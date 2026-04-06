import { OrderStatus, PrepStation, PrepTicketStatus, Prisma } from '@prisma/client';
import type { PrepTicketItemSnapshot } from '../types/order.types';

interface ItemWithPrice {
  unitPrice: Prisma.Decimal;
  quantity: number;
}

interface ItemWithStation {
  category: {
    prepStation: PrepStation;
  };
}

interface SnapshotSourceItem {
  menuItemId: string;
  name: string;
  quantity: number;
  notes: string | null;
  category: {
    prepStation: PrepStation;
  };
}

interface TicketWithStatus {
  status: PrepTicketStatus;
}

export const calculateOrderTotals = (
  items: ItemWithPrice[],
  deliveryFee: Prisma.Decimal,
): { subtotal: Prisma.Decimal; total: Prisma.Decimal } => {
  const subtotal = items.reduce(
    (sum, item) => sum.plus(item.unitPrice.mul(item.quantity)),
    new Prisma.Decimal(0),
  );

  return {
    subtotal,
    total: subtotal.plus(deliveryFee),
  };
};

export const deriveStationsFromItems = (items: ItemWithStation[]): PrepStation[] => {
  return [...new Set(items.map((item) => item.category.prepStation))];
};

export const buildPrepTicketItemsSnapshot = (
  items: SnapshotSourceItem[],
  station: PrepStation,
): PrepTicketItemSnapshot[] => {
  return items
    .filter((item) => item.category.prepStation === station)
    .map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      notes: item.notes,
    }));
};

/**
 * Returns one snapshot array per order-item line for a given station.
 * Each snapshot contains exactly one item — one ticket per line item.
 * This enables parallel prep and per-item status tracking on the waiter view.
 */
export const buildPerItemTicketSnapshots = (
  items: SnapshotSourceItem[],
  station: PrepStation,
): PrepTicketItemSnapshot[][] => {
  return items
    .filter((item) => item.category.prepStation === station)
    .map((item) => ([
      {
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        notes: item.notes,
      },
    ]));
};

export const deriveOrderStatus = (tickets: TicketWithStatus[]): OrderStatus => {
  if (tickets.length === 0 || tickets.every((ticket) => ticket.status === 'PENDING')) {
    return OrderStatus.PENDING;
  }

  if (tickets.every((ticket) => ticket.status === 'READY')) {
    return OrderStatus.READY;
  }

  return OrderStatus.IN_PROGRESS;
};

