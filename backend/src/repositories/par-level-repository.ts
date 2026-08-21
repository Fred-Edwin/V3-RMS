import type { ParLevel } from '@prisma/client';
import { prisma } from '../config/database';

/**
 * Read-only lookup used by Requisition (Session 2) to compute suggested
 * quantities (par - on-hand). Full set/update CRUD is Session 3 scope.
 */
export const parLevelRepository = {
  findByLocationAndItem: async (locationId: string, inventoryItemId: string): Promise<ParLevel | null> => {
    return prisma.parLevel.findUnique({
      where: { locationId_inventoryItemId: { locationId, inventoryItemId } },
    });
  },
};
