import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { AuditFilter, Scope } from '../audit-log-repository';
import { PERSON, rangeOn } from './source';

/**
 * Central Store waste, read from the `waste_logs` rows: Logged (`createdAt`, by `loggedBy`) and Reversed (`reversedAt`, by
 * `reversedBy`). A branch department's waste belongs to its own branch and is the Branch waste area, not this one.
 */
export type WasteEntryKind = 'LOGGED' | 'REVERSED';

const TIME = { LOGGED: 'createdAt', REVERSED: 'reversedAt' } as const;
const ACTOR = { LOGGED: 'loggedById', REVERSED: 'reversedById' } as const;

const where = (scope: Scope, f: AuditFilter, kind: WasteEntryKind): Prisma.WasteLogWhereInput => {
  const range = rangeOn(TIME[kind], f);
  const set = Object.keys(range).length > 0 ? range : kind === 'REVERSED' ? { reversedAt: { not: null } } : {};
  return { siteId: scope.hubId, ...set, ...(f.actorId ? { [ACTOR[kind]]: f.actorId } : {}) };
};

export const wasteAuditRepository = {
  entries: (scope: Scope, f: AuditFilter, kind: WasteEntryKind, take: number) =>
    prisma.wasteLog.findMany({
      where: where(scope, f, kind),
      select: {
        id: true,
        quantity: true,
        unitCost: true,
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
  count: (scope: Scope, f: AuditFilter, kind: WasteEntryKind) => prisma.wasteLog.count({ where: where(scope, f, kind) }),

  actorIds: async (scope: Scope, range: Pick<AuditFilter, 'from' | 'to'>): Promise<string[]> => {
    const [loggers, reversers] = await Promise.all([
      prisma.wasteLog.findMany({ where: where(scope, range, 'LOGGED'), select: { loggedById: true }, distinct: ['loggedById'] }),
      prisma.wasteLog.findMany({ where: where(scope, range, 'REVERSED'), select: { reversedById: true }, distinct: ['reversedById'] }),
    ]);
    return [...new Set([...loggers.map((r) => r.loggedById), ...reversers.flatMap((r) => (r.reversedById ? [r.reversedById] : []))])];
  },
};
