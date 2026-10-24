import { hmOf } from '../../_shared/lib/nairobi-clock';
import type { TimeFilter, TimeMonth, TimeRow, TimeTiles } from '../../_shared/types/attendance-types';

/** Words for the Time tab and the Overview tiles (Paper Schedule V1, frames 1.1 to 1.5), worked out from T1 and T2. Pure; components only draw. */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-10" to "October 2026". */
export function monthWords(month: string): string {
  const [year, number] = month.split('-');
  return `${MONTHS[Number(number) - 1] ?? month} ${year}`;
}

/** One month before (-1) or after (+1): "2026-12" + 1 is "2027-01". */
export function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const index = year * 12 + (number - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** "161 h 20 m", "8 h 09 m", "1 h 25 m"; whole hours read "0 h" and "8 h". */
export function hoursWords(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} m`;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "SAT 24 OCT": the date column, in Geist Mono capitals. */
export function dateCell(date: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'short', day: '2-digit', month: 'short' }).formatToParts(new Date(`${date}T12:00:00+03:00`));
  const pick = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  // Three letters for the month ("SEP", not "SEPT").
  return `${pick('weekday')} ${pick('day')} ${pick('month').slice(0, 3)}`.toUpperCase();
}

/** The line at the right of the month picker. */
export function lateLine(time: Pick<TimeMonth, 'last30' | 'canEditTime'>): string {
  const { lateDays, lateMinutes } = time.last30;
  const late = lateDays === 0 ? 'none' : `${plural(lateDays, 'day', 'days')}, ${plural(lateMinutes, 'minute', 'minutes')}`;
  return `Late in the last 30 days: ${late}. Includes today.${time.canEditTime ? '' : ' Read only for your role.'}`;
}

export interface SummaryCell {
  key: string;
  label: string;
  value: string;
  detail: string;
  /** Late and absent figures are red-brown when there is something to see. */
  tone: 'default' | 'error';
}

export function summaryCells(time: Pick<TimeMonth, 'summary'>): SummaryCell[] {
  const s = time.summary;
  return [
    { key: 'worked', label: 'DAYS WORKED', value: String(s.daysWorked), detail: `of ${s.rosteredDays} rostered`, tone: 'default' },
    { key: 'hours', label: 'HOURS', value: hoursWords(s.workedMinutes), detail: 'clocked this month', tone: 'default' },
    { key: 'late', label: 'LATE DAYS', value: String(s.lateDays), detail: `${plural(s.lateMinutes, 'minute', 'minutes')} in total`, tone: s.lateDays > 0 ? 'error' : 'default' },
    { key: 'overtime', label: 'OVERTIME', value: hoursWords(s.overtimeApprovedMinutes), detail: 'approved', tone: 'default' },
    { key: 'absent', label: 'ABSENT DAYS', value: String(s.absentDays), detail: 'no clock, no leave', tone: s.absentDays > 0 ? 'error' : 'default' },
  ];
}

export const FILTER_LABELS: Record<TimeFilter, string> = { all: 'All days', late: 'Late', overtime: 'Overtime', absent: 'Absent' };
export const FILTER_ORDER: readonly TimeFilter[] = ['all', 'late', 'overtime', 'absent'];

export interface RowView {
  key: string;
  date: string;
  /** The shift column; a day off reads "Day off" and nothing else. */
  shift: string;
  inAt: string;
  out: string;
  hours: string;
  /** "Late 12 min" or "Absent"; null when neither. */
  tag: { tone: 'error'; text: string } | null;
  overtime: string;
  today: boolean;
  /** A day off and a leave day have no times and no Edit time. */
  quiet: boolean;
  canEdit: boolean;
}

const DASH = '—';

/** The shift column: "06:00 – 14:00", two shifts joined with " · ". */
export const shiftWords = (row: Pick<TimeRow, 'shifts'>): string => row.shifts.map((s) => `${s.startTime} – ${s.endTime}`).join(' · ');

export function rowView(row: TimeRow, canEditTime: boolean): RowView {
  const base = { key: row.date, date: dateCell(row.date), today: row.kind === 'ON_SHIFT', overtime: row.overtimeApprovedMinutes > 0 ? `${hoursWords(row.overtimeApprovedMinutes)} approved` : DASH };
  if (row.kind === 'DAY_OFF' || row.kind === 'ON_LEAVE') {
    return { ...base, shift: row.kind === 'DAY_OFF' ? 'Day off' : 'On leave', inAt: '', out: '', hours: '', tag: null, overtime: '', quiet: true, canEdit: false };
  }
  const shift = shiftWords(row) || DASH;
  if (row.kind === 'ON_SHIFT') {
    return { ...base, shift, inAt: row.clockedInAt ? hmOf(row.clockedInAt) : DASH, out: 'On shift', hours: row.soFarMinutes === null ? DASH : `so far ${hoursWords(row.soFarMinutes)}`, tag: null, quiet: false, canEdit: canEditTime };
  }
  if (row.kind === 'ABSENT') {
    return { ...base, shift, inAt: DASH, out: DASH, hours: '0 h', tag: { tone: 'error', text: 'Absent' }, quiet: false, canEdit: canEditTime };
  }
  if (row.kind === 'NOT_IN') {
    return { ...base, shift, inAt: DASH, out: DASH, hours: DASH, tag: null, overtime: DASH, quiet: false, canEdit: canEditTime };
  }
  if (row.kind === 'UPCOMING') {
    return { ...base, shift, inAt: DASH, out: DASH, hours: DASH, tag: null, overtime: DASH, quiet: false, canEdit: false };
  }
  return {
    ...base,
    shift,
    inAt: row.clockedInAt ? hmOf(row.clockedInAt) : DASH,
    out: row.clockedOutAt ? hmOf(row.clockedOutAt) : DASH,
    hours: hoursWords(row.workedMinutes),
    // "Late 12 min" uses minutes past the grace time so the row and the summary agree.
    tag: row.late ? { tone: 'error', text: `Late ${row.minutesAfterGrace} min` } : null,
    quiet: false,
    canEdit: canEditTime,
  };
}

/** "Showing 1 to 9 of 24 days". */
export const rangeWords = (page: number, pageSize: number, total: number): string => (total === 0 ? 'Nothing to show' : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, total)} of ${total} days`);

export interface EmptyCopy {
  title: string;
  line: string;
}

/** The two empty states of frame 1.4; null when the tab has days to show. */
export function emptyCopy(time: Pick<TimeMonth, 'emptyReason' | 'name' | 'positionName' | 'organizationName'>): EmptyCopy | null {
  if (time.emptyReason === 'DOES_NOT_CLOCK') {
    const position = time.positionName ?? 'Staff';
    return {
      title: `${time.name} · ${position} does not clock in`,
      line: `${position}s are not on the clock, so there are no days to show. Their pay is a fixed amount each month.`,
    };
  }
  if (time.emptyReason === 'CLOCK_OFF') {
    return {
      title: time.organizationName ? `The clock is off at ${time.organizationName}` : 'The clock is off at this branch',
      line: 'Clock-ins are not being recorded at this branch, so there are no new days to show. Days from before the clock was switched off stay here. The Director or the System Admin can switch it on.',
    };
  }
  return null;
}

/** A month with no days for the chosen chip (the chip counts are still shown). */
export const NO_DAYS_FOR_CHIP: Record<TimeFilter, string> = {
  all: 'No days to show in this month.',
  late: 'No late days in this month.',
  overtime: 'No approved overtime in this month.',
  absent: 'No absent days in this month.',
};

export interface TileView {
  key: string;
  label: string;
  value: string;
  detail: string;
  /** "Not tracked" and "Not set" read grey. */
  muted: boolean;
}

/** The Overview tiles: On time, Overtime, Leave left (frame 1.3). */
export function tileViews(tiles: TimeTiles): TileView[] {
  const { onTime, overtime } = tiles;
  return [
    onTime.tracked
      ? { key: 'on-time', label: 'ON TIME', value: `${onTime.onTime}/${onTime.worked}`, detail: 'shifts, last 30 days', muted: false }
      : { key: 'on-time', label: 'ON TIME', value: 'Not tracked', detail: 'Does not clock in', muted: true },
    overtime.tracked
      ? { key: 'overtime', label: 'OVERTIME', value: hoursWords(overtime.approvedMinutes), detail: 'approved this month', muted: false }
      : { key: 'overtime', label: 'OVERTIME', value: 'Not tracked', detail: 'Does not clock in', muted: true },
    { key: 'leave-left', label: 'LEAVE LEFT', value: 'Not set', detail: 'No leave rule for this position yet', muted: true },
  ];
}

/** Error and busy copy (frame 1.5). A 429 or 503 is "busy"; anything else is "could not load". */
export function problemCopy(status: number, name: string, positionName: string | null): { busy: boolean; title: string; line: string } {
  const who = positionName ? `${name} · ${positionName}` : name;
  if (status === 429 || status === 503) return { busy: true, title: 'The system is busy', line: 'Time is slow to load. Wait a moment and try again. Nothing was changed.' };
  return { busy: false, title: 'We could not load this', line: `The time for ${who} did not load. Nothing was changed.` };
}
