import { NotFoundError, ValidationError } from '../../../../utils/errors';
import { nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { currentPeriod, refreshPeriod } from '../assemble/assemble-service';
import { periodsRepository } from '../periods/periods-repository';
import { viewerFor, type Viewer } from '../timesheets-scope';
import type { PeriodRow } from '../timesheets.types';
import { isMonthKey, monthBounds, monthKeyOf, monthStateOf, type MonthState } from './rules/month-state';

export interface MonthContext {
  period: PeriodRow;
  viewer: Viewer;
  key: string;
  state: MonthState;
  today: NairobiDate;
}

/** What the viewer may do at this month, worked out on the server so the screen never guesses. */
export interface MonthCapabilities {
  canApprove: boolean;
  canExport: boolean;
  canDecide: boolean;
}

export const capabilitiesOf = (subject: AccessSubject, period: PeriodRow, state: MonthState): MonthCapabilities => ({
  canApprove: scopeOf(subject, 'timesheet.close') !== null && subject.siteId === period.siteId && state !== 'APPROVED',
  canExport: scopeOf(subject, 'timesheet.export') !== null,
  canDecide: (scopeOf(subject, 'overtime.approve') !== null || scopeOf(subject, 'timesheet.approve') !== null) && subject.siteId === period.siteId && state !== 'APPROVED',
});

/**
 * The month a viewer asked for, if their scope reaches its site (another branch answers 404, so its existence is never
 * revealed). The current month is created on first read; a month that never existed answers 404 NO_TIMESHEET. An open month is
 * brought up to date on the way; an approved month is never touched.
 */
export async function monthForViewer(subject: AccessSubject, monthKey: string, siteId: string | undefined, now: Date, refresh = true): Promise<MonthContext> {
  if (!isMonthKey(monthKey)) throw new ValidationError('Use YYYY-MM', 'BAD_MONTH');
  const viewer = viewerFor(subject, 'timesheet.read', siteId);
  const bounds = monthBounds(monthKey);
  const today = nairobiToday(now);
  let period = await periodsRepository.byMonth(viewer.siteId, bounds.first, bounds.last);
  if (!period && today >= bounds.first && today <= bounds.last) period = await currentPeriod(viewer.siteId, now);
  if (!period) throw new NotFoundError('No timesheet for that month', 'NO_TIMESHEET');
  if (refresh) await refreshPeriod(period, now);
  const fresh = (await periodsRepository.find(viewer.siteId, period.id)) ?? period;
  return { period: fresh, viewer, key: monthKeyOf(fresh), state: monthStateOf(fresh, today), today };
}

/** A range given on a read must sit inside the month (400 RANGE_OUTSIDE_MONTH). */
export function assertRangeInMonth(period: PeriodRow, range: { from?: string | undefined; to?: string | undefined }): void {
  if (range.from === undefined || range.to === undefined) return;
  if (range.from < period.start || range.to > period.end) throw new ValidationError('Pick days inside the month', 'RANGE_OUTSIDE_MONTH');
}
