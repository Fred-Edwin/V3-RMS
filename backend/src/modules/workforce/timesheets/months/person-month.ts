import { NotFoundError } from '../../../../utils/errors';
import { eachDay, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { attendanceRulesFor } from '../../attendance/days/day-rules';
import { daysRepository } from '../../attendance/days/days-repository';
import { personInScope } from '../../attendance/attendance-scope';
import { periodsRepository } from '../periods/periods-repository';
import type { DayRow, OvertimeRow, RequestRow } from '../timesheets.types';
import { dayResult, type DayResultKey, type GlanceKind } from './day-result';
import { assertRangeInMonth, monthForViewer, type MonthContext } from './month-context';
import { loadMonthData, sliceRange, type MonthData } from './month-data';
import { personMonthRows, sortPeople, withinRange, type PersonMonthRow } from './people-rows';
import { dayFactsOf, type PersonDayFacts } from './person-day-facts';
import { dayNeed, requestNeed } from './needs-you';
import type { PersonDaysQuery, PersonQuery } from './months-validators';

interface PersonInMonth {
  ctx: MonthContext;
  data: MonthData;
  person: { id: string; name: string; userId: string | null; departmentName: string | null };
  role: string | null;
  days: DayRow[];
  items: OvertimeRow[];
  requests: RequestRow[];
}

async function loadPerson(subject: AccessSubject, monthKey: string, employeeId: string, query: { site?: string | undefined; from?: string | undefined; to?: string | undefined }, now: Date): Promise<PersonInMonth> {
  const person = await personInScope(subject, 'timesheet.read', employeeId, 'read');
  const ctx = await monthForViewer(subject, monthKey, query.site, now);
  if (ctx.period.siteId !== person.siteId) throw new NotFoundError('Not found');
  assertRangeInMonth(ctx.period, query);
  const data = await loadMonthData(ctx.period);
  const role = person.userId ? ((await periodsRepository.people([person.userId])).get(person.userId)?.role ?? null) : null;
  return {
    ctx,
    data,
    person,
    role,
    days: data.days.filter(({ person: p }) => p.id === employeeId).map(({ day }) => day),
    items: data.items.filter((i) => i.employeeId === employeeId),
    requests: data.requests.filter((r) => r.employeeId === employeeId),
  };
}

const totalsOf = (row: PersonMonthRow | undefined): { plannedMinutes: number; workedMinutes: number; overtimeMinutes: number; lateMinutes: number } =>
  row ? { plannedMinutes: row.plannedMinutes, workedMinutes: row.workedMinutes, overtimeMinutes: row.overtimeMinutes, lateMinutes: row.lateMinutes } : { plannedMinutes: 0, workedMinutes: 0, overtimeMinutes: 0, lateMinutes: 0 };

/** The people in the order the table shows them, so the full-month page's arrows follow the same list (D22). */
function neighboursOf(data: MonthData, employeeId: string, query: { from?: string | undefined; to?: string | undefined }): { prevEmployeeId: string | null; nextEmployeeId: string | null } {
  const order = sortPeople(sliceRange(data, query).rows, 'department', 'asc').map((r) => r.employeeId);
  const at = order.indexOf(employeeId);
  return { prevEmployeeId: at > 0 ? order[at - 1]! : null, nextEmployeeId: at >= 0 && at < order.length - 1 ? order[at + 1]! : null };
}

export interface NeedLookItem {
  date: NairobiDate;
  kind: 'OVERTIME' | 'CLOCK_OUT_FIX' | 'REQUEST' | 'DAY_LOOK';
  overtimeItemId: string | null;
  requestId: string | null;
  minutes: number | null;
  /** The manager may fix the clock for this day (the month is not approved). */
  timeFixAllowed: boolean;
}

export interface LastDay {
  date: NairobiDate;
  plannedStart: string | null;
  plannedEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  resultKey: DayResultKey;
}

async function factsFor(ctx: MonthContext, employeeId: string, dates: readonly NairobiDate[], now: Date): Promise<Map<string, PersonDayFacts>> {
  if (dates.length === 0) return new Map();
  const { period } = ctx;
  const [data, rules] = await Promise.all([daysRepository.loadDayData(period.siteId, period.start, period.end, [employeeId]), attendanceRulesFor(period.siteId, period.end)]);
  return dayFactsOf(employeeId, dates, data, rules, now);
}

export interface PersonDrawerView {
  employee: { id: string; name: string; role: string | null; department: string | null };
  month: { monthKey: string; state: MonthContext['state']; start: NairobiDate; end: NairobiDate };
  range: { from: NairobiDate; to: NairobiDate };
  workingDays: number;
  totals: ReturnType<typeof totalsOf>;
  needLook: NeedLookItem[];
  lastDays: LastDay[];
  neighbours: { prevEmployeeId: string | null; nextEmployeeId: string | null };
  /** Decisions made on an approved month, as quiet rows (the section reads "Decisions" there). */
  decisions: { date: NairobiDate; kind: 'OVERTIME'; status: OvertimeRow['status']; authorisedMinutes: number; extraMinutes: number; byId: string | null; at: string | null }[];
}

/** The drawer: a person's month at a glance, the days that need a look, and the last 7 days of the range (spec S4). */
export async function personDrawer(subject: AccessSubject, monthKey: string, employeeId: string, query: PersonQuery, now: Date = new Date()): Promise<PersonDrawerView> {
  const p = await loadPerson(subject, monthKey, employeeId, query, now);
  const { ctx } = p;
  const range = { from: (query.from ?? ctx.period.start) as NairobiDate, to: (query.to ?? ctx.period.end) as NairobiDate };
  const inRange = withinRange(p.days, (d) => d.shiftDate, range);
  const items = withinRange(p.items, (i) => i.shiftDate, range);
  const row = personMonthRows(inRange.map((day) => ({ day, person: { id: p.person.id, name: p.person.name, departmentId: null, department: p.person.departmentName ? { name: p.person.departmentName } : null } })), items, p.requests)[0];
  const approved = ctx.state === 'APPROVED';
  const needLook: NeedLookItem[] = approved ? [] : needLookOf(p.days, p.items, p.requests);

  const lastDates = eachDay(range.from, range.to).slice(-7).reverse();
  const facts = await factsFor(ctx, employeeId, lastDates, now);
  const lastDays: LastDay[] = lastDates.map((date) => {
    const day = p.days.find((d) => d.shiftDate === date) ?? null;
    const f = facts.get(date);
    return { date, plannedStart: f?.plannedStart ?? null, plannedEnd: f?.plannedEnd ?? null, clockIn: f?.clockIn ?? null, clockOut: f?.clockOut ?? null, resultKey: dayResult(day, p.items.find((i) => i.shiftDate === date) ?? null, p.requests.filter((r) => r.shiftDate === date)).resultKey };
  });
  return {
    employee: { id: p.person.id, name: p.person.name, role: p.role, department: p.person.departmentName },
    month: { monthKey: ctx.key, state: ctx.state, start: ctx.period.start, end: ctx.period.end },
    range,
    workingDays: inRange.filter((d) => d.scheduledMinutes > 0 || d.workedMinutes > 0).length,
    totals: totalsOf(row),
    needLook,
    lastDays,
    neighbours: neighboursOf(p.data, employeeId, query),
    decisions: approved ? p.items.filter((i) => i.decidedById !== null).map((i) => ({ date: i.shiftDate, kind: 'OVERTIME' as const, status: i.status, authorisedMinutes: i.authorisedMinutes, extraMinutes: i.rawMinutes, byId: i.decidedById, at: i.decidedAt?.toISOString() ?? null })) : [],
  };
}

function needLookOf(days: readonly DayRow[], items: readonly OvertimeRow[], requests: readonly RequestRow[]): NeedLookItem[] {
  const out: NeedLookItem[] = [];
  for (const d of days) {
    const kind = dayNeed(d);
    if (kind === 'CLOCK_OUT_FIX' || kind === 'DAY_LOOK') out.push({ date: d.shiftDate, kind, overtimeItemId: null, requestId: null, minutes: null, timeFixAllowed: true });
  }
  for (const i of items) if (i.status === 'PENDING') out.push({ date: i.shiftDate, kind: 'OVERTIME', overtimeItemId: i.id, requestId: null, minutes: i.needsMinutes, timeFixAllowed: false });
  for (const r of requests) if (requestNeed(r) === 'WITH_MANAGER') out.push({ date: r.shiftDate, kind: 'REQUEST', overtimeItemId: null, requestId: r.id, minutes: null, timeFixAllowed: false });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface PersonDayRow {
  date: NairobiDate;
  weekday: number; // 1 = Monday
  plannedStart: string | null;
  plannedEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  extraShifts: PersonDayFacts['extraShifts'];
  workedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  resultKey: DayResultKey;
  needsLook: boolean;
  status: DayRow['status'] | 'REST';
  overtimeItemId: string | null;
  requestId: string | null;
  editedById: string | null;
  /** The person had no timesheet days before this date in the month (joined mid-month). */
  beforeEmployment: boolean;
}

export interface PersonDaysView {
  employee: { id: string; name: string; role: string | null; department: string | null };
  month: { monthKey: string; state: MonthContext['state']; start: NairobiDate; end: NairobiDate };
  days: PersonDayRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; needs: number; worked: number };
  glance: { date: NairobiDate; kind: GlanceKind }[];
  totals: ReturnType<typeof totalsOf> & { absentDays: number; workedDays: number; restDays: number; lateDays: number };
  neighbours: PersonDrawerView['neighbours'];
}

/** The full-month page: every day of the range (rest days included), the calendar glance, and the same totals (spec S5). */
export async function personDays(subject: AccessSubject, monthKey: string, employeeId: string, query: PersonDaysQuery, now: Date = new Date()): Promise<PersonDaysView> {
  const p = await loadPerson(subject, monthKey, employeeId, query, now);
  const { ctx } = p;
  const range = { from: (query.from ?? ctx.period.start) as NairobiDate, to: (query.to ?? ctx.period.end) as NairobiDate };
  const dates = eachDay(range.from, range.to);
  const facts = await factsFor(ctx, employeeId, dates, now);
  const firstDay = p.days.map((d) => d.shiftDate).sort()[0] ?? null;
  const rows: PersonDayRow[] = dates.map((date) => {
    const day = p.days.find((d) => d.shiftDate === date) ?? null;
    const item = p.items.find((i) => i.shiftDate === date) ?? null;
    const f = facts.get(date);
    const result = dayResult(day, item, p.requests.filter((r) => r.shiftDate === date));
    return {
      date,
      weekday: ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1,
      plannedStart: f?.plannedStart ?? null,
      plannedEnd: f?.plannedEnd ?? null,
      clockIn: f?.clockIn ?? null,
      clockOut: f?.clockOut ?? null,
      extraShifts: f?.extraShifts ?? [],
      workedMinutes: day?.workedMinutes ?? 0,
      overtimeMinutes: item?.rawMinutes ?? 0,
      lateMinutes: day?.minutesLate ?? 0,
      resultKey: result.resultKey,
      needsLook: result.needsLook,
      status: day?.status ?? 'REST',
      overtimeItemId: item?.id ?? null,
      requestId: p.requests.find((r) => r.shiftDate === date && requestNeed(r) === 'WITH_MANAGER')?.id ?? null,
      editedById: f?.editedById ?? null,
      beforeEmployment: firstDay !== null && date < firstDay && !day,
    };
  });
  const glance = rows.map((r) => ({ date: r.date, kind: dayResult(p.days.find((d) => d.shiftDate === r.date) ?? null, p.items.find((i) => i.shiftDate === r.date) ?? null, p.requests.filter((q) => q.shiftDate === r.date)).glance }));
  const shown = rows.filter((r) => (query.view === 'needs' ? r.needsLook : query.view === 'worked' ? r.workedMinutes > 0 : true));
  const start = (query.page - 1) * query.rows;
  const personRow = personMonthRows(withinRange(p.days, (d) => d.shiftDate, range).map((day) => ({ day, person: { id: p.person.id, name: p.person.name, departmentId: null, department: null } })), withinRange(p.items, (i) => i.shiftDate, range), p.requests)[0];
  return {
    employee: { id: p.person.id, name: p.person.name, role: p.role, department: p.person.departmentName },
    month: { monthKey: ctx.key, state: ctx.state, start: ctx.period.start, end: ctx.period.end },
    days: shown.slice(start, start + query.rows),
    total: shown.length,
    page: query.page,
    pageSize: query.rows,
    counts: { all: rows.length, needs: rows.filter((r) => r.needsLook).length, worked: rows.filter((r) => r.workedMinutes > 0).length },
    glance,
    totals: {
      ...totalsOf(personRow),
      absentDays: personRow?.absentDays ?? 0,
      workedDays: rows.filter((r) => r.workedMinutes > 0).length,
      restDays: rows.filter((r) => r.resultKey === 'REST').length,
      lateDays: personRow?.lateDays ?? 0,
    },
    neighbours: neighboursOf(p.data, employeeId, query),
  };
}
