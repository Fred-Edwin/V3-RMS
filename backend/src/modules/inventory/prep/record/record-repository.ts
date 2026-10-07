import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { stockRepository } from '../../stock/_shared/stock-repository';

type Client = typeof prisma | Prisma.TransactionClient;

export const recordRepository = {
  /** The hub's Central Store location: where prep stock moves. */
  findCentralStore: (siteId: string): Promise<{ id: string; siteId: string } | null> =>
    prisma.location.findFirst({ where: { siteId, type: 'CENTRAL_STORE' }, select: { id: true, siteId: true } }),

  /** On-hand per item at the location, read from the ledger (inside the record transaction when one is passed). */
  onHandByItem: async (siteId: string, locationId: string, itemIds: string[], client: Client = prisma): Promise<Map<string, Prisma.Decimal>> => {
    const entries = await Promise.all(
      itemIds.map(async (id) => [id, await stockRepository.onHandForItem(siteId, locationId, id, client)] as const),
    );
    return new Map(entries);
  },
};
