import type { Db } from '../../attendance/days/days-repository';
import { timesheetDaysRepository } from '../days/timesheet-days-repository';
import { overtimeRepository } from '../overtime/overtime-repository';
import type { OvertimeRow, PeriodRow, RequestRow } from '../timesheets.types';
import { monthsRepository } from './months-repository';
import { chipCounts, filterPeople, monthTotals, personMonthRows, withinRange, type DayWithPerson, type PersonMonthRow } from './people-rows';
import { needsYou, type NeedsYouCounts } from './rules/needs-you';

/** Everything the month page reads, loaded once: at most about 200 people by 31 days, so the work is done in memory and only paged on the way out. */
export interface MonthData {
  days: DayWithPerson[];
  items: OvertimeRow[];
  requests: RequestRow[];
}

export async function loadMonthData(period: PeriodRow, db?: Db): Promise<MonthData> {
  const [days, items, requests] = await Promise.all([
    timesheetDaysRepository.allInPeriod(period.id, period.siteId, db),
    overtimeRepository.allInPeriod(period.id, period.siteId, db),
    monthsRepository.requestsInRange(period.siteId, period.start, period.end, db),
  ]);
  return { days, items, requests };
}

export interface RangeSlice {
  rows: PersonMonthRow[];
  items: OvertimeRow[];
}

/** The people (and their overtime) for the days from `from` to `to`; no range is the whole month. A person with no days in the range is not listed. */
export function sliceRange(data: MonthData, range: { from?: string | undefined; to?: string | undefined }, departmentId?: string): RangeSlice {
  const days = withinRange(data.days, ({ day }) => day.shiftDate, range);
  const items = withinRange(data.items, (item) => item.shiftDate, range);
  const requests = withinRange(data.requests, (request) => request.shiftDate, range);
  const rows = filterPeople(personMonthRows(days, items, requests), { view: 'all', departmentId });
  return { rows, items };
}

/** "Needs you before approving" is always for the whole month, whatever range the page shows (D2). */
export const needsYouOf = (data: MonthData): NeedsYouCounts =>
  needsYou(
    data.days.map(({ day }) => day),
    data.items,
    data.requests,
  );

export { chipCounts, monthTotals };
