import { NotFoundError } from '../../../../utils/errors';
import type { AccessSubject } from '../../_shared/workforce-access';
import { currentPeriodFresh, refreshPeriod } from '../assemble/assemble-service';
import { timesheetDaysRepository } from '../days/timesheet-days-repository';
import { overtimeRepository } from '../overtime/overtime-repository';
import { viewerFor, type Viewer } from '../timesheets-scope';
import type { PeriodRow } from '../timesheets.types';
import { filterRows, personRows, summarise, withinRange, type PeriodSummary, type PersonPeriodRow } from './period-view';
import type { PeriodListQuery, PeriodQuery } from './periods-validators';
import { periodsRepository } from './periods-repository';

export interface PeriodListView {
  /** False while the branch is still on the old clock: there are no timesheets to show. */
  enabled: boolean;
  periods: PeriodRow[];
}

export interface PeriodView {
  period: PeriodRow;
  summary: PeriodSummary;
  /** Weeks by status: matching weeks approve themselves, only exceptions need a person. */
  weeks: Record<string, number>;
  /** Days that moved here from the period before, still waiting on someone. */
  carriedInDays: number;
  counts: { all: number; needsLook: number; late: number };
  people: { rows: PersonPeriodRow[]; page: number; pageSize: number; total: number };
}

/** The period a viewer asked for, if their scope reaches its site (another branch answers 404). */
export async function periodForViewer(subject: AccessSubject, id: string): Promise<{ period: PeriodRow; viewer: Viewer }> {
  const found = await periodsRepository.findAnywhere(id);
  if (!found) throw new NotFoundError('Period not found');
  const viewer = viewerFor(subject, 'timesheet.read', found.siteId);
  return { period: found, viewer };
}

/** The branch's recent timesheet periods, the current one created and brought up to date on the way. */
export async function listPeriods(subject: AccessSubject, query: PeriodListQuery, now: Date = new Date()): Promise<PeriodListView> {
  const viewer = viewerFor(subject, 'timesheet.read', query.siteId);
  const current = await currentPeriodFresh(viewer.siteId, now);
  if (!current) return { enabled: false, periods: [] };
  return { enabled: true, periods: await periodsRepository.list(viewer.siteId, 12) };
}

/** One period: the totals, the weeks, and one row per person (exceptions first), searchable and paged. */
export async function getPeriod(subject: AccessSubject, id: string, query: PeriodQuery, now: Date = new Date()): Promise<PeriodView> {
  const { period: found, viewer } = await periodForViewer(subject, id);
  await refreshPeriod(found, now);
  const period = (await periodsRepository.find(found.siteId, found.id)) ?? found;

  const [allDays, allOvertime, weeks] = await Promise.all([
    timesheetDaysRepository.allInPeriod(period.id, period.siteId),
    overtimeRepository.allInPeriod(period.id, period.siteId),
    timesheetDaysRepository.weekCounts(period.id, period.siteId),
  ]);
  // The week picker narrows the figures and the people to a range of the period's days (the whole period when none is given).
  const range = { from: query.from, to: query.to };
  const days = withinRange(allDays, ({ day }) => day.shiftDate, range);
  const overtime = withinRange(allOvertime, (item) => item.shiftDate, range);
  const scoped = filterRows(personRows(days, overtime), 'ALL', undefined, undefined, viewer.departmentIds);
  const visible = new Set(scoped.map((row) => row.employeeId));
  const rows = filterRows(scoped, query.filter, query.search, query.departmentId, null);
  const start = (query.page - 1) * query.pageSize;
  return {
    period,
    summary: summarise(scoped, days.filter(({ person }) => visible.has(person.id)), overtime.filter((item) => visible.has(item.employeeId))),
    weeks,
    carriedInDays: days.filter(({ day }) => day.carriedFromPeriodId !== null).length,
    counts: { all: scoped.length, needsLook: filterRows(scoped, 'NEEDS_LOOK', undefined, undefined, null).length, late: filterRows(scoped, 'LATE', undefined, undefined, null).length },
    people: { rows: rows.slice(start, start + query.pageSize), page: query.page, pageSize: query.pageSize, total: rows.length },
  };
}
