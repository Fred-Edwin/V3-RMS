import type { MyRow } from '../../../_shared/types/leave-types';

export interface HistoryCounts {
  all: number;
  waiting: number;
  approved: number;
  declined: number;
  /** Days of approved leave that are over or under way (paid and unpaid), for the header's TAKEN. */
  takenDays: number;
}

/** The tab counts and header figures from the year's rows. A cancelled request counts in All only. */
export function countsOf(rows: readonly MyRow[]): HistoryCounts {
  return {
    all: rows.length,
    waiting: rows.filter((r) => r.status === 'WAITING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    declined: rows.filter((r) => r.status === 'DECLINED').length,
    takenDays: rows.filter((r) => r.phase === 'TAKEN' || r.phase === 'ON_LEAVE').reduce((sum, r) => sum + r.days, 0),
  };
}
