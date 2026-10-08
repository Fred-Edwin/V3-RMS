import type { Prisma } from '@prisma/client';
import type { ItemStockStatus } from './stock-contract';

/**
 * The status of an item at the Central Store (S2, S5), from what the ledger holds and the restock level set there:
 *  - NEGATIVE when on hand is below zero;
 *  - OUT when on hand is exactly zero and a restock level is set;
 *  - LOW when on hand is above zero but under the level;
 *  - OK otherwise (including an item with no level).
 */
export const itemStockStatus = (onHand: Prisma.Decimal, restockLevel: Prisma.Decimal | null): ItemStockStatus => {
  if (onHand.isNegative() && !onHand.isZero()) return 'NEGATIVE';
  if (onHand.isZero()) return restockLevel !== null ? 'OUT' : 'OK';
  if (restockLevel !== null && onHand.lessThan(restockLevel)) return 'LOW';
  return 'OK';
};

/** "Low · restock level 180 kg", "Out · restock level 30 kg", "Negative · need a count", "OK". */
export const stockStatusText = (status: ItemStockStatus, restockLevel: Prisma.Decimal | null, unit: string): string => {
  const level = restockLevel !== null ? ` · restock level ${restockLevel.toFixed()} ${unit}` : '';
  switch (status) {
    case 'NEGATIVE':
      return `Negative${level || ' · needs a count'}`;
    case 'OUT':
      return `Out${level}`;
    case 'LOW':
      return `Low${level}`;
    default:
      return restockLevel !== null ? `OK${level}` : 'OK · no restock level set';
  }
};
