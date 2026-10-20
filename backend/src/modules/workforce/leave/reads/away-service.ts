import type { z } from 'zod';
import { ForbiddenError, NotFoundError } from '../../../../utils/errors';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { applicationsRepository } from '../data/applications-repository';
import { dbOf, peopleRepository } from '../data/people-repository';
import type { awayQuery } from '../leave-validators';
import { roleWord } from '../leave-words';

export interface AwayPerson {
  employeeId: string;
  name: string;
  roleLabel: string;
  department: string | null;
  siteId: string;
  applicationId: string;
  start: NairobiDate;
  end: NairobiDate;
  days: number;
}

/**
 * N1 `GET /away`: approved leave touching a range, for the Today board, Home "On leave" and "Coming up". Site readers see their
 * site, company readers every site (or the one asked for), a department head only the departments they head. A site that is not the
 * caller's answers 404. Names always come with a role.
 */
export async function awayBetween(subject: AccessSubject, query: z.infer<typeof awayQuery>): Promise<{ count: number; people: AwayPerson[] }> {
  const scope = scopeOf(subject, 'leave.read');
  if (scope === null || scope === 'own') throw new ForbiddenError('You do not have permission to perform this action');
  const ctx = await resolveActor(subject);
  if (scope !== 'all' && (!subject.siteId || (query.site && query.site !== subject.siteId))) throw new NotFoundError('Not found');
  const siteId = scope === 'all' ? query.site : (subject.siteId as string);
  const apps = await applicationsRepository.approvedBetween(dbOf(), { companyId: ctx.companyId, ...(siteId ? { siteId } : {}) }, query.from, query.to);
  const people = await peopleRepository.byIds(ctx.companyId, [...new Set(apps.map((a) => a.employeeId))]);
  const byId = new Map(people.map((p) => [p.id, p] as const));
  const heads = scope === 'dept' ? new Set(subject.headOfDepartmentIds ?? []) : null;
  const rows: AwayPerson[] = [];
  for (const app of apps) {
    const p = byId.get(app.employeeId);
    if (!p || (heads && (!p.departmentId || !heads.has(p.departmentId)))) continue;
    rows.push({ employeeId: p.id, name: p.name, roleLabel: p.positionName ?? roleWord(p.role), department: p.departmentName, siteId: p.siteId, applicationId: app.id, start: app.start, end: app.end, days: app.days });
  }
  return { count: new Set(rows.map((r) => r.employeeId)).size, people: rows };
}
