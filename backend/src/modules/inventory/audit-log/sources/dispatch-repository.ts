import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { AuditFilter, Scope } from '../audit-log-repository';
import { branchSitesOf } from './requisitions-repository';
import { rangeOn } from './source';

/**
 * Dispatch events, read for the Audit log's DISPATCH area. A dispatch belongs to the hub and is addressed to a branch, so the scope is
 * the dispatch's receiving branch (the one named by the Branch filter, or every active branch; a Branch Manager's is forced to their
 * own). The three events about gaps (opened, finding recorded or reversed) are the DISCREPANCIES area's: the same moment is not
 * listed twice.
 */
export const DISPATCH_AUDIT_TYPES = ['SIGNED_AND_SENT', 'CANCELLED', 'DELIVERY_CONFIRMED', 'DELIVERY_CONFIRMED_ON_BEHALF', 'CLOSED'] as const;

const where = (scope: Scope, f: AuditFilter): Prisma.DispatchEventWhereInput => ({
  type: { in: [...DISPATCH_AUDIT_TYPES] },
  dispatch: { siteId: scope.hubId, toSiteId: { in: branchSitesOf(scope) } },
  ...rangeOn('at', f),
  ...(f.actorId ? { actorId: f.actorId } : {}),
});

export const dispatchAuditRepository = {
  entries: (scope: Scope, f: AuditFilter, take: number) =>
    prisma.dispatchEvent.findMany({
      where: where(scope, f),
      select: {
        id: true,
        type: true,
        at: true,
        reason: true,
        actorRoleLabel: true,
        actor: { select: { id: true, name: true } },
        dispatch: {
          select: {
            id: true,
            reference: true,
            department: { select: { name: true } },
            toSite: { select: { name: true } },
            carrier: { select: { name: true } },
            _count: { select: { lines: true } },
          },
        },
      },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take,
    }),

  count: (scope: Scope, f: AuditFilter): Promise<number> => prisma.dispatchEvent.count({ where: where(scope, f) }),

  actorIds: async (scope: Scope, range: Pick<AuditFilter, 'from' | 'to'>): Promise<string[]> => {
    const rows = await prisma.dispatchEvent.findMany({ where: where(scope, range), select: { actorId: true }, distinct: ['actorId'] });
    return rows.map((r) => r.actorId);
  },
};
