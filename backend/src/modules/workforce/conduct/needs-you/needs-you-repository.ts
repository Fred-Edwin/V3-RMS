import type { ConductNotice } from '@prisma/client';
import { prisma } from '../../../../config/database';

/** What waits for someone, read from the notices themselves so an answered item disappears by itself (no stored "waiting" table). */
export const conductNeedsYouRepository = {
  /** Notices a person has been given and not yet signed. */
  toSign: (userId: string, siteIds: readonly string[]): Promise<ConductNotice[]> =>
    prisma.conductNotice.findMany({ where: { personUserId: userId, status: 'ISSUED', siteId: { in: [...siteIds] } }, orderBy: { issuedAt: 'asc' }, take: 50 }),

  /** Notices this issuer must still record as not signed: issued, past the sign limit, or to a person with no login. */
  toRecord: (issuerId: string, siteIds: readonly string[]): Promise<ConductNotice[]> =>
    prisma.conductNotice.findMany({ where: { issuerId, status: 'ISSUED', level: { not: 'VERBAL_NOTE' }, siteId: { in: [...siteIds] } }, orderBy: { issuedAt: 'asc' }, take: 100 }),

  /** Appeals waiting for a decision. `byHr` picks the notices HR issued (the Director decides) or the others (HR decides). */
  appealsWaiting: (args: { byHr: boolean; siteIds: readonly string[]; excludeUserId: string }): Promise<ConductNotice[]> =>
    prisma.conductNotice.findMany({
      where: {
        status: 'APPEALED',
        siteId: { in: [...args.siteIds] },
        issuerRole: args.byHr ? 'HR' : { not: 'HR' },
        issuerId: { not: args.excludeUserId },
        OR: [{ personUserId: null }, { personUserId: { not: args.excludeUserId } }],
      },
      orderBy: { appealedAt: 'asc' },
      take: 100,
    }),

  /** Appeals past their decision day anywhere in the company (the Director's Overdue list). */
  overdueAppeals: (siteIds: readonly string[], now: Date): Promise<ConductNotice[]> =>
    prisma.conductNotice.findMany({ where: { status: 'APPEALED', siteId: { in: [...siteIds] }, appealDecisionDueBy: { lt: now } }, orderBy: { appealDecisionDueBy: 'asc' }, take: 100 }),
};
