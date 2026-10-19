import { hmOf } from '../../../attendance';
import { mondayOf } from '../../../rota';
import { dayShort, hm, hmWords, weekLabel } from '../../_shared/lib/timesheet-words';
import type { MyDay, MyTime, Period } from '../../_shared/types/timesheet-types';

/** My time (Paper Chapter 9, step 1) as the phone draws it. Pure. */

export interface DayLine {
  key: string;
  date: string;
  day: string;
  /** "05:58 → 14:01", or why there is none. */
  range: string;
  hours: string;
  state: 'ok' | 'short' | 'problem';
  note?: string;
  /** The "Report a problem" button belongs on this row (a problem with no report waiting yet). */
  reportable: boolean;
}

const PROBLEM_NOTES: Partial<Record<string, string>> = {
  LEFT_EARLY: 'Clocked out early. Is this wrong?',
  ABSENT: 'No clock recorded. Is this wrong?',
  AUTO_CLOSED: 'The phone closed this shift. Is this wrong?',
  OPEN_SHIFT: 'No clock-out recorded. Is this wrong?',
};

/** One day as a row: the clock range, the hours, and a red bar with the question when something looks wrong. */
export function dayLine(day: MyDay): DayLine {
  const range = day.clockIn ? `${hmOf(day.clockIn)} → ${day.clockOut ? hmOf(day.clockOut) : '…'}` : day.scheduledMinutes > 0 ? 'No clock recorded' : 'Not on the rota';
  const reason = day.reasons.find((r) => PROBLEM_NOTES[r] !== undefined);
  const waiting = day.requests.some((r) => r.state === 'WAITING');
  const base = { key: day.id, date: day.shiftDate, day: dayShort(day.shiftDate), range, hours: hm(day.workedMinutes) };
  if (reason && waiting) return { ...base, state: 'problem', note: 'You reported this. Your manager has it.', reportable: false };
  if (reason) return { ...base, state: 'problem', note: PROBLEM_NOTES[reason], reportable: true };
  const short = day.scheduledMinutes > 0 && day.workedMinutes < day.scheduledMinutes - 5;
  return { ...base, state: short ? 'short' : 'ok', reportable: false };
}

export interface WeekGroup {
  weekStart: string;
  label: string;
  lines: DayLine[];
}

/** Days grouped by week, newest week first and newest day first, so what just happened is on top. Days with nothing planned or worked are left out. */
export function weekGroups(time: MyTime, period: Period): WeekGroup[] {
  const shown = time.days.filter((d) => d.scheduledMinutes > 0 || d.workedMinutes > 0).sort((a, b) => b.shiftDate.localeCompare(a.shiftDate));
  const groups = new Map<string, MyDay[]>();
  for (const day of shown) groups.set(mondayOf(day.shiftDate), [...(groups.get(mondayOf(day.shiftDate)) ?? []), day]);
  return Array.from(groups.entries()).map(([weekStart, days]) => ({
    weekStart,
    label: weekLabel(weekStart, time.weeks.find((w) => w.weekStart === weekStart)?.partWeek ?? false, period.start, period.end),
    lines: days.map(dayLine),
  }));
}

/** The line under the big figure: "worked in October 2026 · 165 h planned". */
export const heroLine = (time: MyTime, month: string): string => `worked in ${month} · ${hm(time.totals.plannedMinutes)} planned`;

/** Overtime as the person sees it: authorised, and waiting for an answer. Null when there is none. */
export function overtimeLine(time: MyTime): string | null {
  const { overtimeAuthorisedMinutes: done, overtimePendingMinutes: waiting } = time.totals;
  const parts: string[] = [];
  if (done > 0) parts.push(`${hmWords(done)} overtime authorised`);
  if (waiting > 0) parts.push(`${hmWords(waiting)} waiting for your manager`);
  return parts.length === 0 ? null : parts.join(' · ');
}
