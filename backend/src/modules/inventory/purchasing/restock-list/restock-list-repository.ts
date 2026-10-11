/** "Review and send": database access only. Every query carries `siteId` (the hub; column `organization_id`). */
import { prisma } from '../../../../config/database';
import type { ItemFacts } from '../attendant/attendant-logic';

export const restockListRepository = {
  /** The items on the list, with the units and preferred supplier that decide the default supplier and the price. */
  findItems: (siteId: string, ids: readonly string[]): Promise<ItemFacts[]> =>
    prisma.inventoryItem.findMany({
      where: { siteId, deletedAt: null, id: { in: [...ids] } },
      select: { id: true, name: true, usageUnit: true, buyUnit: true, packSize: true, preferredSupplierId: true },
    }),
};
