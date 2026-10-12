import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { AuditFilter, Scope } from '../audit-log-repository';
import { rangeOn } from './source';

/**
 * Requisition events, read for the Audit log's REQUISITIONS area. These live on the BRANCH site (the first branch-site source of the
 * log), so the sites are the scope's branches: the one named by the Branch filter, or every active branch. Never the hub. A
 * Branch Manager's scope is forced to their own branch by the service before it gets here.
 */
export const branchSitesOf = (scope: Scope): string[] => (scope.branchId ? [scope.branchId] : scope.peopleOrgIds.filter((id) => id !== scope.hubId));

const where = (scope: Scope, f: AuditFilter): Prisma.RequisitionEventWhereInput => ({
  requisition: { siteId: { in: branchSitesOf(scope) } },
  ...rangeOn('at', f),
  ...(f.actorId ? { actorId: f.actorId } : {}),
});

export const requisitionsAuditRepository = {
  entries: async (scope: Scope, f: AuditFilter, take: number) => {
    const events = await prisma.requisitionEvent.findMany({
      where: where(scope, f),
      select: {
        id: true, type: true, at: true, sectionId: true, lineId: true, fromValue: true, toValue: true, reason: true, actorRoleLabel: true,
        actor: { select: { id: true, name: true } },
        requisition: { select: { id: true, reference: true, siteId: true } },
      },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take,
    });
    const sites = branchSitesOf(scope);
    const sectionIds = [...new Set(events.flatMap((e) => (e.sectionId ? [e.sectionId] : [])))];
    const lineIds = [...new Set(events.flatMap((e) => (e.lineId ? [e.lineId] : [])))];
    const [sections, lines] = await Promise.all([
      sectionIds.length === 0
        ? []
        : prisma.requisitionSection.findMany({ where: { id: { in: sectionIds }, requisition: { siteId: { in: sites } } }, select: { id: true, department: { select: { name: true } } } }),
      lineIds.length === 0
        ? []
        : prisma.requisitionLine.findMany({ where: { id: { in: lineIds }, section: { requisition: { siteId: { in: sites } } } }, select: { id: true, item: { select: { name: true, usageUnit: true } } } }),
    ]);
    return {
      events,
      departmentBySection: new Map(sections.map((s) => [s.id, s.department?.name ?? null])),
      lineLabels: new Map(lines.map((l) => [l.id, { itemName: l.item.name, unit: l.item.usageUnit }])),
    };
  },

  count: (scope: Scope, f: AuditFilter): Promise<number> => prisma.requisitionEvent.count({ where: where(scope, f) }),

  actorIds: async (scope: Scope, range: Pick<AuditFilter, 'from' | 'to'>): Promise<string[]> => {
    const rows = await prisma.requisitionEvent.findMany({ where: where(scope, range), select: { actorId: true }, distinct: ['actorId'] });
    return rows.map((r) => r.actorId);
  },
};
