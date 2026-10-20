import { nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import { applicationsRepository } from '../data/applications-repository';
import { dbOf, peopleRepository } from '../data/people-repository';
import { COMING_UP_DAYS } from '../leave.constants';
import { addDays } from '../../_shared/time/nairobi-time';
import { roleWord } from '../leave-words';

export interface OnLeaveToday {
  count: number;
  people: { employeeId: string; name: string; roleLabel: string; departmentId: string | null; end: NairobiDate }[];
}

/**
 * Who is on approved leave at a site on a day, optionally only some departments (a head's board). Used by the Today board's
 * "On leave" tile and Home's On leave number; the caller has already checked the viewer's scope.
 */
export async function onLeaveAt(siteId: string, companyId: string, date: NairobiDate, departmentIds: readonly string[] | null): Promise<OnLeaveToday> {
  const apps = await applicationsRepository.approvedBetween(dbOf(), { companyId, siteId }, date, date);
  const people = await peopleRepository.byIds(companyId, [...new Set(apps.map((a) => a.employeeId))]);
  const rows = people
    .filter((p) => !departmentIds || (p.departmentId !== null && departmentIds.includes(p.departmentId)))
    .map((p) => ({ employeeId: p.id, name: p.name, roleLabel: p.positionName ?? roleWord(p.role), departmentId: p.departmentId, end: (apps.find((a) => a.employeeId === p.id) as { end: NairobiDate }).end }));
  return { count: rows.length, people: rows };
}

/** "Coming up": approved leave starting within the next 14 days at a site (names with roles and dates). */
export async function comingUp(siteId: string, companyId: string, now: Date, departmentIds: readonly string[] | null) {
  const today = nairobiToday(now);
  const apps = (await applicationsRepository.approvedBetween(dbOf(), { companyId, siteId }, addDays(today, 1), addDays(today, COMING_UP_DAYS))).filter((a) => a.start > today);
  const people = new Map((await peopleRepository.byIds(companyId, apps.map((a) => a.employeeId))).map((p) => [p.id, p] as const));
  return apps.flatMap((a) => {
    const p = people.get(a.employeeId);
    if (!p || (departmentIds && (p.departmentId === null || !departmentIds.includes(p.departmentId)))) return [];
    return [{ employeeId: p.id, name: p.name, roleLabel: p.positionName ?? roleWord(p.role), start: a.start, end: a.end, days: a.days }];
  });
}
