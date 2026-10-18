import type { TimesheetStatus } from '@prisma/client';
import { weekStart, type IsoWeekday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { Db } from '../../attendance/days/days-repository';
import { weekStatus } from './day-merge';
import { timesheetDaysRepository } from './timesheet-days-repository';

/**
 * A person's weeks in a period follow their stored days (no week sign-off exists). Used after a person's decision and
 * when a closing period hands days on. Replaces the person's week rows for that period.
 */
export async function rebuildWeeks(tx: Db, periodId: string, siteId: string, employeeId: string, weekStartsOn: IsoWeekday): Promise<void> {
  const mine = (await timesheetDaysRepository.allInPeriod(periodId, siteId, tx)).filter(({ person }) => person.id === employeeId);
  const byWeek = new Map<NairobiDate, { statuses: TimesheetStatus[]; scheduled: number; worked: number }>();
  for (const { day } of mine) {
    const start = weekStart(day.shiftDate, weekStartsOn);
    const week = byWeek.get(start) ?? { statuses: [], scheduled: 0, worked: 0 };
    week.statuses.push(day.status);
    week.scheduled += day.scheduledMinutes;
    week.worked += day.workedMinutes;
    byWeek.set(start, week);
  }
  await timesheetDaysRepository.deleteWeeks(tx, periodId, employeeId);
  await timesheetDaysRepository.replaceWeeks(
    tx,
    periodId,
    siteId,
    employeeId,
    [...byWeek.entries()].map(([start, w]) => ({ weekStart: start, status: weekStatus(w.statuses), scheduledMinutes: w.scheduled, workedMinutes: w.worked })),
  );
}
