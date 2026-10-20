import type { Prisma } from '@prisma/client';
import { addDays, eachDay, weekStart, type NairobiDate } from '../../_shared/time/nairobi-time';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { rulesToday } from '../balances/rules-loader';
import { applicationsRepository } from '../data/applications-repository';
import { coverRepository, type RotaCell } from '../data/cover-repository';
import { dbOf, type LeavePerson } from '../data/people-repository';
import { coverFor, type CoverDay } from '../engine/leave-cover';

export interface CoverView {
  days: CoverDay[];
  team: { id: string; name: string; positionName: string | null }[];
  cells: RotaCell[];
  /** Other people on approved leave per day. */
  leaveByDay: Map<NairobiDate, Set<string>>;
  /** True when the rota is planned for at least one of the days. */
  anyPlanned: boolean;
}

const EMPTY: CoverView = { days: [], team: [], cells: [], leaveByDay: new Map(), anyPlanned: false };

/**
 * Minimum cover for one person's range of days (spec section 6). Reads the department's rota, the team, everyone else's approved
 * leave and the Rules minimum (a site override first). A person with no department has no cover figure. Never blocks anything.
 */
export const loadCover = (person: LeavePerson, from: NairobiDate, to: NairobiDate, now: Date, tx?: Prisma.TransactionClient): Promise<CoverView> =>
  person.departmentId ? loadDepartmentCover({ companyId: person.companyId, siteId: person.siteId, departmentId: person.departmentId, excludeId: person.id }, from, to, now, tx) : Promise.resolve(EMPTY);

export interface CoverScope {
  companyId: string;
  siteId: string;
  departmentId: string;
  /** The person asking, taken out of the count. Null for a whole-department view (the calendar). */
  excludeId: string | null;
}

/** Cover for a department over a range, optionally without one person. */
export async function loadDepartmentCover(scope: CoverScope, from: NairobiDate, to: NairobiDate, now: Date, tx?: Prisma.TransactionClient): Promise<CoverView> {
  const person = { id: scope.excludeId ?? '', siteId: scope.siteId, companyId: scope.companyId, departmentId: scope.departmentId };
  const db = dbOf(tx);
  const [week, rules, team] = await Promise.all([
    getEffectiveRuleGroup(person.siteId, nairobiToday(now), 'WEEK_AND_BREAKS'),
    rulesToday(person.siteId, now),
    coverRepository.team(db, person.siteId, person.departmentId),
  ]);
  const startsOn = week.values.weekStartsOn;
  const cells = await coverRepository.cells(db, person.siteId, person.departmentId, weekStart(from, startsOn), addDays(weekStart(to, startsOn), 6));
  const days = eachDay(from, to);

  const plannedWeeks = new Set(cells.map((cell) => weekStart(cell.date, startsOn)));
  const plannedDays = new Set(days.filter((day) => plannedWeeks.has(weekStart(day, startsOn))));
  const rostered = new Map<NairobiDate, Set<string>>();
  for (const cell of cells) rostered.set(cell.date, (rostered.get(cell.date) ?? new Set<string>()).add(cell.employeeId));

  const others = team.filter((member) => member.id !== person.id).map((member) => member.id);
  const leave = await applicationsRepository.approvedBetween(db, { companyId: person.companyId, employeeIds: others }, from, to);
  const leaveByDay = new Map<NairobiDate, Set<string>>();
  for (const application of leave) {
    for (const day of eachDay(application.start < from ? from : application.start, application.end > to ? to : application.end)) {
      leaveByDay.set(day, (leaveByDay.get(day) ?? new Set<string>()).add(application.employeeId));
    }
  }
  const kept = new Map<NairobiDate, Set<string>>();
  for (const cell of cells) {
    if (cell.overrideReason !== null && leaveByDay.get(cell.date)?.has(cell.employeeId)) kept.set(cell.date, (kept.get(cell.date) ?? new Set<string>()).add(cell.employeeId));
  }

  const minimum = rules.minimumCover[person.departmentId] ?? null;
  const covered = coverFor({ days, minimum, employeeId: person.id, activeIds: team.map((member) => member.id), rostered, plannedDays, onLeave: leaveByDay, keptOnRota: kept });
  return { days: covered, team, cells, leaveByDay, anyPlanned: plannedDays.size > 0 };
}
