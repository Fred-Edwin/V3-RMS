import type { z } from 'zod';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { gridScope } from '../../rota/rota-scope';
import type { Pagination } from '../people.types';
import { teamRepository, type TeamPersonRow, type TeamShiftRow } from './team-repository';
import type { TeamQuerySchema } from './team-validators';

export type TeamQuery = z.infer<typeof TeamQuerySchema>;

export interface TeamMember {
  id: string;
  name: string;
  position: string | null;
  department: string | null;
  /** On shift: a shift is on today's rota. Everyone else is not on shift (a day off, or no rota yet). */
  status: 'ON_SHIFT' | 'NOT_ON_SHIFT';
  /** "06:00 to 14:00", or null with no shift. */
  shift: string | null;
  /** The viewer may write a probation report on this person (on probation, and the viewer holds `probation.note`). */
  canReport: boolean;
}

export interface TeamPage {
  data: TeamMember[];
  pagination: Pagination;
  counts: { all: number; onShift: number; notOnShift: number };
}

export function teamMembers(people: readonly TeamPersonRow[], shifts: readonly TeamShiftRow[], mayReport = false): TeamMember[] {
  const byPerson = new Map<string, TeamShiftRow[]>();
  for (const s of shifts) byPerson.set(s.employeeId, [...(byPerson.get(s.employeeId) ?? []), s]);
  return people.map((p) => {
    const own = byPerson.get(p.id) ?? [];
    return {
      id: p.id,
      name: p.name,
      position: p.positionName,
      department: p.departmentName,
      status: own.length > 0 ? 'ON_SHIFT' : 'NOT_ON_SHIFT',
      shift: own.length > 0 ? own.map((s) => `${s.startTime} to ${s.endTime}`).join(', ') : null,
      canReport: mayReport && p.onProbation,
    };
  });
}

/**
 * My team (frames 9.2, 9.5): the people a head leads, read only. Scope is the rota's: a head sees the departments they head, a Branch
 * or Store Manager their site, HR and above the site they name. Name, position, today's status and shift; nothing about pay or IDs.
 */
export const teamService = {
  async list(subject: AccessSubject, query: TeamQuery, now: Date = new Date()): Promise<TeamPage> {
    const scope = gridScope(subject, 'today.read', query.siteId);
    const today = nairobiToday(now);
    const departmentIds = scope.kind === 'departments' ? scope.departmentIds : null;
    if (departmentIds !== null && departmentIds.length === 0) return { data: [], pagination: { total: 0, page: 1, perPage: query.perPage, totalPages: 1 }, counts: { all: 0, onShift: 0, notOnShift: 0 } };
    const people = await teamRepository.people(scope.siteId, today, departmentIds, query.q);
    const members = teamMembers(people, await teamRepository.shiftsOn(scope.siteId, today, people.map((p) => p.id)), workforceCan(subject, 'probation.note'));
    const counts = { all: members.length, onShift: members.filter((m) => m.status === 'ON_SHIFT').length, notOnShift: members.filter((m) => m.status === 'NOT_ON_SHIFT').length };
    const wanted = query.status === 'on_shift' ? 'ON_SHIFT' : query.status === 'not_on_shift' ? 'NOT_ON_SHIFT' : null;
    const rows = wanted ? members.filter((m) => m.status === wanted) : members;
    const totalPages = Math.max(1, Math.ceil(rows.length / query.perPage));
    const page = Math.min(query.page, totalPages);
    return { data: rows.slice((page - 1) * query.perPage, page * query.perPage), pagination: { total: rows.length, page, perPage: query.perPage, totalPages }, counts };
  },
};
