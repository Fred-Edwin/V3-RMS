import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { AuditFilter, Scope } from '../audit-log-repository';
import { PERSON, rangeOn } from './source';

/**
 * Stock counts, read from the `counts` rows themselves: a count is Signed when the counter signs it (`signedAt`), and Approved
 * when the Manager approves it (`approvedAt`). A count the Manager signed themselves is approved on the spot, so it is one
 * "Signed and applied" entry (kind APPROVED with `selfSigned`), never two.
 */
export type CountEntryKind = 'SIGNED' | 'APPROVED';

const TIME = { SIGNED: 'signedAt', APPROVED: 'approvedAt' } as const;

const where = (scope: Scope, f: AuditFilter, kind: CountEntryKind): Prisma.CountWhereInput => {
  const range = rangeOn(TIME[kind], f);
  // A range on the time field already excludes the null rows; with an open range the field must still be set.
  const set = Object.keys(range).length > 0 ? range : { [TIME[kind]]: { not: null } };
  return kind === 'SIGNED'
    ? { siteId: scope.hubId, selfSigned: false, ...set, ...(f.actorId ? { counterId: f.actorId } : {}) }
    : { siteId: scope.hubId, ...set, ...(f.actorId ? { approverId: f.actorId } : {}) };
};

export const stockCountsRepository = {
  entries: (scope: Scope, f: AuditFilter, kind: CountEntryKind, take: number) =>
    prisma.count.findMany({
      where: where(scope, f, kind),
      select: {
        id: true,
        reference: true,
        selfSigned: true,
        signedAt: true,
        approvedAt: true,
        counter: PERSON,
        approver: PERSON,
        scopeSections: { orderBy: { sectionName: 'asc' }, select: { sectionName: true } },
        lines: { orderBy: { position: 'asc' }, select: { countedQty: true, inventoryItem: { select: { name: true } } } },
      },
      orderBy: [{ [TIME[kind]]: 'desc' as const }, { id: 'desc' as const }],
      take,
    }),
  count: (scope: Scope, f: AuditFilter, kind: CountEntryKind) => prisma.count.count({ where: where(scope, f, kind) }),

  /** What approving each count posted: how many ledger adjustments, and their net value (signed quantity times the unit cost). */
  adjustmentsOf: async (scope: Scope, countIds: string[]): Promise<Map<string, { adjustments: number; netKes: number }>> => {
    const out = new Map<string, { adjustments: number; netKes: number }>();
    if (countIds.length === 0) return out;
    const rows = await prisma.inventoryTransaction.findMany({
      where: { siteId: scope.hubId, type: 'ADJUSTMENT', countLine: { countId: { in: countIds } } },
      select: { quantity: true, unitCost: true, countLine: { select: { countId: true } } },
    });
    for (const row of rows) {
      const id = row.countLine?.countId;
      if (!id) continue;
      const seen = out.get(id) ?? { adjustments: 0, netKes: 0 };
      seen.adjustments += 1;
      seen.netKes += row.quantity.times(row.unitCost).toNumber();
      out.set(id, seen);
    }
    return out;
  },

  /** Everyone who signed or approved a count in the period. */
  actorIds: async (scope: Scope, range: Pick<AuditFilter, 'from' | 'to'>): Promise<string[]> => {
    const [signers, approvers] = await Promise.all([
      prisma.count.findMany({ where: where(scope, range, 'SIGNED'), select: { counterId: true }, distinct: ['counterId'] }),
      prisma.count.findMany({ where: where(scope, range, 'APPROVED'), select: { approverId: true }, distinct: ['approverId'] }),
    ]);
    return [...new Set([...signers.map((r) => r.counterId), ...approvers.flatMap((r) => (r.approverId ? [r.approverId] : []))])];
  },
};
