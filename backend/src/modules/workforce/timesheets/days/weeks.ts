import type { TimesheetStatus } from '@prisma/client';
import { addDays, weekStart, type IsoWeekday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { Db } from '../../attendance/days/days-repository';
import { weekStatus } from './day-merge';
import { timesheetDaysRepository } from './timesheet-days-repository';

export interface WeekView {
  weekStart: string;
  status: string;
  scheduledMinutes: number;
  workedMinutes: number;
  /** The Monday to Sunday week runs into the neighbouring period; this row counts only this period's days. */
  partWeek: boolean;
}

/** A stored week row as the API shows it. Weekly rules still read the whole week (see assemble-service). */
export function weekView(row: { weekStart: Date; status: string; scheduledMinutes: number; workedMinutes: number }, period: { start: NairobiDate; end: NairobiDate }): WeekView {
  const start = row.weekStart.toISOString().slice(0, 10);
  return {
    weekStart: start,
    status: row.status,
    scheduledMinutes: row.scheduledMinutes,
    workedMinutes: row.workedMinutes,
    partWeek: start < period.start || addDays(start as NairobiDate, 6) > period.end,
  };
}

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
