import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { AuditFilter, Scope } from '../audit-log-repository';
import { branchSitesOf } from './requisitions-repository';
import { PERSON, rangeOn } from './source';

/**
 * Branch waste, read from the `waste_logs` rows of a branch's department locations: Logged (`createdAt`, by `loggedBy`) and Reversed
 * (`reversedAt`, by `reversedBy`). The scope is the branches the Branch filter names (every active branch, or the Branch Manager's own),
 * never the hub, whose waste is the Central Store `WASTE` area.
 */
export type BranchWasteEntryKind = 'LOGGED' | 'REVERSED';

const TIME = { LOGGED: 'createdAt', REVERSED: 'reversedAt' } as const;
const ACTOR = { LOGGED: 'loggedById', REVERSED: 'reversedById' } as const;

const where = (scope: Scope, f: AuditFilter, kind: BranchWasteEntryKind): Prisma.WasteLogWhereInput => {
  const range = rangeOn(TIME[kind], f);
  const set = Object.keys(range).length > 0 ? range : kind === 'REVERSED' ? { reversedAt: { not: null } } : {};
  return { siteId: { in: branchSitesOf(scope) }, location: { type: 'BRANCH_DEPARTMENT' }, ...set, ...(f.actorId ? { [ACTOR[kind]]: f.actorId } : {}) };
};

export const branchWasteAuditRepository = {
  entries: (scope: Scope, f: AuditFilter, kind: BranchWasteEntryKind, take: number) =>
    prisma.wasteLog.findMany({
      where: where(scope, f, kind),
      select: {
        id: true,
        quantity: true,
        reason: true,
        createdAt: true,
        reversedAt: true,
        reversalReason: true,
        reversalNote: true,
        inventoryItem: { select: { id: true, name: true, usageUnit: true } },
        loggedBy: PERSON,
        reversedBy: PERSON,
      },
      orderBy: [{ [TIME[kind]]: 'desc' as const }, { id: 'desc' as const }],
      take,
    }),
  count: (scope: Scope, f: AuditFilter, kind: BranchWasteEntryKind) => prisma.wasteLog.count({ where: where(scope, f, kind) }),

  actorIds: async (scope: Scope, range: Pick<AuditFilter, 'from' | 'to'>): Promise<string[]> => {
    const [loggers, reversers] = await Promise.all([
      prisma.wasteLog.findMany({ where: where(scope, range, 'LOGGED'), select: { loggedById: true }, distinct: ['loggedById'] }),
      prisma.wasteLog.findMany({ where: where(scope, range, 'REVERSED'), select: { reversedById: true }, distinct: ['reversedById'] }),
    ]);
    return [...new Set([...loggers.map((r) => r.loggedById), ...reversers.flatMap((r) => (r.reversedById ? [r.reversedById] : []))])];
  },
};
