import type { ConductNotice, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { nairobiToday, toDateColumn, addDays } from '../../_shared/time/nairobi-time';
import { ACTIVE_STATUSES } from '../_shared/conduct-status';

export type Bucket = 'active' | 'appealed' | 'ended';

/** Which notices a reader's list may hold. `employeeIds` is the people filed at the reader's site now (C26); null for a company-wide reader. */
export interface ListScope {
  companyId: string;
  siteId: string | null; // one site: the reader's own, or the one HR/the Director picked; null = every site
  employeeIdsAtSite: readonly string[] | null; // with siteId, also notices about people who work there now
  nameMatchIds: readonly string[] | null; // type-ahead on the person's name, resolved from the employee file; null = no search
}

const LIVE = ACTIVE_STATUSES.filter((status) => status !== 'APPEALED');

function scopeWhere(scope: ListScope): Prisma.ConductNoticeWhereInput {
  const parts: Prisma.ConductNoticeWhereInput[] = [{ companyId: scope.companyId }];
  if (scope.siteId) parts.push({ OR: [{ siteId: scope.siteId }, ...(scope.employeeIdsAtSite ? [{ employeeId: { in: [...scope.employeeIdsAtSite] } }] : [])] });
  if (scope.nameMatchIds) parts.push({ employeeId: { in: [...scope.nameMatchIds] } });
  return { AND: parts };
}

/** The chip a notice sits under today: Active (live, inside its end date), Appealed (with HR), Ended (ended, replaced or withdrawn, or live past its end date). */
function bucketWhere(bucket: Bucket, today: Date): Prisma.ConductNoticeWhereInput {
  if (bucket === 'appealed') return { status: 'APPEALED' };
  if (bucket === 'active') return { status: { in: [...LIVE] }, validUntil: { gte: today } };
  return { OR: [{ status: { in: ['ENDED', 'REPLACED', 'WITHDRAWN'] } }, { status: { in: [...LIVE] }, validUntil: { lt: today } }] };
}

/** Lists and counts for the manager, HR and Director screen. Read only; every query is scoped by the company and the site (spec S8). */
export const listRepository = {
  async page(scope: ListScope, bucket: Bucket, now: Date, page: number, pageSize: number): Promise<{ rows: ConductNotice[]; total: number }> {
    const where: Prisma.ConductNoticeWhereInput = { AND: [scopeWhere(scope), bucketWhere(bucket, toDateColumn(nairobiToday(now)))] };
    const [rows, total] = await Promise.all([
      prisma.conductNotice.findMany({ where, orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.conductNotice.count({ where }),
    ]);
    return { rows, total };
  },

  /** The chip counts and the KPI figures in one pass over the scope. */
  async counts(scope: ListScope, now: Date) {
    const today = toDateColumn(nairobiToday(now));
    const soon = toDateColumn(addDays(nairobiToday(now), 30));
    const base = scopeWhere(scope);
    const active = { AND: [base, bucketWhere('active', today)] };
    const [activeCount, written, endingIn30, appealed, ended, next] = await Promise.all([
      prisma.conductNotice.count({ where: active }),
      prisma.conductNotice.count({ where: { AND: [active, { level: { in: ['WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING'] } }] } }),
      prisma.conductNotice.count({ where: { AND: [active, { validUntil: { lte: soon } }] } }),
      prisma.conductNotice.count({ where: { AND: [base, bucketWhere('appealed', today)] } }),
      prisma.conductNotice.count({ where: { AND: [base, bucketWhere('ended', today)] } }),
      prisma.conductNotice.findFirst({ where: active, orderBy: [{ validUntil: 'asc' }, { id: 'asc' }] }),
    ]);
    return { active: activeCount, written, endingIn30, appealed, ended, next };
  },
};
