import type { WorkforceKpiCell } from '../../../_shared';
import { dayWords, hmOf } from '../../_shared/lib/nairobi-clock';
import type { Board, BoardDepartment, BoardPerson, BoardShift } from '../../_shared/types/attendance-types';

/** Words and groups for the Today board, worked out from the server's board. Pure; the components only draw it. */

const NEEDS_LOOK_FIRST: Record<string, number> = { NOT_IN: 0, MISSED: 1, AUTO_CLOSED: 2, LATE: 3 };

/** The shift on a person that needs a look, if any (the one the server ranked most urgent). */
export function lookShiftOf(person: BoardPerson): BoardShift | null {
  const ranked = person.shifts.filter((s) => s.state in NEEDS_LOOK_FIRST).sort((a, b) => (NEEDS_LOOK_FIRST[a.state] ?? 9) - (NEEDS_LOOK_FIRST[b.state] ?? 9));
  return ranked[0] ?? null;
}

export interface LookItem {
  key: string;
  employeeId: string;
  name: string;
  department: string;
  departmentId: string | null;
  /** "Not in · due 06:00" or "Late 22 min · clocked in 06:22". */
  status: string;
  tone: 'error' | 'warning';
  kind: 'NOT_IN' | 'LATE' | 'AUTO_CLOSED' | 'MISSED';
  entryId: string;
  /** The day of the shift: the board's day, or yesterday for a shift the phone closed overnight. */
  date: string;
  late?: { grace: number; minutes: number };
}

export function lookItems(board: Board, snoozed: ReadonlySet<string> = new Set()): LookItem[] {
  const items: LookItem[] = [];
  for (const person of board.people) {
    const shift = lookShiftOf(person);
    if (!shift || snoozed.has(person.employeeId)) continue;
    const department = person.departmentName ?? 'No department';
    const base = { key: `${person.employeeId}:${shift.entryId}`, employeeId: person.employeeId, name: person.name, department, departmentId: person.departmentId, entryId: shift.entryId, date: board.date };
    if (shift.state === 'NOT_IN' || shift.state === 'MISSED') {
      items.push({ ...base, kind: shift.state, tone: 'error', status: shift.state === 'NOT_IN' ? `Not in · due ${shift.startTime}` : `Missed · was due ${shift.startTime}` });
    } else if (shift.state === 'AUTO_CLOSED') {
      items.push({ ...base, kind: 'AUTO_CLOSED', tone: 'warning', status: `Closed by the phone${shift.clockedOutAt ? ` at ${hmOf(shift.clockedOutAt)}` : ''}` });
    } else if (shift.state === 'LATE') {
      const grace = Math.max(0, shift.minutesLate - shift.minutesAfterGrace);
      items.push({
        ...base,
        kind: 'LATE',
        tone: 'warning',
        status: `Late ${shift.minutesLate} min${shift.clockedInAt ? ` · clocked in ${hmOf(shift.clockedInAt)}` : ''}`,
        late: { grace: Math.round((grace / 30) * 100), minutes: shift.minutesAfterGrace },
      });
    }
  }
  // A shift the phone closed on an earlier day (or today) that no manager has put right yet stays on the list until someone does.
  for (const a of board.attention) {
    if (items.some((i) => i.entryId === a.entryId) || snoozed.has(a.employeeId)) continue;
    const person = board.people.find((p) => p.employeeId === a.employeeId);
    items.push({
      key: `${a.employeeId}:${a.entryId}`,
      employeeId: a.employeeId,
      name: a.name,
      department: person?.departmentName ?? 'No department',
      departmentId: person?.departmentId ?? null,
      entryId: a.entryId,
      date: a.date,
      kind: 'AUTO_CLOSED',
      tone: 'warning',
      status: `Closed by the phone${a.closedAt ? ` at ${hmOf(a.closedAt)}` : ''}${a.date === board.date ? '' : ` · ${dayWords(a.date)}`}`,
    });
  }
  const order = (i: LookItem): number => NEEDS_LOOK_FIRST[i.kind] ?? 9;
  return items.sort((a, b) => order(a) - order(b));
}

export interface ChipItem {
  key: string;
  label: string;
  count: number;
  marker?: 'warning' | 'error';
}

/** All, then one chip per department: the number expected, with a square when someone there is late (amber) or not in (red). */
export function chipItems(board: Board): ChipItem[] {
  const expectedAll = board.departments.reduce((n, d) => n + d.expected, 0);
  return [
    { key: 'all', label: 'All', count: expectedAll },
    ...board.departments.map((d): ChipItem => ({ key: d.departmentId ?? 'none', label: d.name, count: d.expected, marker: d.notIn > 0 ? 'error' : d.late > 0 ? 'warning' : undefined })),
  ];
}

export interface DepartmentRowItem {
  key: string;
  name: string;
  onTime: number;
  people: string[];
  note: { text: string; tone: 'muted' | 'warning' | 'error' };
}

export function departmentRows(board: Board): DepartmentRowItem[] {
  return board.departments.map((d: BoardDepartment): DepartmentRowItem => {
    const members = board.people.filter((p) => (p.departmentId ?? 'none') === (d.departmentId ?? 'none') && ['ON_SHIFT', 'LATE', 'ENDING', 'STAYED_ON'].includes(p.state));
    const problems = [d.late > 0 ? `${d.late} late` : '', d.notIn > 0 ? `${d.notIn} not in` : ''].filter(Boolean).join(', ');
    const head = d.head ? `Head ${d.head.name}${d.head.isActing ? ' (acting)' : ''}` : null;
    const note = !d.head && d.departmentId ? { text: 'No head assigned', tone: 'error' as const } : problems ? { text: [head, problems].filter(Boolean).join(' · '), tone: 'warning' as const } : { text: [head, d.complete ? 'Complete' : null].filter(Boolean).join(' · '), tone: 'muted' as const };
    return { key: d.departmentId ?? 'none', name: d.name, onTime: Math.max(0, d.present - d.late), people: members.map((m) => m.name), note };
  });
}

/**
 * The numbers under the greeting. "On leave" shows only when the server has the figure. `past` is a day that has ended: the labels lose
 * "now" and "today", and nothing says "expected by 00:00".
 */
export function kpiCells(board: Board, go?: { late: () => void; notIn: () => void }, past = false): WorkforceKpiCell[] {
  const { onShift, late, notIn, onLeave } = board.tiles;
  const firstStart = board.people.flatMap((p) => p.shifts).filter((s) => s.state === 'NOT_IN' || s.state === 'MISSED').map((s) => s.startTime).sort()[0];
  const cells: WorkforceKpiCell[] = [
    past
      ? { key: 'on-shift', label: 'WORKED A SHIFT', value: `${onShift.count} of ${onShift.expected}`, detail: 'people who had a shift' }
      : { key: 'on-shift', label: 'ON SHIFT NOW', value: `${onShift.count} of ${onShift.expected}`, detail: board.asOf ? `expected by ${board.asOf}` : 'expected so far' },
    { key: 'late', label: past ? 'LATE' : 'LATE TODAY', value: String(late.count), detail: late.count > 0 ? `${late.minutesPastGrace} min past grace in all` : 'nobody late', actionable: late.count > 0 && !!go, onSelect: late.count > 0 ? go?.late : undefined },
    { key: 'not-in', label: past ? 'NEVER CLOCKED IN' : 'NOT IN YET', value: String(notIn.count), detail: notIn.count > 0 ? `due ${firstStart ?? 'earlier'}, no clock-in` : 'everyone due was in', actionable: notIn.count > 0 && !!go, onSelect: notIn.count > 0 ? go?.notIn : undefined },
  ];
  if (onLeave.available) cells.push({ key: 'leave', label: past ? 'ON LEAVE' : 'ON LEAVE TODAY', value: String(onLeave.count), detail: 'approved' });
  return cells;
}

/** "Morning shift started 06:00." for the line under the page title. */
export function liveLine(board: Board, today: boolean): string {
  if (!today) return 'A day that has passed. Times are as they were recorded.';
  const shifts = new Map<string, string>();
  for (const s of board.people.flatMap((p) => p.shifts)) if (!shifts.has(s.templateName)) shifts.set(s.templateName, s.startTime);
  const parts = Array.from(shifts.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([name, start]) => `${name} starts ${start}`);
  return parts.length > 0 ? `Live. ${parts.join('. ')}.` : 'Live. Nobody is rostered today.';
}
