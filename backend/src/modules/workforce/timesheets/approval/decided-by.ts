import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { DayRow, OvertimeRow } from '../timesheets.types';
import { dayNeed } from '../months/rules/needs-you';

export interface Decider {
  name: string;
  role: string;
}

/** One reason a person's month reads the way it does. Codes are stored in the snapshot; the wording is built on the way out. */
export type DecidedLine =
  | { code: 'MATCHES_ROTA' }
  | { code: 'OVERTIME_APPROVED'; by: Decider | null; minutes: number }
  | { code: 'OVERTIME_PART'; by: Decider | null; minutes: number; ofMinutes: number }
  | { code: 'OVERTIME_NOT_APPROVED'; by: Decider | null }
  | { code: 'CLOCK_FIX_APPROVED'; by: Decider | null }
  | { code: 'LEAVE'; days: number }
  | { code: 'ABSENT'; date: NairobiDate }
  | { code: 'SERVICE_TAIL' };

const ROLE_LABELS: Record<string, string> = {
  MANAGER: 'Branch Manager',
  STORE_MANAGER: 'Store Manager',
  HR_MANAGER: 'HR Manager',
  DIRECTOR: 'Director',
  ACCOUNTANT: 'Accountant',
  SYSTEM_ADMIN: 'System Admin',
};
export const roleLabel = (role: string): string => ROLE_LABELS[role] ?? role.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const whoText = (by: Decider | null): string => (by ? `${by.name}, ${roleLabel(by.role)}` : 'a manager');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const shortDay = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** Hours and minutes as the document prints them: `h:mm` (176:00, 0:35). */
export const hoursMinutes = (minutes: number): string => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
/** Small amounts in words: "35 min", "1 h 30", "3 h". */
export const spoken = (minutes: number): string => (minutes < 60 ? `${minutes} min` : minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`);

/** Rule: the "Decided by" lines of one person, in the order the spec words them (document section 10). Names come from `nameOf`. */
export function decidedLines(days: readonly DayRow[], items: readonly OvertimeRow[], nameOf: (userId: string | null) => Decider | null, leaveDays = 0): DecidedLine[] {
  const lines: DecidedLine[] = [];
  const settled = days.filter((d) => d.status === 'AUTO_APPROVED' || d.status === 'MATCHED');
  if (settled.length > 0) lines.push({ code: 'MATCHES_ROTA' });
  for (const item of items) {
    if (item.status === 'AUTO_AUTHORISED') lines.push({ code: 'SERVICE_TAIL' });
    else if (item.status === 'APPROVED_PART') lines.push({ code: 'OVERTIME_PART', by: nameOf(item.decidedById), minutes: item.authorisedMinutes - item.autoMinutes, ofMinutes: item.needsMinutes });
    else if (item.status === 'APPROVED') lines.push({ code: 'OVERTIME_APPROVED', by: nameOf(item.decidedById), minutes: item.authorisedMinutes - item.autoMinutes });
    else if (item.status === 'DECLINED') lines.push({ code: 'OVERTIME_NOT_APPROVED', by: nameOf(item.decidedById) });
  }
  for (const day of days) if (day.status === 'APPROVED' && day.decidedById && (day.reasons.includes('OPEN_SHIFT') || day.reasons.includes('AUTO_CLOSED') || dayNeed({ status: 'NEEDS_LOOK', reasons: day.reasons }) === 'CLOCK_OUT_FIX')) lines.push({ code: 'CLOCK_FIX_APPROVED', by: nameOf(day.decidedById) });
  if (leaveDays > 0) lines.push({ code: 'LEAVE', days: leaveDays });
  for (const day of days.filter((d) => d.reasons.includes('ABSENT')).slice(0, 1)) lines.push({ code: 'ABSENT', date: day.shiftDate });
  return lines;
}

/** One line of words for the PDF's last column and the Excel's "Decided by" cell; several lines join with "; ". */
export function decidedText(lines: readonly DecidedLine[]): string {
  const words = lines.map((line): string => {
    switch (line.code) {
      case 'MATCHES_ROTA':
        return 'Matches the shift, approved by the system';
      case 'OVERTIME_APPROVED':
        return `Overtime approved by ${whoText(line.by)}`;
      case 'OVERTIME_PART':
        return `Overtime approved in part (${spoken(line.minutes)} of ${spoken(line.ofMinutes)}) by ${whoText(line.by)}`;
      case 'OVERTIME_NOT_APPROVED':
        return `Overtime not approved by ${whoText(line.by)}`;
      case 'CLOCK_FIX_APPROVED':
        return `Clock-out fix approved by ${whoText(line.by)}`;
      case 'LEAVE':
        return `Approved leave, ${line.days} ${line.days === 1 ? 'day' : 'days'}`;
      case 'ABSENT':
        return `Absent ${shortDay(line.date)}, no leave; unpaid by the Rules`;
      case 'SERVICE_TAIL':
        return 'Service tail within the allowance';
    }
  });
  return words.join('; ');
}
