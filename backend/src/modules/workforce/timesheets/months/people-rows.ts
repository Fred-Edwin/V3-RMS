import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { DayRow, OvertimeRow, RequestRow } from '../timesheets.types';
import { dayNeed, requestNeed } from './needs-you';

export interface PersonFacts {
  id: string;
  name: string;
  departmentId: string | null;
  department: { name: string } | null;
}

export interface DayWithPerson {
  day: DayRow;
  person: PersonFacts;
}

/** The one thing a row says about the person, most urgent first (the screen owns the wording). */
export type PersonStatus =
  | { kind: 'CLOCK_OUT_FIX'; date: NairobiDate }
  | { kind: 'OVERTIME_TO_DECIDE'; minutes: number }
  | { kind: 'REQUEST_TO_ANSWER'; date: NairobiDate }
  | { kind: 'DAY_TO_LOOK_AT'; date: NairobiDate }
  | { kind: 'SEVERAL'; count: number }
  | { kind: 'OVERTIME_APPROVED'; minutes: number }
  | { kind: 'OVERTIME_APPROVED_PART'; minutes: number }
  | { kind: 'OVERTIME_NOT_APPROVED' }
  | { kind: 'CLOCK_FIX_APPROVED' }
  | { kind: 'ABSENT'; date: NairobiDate }
  | { kind: 'LEAVE'; days: number }
  | { kind: 'NOTHING' };

export interface PersonMonthRow {
  employeeId: string;
  name: string;
  departmentId: string | null;
  department: string | null;
  plannedMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number; // recorded
  overtimeAuthorisedMinutes: number;
  lateMinutes: number; // as recorded; payroll applies the Rules
  lateDays: number;
  absentDays: number;
  leaveDays: number; // from slice 5; zero until it exists
  needsYou: number; // blocking things for this person
  status: PersonStatus;
}

export type PeopleView = 'needs' | 'late' | 'all';
export type PeopleSort = 'department' | 'person' | 'worked' | 'overtime' | 'late';

/** The items inside the Nairobi dates `from` to `to`, both included; no range means all of them. */
export function withinRange<T>(items: readonly T[], dateOf: (item: T) => string, range: { from?: string | undefined; to?: string | undefined }): T[] {
  const { from, to } = range;
  return from === undefined || to === undefined ? [...items] : items.filter((item) => dateOf(item) >= from && dateOf(item) <= to);
}

const sum = <T>(list: readonly T[], pick: (item: T) => number): number => list.reduce((total, item) => total + pick(item), 0);
const earliest = (dates: readonly NairobiDate[]): NairobiDate | null => (dates.length ? [...dates].sort()[0]! : null);

function statusOf(days: readonly DayRow[], items: readonly OvertimeRow[], requests: readonly RequestRow[]): { status: PersonStatus; needs: number } {
  const clock = days.filter((d) => dayNeed(d) === 'CLOCK_OUT_FIX');
  const look = days.filter((d) => dayNeed(d) === 'DAY_LOOK');
  const pending = items.filter((i) => i.status === 'PENDING');
  const asks = requests.filter((r) => requestNeed(r) === 'WITH_MANAGER');
  const needs = clock.length + look.length + pending.length + asks.length;
  const kinds = [clock.length, look.length, pending.length, asks.length].filter((n) => n > 0).length;
  if (kinds > 1) return { status: { kind: 'SEVERAL', count: needs }, needs };
  if (clock.length) return { status: { kind: 'CLOCK_OUT_FIX', date: earliest(clock.map((d) => d.shiftDate))! }, needs };
  if (pending.length) return { status: { kind: 'OVERTIME_TO_DECIDE', minutes: sum(pending, (i) => i.needsMinutes) }, needs };
  if (asks.length) return { status: { kind: 'REQUEST_TO_ANSWER', date: earliest(asks.map((r) => r.shiftDate))! }, needs };
  if (look.length) return { status: { kind: 'DAY_TO_LOOK_AT', date: earliest(look.map((d) => d.shiftDate))! }, needs };
  const decided = items.filter((i) => i.decidedById !== null);
  if (decided.some((i) => i.status === 'APPROVED_PART')) return { status: { kind: 'OVERTIME_APPROVED_PART', minutes: sum(decided.filter((i) => i.status === 'APPROVED_PART'), (i) => i.authorisedMinutes - i.autoMinutes) }, needs };
  if (decided.some((i) => i.status === 'DECLINED')) return { status: { kind: 'OVERTIME_NOT_APPROVED' }, needs };
  if (decided.some((i) => i.status === 'APPROVED')) return { status: { kind: 'OVERTIME_APPROVED', minutes: sum(decided.filter((i) => i.status === 'APPROVED'), (i) => i.authorisedMinutes - i.autoMinutes) }, needs };
  if (days.some((d) => d.status === 'APPROVED' && d.decidedById !== null && (d.reasons.includes('OPEN_SHIFT') || d.reasons.includes('AUTO_CLOSED')))) return { status: { kind: 'CLOCK_FIX_APPROVED' }, needs };
  const absent = days.filter((d) => d.reasons.includes('ABSENT'));
  if (absent.length) return { status: { kind: 'ABSENT', date: earliest(absent.map((d) => d.shiftDate))! }, needs };
  return { status: { kind: 'NOTHING' }, needs };
}

/**
 * Rule: one row per person with the days given (a range or the whole month). Late counts any lateness (D17 of the spec's list),
 * absence is a fact and not a decision, and the row's status is the most urgent thing that needs the manager.
 */
export function personMonthRows(days: readonly DayWithPerson[], items: readonly OvertimeRow[], requests: readonly RequestRow[]): PersonMonthRow[] {
  const byPerson = new Map<string, { person: PersonFacts; days: DayRow[] }>();
  for (const { day, person } of days) {
    const entry = byPerson.get(person.id) ?? { person, days: [] };
    entry.days.push(day);
    byPerson.set(person.id, entry);
  }
  return [...byPerson.values()].map(({ person, days: list }): PersonMonthRow => {
    const mine = items.filter((i) => i.employeeId === person.id);
    const asks = requests.filter((r) => r.employeeId === person.id);
    const { status, needs } = statusOf(list, mine, asks);
    return {
      employeeId: person.id,
      name: person.name,
      departmentId: person.departmentId,
      department: person.department?.name ?? null,
      plannedMinutes: sum(list, (d) => d.scheduledMinutes),
      workedMinutes: sum(list, (d) => d.workedMinutes),
      overtimeMinutes: sum(mine, (i) => i.rawMinutes),
      overtimeAuthorisedMinutes: sum(mine, (i) => i.authorisedMinutes),
      lateMinutes: sum(list, (d) => d.minutesLate),
      lateDays: list.filter((d) => d.minutesLate > 0).length,
      absentDays: list.filter((d) => d.reasons.includes('ABSENT')).length,
      leaveDays: 0,
      needsYou: needs,
      status,
    };
  });
}

export interface PeopleFilter {
  view: PeopleView;
  search?: string | undefined;
  departmentId?: string | undefined;
  /** A head or other narrowed viewer: only these departments. Null = the whole site. */
  departmentIds?: readonly string[] | null | undefined;
}

export function filterPeople(rows: readonly PersonMonthRow[], filter: PeopleFilter): PersonMonthRow[] {
  const needle = filter.search?.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (filter.departmentIds == null || (row.departmentId !== null && filter.departmentIds.includes(row.departmentId))) &&
      (!filter.departmentId || row.departmentId === filter.departmentId) &&
      (!needle || row.name.toLowerCase().includes(needle)) &&
      (filter.view === 'all' || (filter.view === 'needs' ? row.needsYou > 0 : row.lateDays > 0)),
  );
}

/** The chip counts follow the range and the department, not the search (the screen's rule). */
export const chipCounts = (rows: readonly PersonMonthRow[]): { needs: number; late: number; all: number } => ({
  needs: rows.filter((r) => r.needsYou > 0).length,
  late: rows.filter((r) => r.lateDays > 0).length,
  all: rows.length,
});

const byName = (a: PersonMonthRow, b: PersonMonthRow): number => a.name.localeCompare(b.name, 'en') || a.employeeId.localeCompare(b.employeeId);
const byDepartment = (a: PersonMonthRow, b: PersonMonthRow): number => (a.department ?? '').localeCompare(b.department ?? '', 'en') || byName(a, b);

/** Default: department A to Z, then name A to Z, so the screen, the PDF and the Excel agree (D22). */
export function sortPeople(rows: readonly PersonMonthRow[], sort: PeopleSort, direction: 'asc' | 'desc'): PersonMonthRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  const compare: Record<PeopleSort, (a: PersonMonthRow, b: PersonMonthRow) => number> = {
    department: (a, b) => byDepartment(a, b),
    person: (a, b) => byName(a, b),
    worked: (a, b) => a.workedMinutes - b.workedMinutes || byDepartment(a, b),
    overtime: (a, b) => a.overtimeMinutes - b.overtimeMinutes || byDepartment(a, b),
    late: (a, b) => a.lateMinutes - b.lateMinutes || byDepartment(a, b),
  };
  return [...rows].sort((a, b) => sign * compare[sort](a, b));
}

export interface MonthTotals {
  people: number;
  plannedMinutes: number;
  workedMinutes: number;
  overtimeRecordedMinutes: number;
  overtimeApprovedMinutes: number;
  overtimePartNotApprovedMinutes: number;
  overtimeToDecideMinutes: number;
  lateCount: number;
  lateMinutes: number;
  absentDays: number;
}

/** The KPI strip: the same numbers the table, the dialog, the PDF and the Excel show (D19). */
export function monthTotals(rows: readonly PersonMonthRow[], items: readonly OvertimeRow[]): MonthTotals {
  const ids = new Set(rows.map((r) => r.employeeId));
  const mine = items.filter((i) => ids.has(i.employeeId));
  const decided = mine.filter((i) => i.status === 'APPROVED_PART' || i.status === 'DECLINED' || i.status === 'APPROVED');
  return {
    people: rows.length,
    plannedMinutes: sum(rows, (r) => r.plannedMinutes),
    workedMinutes: sum(rows, (r) => r.workedMinutes),
    overtimeRecordedMinutes: sum(mine, (i) => i.rawMinutes),
    // recorded = approved + not approved + still to decide; a pending item's authorised minutes are its service-tail part only
    overtimeApprovedMinutes: sum(mine, (i) => i.authorisedMinutes),
    overtimePartNotApprovedMinutes: sum(decided, (i) => Math.max(0, i.needsMinutes - (i.authorisedMinutes - i.autoMinutes))),
    overtimeToDecideMinutes: sum(mine.filter((i) => i.status === 'PENDING'), (i) => i.needsMinutes),
    lateCount: sum(rows, (r) => r.lateDays),
    lateMinutes: sum(rows, (r) => r.lateMinutes),
    absentDays: sum(rows, (r) => r.absentDays),
  };
}
