import { prisma } from '../../../../config/database';

/**
 * Read-only: what a person still has open in their own job when their shift ends (Chapter 6, step 6). Orders, prep
 * tickets and dispatches belong to other modules; attendance only reads them, and only for the person's own site.
 */
export const leftoversRepository = {
  /** Orders the person took that are not closed or cancelled and not yet paid. */
  openOrders: (siteId: string, userId: string) =>
    prisma.order.findMany({
      where: { siteId, createdById: userId, paidAt: null, status: { notIn: ['CLOSED', 'CANCELLED'] } },
      select: { id: true, dailyNumber: true, tableNumber: true, total: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),

  /** Prep tickets the person claimed that are still open. */
  openTickets: (siteId: string, userId: string) =>
    prisma.prepTicket.findMany({
      where: { siteId, claimedById: userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      select: { id: true, station: true, status: true },
      orderBy: { claimedAt: 'asc' },
      take: 50,
    }),

  /** Dispatches the person is packing that have not been signed off yet (the hub owns the dispatch, so `siteId` is the hub). */
  packingDispatches: (siteId: string, userId: string) =>
    prisma.dispatch.findMany({
      where: { siteId, packedById: userId, status: { in: ['TO_PACK', 'PACKING'] } },
      select: { id: true, reference: true, toSiteId: true },
      orderBy: { packedAt: 'asc' },
      take: 50,
    }),

  siteNames: async (ids: readonly string[]): Promise<Map<string, string>> => {
    const rows = ids.length ? await prisma.site.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } }) : [];
    return new Map(rows.map((row) => [row.id, row.name] as const));
  },
};
