import type { AccessSubject } from '../../_shared/workforce-access';
import { nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import { daysRepository } from '../../attendance/days/days-repository';
import { currentPeriodFresh } from '../assemble/assemble-service';
import { periodsRepository } from '../periods/periods-repository';
import { viewerFor } from '../timesheets-scope';
import type { PeriodRow } from '../timesheets.types';
import { assertRangeInMonth, capabilitiesOf, monthForViewer, type MonthCapabilities } from './month-context';
import { chipCounts, loadMonthData, monthTotals, needsYouOf, sliceRange } from './month-data';
import { firstApprovalDay, monthKeyOf, monthLabelOf, monthStateOf, type MonthState } from './month-state';
import { monthsRepository } from './months-repository';
import { blockingTotal, needsYou, type NeedsYouCounts } from './needs-you';
import { filterPeople, sortPeople, type MonthTotals, type PersonMonthRow } from './people-rows';
import { rulesUsedFor, type RuleUsed } from './rules-used';
import { soFar } from './so-far';
import type { MonthQuery, MonthsQuery, PeopleQuery } from './months-validators';

export const documentCode = (n: number | null): string | null => (n === null ? null : `TSH-${String(n).padStart(4, '0')}`);

interface Person {
  name: string;
  role: string;
}

export interface MonthListRow {
  monthKey: string;
  label: string;
  state: MonthState;
  workedMinutes: number;
  headcount: number;
  /** The open month only: the figures run to this day, open shifts not counted (D18). */
  soFarThroughDate: NairobiDate | null;
  plannedSoFarMinutes: number | null;
  needsYouCount: number;
  approvedAt: string | null;
  approvedBy: Person | null;
  documentNumber: string | null;
}

export interface MonthListView {
  /** False while the branch is still on the old clock: there are no timesheets to show. */
  enabled: boolean;
  months: MonthListRow[];
  page: number;
  rows: number;
  total: number;
}

/** The months of a site, newest first, with the open month "so far" (spec S1). The current month is created on first read. */
export async function listMonths(subject: AccessSubject, query: MonthsQuery, now: Date = new Date()): Promise<MonthListView> {
  const viewer = viewerFor(subject, 'timesheet.read', query.site);
  const today = nairobiToday(now);
  const current = await currentPeriodFresh(viewer.siteId, now);
  if (!current) return { enabled: false, months: [], page: query.page, rows: query.rows, total: 0 };
  const { rows: periods, total } = await periodsRepository.page(viewer.siteId, (query.page - 1) * query.rows, query.rows);
  const open = new Set(periods.filter((p) => monthStateOf(p, today) !== 'APPROVED' && p.start <= today && today <= p.end).map((p) => p.id));
  const stats = await monthsRepository.stats(periods, open);
  const people = await periodsRepository.people(periods.map((p) => p.approvedById).filter((id): id is string => id !== null));
  const months = periods.map((period): MonthListRow => {
    const s = stats.get(period.id)!;
    const state = monthStateOf(period, today);
    const sofar = open.has(period.id) ? soFar(s.days, today) : null;
    return {
      monthKey: monthKeyOf(period),
      label: monthLabelOf(monthKeyOf(period)),
      state,
      workedMinutes: sofar ? sofar.workedMinutes : s.workedMinutes,
      headcount: s.headcount,
      soFarThroughDate: sofar ? sofar.throughDate : null,
      plannedSoFarMinutes: sofar ? sofar.plannedMinutes : null,
      needsYouCount: state === 'APPROVED' ? 0 : blockingTotal(needsYou(s.open.map((d) => ({ status: d.status, reasons: d.reasons })), Array.from({ length: s.pendingOvertime }, () => ({ status: 'PENDING' as const })), s.waitingRequests)),
      approvedAt: period.approvedAt?.toISOString() ?? null,
      approvedBy: period.approvedById ? (people.get(period.approvedById) ?? null) : null,
      documentNumber: documentCode(period.documentNumber),
    };
  });
  return { enabled: true, months, page: query.page, rows: query.rows, total };
}

export interface MonthView {
  monthKey: string;
  label: string;
  site: { id: string; name: string };
  state: MonthState;
  window: { start: NairobiDate; end: NairobiDate };
  range: { from: NairobiDate; to: NairobiDate };
  kpis: {
    workedMinutes: number;
    plannedMinutes: number;
    headcount: number;
    overtime: { recordedMinutes: number; approvedMinutes: number; partNotApprovedMinutes: number; toDecideMinutes: number };
    lateCount: number;
    absentDays: number;
  };
  /** Open month only: hours so far, with open shifts left out. */
  soFar: { workedMinutes: number; plannedMinutes: number; throughDate: NairobiDate } | null;
  needsYou: NeedsYouCounts & { total: number };
  approval: { approvedAt: string; approvedBy: Person | null; documentNumber: string | null; note: string | null; ownHoursIncluded: boolean } | null;
  rulesUsed: RuleUsed[];
  otherSites: { name: string; approved: boolean }[];
  capabilities: MonthCapabilities;
  /** The first day the month can be approved, for the disabled button's reason (D5). */
  approvableFrom: NairobiDate;
}

const kpisOf = (totals: MonthTotals): MonthView['kpis'] => ({
  workedMinutes: totals.workedMinutes,
  plannedMinutes: totals.plannedMinutes,
  headcount: totals.people,
  overtime: { recordedMinutes: totals.overtimeRecordedMinutes, approvedMinutes: totals.overtimeApprovedMinutes, partNotApprovedMinutes: totals.overtimePartNotApprovedMinutes, toDecideMinutes: totals.overtimeToDecideMinutes },
  lateCount: totals.lateCount,
  absentDays: totals.absentDays,
});

/** One month: KPIs for the range, "needs you" and the approval for the whole month (spec S1). Reading refreshes it and never alters an approved month. */
export async function getMonth(subject: AccessSubject, monthKey: string, query: MonthQuery, now: Date = new Date()): Promise<MonthView> {
  const ctx = await monthForViewer(subject, monthKey, query.site, now);
  const { period, state } = ctx;
  assertRangeInMonth(period, query);
  const data = await loadMonthData(period);
  const range = { from: (query.from ?? period.start) as NairobiDate, to: (query.to ?? period.end) as NairobiDate };
  const slice = sliceRange(data, query.from === undefined ? {} : range);
  const counts = needsYouOf(data);
  const site = await daysRepository.siteFacts(period.siteId);
  const [rulesUsed, otherSites, people] = await Promise.all([
    rulesUsedFor(period.siteId, period.end),
    site ? periodsRepository.otherSites(site.companyId, period.siteId, period.end) : Promise.resolve([]),
    periodsRepository.people(period.approvedById ? [period.approvedById] : []),
  ]);
  const open = state === 'APPROVED' ? null : soFarOf(data, ctx.today, period);
  return {
    monthKey: ctx.key,
    label: monthLabelOf(ctx.key),
    site: { id: period.siteId, name: await periodsRepository.siteName(period.siteId) },
    state,
    window: { start: period.start, end: period.end },
    range,
    kpis: kpisOf(monthTotals(slice.rows, slice.items)),
    soFar: open,
    needsYou: { ...counts, total: blockingTotal(counts) },
    approval: period.approvedAt
      ? { approvedAt: period.approvedAt.toISOString(), approvedBy: period.approvedById ? (people.get(period.approvedById) ?? null) : null, documentNumber: documentCode(period.documentNumber), note: period.approvalNote, ownHoursIncluded: period.approverOwnHours }
      : null,
    rulesUsed,
    otherSites,
    capabilities: capabilitiesOf(subject, period, state),
    approvableFrom: firstApprovalDay(period),
  };
}

const soFarOf = (data: Awaited<ReturnType<typeof loadMonthData>>, today: NairobiDate, period: PeriodRow): MonthView['soFar'] => {
  if (today < period.start || today > period.end) return null;
  const s = soFar(data.days.map(({ day }) => day), today);
  return { workedMinutes: s.workedMinutes, plannedMinutes: s.plannedMinutes, throughDate: s.throughDate };
};

export interface PeopleView {
  rows: PersonMonthRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { needs: number; late: number; all: number };
}

/** The people table: search, department, range, needs-a-look and late filters, sorted and paged on the server (50 a page by default). */
export async function listPeople(subject: AccessSubject, monthKey: string, query: PeopleQuery, now: Date = new Date()): Promise<PeopleView> {
  const ctx = await monthForViewer(subject, monthKey, query.site, now);
  assertRangeInMonth(ctx.period, query);
  const data = await loadMonthData(ctx.period);
  const slice = sliceRange(data, query.from === undefined ? {} : { from: query.from, to: query.to }, query.dept);
  const filtered = sortPeople(filterPeople(slice.rows, { view: query.view, search: query.q, departmentIds: ctx.viewer.departmentIds }), query.sort, query.dir);
  const start = (query.page - 1) * query.rows;
  return { rows: filtered.slice(start, start + query.rows), total: filtered.length, page: query.page, pageSize: query.rows, counts: chipCounts(slice.rows) };
}
