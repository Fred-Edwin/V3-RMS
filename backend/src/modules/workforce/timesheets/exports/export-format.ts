import type { DayResultKey } from '../months/day-result';
import { hoursMinutes, spoken } from '../approval/decided-by';

/** Hours in a table cell: `h:mm`, no thousands (176:00, 0:35). */
export const cellHours = (minutes: number): string => hoursMinutes(minutes);

/** Whole hours with separators for headings and the figures band: "5,360 h" (half up). */
export const headingHours = (minutes: number): string => `${Math.round(minutes / 60).toLocaleString('en-US')} h`;

/** Overtime in the figures band: "3 h 45" / "40 min" / "0". */
export const bandOvertime = (minutes: number): string => (minutes === 0 ? '0' : spoken(minutes));

/** Late minutes in a cell: "5 min", zero shows 0. */
export const lateCell = (minutes: number): string => (minutes === 0 ? '0' : `${minutes} min`);

/** Absent and leave days: "1 d", "3 d", zero shows 0. */
export const dayCell = (days: number): string => (days === 0 ? '0' : `${days} d`);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "19 October 2026, 11:42" in Nairobi time (the 24-hour clock). */
export function longStamp(instant: Date): string {
  const nairobi = new Date(instant.getTime() + 3 * 3_600_000);
  const h = String(nairobi.getUTCHours()).padStart(2, '0');
  const m = String(nairobi.getUTCMinutes()).padStart(2, '0');
  return `${nairobi.getUTCDate()} ${MONTHS[nairobi.getUTCMonth()]} ${nairobi.getUTCFullYear()}, ${h}:${m}`;
}

/** "19 October 2026" from a date string. */
export function longDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "14 to 20 September 2026" or "1 to 30 September". */
export function rangeWords(from: string, to: string): string {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  if (fy === ty && fm === tm) return `${fd} to ${td} ${MONTHS[tm - 1]} ${ty}`;
  return `${fd} ${MONTHS[fm - 1]} ${fy} to ${td} ${MONTHS[tm - 1]} ${ty}`;
}

/** Clock instants as Nairobi "HH:MM". */
export function clockOf(instantIso: string | null): string | null {
  if (!instantIso) return null;
  const nairobi = new Date(new Date(instantIso).getTime() + 3 * 3_600_000);
  return `${String(nairobi.getUTCHours()).padStart(2, '0')}:${String(nairobi.getUTCMinutes()).padStart(2, '0')}`;
}

/** The day's result in words, for the Daily hours sheet. */
export function resultWords(key: DayResultKey, args: { lateMinutes: number; overtimeMinutes: number }): string {
  switch (key) {
    case 'REST':
      return 'Rest day';
    case 'ON_ROTA':
      return 'On the rota';
    case 'LATE':
      return `Late ${args.lateMinutes} min, recorded`;
    case 'LEFT_EARLY':
      return 'Left early';
    case 'OVERTIME_TO_DECIDE':
      return `Overtime ${args.overtimeMinutes} min, to decide`;
    case 'OVERTIME_APPROVED':
      return `Overtime ${args.overtimeMinutes} min, approved`;
    case 'OVERTIME_APPROVED_PART':
      return `Overtime ${args.overtimeMinutes} min, approved in part`;
    case 'OVERTIME_NOT_APPROVED':
      return `Overtime ${args.overtimeMinutes} min, not approved`;
    case 'CLOCK_OUT_MISSING':
      return 'Clock-out missing, fix needed';
    case 'ABSENT':
      return 'Absent, unpaid';
    case 'REQUEST_WAITING':
      return 'Request waiting';
    case 'EDITED':
      return 'Edited by a manager';
  }
}
