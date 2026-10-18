import { prisma } from '../../../../config/database';
import type { OvertimeRow } from '../timesheets.types';

export type OvertimeEvidence = OvertimeRow['evidence'];

/**
 * Read-only: what the person was doing in the extra time (Chapter 8, step 3). Orders and prep tickets belong to other
 * modules; this only counts them, for the person's own site. "No activity recorded" makes declining the obvious choice.
 * Order value is shown to the manager (`valueOfOrders`) but never stored and never part of any pay formula.
 */
export const evidenceRepository = {
  /** Counts for one person between the scheduled end and the moment they clocked out. */
  counts: async (siteId: string, userId: string, endsAt: Date, leftAt: Date): Promise<Omit<OvertimeEvidence, 'openWorkAtEnd'> & { openWorkAtEnd: boolean }> => {
    const [ordersTaken, openOrdersAtEnd, ticketsCleared, openTicketsAtEnd] = await Promise.all([
      prisma.order.count({ where: { siteId, createdById: userId, createdAt: { gt: endsAt, lte: leftAt } } }),
      prisma.order.count({ where: { siteId, createdById: userId, createdAt: { lte: endsAt }, status: { notIn: ['CANCELLED'] }, OR: [{ paidAt: null }, { paidAt: { gt: endsAt } }] } }),
      prisma.prepTicket.count({ where: { siteId, claimedById: userId, readyAt: { gt: endsAt, lte: leftAt } } }),
      prisma.prepTicket.count({ where: { siteId, claimedById: userId, claimedAt: { lte: endsAt }, OR: [{ readyAt: null }, { readyAt: { gt: endsAt } }] } }),
    ]);
    return { ordersTaken, openOrdersAtEnd, ticketsCleared, openWorkAtEnd: openOrdersAtEnd + openTicketsAtEnd > 0 };
  },

  /** The takings of the orders taken in the extra time, as text for the screen only (evidence, not pay). */
  valueOfOrders: async (siteId: string, userId: string, endsAt: Date, leftAt: Date): Promise<string> => {
    const sum = await prisma.order.aggregate({ where: { siteId, createdById: userId, status: { not: 'CANCELLED' }, createdAt: { gt: endsAt, lte: leftAt } }, _sum: { total: true } });
    return (sum._sum.total ?? 0).toString();
  },
};
