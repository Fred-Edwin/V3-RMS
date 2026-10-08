import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { AuditFilter, Scope } from '../audit-log-repository';
import { PERSON, rangeOn } from './source';

/**
 * Stock adjustments, read from the ledger's `ADJUSTMENT` rows (the `ADJ-####` numbers) of the Central Store. At the hub every
 * adjustment comes from an approved count (or reverses one), so each one is listed on its own here, next to the single
 * "Approved the count" entry in Stock counts that tells how many were posted.
 */
const where = (scope: Scope, f: AuditFilter): Prisma.InventoryTransactionWhereInput => ({
  siteId: scope.hubId,
  type: 'ADJUSTMENT',
  ...rangeOn('createdAt', f),
  ...(f.actorId ? { userId: f.actorId } : {}),
});

export const stockAdjustmentsRepository = {
  entries: (scope: Scope, f: AuditFilter, take: number) =>
    prisma.inventoryTransaction.findMany({
      where: where(scope, f),
      select: {
        id: true,
        quantity: true,
        reason: true,
        reference: true,
        createdAt: true,
        inventoryItem: { select: { name: true, usageUnit: true } },
        user: PERSON,
        reverses: { select: { reference: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    }),
  count: (scope: Scope, f: AuditFilter) => prisma.inventoryTransaction.count({ where: where(scope, f) }),
  actorIds: async (scope: Scope, range: Pick<AuditFilter, 'from' | 'to'>): Promise<string[]> =>
    (await prisma.inventoryTransaction.findMany({ where: where(scope, range), select: { userId: true }, distinct: ['userId'] })).map((r) => r.userId),
};
