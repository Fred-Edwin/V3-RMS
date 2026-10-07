import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Reads of the stock position that more than one sub-module needs. On-hand is always derived from the ledger
 * (Σ `InventoryTransaction.quantity` per location and item), never stored. Every query carries the site id.
 */
export const stockRepository = {
  /** One item's on-hand at one location. */
  onHandForItem: async (siteId: string, locationId: string, inventoryItemId: string, client: Client = prisma): Promise<Prisma.Decimal> => {
    const result = await client.inventoryTransaction.aggregate({
      where: { siteId, locationId, inventoryItemId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? new Prisma.Decimal(0);
  },
};
