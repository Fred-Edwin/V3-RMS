import type { ConductNotice } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { nairobiToday, toDateColumn } from '../../_shared/time/nairobi-time';

/** What the daily job looks for, company wide (the job runs for the whole company; each change it makes is scoped by the notice's own ids). */
export const sweepRepository = {
  /** Live notices past their end date: the job marks them ENDED. An appealed notice stands until decided, so it is never listed. */
  endable: (now: Date, take: number): Promise<ConductNotice[]> =>
    prisma.conductNotice.findMany({
      where: { status: { in: ['ISSUED', 'RECORDED', 'SIGNED', 'GIVEN_NOT_SIGNED', 'KEPT'] }, validUntil: { lt: toDateColumn(nairobiToday(now)) } },
      orderBy: { validUntil: 'asc' },
      take,
    }),

  /** Appeals HR has not decided by the due moment, not yet told to the Director. */
  overdueAppeals: (now: Date, take: number): Promise<ConductNotice[]> =>
    prisma.conductNotice.findMany({ where: { status: 'APPEALED', appealDecisionDueBy: { lt: now }, overdueToldAt: null }, orderBy: { appealDecisionDueBy: 'asc' }, take }),

  /** "Given, not signed" notices whose witness has not answered by the cutoff. */
  silentWitnesses: (cutoff: Date, take: number): Promise<ConductNotice[]> =>
    prisma.conductNotice.findMany({
      where: { status: 'GIVEN_NOT_SIGNED', witnessId: { not: null }, witnessConfirmedAt: null, witnessDeclinedAt: null, witnessAskedAt: { lt: cutoff } },
      orderBy: { witnessAskedAt: 'asc' },
      take,
    }),
};
