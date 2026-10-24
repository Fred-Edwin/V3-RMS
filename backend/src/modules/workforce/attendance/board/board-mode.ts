import type { UserRole } from '@prisma/client';
import { addDays, instantAt, parseClockTime, type NairobiDate } from '../../_shared/time/nairobi-time';
import { ROLE_GRANTS } from '../../_shared/workforce-access';
import type { DayData } from '../attendance.types';

/**
 * What the board is showing besides the people: a live day or a past day, and whether the branch clock is on. The screens read
 * these instead of working them out (frames 2.1 to 2.3 of the V1 design).
 */
export interface BoardMode {
  /** A day that is over: read only, no "Clock in for …", the exceptions still carry "Edit time". */
  readOnly: boolean;
  /** What the caller may do on this board right now. */
  actions: { clockFor: boolean; fixTime: boolean };
  /** The branch clock. `on: false` means the tiles On shift, Late and Not in read "Not tracked / clock is off"; On leave stays real. */
  clock: { on: boolean; siteName: string | null; canSwitch: boolean; whoCanSwitch: string[] };
  /** Past-day wording (W27). Null on a live day; then the screen keeps "expected by <asOf>" and "On shift now". */
  pastDay: { tag: string; line: string; tiles: { onShift: string; late: string; notIn: string; onLeave: string } } | null;
  /** Past day only: people whose clock time a manager changed after the day ended (the side panel "Fixed after the day"). */
  fixedAfterTheDay: { employeeId: string; name: string; changes: number }[];
}

const ROLE_WORDS: Partial<Record<UserRole, string>> = { DIRECTOR: 'Director', SYSTEM_ADMIN: 'System Admin', HR_MANAGER: 'HR Manager', MANAGER: 'Branch Manager', STORE_MANAGER: 'Store Manager' };

/** The roles that hold the switch, read from the access table so a change there shows here. */
export const whoCanSwitch = (): string[] =>
  (Object.entries(ROLE_GRANTS) as [UserRole, Record<string, unknown>][]).filter(([, grants]) => 'attendance.switch' in grants).map(([role]) => ROLE_WORDS[role] ?? role);

export const PAST_DAY = {
  tag: 'Past day · read only',
  line: 'This day is over. You can read it, and fix a clock time with Edit time.',
  tiles: { onShift: 'WORKED', late: 'LATE', notIn: 'ABSENT', onLeave: 'ON LEAVE' },
} as const;

/** Clock events recorded by a person after the day ended, counted per employee. */
export function fixedAfterTheDay(date: NairobiDate, data: DayData, names: ReadonlyMap<string, string>): BoardMode['fixedAfterTheDay'] {
  const dayEnded = instantAt(addDays(date, 1), parseClockTime('00:00'));
  const byPerson = new Map<string, number>();
  for (const event of data.events) {
    if (event.shiftDate === date && event.recordedById !== null && event.createdAt >= dayEnded) byPerson.set(event.employeeId, (byPerson.get(event.employeeId) ?? 0) + 1);
  }
  return [...byPerson].map(([employeeId, changes]) => ({ employeeId, name: names.get(employeeId) ?? '', changes })).sort((a, b) => a.name.localeCompare(b.name));
}
