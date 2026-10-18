import { NotFoundError } from '../../../../../utils/errors';
import { toDateColumn } from '../../../_shared/time/nairobi-time';
import { inScope, type AccessSubject } from '../../../_shared/workforce-access';
import { resolveActor, todayOf } from '../../people-context';
import { headsRepository } from '../heads/heads-repository';
import type { CasualPoolPerson, DepartmentPerson, DepartmentView, OrgOverview, SiteBlock } from '../org.types';
import { assertCanReadDepartment, orgReadScope } from '../org-scope';
import { departmentsRepository, type DepartmentRecord } from './departments-repository';
import { summaryOf } from './department-view';

/** O1 and O2: reading the organisation. Writes live in departments-service.ts. */
export const departmentsReadService = {
  /** O1: sites, their departments with heads and gaps, and four counts. Scope trims what is listed. */
  async overview(subject: AccessSubject, includeRetired: boolean, now: Date = new Date()): Promise<OrgOverview> {
    const ctx = await resolveActor(subject);
    const today = toDateColumn(todayOf(now));
    const scope = orgReadScope(subject);
    const sites = await departmentsRepository.sitesOfCompany(ctx.companyId, scope.kind === 'all' ? null : scope.siteId);
    const departments = await departmentsRepository.departmentsOfSites(ctx.companyId, sites.map((s) => s.id), includeRetired, scope.kind === 'departments' ? scope.departmentIds : null);
    const ids = departments.map((d) => d.id);
    const [counts, headRows] = ids.length === 0 ? [new Map<string, number>(), []] : await Promise.all([departmentsRepository.peopleCounts(ctx.companyId, ids), headsRepository.activeRowsOfDepartments(ids, today)]);

    const blocks: SiteBlock[] = sites
      .filter((site) => scope.kind !== 'departments' || departments.some((d) => d.siteId === site.id))
      .map((site) => {
        const list = departments.filter((d) => d.siteId === site.id).map((d) => summaryOf(d, counts.get(d.id) ?? 0, headRows));
        return { id: site.id, name: site.name, type: site.type, isHub: site.isHub, headsAllowed: !site.isHub, departments: list, gaps: list.filter((d) => d.hasGap).length };
      });
    const flat = blocks.flatMap((b) => b.departments);
    return {
      sites: blocks,
      counts: { sites: blocks.length, departments: flat.filter((d) => d.isActive).length, heads: flat.filter((d) => d.head !== null || d.actingHead !== null).length, gaps: flat.filter((d) => d.hasGap).length },
    };
  },

  /** O2: one department with its head, a page of its people and its casual pool. Pool rates only for a pay reader. */
  async getDepartment(subject: AccessSubject, id: string, paging: { page: number; perPage: number }, now: Date = new Date()): Promise<DepartmentView> {
    const ctx = await resolveActor(subject);
    const department = await departmentsRepository.findDepartment(ctx.companyId, id);
    if (!department) throw new NotFoundError('Department not found');
    assertCanReadDepartment(subject, department);
    return buildDepartmentView(subject, ctx.companyId, department, paging, now);
  },
};

export async function buildDepartmentView(
  subject: AccessSubject,
  companyId: string,
  department: DepartmentRecord,
  paging: { page: number; perPage: number },
  now: Date = new Date(),
): Promise<DepartmentView> {
  const today = toDateColumn(todayOf(now));
  const target = { userId: null, siteId: department.siteId, departmentId: department.id };
  const seesRates = inScope(subject, 'payprofile.read', target);
  const [headRows, [people, total], pool, headCount] = await Promise.all([
    headsRepository.activeRowsOfDepartment(department.id, today),
    departmentsRepository.peoplePage(companyId, department.id, (paging.page - 1) * paging.perPage, paging.perPage),
    departmentsRepository.casualPool(companyId, department.id, seesRates),
    departmentsRepository.peopleCount(companyId, department.id),
  ]);
  const headEmployeeIds = new Set(headRows.map((row) => row.employeeId));
  const person = (e: { id: string; userId: string | null; name: string; status: DepartmentPerson['status']; payType: DepartmentPerson['payType']; position: { name: string } | null }): DepartmentPerson => ({
    employeeId: e.id,
    userId: e.userId,
    name: e.name,
    positionName: e.position?.name ?? null,
    status: e.status,
    payType: e.payType,
    isHead: headEmployeeIds.has(e.id),
  });
  const casuals: CasualPoolPerson[] = pool.map((e) => ({ ...person(e), ...(seesRates ? { dailyRate: 'payProfile' in e && e.payProfile?.amount ? e.payProfile.amount.toFixed(2) : null } : {}) }));
  const summary = summaryOf(department, headCount, headRows);
  return {
    ...summary,
    siteName: department.site.name,
    isHub: department.site.isHub,
    positions: department.positions.map((p) => ({ id: p.position.id, name: p.position.name, isActive: p.position.isActive })),
    peoplePage: { items: people.map(person), page: paging.page, perPage: paging.perPage, total },
    casualPool: { total: casuals.length, items: casuals },
    can: {
      edit: inScope(subject, 'org.write', target),
      assignHead: inScope(subject, 'org.write_heads', target) && !department.site.isHub && department.status === 'ACTIVE',
    },
  };
}
