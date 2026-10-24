import { addDays, eachDay, monthKey, parseNairobiDate, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, DayData, EntryDay, PersonRow } from '../attendance.types';
import { buildPersonDay } from '../days/person-day';
import type { TimeTabFilter } from './time-tab-validators';

/**
 * WORKED      clocked in and out        ON_SHIFT   clocked in, still open (the tinted "today" row)
 * ABSENT      shift over, no clock, no leave        NOT_IN     the shift began, no clock yet
 * UPCOMING    rostered, not begun       DAY_OFF    nothing rostered        ON_LEAVE   approved leave, no clock
 */
export type TimeDayKind = 'WORKED' | 'ON_SHIFT' | 'ABSENT' | 'NOT_IN' | 'UPCOMING' | 'DAY_OFF' | 'ON_LEAVE';

export interface TimeDayRow {
  date: NairobiDate;
  kind: TimeDayKind;
  shifts: { templateName: string; startTime: string; endTime: string }[];
  /** First clock-in and last clock-out of the day; out is null while a shift is open. */
  clockedInAt: string | null;
  clockedOutAt: string | null;
  workedMinutes: number;
  /** Clocked in past the grace time. `minutesLate` is raw, `minutesAfterGrace` is what the figures and the tag count. */
  late: boolean;
  minutesLate: number;
  minutesAfterGrace: number;
  overtimeApprovedMinutes: number;
  /** The open row only: minutes since the clock-in ("so far 4 h 12 m"). */
  soFarMinutes: number | null;
  /** A manager touched the day, or the phone closed it. */
  edited: boolean;
  autoClosed: boolean;
}

export interface TimeMonthSummary {
  daysWorked: number;
  rosteredDays: number;
  workedMinutes: number;
  lateDays: number;
  lateMinutes: number;
  overtimeApprovedMinutes: number;
  absentDays: number;
}

export interface TimeFilterCounts {
  all: number;
  late: number;
  overtime: number;
  absent: number;
}

const OPEN: readonly EntryDay['state'][] = ['ON_SHIFT', 'PROMPT_DUE', 'STAYING_ON'];

/** The first and last day of "2026-10". */
export function monthBounds(month: string): { first: NairobiDate; last: NairobiDate } {
  const first = parseNairobiDate(`${month}-01`);
  let last = addDays(first, 27);
  while (monthKey(addDays(last, 1)) === month) last = addDays(last, 1);
  return { first, last };
}

export interface MonthInput {
  person: PersonRow;
  month: string;
  today: NairobiDate;
  now: Date;
  data: DayData;
  rulesByDay: ReadonlyMap<NairobiDate, AttendanceRuleSet>;
  /** Days the person is on approved leave. */
  leaveDays: ReadonlySet<NairobiDate>;
  overtimeByDay: ReadonlyMap<NairobiDate, number>;
  /** The first day the new clock was authoritative at the site; null when it is off. A rostered day with no clock before it is not "absent". */
  trackedFrom: NairobiDate | null;
  /** The person's first and last day of employment; a day outside them has no row unless a clock event sits on it. */
  employed: { from: NairobiDate | null; to: NairobiDate | null };
}

/** One calendar day of the person, or null when there is nothing honest to say about it (a free future day; an untracked day). */
export function buildDayRow(input: MonthInput, date: NairobiDate): TimeDayRow | null {
  const { person, today, now, data, rulesByDay, leaveDays, overtimeByDay, trackedFrom } = input;
  const rules = rulesByDay.get(date);
  const entries: EntryDay[] = rules ? buildPersonDay(person, date, data, rules, now).entries : [];
  const clocked = entries.filter((e) => e.clockedInAt !== null);
  const tracked = trackedFrom !== null && date >= trackedFrom;
  const base = {
    date,
    shifts: entries.map((e) => ({ templateName: e.templateName, startTime: e.shift.startTime, endTime: e.shift.endTime })),
    overtimeApprovedMinutes: overtimeByDay.get(date) ?? 0,
  };
  const idle = { clockedInAt: null, clockedOutAt: null, workedMinutes: 0, late: false, minutesLate: 0, minutesAfterGrace: 0, soFarMinutes: null, edited: false, autoClosed: false };

  if (clocked.length > 0) {
    const open = entries.some((e) => OPEN.includes(e.state));
    const firstIn = clocked.map((e) => e.clockedInAt as Date).sort((a, b) => a.getTime() - b.getTime())[0] as Date;
    const lateOnes = clocked.filter((e) => e.lateness?.countsAsLate === true);
    const outs = clocked.map((e) => e.clockedOutAt);
    return {
      ...base,
      kind: open ? 'ON_SHIFT' : 'WORKED',
      clockedInAt: firstIn.toISOString(),
      clockedOutAt: outs.some((o) => o === null) ? null : (outs as Date[]).sort((a, b) => b.getTime() - a.getTime())[0]!.toISOString(),
      workedMinutes: clocked.reduce((sum, e) => sum + e.hours.workedMinutes, 0),
      late: lateOnes.length > 0,
      minutesLate: lateOnes.reduce((sum, e) => sum + (e.lateness?.minutesLate ?? 0), 0),
      minutesAfterGrace: lateOnes.reduce((sum, e) => sum + (e.lateness?.minutesAfterGrace ?? 0), 0),
      soFarMinutes: open ? Math.max(0, Math.floor((now.getTime() - firstIn.getTime()) / 60000)) : null,
      edited: clocked.some((e) => e.flags.fixed),
      autoClosed: clocked.some((e) => e.flags.autoClosed),
    };
  }
  if (!person.tracksTime) return null; // not on the clock: no days to show (old clock events, if any, were handled above)
  if ((input.employed.from !== null && date < input.employed.from) || (input.employed.to !== null && date > input.employed.to)) return null;
  if (!tracked) return null; // before the clock was switched on, or while it is off: only days with a clock-in are shown
  if (leaveDays.has(date)) return { ...base, ...idle, kind: 'ON_LEAVE' };
  if (entries.length === 0) return date > today ? null : { ...base, ...idle, kind: 'DAY_OFF' };
  if (date > today) return { ...base, ...idle, kind: 'UPCOMING' };
  if (entries.every((e) => e.state === 'MISSED')) return { ...base, ...idle, kind: 'ABSENT' };
  return { ...base, ...idle, kind: entries.some((e) => e.state === 'NOT_IN') ? 'NOT_IN' : 'UPCOMING' };
}

const COUNTED_AS_ROSTERED: readonly TimeDayKind[] = ['WORKED', 'ON_SHIFT', 'ABSENT', 'NOT_IN', 'UPCOMING'];
const matches = (row: TimeDayRow, filter: TimeTabFilter): boolean =>
  filter === 'all' || (filter === 'late' && row.late) || (filter === 'overtime' && row.overtimeApprovedMinutes > 0) || (filter === 'absent' && row.kind === 'ABSENT');

/** The month: every day newest first, the five summary figures, and the chip counts (before the filter and the paging). */
export function buildMonth(input: MonthInput): { rows: TimeDayRow[]; summary: TimeMonthSummary; counts: TimeFilterCounts } {
  const { first, last } = monthBounds(input.month);
  const rows = eachDay(first, last)
    .map((date) => buildDayRow(input, date))
    .filter((row): row is TimeDayRow => row !== null)
    .reverse();
  const worked = rows.filter((r) => r.kind === 'WORKED' || r.kind === 'ON_SHIFT');
  const summary: TimeMonthSummary = {
    daysWorked: worked.length,
    rosteredDays: rows.filter((r) => COUNTED_AS_ROSTERED.includes(r.kind)).length,
    workedMinutes: rows.reduce((sum, r) => sum + r.workedMinutes, 0),
    lateDays: rows.filter((r) => r.late).length,
    lateMinutes: rows.reduce((sum, r) => sum + r.minutesAfterGrace, 0),
    overtimeApprovedMinutes: [...input.overtimeByDay].reduce((sum, [date, minutes]) => sum + (monthKey(date) === input.month ? minutes : 0), 0),
    absentDays: rows.filter((r) => r.kind === 'ABSENT').length,
  };
  const counts: TimeFilterCounts = { all: rows.length, late: rows.filter((r) => matches(r, 'late')).length, overtime: rows.filter((r) => matches(r, 'overtime')).length, absent: summary.absentDays };
  return { rows, summary, counts };
}

export const filterRows = (rows: readonly TimeDayRow[], filter: TimeTabFilter): TimeDayRow[] => rows.filter((row) => matches(row, filter));

/** The 30 days up to and including today: late days and minutes, and the on-time tile (shifts in within grace out of shifts worked). */
export function buildLast30(input: Omit<MonthInput, 'month'>, from: NairobiDate): { lateDays: number; lateMinutes: number; shiftsWorked: number; shiftsOnTime: number } {
  let lateDays = 0;
  let lateMinutes = 0;
  let shiftsWorked = 0;
  let shiftsOnTime = 0;
  for (const date of eachDay(from, input.today)) {
    const rules = input.rulesByDay.get(date);
    if (!rules) continue;
    const clocked = buildPersonDay(input.person, date, input.data, rules, input.now).entries.filter((e) => e.clockedInAt !== null);
    const late = clocked.filter((e) => e.lateness?.countsAsLate === true);
    shiftsWorked += clocked.length;
    shiftsOnTime += clocked.length - late.length;
    if (late.length > 0) lateDays += 1;
    lateMinutes += late.reduce((sum, e) => sum + (e.lateness?.minutesAfterGrace ?? 0), 0);
  }
  return { lateDays, lateMinutes, shiftsWorked, shiftsOnTime };
}
