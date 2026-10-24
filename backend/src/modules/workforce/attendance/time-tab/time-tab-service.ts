import { addDays, eachDay, monthKey, nairobiDateOf, nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import { inScope, type AccessSubject } from '../../_shared/workforce-access';
import { applicationsRepository } from '../../leave/data/applications-repository';
import type { AttendanceRuleSet, PersonRow } from '../attendance.types';
import { personInScope } from '../attendance-scope';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { switchRepository } from '../switch/switch-repository';
import { timeTabRepository } from './time-tab-repository';
import type { TimeMonthQuery, TimeTilesQuery } from './time-tab-validators';
import { buildLast30, buildMonth, filterRows, monthBounds, type MonthInput, type TimeDayRow, type TimeFilterCounts, type TimeMonthSummary } from './time-tab-view';

/** The 30 days "Late in the last 30 days" and the On time tile look at: today and the 29 before it. */
const LAST_DAYS = 30;
const LONG_AGO = '2000-01-01' as NairobiDate;

export type EmptyReason = 'DOES_NOT_CLOCK' | 'CLOCK_OFF';

export interface TimeMonthRead {
  employeeId: string;
  name: string;
  positionName: string | null;
  siteId: string;
  siteName: string | null;
  month: string;
  /** Whether this person is on the clock at all (the employee file's "tracks time"), and whether the branch clock is on. */
  clocks: boolean;
  clockOn: boolean;
  /** Set when there is nothing to list and the screen should say why (the two empty states). */
  emptyReason: EmptyReason | null;
  /** The caller may use "Edit time" on this person (HR, Director, Branch Manager of the branch; not the Accountant). */
  canEditTime: boolean;
  summary: TimeMonthSummary;
  last30: { from: NairobiDate; to: NairobiDate; lateDays: number; lateMinutes: number };
  counts: TimeFilterCounts;
  filter: TimeMonthQuery['filter'];
  page: number;
  pageSize: number;
  /** Rows after the filter, before the paging. */
  total: number;
  rows: TimeDayRow[];
}

export interface TimeTilesRead {
  employeeId: string;
  clocks: boolean;
  clockOn: boolean;
  onTime: { tracked: boolean; onTime: number; worked: number; from: NairobiDate; to: NairobiDate };
  overtime: { tracked: boolean; month: string; approvedMinutes: number };
  /** Leave balances arrive with the Leave section; until then the tile reads "Not set". */
  leaveLeft: { state: 'NOT_SET' };
}

interface Loaded {
  person: PersonRow;
  input: Omit<MonthInput, 'month'>;
  clockOn: boolean;
}

/** One load of a person's shifts, clock events, rules, leave and overtime over `from..to`; the month and the tiles both read it. */
async function loadPerson(subject: AccessSubject, employeeId: string, from: NairobiDate, to: NairobiDate, overtime: { from: NairobiDate; to: NairobiDate }, now: Date): Promise<Loaded> {
  const person = await personInScope(subject, 'timesheet.read', employeeId, 'read');
  const days = eachDay(from, to);
  const [data, sw, leave, overtimeByDay, employed, rulesList] = await Promise.all([
    daysRepository.loadDayData(person.siteId, from, to, [person.id]),
    switchRepository.get(person.siteId),
    applicationsRepository.approvedForPeople([person.id], from, to),
    timeTabRepository.approvedOvertimeByDay(person.siteId, person.id, overtime.from, overtime.to),
    timeTabRepository.employedBetween(person.siteId, person.id),
    Promise.all(days.map(async (date) => [date, await attendanceRulesFor(person.siteId, date)] as const)),
  ]);
  const clockOn = sw?.enabled === true;
  const leaveDays = new Set<NairobiDate>(days.filter((d) => leave.some((a) => a.start <= d && d <= a.end)));
  const rulesByDay = new Map<NairobiDate, AttendanceRuleSet>(rulesList);
  const trackedFrom = clockOn && person.tracksTime ? (sw?.enabledAt ? nairobiDateOf(sw.enabledAt) : LONG_AGO) : null;
  return { person, clockOn, input: { person, today: nairobiToday(now), now, data, rulesByDay, leaveDays, overtimeByDay, trackedFrom, employed } };
}

/**
 * The Time tab: one person's month, a day per row, newest first. Gate is `timesheet.read` (a department head has none, so no
 * Time tab); another branch answers 404. Days with no clock-in before the new clock was switched on, or while it is off, are
 * left out rather than shown as "Absent". One load, never one read per day.
 */
export async function personMonth(subject: AccessSubject, query: TimeMonthQuery, now: Date = new Date()): Promise<TimeMonthRead> {
  const { first, last } = monthBounds(query.month);
  const today = nairobiToday(now);
  const last30From = addDays(today, 1 - LAST_DAYS);
  const from = [first, last30From].sort()[0] as NairobiDate;
  const to = [last, today].sort().reverse()[0] as NairobiDate;
  const { person, input, clockOn } = await loadPerson(subject, query.employeeId, from, to, { from: first, to: last }, now);

  const month = buildMonth({ ...input, month: query.month });
  const filtered = filterRows(month.rows, query.filter);
  const start = (query.page - 1) * query.pageSize;
  const last30 = buildLast30(input, last30From);
  const emptyReason: EmptyReason | null = !person.tracksTime ? 'DOES_NOT_CLOCK' : month.rows.length === 0 && !clockOn ? 'CLOCK_OFF' : null;
  const [positionName, siteName] = await Promise.all([timeTabRepository.positionName(person.siteId, person.id), timeTabRepository.siteName(person.siteId)]);
  return {
    employeeId: person.id,
    name: person.name,
    positionName,
    siteId: person.siteId,
    siteName,
    month: query.month,
    clocks: person.tracksTime,
    clockOn,
    emptyReason,
    canEditTime: inScope(subject, 'time.fix', { userId: person.userId, siteId: person.siteId, departmentId: person.departmentId }) && person.userId !== subject.id,
    summary: month.summary,
    last30: { from: last30From, to: today, lateDays: last30.lateDays, lateMinutes: last30.lateMinutes },
    counts: month.counts,
    filter: query.filter,
    page: query.page,
    pageSize: query.pageSize,
    total: filtered.length,
    rows: filtered.slice(start, start + query.pageSize),
  };
}

/** The Overview tiles: On time (30 days including today) and Overtime (approved this month). Leave left stays "Not set". */
export async function personTiles(subject: AccessSubject, query: TimeTilesQuery, now: Date = new Date()): Promise<TimeTilesRead> {
  const today = nairobiToday(now);
  const from = addDays(today, 1 - LAST_DAYS);
  const month = monthKey(today);
  const bounds = monthBounds(month);
  const { person, input, clockOn } = await loadPerson(subject, query.employeeId, from, today, { from: bounds.first, to: bounds.last }, now);
  const figures = buildLast30(input, from);
  const approvedMinutes = [...input.overtimeByDay.values()].reduce((sum, minutes) => sum + minutes, 0);
  return {
    employeeId: person.id,
    clocks: person.tracksTime,
    clockOn,
    onTime: { tracked: person.tracksTime, onTime: figures.shiftsOnTime, worked: figures.shiftsWorked, from, to: today },
    overtime: { tracked: person.tracksTime, month, approvedMinutes },
    leaveLeft: { state: 'NOT_SET' },
  };
}
