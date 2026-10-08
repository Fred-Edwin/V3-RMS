import { Prisma, type WasteReversalReason } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { wasteLogInclude, type WasteLogRow } from '../_shared/waste-row';

type Tx = Prisma.TransactionClient;

export const reverseRepository = {
  findLog: async (siteId: string, id: string, client: Tx | typeof prisma = prisma): Promise<WasteLogRow | null> => {
    return client.wasteLog.findFirst({ where: { id, siteId }, include: wasteLogInclude });
  },

  /** Holds the entry's row until the transaction ends, so two people reversing it at once cannot both pass the checks. */
  lockLog: async (tx: Tx, siteId: string, id: string): Promise<void> => {
    await tx.$queryRaw`SELECT id FROM waste_logs WHERE id = ${id} AND organization_id = ${siteId} FOR UPDATE`;
  },

  /** The entry's own WASTE ledger row: the one that is not itself a reversal. */
  findWasteLedgerRow: async (tx: Tx, siteId: string, wasteLogId: string) => {
    return tx.inventoryTransaction.findFirst({
      where: { siteId, wasteLogId, type: 'WASTE', reversesTransactionId: null },
      select: { id: true, locationId: true, inventoryItemId: true, quantity: true, unitCost: true },
    });
  },

  stampReversal: async (
    tx: Tx,
    siteId: string,
    id: string,
    data: { reversedAt: Date; reversedById: string; reversalReason: WasteReversalReason; reversalNote: string | null },
  ): Promise<WasteLogRow> => {
    await tx.wasteLog.updateMany({ where: { id, siteId, reversedAt: null }, data });
    return tx.wasteLog.findFirstOrThrow({ where: { id, siteId }, include: wasteLogInclude });
  },
};
