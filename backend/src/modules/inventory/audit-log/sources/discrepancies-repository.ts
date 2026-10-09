import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { AuditFilter, Scope } from '../audit-log-repository';
import { branchSitesOf } from './requisitions-repository';
import { rangeOn } from './source';

/**
 * Discrepancy events (opened, finding recorded, finding reversed), read for the Audit log's DISCREPANCIES area. A discrepancy is
 * addressed to the branch that counted, so the scope is its receiving branch (the Branch filter's, or every active branch; a Branch
 * Manager's is forced to their own).
 */
const where = (scope: Scope, f: AuditFilter): Prisma.DiscrepancyEventWhereInput => ({
  discrepancy: { siteId: scope.hubId, toSiteId: { in: branchSitesOf(scope) } },
  ...rangeOn('at', f),
  ...(f.actorId ? { actorId: f.actorId } : {}),
});

export const discrepanciesAuditRepository = {
  entries: (scope: Scope, f: AuditFilter, take: number) =>
    prisma.discrepancyEvent.findMany({
      where: where(scope, f),
      select: {
        id: true,
        type: true,
        at: true,
        finding: true,
        note: true,
        reason: true,
        actorRoleLabel: true,
        actor: { select: { id: true, name: true } },
        discrepancy: { select: { id: true, reference: true, gapQty: true, dispatchLine: { select: { item: { select: { name: true, usageUnit: true } } } } } },
      },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take,
    }),

  count: (scope: Scope, f: AuditFilter): Promise<number> => prisma.discrepancyEvent.count({ where: where(scope, f) }),

  actorIds: async (scope: Scope, range: Pick<AuditFilter, 'from' | 'to'>): Promise<string[]> => {
    const rows = await prisma.discrepancyEvent.findMany({ where: where(scope, range), select: { actorId: true }, distinct: ['actorId'] });
    return rows.map((r) => r.actorId);
  },
};
