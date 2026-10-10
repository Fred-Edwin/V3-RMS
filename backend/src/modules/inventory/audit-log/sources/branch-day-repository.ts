import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { AuditFilter, Scope } from '../audit-log-repository';
import { branchSitesOf } from './requisitions-repository';
import { PERSON, rangeOn } from './source';

/**
 * Branch day, read for the Audit log's BRANCH_DAY area from the rows that already say who and when (contract §9): an opening checked
 * (`department_openings`), a count signed (`branch_day_departments`), the day closed (`branch_days`) and a count corrected
 * (`branch_day_corrections`). Printing is never an event. The scope is the branches the Branch filter names (every active branch, or the
 * Branch Manager's own), never the hub.
 */
export type BranchDayEntryKind = 'OPENING' | 'COUNT' | 'CLOSE' | 'CORRECTION';

const range = (field: string, f: Pick<AuditFilter, 'from' | 'to'>, fallback: Record<string, unknown>) => {
  const set = rangeOn(field, f);
  return Object.keys(set).length > 0 ? set : fallback;
};

const openings = (scope: Scope, f: AuditFilter): Prisma.DepartmentOpeningWhereInput => ({
  branchDay: { siteId: { in: branchSitesOf(scope) } },
  ...rangeOn('acceptedAt', f),
  ...(f.actorId ? { acceptedById: f.actorId } : {}),
});
const counts = (scope: Scope, f: AuditFilter): Prisma.BranchDayDepartmentWhereInput => ({
  branchDay: { siteId: { in: branchSitesOf(scope) } },
  status: 'COUNTED',
  ...range('countedAt', f, { countedAt: { not: null } }),
  ...(f.actorId ? { countedById: f.actorId } : {}),
});
const closes = (scope: Scope, f: AuditFilter): Prisma.BranchDayWhereInput => ({
  siteId: { in: branchSitesOf(scope) },
  status: 'CLOSED',
  ...range('closedAt', f, { closedAt: { not: null } }),
  ...(f.actorId ? { closedById: f.actorId } : {}),
});
const corrections = (scope: Scope, f: AuditFilter): Prisma.BranchDayCorrectionWhereInput => ({
  branchDay: { siteId: { in: branchSitesOf(scope) } },
  ...rangeOn('correctedAt', f),
  ...(f.actorId ? { correctedById: f.actorId } : {}),
});

const DAY = { select: { id: true, reference: true, businessDate: true } } as const;

export const branchDayAuditRepository = {
  openings: (scope: Scope, f: AuditFilter, take: number) =>
    prisma.departmentOpening.findMany({
      where: openings(scope, f),
      select: {
        id: true,
        kind: true,
        acceptedAt: true,
        onBehalf: true,
        acceptedBy: PERSON,
        department: { select: { name: true } },
        branchDay: DAY,
        lines: { select: { prefilledQty: true, acceptedQty: true, overnightVariance: true, inventoryItem: { select: { name: true } } } },
      },
      orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }],
      take,
    }),

  counts: (scope: Scope, f: AuditFilter, take: number) =>
    prisma.branchDayDepartment.findMany({
      where: counts(scope, f),
      select: { id: true, countedAt: true, onBehalf: true, countedBy: PERSON, department: { select: { name: true } }, branchDay: DAY, _count: { select: { lines: true } } },
      orderBy: [{ countedAt: 'desc' }, { id: 'desc' }],
      take,
    }),

  closes: (scope: Scope, f: AuditFilter, take: number) =>
    prisma.branchDay.findMany({
      where: closes(scope, f),
      select: { id: true, reference: true, businessDate: true, closedAt: true, closedBy: PERSON },
      orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
      take,
    }),

  corrections: (scope: Scope, f: AuditFilter, take: number) =>
    prisma.branchDayCorrection.findMany({
      where: corrections(scope, f),
      select: {
        id: true,
        correctedAt: true,
        fromClosingQty: true,
        toClosingQty: true,
        reason: true,
        note: true,
        correctedBy: PERSON,
        branchDay: DAY,
        branchDayLine: { select: { inventoryItem: { select: { name: true } }, department: { select: { department: { select: { name: true } } } } } },
      },
      orderBy: [{ correctedAt: 'desc' }, { id: 'desc' }],
      take,
    }),

  count: async (scope: Scope, f: AuditFilter): Promise<number> => {
    const [a, b, c, d] = await Promise.all([
      prisma.departmentOpening.count({ where: openings(scope, f) }),
      prisma.branchDayDepartment.count({ where: counts(scope, f) }),
      prisma.branchDay.count({ where: closes(scope, f) }),
      prisma.branchDayCorrection.count({ where: corrections(scope, f) }),
    ]);
    return a + b + c + d;
  },

  actorIds: async (scope: Scope, r: Pick<AuditFilter, 'from' | 'to'>): Promise<string[]> => {
    const f: AuditFilter = r;
    const [o, c, d, x] = await Promise.all([
      prisma.departmentOpening.findMany({ where: openings(scope, f), select: { acceptedById: true }, distinct: ['acceptedById'] }),
      prisma.branchDayDepartment.findMany({ where: counts(scope, f), select: { countedById: true }, distinct: ['countedById'] }),
      prisma.branchDay.findMany({ where: closes(scope, f), select: { closedById: true }, distinct: ['closedById'] }),
      prisma.branchDayCorrection.findMany({ where: corrections(scope, f), select: { correctedById: true }, distinct: ['correctedById'] }),
    ]);
    return [...new Set([...o.map((r_) => r_.acceptedById), ...c.flatMap((r_) => (r_.countedById ? [r_.countedById] : [])), ...d.flatMap((r_) => (r_.closedById ? [r_.closedById] : [])), ...x.map((r_) => r_.correctedById)])];
  },
};
