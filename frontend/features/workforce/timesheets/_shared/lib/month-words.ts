import { dayTitle, hmWords, roleName, wholeHours } from './timesheet-words';
import type { DayResultKey, MonthView, PersonStatus } from '../types/month-types';

/**
 * The words and small rules of the month screens (spec S1 to S8). Pure: every date is a Nairobi day string, never the browser's zone,
 * and no money appears anywhere. Copy follows the spec's "Exact copy" lines.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const parts = (day: string): { y: number; m: number; d: number } => ({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)), d: Number(day.slice(8, 10)) });
const utc = (day: string): number => Date.UTC(parts(day).y, parts(day).m - 1, parts(day).d);
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const addDays = (day: string, n: number): string => iso(utc(day) + n * 86_400_000);
/** Days in the range, both ends counted. */
export const spanOf = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / 86_400_000) + 1;
/** 1 = Monday ... 7 = Sunday. */
export const weekdayNumber = (day: string): number => ((new Date(utc(day)).getUTCDay() + 6) % 7) + 1;

/** "September" for "2026-09". */
export const monthName = (key: string): string => MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
export const monthLabel = (key: string): string => `${monthName(key)} ${key.slice(0, 4)}`;
/** "Sep" style short day: "1 Sep". */
export const dayShortMonth = (day: string): string => `${parts(day).d} ${SHORT[parts(day).m - 1]}`;

/** "176:00", "0:35": minutes as a table cell (no thousands separator). */
export function clockHours(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** "1 Sep to 30 Sep" for a whole month's range, "14 to 20 Sep" inside one month. */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return dayShortMonth(from);
  return parts(from).m === parts(to).m ? `${parts(from).d} to ${dayShortMonth(to)}` : `${dayShortMonth(from)} to ${dayShortMonth(to)}`;
}

/** "1 to 30 September" in words, for a drawer line. */
export function rangeWords(from: string, to: string): string {
  const end = `${parts(to).d} ${MONTHS[parts(to).m - 1]}`;
  return from === to ? end : parts(from).m === parts(to).m ? `${parts(from).d} to ${end}` : `${parts(from).d} ${MONTHS[parts(from).m - 1]} to ${end}`;
}

export const isWholeMonth = (from: string, to: string, last: string): boolean => from === `${last.slice(0, 7)}-01` && to === last;

/** The caption under the picker's fields: "7 days · one Monday to Sunday week" when it is exactly such a week. */
export function spanCaption(from: string, to: string): string {
  const n = spanOf(from, to);
  const week = n === 7 && weekdayNumber(from) === 1;
  return `${n} ${n === 1 ? 'day' : 'days'}${week ? ' · one Monday to Sunday week' : ''}`;
}

export interface WeekPick {
  key: string;
  label: string;
  from: string;
  to: string;
}

/**
 * The quick picks of a month: its Monday-to-Sunday weeks, cut at the month's edges ("Week 1 · 1 to 6 Sep", "Week 5 · 28 to 30"). `last` is
 * the last day that may be picked (the month's end, or today for the open month); a week that starts after it is left out.
 */
export function weekPicks(first: string, last: string): WeekPick[] {
  const picks: WeekPick[] = [];
  let from = first;
  while (from <= last) {
    const sunday = addDays(from, 7 - weekdayNumber(from));
    const to = sunday > last ? last : sunday;
    const n = picks.length + 1;
    picks.push({ key: `week-${n}`, label: `Week ${n} · ${rangeLabel(from, to)}`, from, to });
    from = addDays(to, 1);
  }
  return picks;
}

/** The first day of the month and the last day that may be picked (today for the open month). */
export function pickLimits(month: Pick<MonthView, 'window' | 'state'>, today: string): { first: string; last: string } {
  const last = month.state === 'OPEN' && today >= month.window.start && today < month.window.end ? today : month.window.end;
  return { first: month.window.start, last };
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "1 clock-out fix · 2 overtime decisions": what the fourth cell lists. */
export function needsParts(n: MonthView['needsYou']): string {
  return [
    n.clockOutFixes ? plural(n.clockOutFixes, 'clock-out fix', 'clock-out fixes') : '',
    n.overtimeDecisions ? plural(n.overtimeDecisions, 'overtime decision') : '',
    n.requestsWithManager ? plural(n.requestsWithManager, 'request') : '',
    n.daysToLookAt ? plural(n.daysToLookAt, 'day') + ' to look at' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface Cell {
  key: string;
  label: string;
  value: string;
  detail: string;
  actionable?: boolean;
  tone?: 'success' | 'plain';
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short' });
const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hour12: false });

/** "19 Oct, 11:42" in Nairobi time. */
export const approvedStamp = (iso: string): string => `${DAY_FORMAT.format(new Date(iso))}, ${TIME_FORMAT.format(new Date(iso))}`;

const signerLine = (approval: NonNullable<MonthView['approval']>): string => `${approvedStamp(approval.approvedAt)}${approval.approvedBy ? ` · ${approval.approvedBy.name}, ${roleName(approval.approvedBy.role)}` : ''}`;

/** The four numbers above the table (spec S1 and S8). */
export function kpiCells(month: MonthView): Cell[] {
  const k = month.kpis;
  const open = month.state === 'OPEN' && month.soFar !== null;
  const name = monthName(month.monthKey).toUpperCase();
  const overtimeDetail = (() => {
    if (month.state === 'APPROVED' || k.overtime.toDecideMinutes === 0) {
      const base = `${hmWords(k.overtime.approvedMinutes)} approved`;
      const rest = k.overtime.partNotApprovedMinutes > 0 ? ` · ${hmWords(k.overtime.partNotApprovedMinutes)} not approved` : ' · nothing left to decide';
      return base + rest;
    }
    return `${hmWords(k.overtime.approvedMinutes)} approved · ${hmWords(k.overtime.toDecideMinutes)} to decide${k.overtime.partNotApprovedMinutes > 0 ? ` · ${hmWords(k.overtime.partNotApprovedMinutes)} not approved` : ''}`;
  })();
  const first: Cell = open
    ? { key: 'hours', label: `${name} · HOURS SO FAR`, value: wholeHours(month.soFar!.workedMinutes), detail: `plan so far ${wholeHours(month.soFar!.plannedMinutes)} · open shifts not counted` }
    : { key: 'hours', label: `${name} · HOURS WORKED`, value: wholeHours(k.workedMinutes), detail: `plan was ${wholeHours(k.plannedMinutes)} · ${plural(k.headcount, 'person', 'people')}` };
  const overtime: Cell = { key: 'overtime', label: 'OVERTIME RECORDED', value: hmWords(k.overtime.recordedMinutes).replace(/^0 min$/, '0 h'), detail: overtimeDetail };
  const late: Cell = { key: 'late', label: 'LATE, RECORDED', value: String(k.lateCount), detail: 'for payroll, nothing to approve' };
  let fourth: Cell;
  if (month.state === 'APPROVED' && month.approval) {
    fourth = { key: 'needs', label: 'APPROVED AND SENT TO PAYROLL', value: '✓', detail: signerLine(month.approval), tone: 'success' };
  } else if (month.state === 'OPEN') {
    const n = month.needsYou.total;
    fourth = { key: 'needs', label: 'NEEDS YOU', value: String(n), detail: n > 0 ? needsParts(month.needsYou) : 'Nothing to decide yet', actionable: n > 0 };
  } else {
    const n = month.needsYou.total;
    fourth = { key: 'needs', label: 'NEEDS YOU BEFORE APPROVING', value: String(n), detail: n > 0 ? needsParts(month.needsYou) : 'Nothing left to decide', actionable: n > 0 };
  }
  return [first, overtime, late, fourth];
}

/** The screen-reader sentence for the fourth cell: "Needs you before approving: 3. 1 clock-out fix, 2 overtime decisions." */
export function needsAnnouncement(month: MonthView): string {
  const n = month.needsYou;
  return `Needs you before approving: ${n.total}.${n.total > 0 ? ` ${needsParts(n).replaceAll(' · ', ', ')}.` : ''}`;
}

export type StatusTone = 'warning' | 'success' | 'muted';

/** One row's status words, most urgent first (spec S1, "Status column words"). */
export function statusWords(status: PersonStatus): { text: string; tone: StatusTone } {
  switch (status.kind) {
    case 'CLOCK_OUT_FIX':
      return { text: `Clock-out fix · ${dayTitle(status.date)}`, tone: 'warning' };
    case 'OVERTIME_TO_DECIDE':
      return { text: `Overtime ${hmWords(status.minutes)} to decide`, tone: 'warning' };
    case 'REQUEST_TO_ANSWER':
      return { text: `Request to answer · ${dayTitle(status.date)}`, tone: 'warning' };
    case 'DAY_TO_LOOK_AT':
      return { text: `Day to look at · ${dayTitle(status.date)}`, tone: 'warning' };
    case 'SEVERAL':
      return { text: `Several things to decide (${status.count})`, tone: 'warning' };
    case 'OVERTIME_APPROVED':
      return { text: status.minutes > 0 ? `Overtime ${hmWords(status.minutes)} approved` : 'Overtime approved', tone: 'success' };
    case 'OVERTIME_APPROVED_PART':
      return { text: 'Overtime approved in part', tone: 'success' };
    case 'OVERTIME_NOT_APPROVED':
      return { text: 'Overtime not approved', tone: 'success' };
    case 'CLOCK_FIX_APPROVED':
      return { text: 'Clock-out fix approved', tone: 'success' };
    case 'ABSENT':
      return { text: `Absent ${dayTitle(status.date)}, unpaid`, tone: 'muted' };
    case 'LEAVE':
      return { text: `Approved leave, ${plural(status.days, 'day')}`, tone: 'muted' };
    default:
      return { text: 'Nothing to decide', tone: 'muted' };
  }
}

/** A day's result in words (spec S5). `minutes` is the day's overtime. */
export function resultWords(key: DayResultKey, lateMinutes: number, overtimeMinutes: number): string {
  const extra = hmWords(overtimeMinutes);
  switch (key) {
    case 'REST':
      return 'Rest day';
    case 'ON_ROTA':
      return 'On the rota';
    case 'LATE':
      return `Late ${lateMinutes} min, recorded`;
    case 'LEFT_EARLY':
      return 'Left early';
    case 'OVERTIME_TO_DECIDE':
      return `Overtime ${extra}, to decide`;
    case 'OVERTIME_APPROVED':
      return `Overtime ${extra}, approved`;
    case 'OVERTIME_APPROVED_PART':
      return `Overtime ${extra}, approved in part`;
    case 'OVERTIME_NOT_APPROVED':
      return `Overtime ${extra}, not approved`;
    case 'CLOCK_OUT_MISSING':
      return 'Clock-out missing, fix needed';
    case 'ABSENT':
      return 'Absent, unpaid';
    case 'REQUEST_WAITING':
      return 'Request waiting';
    default:
      return 'Edited by a manager';
  }
}

/** The dialog's note about the other branches (spec S7 "Exact copy"). */
export function payrollWaitingNote(month: string, others: MonthView['otherSites']): string {
  const waiting = others.filter((o) => !o.approved).map((o) => o.name);
  if (others.length === 0) return 'Payroll can start as soon as you approve.';
  if (waiting.length === 0) return `Every branch has approved ${month}. Payroll can start.`;
  const names = waiting.length === 1 ? waiting[0]! : `${waiting.slice(0, -1).join(', ')} and ${waiting[waiting.length - 1]}`;
  return `Today ${names} ${waiting.length === 1 ? 'has' : 'have'} not approved ${month} yet, so payroll waits for ${waiting.length === 1 ? 'it' : 'them'}.`;
}
