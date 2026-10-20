import type { FactDay, FactsSnapshot } from '../_shared/conduct-snapshots';

/** A timesheet day as the repository returns it. */
export interface TimesheetFactRow {
  date: string;
  reasons: readonly string[];
  lateExcused: boolean;
  status: string;
  minutesLate: number;
  plannedIn: string | null;
  clockIn: string | null;
}

/** Whether a day is a late arrival the manager did not excuse. */
export const isUnexcusedLate = (row: TimesheetFactRow): boolean => row.reasons.includes('LATE') && !row.lateExcused;

/** An absent day stays unexcused unless a person approved the day (a manager accepted the absence). */
export const isUnexcusedAbsence = (row: TimesheetFactRow): boolean => row.reasons.includes('ABSENT') && row.status !== 'APPROVED';

/**
 * The facts for a Lateness or Absence notice from one month's timesheet days (C5): the unexcused days only, in date order, with
 * the total late minutes. Null when there are none (the screen then says "No unexcused lateness in {month}" and blocks the notice).
 */
export function selectFacts(kind: FactsSnapshot['kind'], monthKey: string, rows: readonly TimesheetFactRow[]): FactsSnapshot | null {
  const pick = kind === 'LATENESS' ? isUnexcusedLate : isUnexcusedAbsence;
  const days: FactDay[] = rows
    .filter((row) => row.date.startsWith(`${monthKey}-`) && pick(row))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({ date: row.date, plannedIn: row.plannedIn, clockIn: row.clockIn, minutesLate: kind === 'LATENESS' ? row.minutesLate : 0, excused: false }));
  if (days.length === 0) return null;
  return { kind, monthKey, count: days.length, minutes: days.reduce((sum, day) => sum + day.minutesLate, 0), days };
}

/** The last three calendar months before `monthKey` (inclusive of it), newest first, for the month select. */
export function offeredMonths(currentMonthKey: string): string[] {
  const [y, m] = currentMonthKey.split('-').map(Number) as [number, number];
  return [0, 1, 2].map((back) => {
    const total = y * 12 + (m - 1) - back;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}

/** The default month: the last completed month (C5). */
export const defaultMonthKey = (currentMonthKey: string): string => offeredMonths(currentMonthKey)[1] ?? currentMonthKey;
