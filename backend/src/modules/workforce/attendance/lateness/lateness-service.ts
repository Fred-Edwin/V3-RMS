import { ValidationError } from '../../../../utils/errors';
import { daysBetween, eachDay, nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { gridScope } from '../../rota/rota-scope';
import { attendanceReadCapability } from '../attendance-scope';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { buildPersonDay } from '../days/person-day';
import { switchRepository } from '../switch/switch-repository';
import { MAX_LATENESS_DAYS, type LatenessQuery } from './lateness-validators';

export interface LatenessLine {
  employeeId: string;
  name: string;
  departmentId: string | null;
  date: NairobiDate;
  entryId: string;
  templateName: string;
  startTime: string;
  clockedInAt: string;
  /** Raw minutes after the start, never below zero (06:05 against 06:00 is 5). */
  minutesLate: number;
  /** More than the grace period. Only these can ever be deducted (slice 4 decides). */
  countsAsLate: boolean;
  graceMinutes: number;
  minutesAfterGrace: number;
  earlyMinutes: number;
  /** Someone else clocked them in, so the time is the manager's word. */
  recordedForBy: string | null;
}

export interface LatenessSummary {
  employeeId: string;
  name: string;
  lateDays: number;
  minutesAfterGrace: number;
}

export interface LatenessReport {
  enabled: boolean;
  siteId: string;
  from: NairobiDate;
  to: NairobiDate;
  lines: LatenessLine[];
  summary: LatenessSummary[];
}

/**
 * Lateness as data (proposal 5.6): the first clock-in of each rostered shift against its start, in Nairobi time only, with
 * the grace from the Rules store as it stood on that day. Deductions, excuses and caps are slice 4; nothing here is money.
 * Scope is the Today board's for managers and heads, and the whole branch for HR, the Director and the Accountant.
 */
export async function latenessReport(subject: AccessSubject, query: LatenessQuery, now: Date = new Date()): Promise<LatenessReport> {
  const scope = gridScope(subject, attendanceReadCapability(subject), query.siteId);
  if (query.to < query.from) throw new ValidationError('The end day is before the start day', 'RANGE_INVALID');
  if (daysBetween(query.from, query.to) + 1 > MAX_LATENESS_DAYS) throw new ValidationError(`Ask for at most ${MAX_LATENESS_DAYS} days at a time`, 'RANGE_TOO_LONG');
  const to = [query.to, nairobiToday(now)].sort()[0] as NairobiDate; // a day that has not started has no lateness
  const empty: LatenessReport = { enabled: true, siteId: scope.siteId, from: query.from, to: query.to, lines: [], summary: [] };
  if (!(await switchRepository.isEnabled(scope.siteId))) return { ...empty, enabled: false };
  if (to < query.from) return empty;

  const departmentIds = scope.kind === 'departments' ? scope.departmentIds : null;
  const data = await daysRepository.loadDayData(scope.siteId, query.from, to, query.employeeId ? [query.employeeId] : null);
  const people = (await daysRepository.peopleByIds(scope.siteId, [...new Set(data.entries.map((e) => e.employeeId))])).filter((p) => !departmentIds || (p.departmentId !== null && departmentIds.includes(p.departmentId)));
  const days = eachDay(query.from, to);
  const rulesByDay = new Map(await Promise.all(days.map(async (date) => [date, await attendanceRulesFor(scope.siteId, date)] as const)));

  const lines: LatenessLine[] = [];
  for (const person of people) {
    for (const date of days) {
      const rules = rulesByDay.get(date)!;
      for (const entry of buildPersonDay(person, date, data, rules, now).entries) {
        if (!entry.clockedInAt || !entry.lateness) continue;
        if (!query.includeOnTime && !entry.lateness.countsAsLate) continue;
        lines.push({
          employeeId: person.id,
          name: person.name,
          departmentId: person.departmentId,
          date,
          entryId: entry.entryId,
          templateName: entry.templateName,
          startTime: entry.shift.startTime,
          clockedInAt: entry.clockedInAt.toISOString(),
          minutesLate: entry.lateness.minutesLate,
          countsAsLate: entry.lateness.countsAsLate,
          graceMinutes: rules.lateness.graceMinutes,
          minutesAfterGrace: entry.lateness.minutesAfterGrace,
          earlyMinutes: entry.lateness.earlyMinutes,
          recordedForBy: entry.flags.recordedForBy,
        });
      }
    }
  }

  const byPerson = new Map<string, LatenessSummary>();
  for (const line of lines.filter((l) => l.countsAsLate)) {
    const current = byPerson.get(line.employeeId) ?? { employeeId: line.employeeId, name: line.name, lateDays: 0, minutesAfterGrace: 0 };
    byPerson.set(line.employeeId, { ...current, lateDays: current.lateDays + 1, minutesAfterGrace: current.minutesAfterGrace + line.minutesAfterGrace });
  }
  return { ...empty, lines, summary: [...byPerson.values()].sort((a, b) => b.minutesAfterGrace - a.minutesAfterGrace || a.name.localeCompare(b.name)) };
}
