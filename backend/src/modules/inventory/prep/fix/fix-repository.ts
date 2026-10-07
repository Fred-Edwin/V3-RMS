import { Prisma } from '@prisma/client';
import { prepRunRepository } from '../_shared/prep-run-repository';

/**
 * Reads that only Fix a slip needs. The writes (lock, close, create the replacement) are in `_shared/prep-run-repository.ts`
 * because the run table is shared; the ledger itself is written only through `postStockMovement`.
 */
export const fixRepository = {
  /** What undoing a run would do to each item's stock: the sum of the run's unreversed ledger rows, per item (negative for inputs, positive for the output). */
  netEffectByItem: async (siteId: string, runId: string): Promise<Map<string, Prisma.Decimal>> => {
    const rows = await prepRunRepository.findReversibleRows(siteId, runId);
    const net = new Map<string, Prisma.Decimal>();
    for (const row of rows) net.set(row.inventoryItemId, (net.get(row.inventoryItemId) ?? new Prisma.Decimal(0)).plus(row.quantity));
    return net;
  },
};
