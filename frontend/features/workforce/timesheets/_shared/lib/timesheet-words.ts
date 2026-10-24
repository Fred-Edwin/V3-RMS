import { dateOf, hmOf } from '../../../attendance';
import { formatDuration, formatHoursMinutes } from '../../../_shared/lib/data/time';
import type { DayReason, Period, RequestKind, RequestState } from '../types/timesheet-types';

/** The words every Timesheets screen uses. Pure; all dates are Nairobi days, never the browser's zone. */

const noon = (day: string): Date => new Date(`${day}T12:00:00+03:00`);
const nairobi = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', ...options });

const MONTH_YEAR = nairobi({ month: 'long', year: 'numeric' });
const LONG_DAY_MONTH = nairobi({ weekday: 'long', day: 'numeric', month: 'long' });
const DAY_MONTH = nairobi({ day: 'numeric', month: 'short' });
const DAY_MONTH_LONG = nairobi({ day: 'numeric', month: 'long' });
const WEEKDAY_SHORT = nairobi({ weekday: 'short', day: 'numeric' });
const WEEKDAY_ONLY = nairobi({ weekday: 'long' });

/** Minutes as "41 h 05". */
export const hm = (minutes: number): string => formatHoursMinutes(minutes);
/** Minutes as "1 h 30", "35 min". */
export const hmWords = (minutes: number): string => formatDuration(minutes);
/** Hours rounded to the whole hour with a thousands comma: "1,046 h". */
export const wholeHours = (minutes: number): string => `${Math.round(minutes / 60).toLocaleString('en-GB')} h`;

export const monthOf = (period: Pick<Period, 'start'>): string => MONTH_YEAR.format(noon(period.start));
/** "Mon 5", for a day row. */
export const dayShort = (day: string): string => WEEKDAY_SHORT.format(noon(day)).replace(',', '');
/** Newer ICU data spells September "Sept" in en-GB; the spec and Paper write "Sep". */
const sep = (text: string): string => text.replace('Sept', 'Sep');

/** "9 Oct". */
export const dayMonth = (day: string): string => sep(DAY_MONTH.format(noon(day)));
/** "Friday 9 October". */
export const dayLong = (day: string): string => LONG_DAY_MONTH.format(noon(day)).replace(',', '');
/** "Fri 9 Oct" for a request title. */
export const dayTitle = (day: string): string => `${WEEKDAY_SHORT.format(noon(day)).split(/[ ,]+/)[0]} ${dayMonth(day)}`;

/** "Monday 2 November, 18:00": when the period closes by itself. */
export function cutoffWords(period: Pick<Period, 'cutoffAt'>): string {
  const at = new Date(period.cutoffAt);
  return `${LONG_DAY_MONTH.format(at).replace(',', '')}, ${hmOf(at)}`;
}

/** The line under the page title: "October 2026 · closes by itself on Monday 2 November, 18:00". */
export function periodLine(period: Period): string {
  const month = monthOf(period);
  if (period.state === 'CLOSED') return `${month} · closed ${closedWhen(period)}`;
  if (period.state === 'CLOSING') return `${month} · closing now`;
  return `${month} · closes by itself on ${cutoffWords(period)}`;
}

/** "Mon 2 Nov, 18:00" style for a closed period. */
export function closedWhen(period: Pick<Period, 'closedAt' | 'closeKind'>): string {
  if (!period.closedAt) return '';
  const at = new Date(period.closedAt);
  return `${DAY_MONTH_LONG.format(at)}, ${hmOf(at)}${period.closeKind === 'AUTO' ? ' (automatically)' : ' (early, by a manager)'}`;
}

/** "5 Oct to 11 Oct", and "part week" when the week runs into the neighbouring month. */
export function weekLabel(weekStart: string, partWeek: boolean, periodStart: string, periodEnd: string): string {
  const sunday = new Date(noon(weekStart).getTime() + 6 * 86_400_000);
  const first = weekStart < periodStart ? periodStart : weekStart;
  const sundayDay = dateOf(sunday);
  const last = sundayDay > periodEnd ? periodEnd : sundayDay;
  return `${DAY_MONTH.format(noon(first))} to ${DAY_MONTH.format(noon(last))}${partWeek ? ' · part week' : ''}`;
}

export const REASON_WORDS: Record<DayReason, string> = {
  LATE: 'Late',
  LEFT_EARLY: 'Left early',
  ABSENT: 'Did not come in',
  EDITED: 'Time was edited',
  AUTO_CLOSED: 'Closed by the phone',
  OPEN_SHIFT: 'Shift still open',
  PHONE_CLOCK: 'The phone clock was wrong',
  UNSCHEDULED: 'Worked off the rota',
  OVERTIME: 'Overtime',
  CHANGED_AFTER_APPROVAL: 'Changed after you approved it',
};

/** "Late 12 min · closed by the phone": the words in the "what needs you" cell and on the day card. */
export function reasonsLine(reasons: readonly DayReason[], minutesLate: number): string {
  return reasons.filter((r) => r !== 'OVERTIME').map((r) => (r === 'LATE' && minutesLate > 0 ? `Late ${minutesLate} min` : REASON_WORDS[r])).join(' · ');
}

export const REQUEST_KIND_WORDS: Record<RequestKind, string> = {
  CLOCK_TIME_WRONG: 'A clock time is wrong',
  WORKED_NOT_RECORDED: 'I worked but it is not recorded',
  CLOCKED_OUT_BY_MISTAKE: 'I clocked out by mistake',
  ROTA_WRONG: 'My rota is wrong',
  OVERTIME_MISSING: 'Overtime I worked is missing',
  PAY_OTHER: 'Something else about my pay',
};

/** The title a request carries in a list: "Clock-out, Fri 9 Oct". */
export function requestTitle(kind: RequestKind, requested: Record<string, unknown>, shiftDate: string): string {
  const day = dayTitle(shiftDate);
  switch (kind) {
    case 'CLOCK_TIME_WRONG':
      return `${requested.type === 'IN' ? 'Clock-in' : 'Clock-out'}, ${day}`;
    case 'CLOCKED_OUT_BY_MISTAKE':
      return `Clocked out by mistake, ${day}`;
    case 'WORKED_NOT_RECORDED':
      return `Worked, not recorded, ${day}`;
    case 'ROTA_WRONG':
      return `Rota, ${day}`;
    case 'OVERTIME_MISSING':
      return `Overtime, ${day}`;
    default:
      return `Pay question, ${day}`;
  }
}

export const REQUEST_STATE_WORDS: Record<RequestState, string> = { WAITING: 'WAITING', APPROVED: 'APPROVED', DECLINED: 'NOT APPROVED', WITHDRAWN: 'WITHDRAWN' };

const STAMP_DAY = nairobi({ day: 'numeric', month: 'short', year: 'numeric' });
/** "3 Nov 2026, 09:12" for an instant, in Nairobi time. */
export const stampOf = (iso: string): string => `${STAMP_DAY.format(new Date(iso))}, ${hmOf(iso)}`;

/** A name as a sentence wants it: the bracketed suffix some display names carry ("Faith Njeri (BM Nyeri Town)") is dropped. */
export const plainName = (full: string): string => full.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

export const ROLE_WORDS: Record<string, string> = { MANAGER: 'Branch Manager', STORE_MANAGER: 'Store Manager', HR_MANAGER: 'HR Manager', SYSTEM_ADMIN: 'System Admin', DIRECTOR: 'Director', ACCOUNTANT: 'Accountant' };

/** A role as a person says it ("Branch Manager"); a role the table does not know is shown as it came. */
export const roleName = (role: string | null | undefined): string => (role ? (ROLE_WORDS[role] ?? role) : '');

export const weekdayOf =(day: string): string => WEEKDAY_ONLY.format(noon(day));
