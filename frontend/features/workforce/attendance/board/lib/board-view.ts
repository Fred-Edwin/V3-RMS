import type { WorkforceKpiCell } from '../../../_shared';
import { dayWords, hmOf } from '../../_shared/lib/nairobi-clock';
import type { Board, BoardDepartment, BoardPerson, BoardShift } from '../../_shared/types/attendance-types';

/** Words and groups for the Today board, worked out from the server's board. Pure; the components only draw it. */

/**
 * The one meaning of "on shift" (My team, Team today, Home): clocked in now and not yet clocked out. A person with a shift today is
 * "rostered"; one who is rostered and not in yet has "not started". The server uses the same words (`employeesOnShiftNow`).
 */
export const ON_SHIFT_STATES: readonly BoardPerson['state'][] = ['ON_SHIFT', 'LATE', 'ENDING', 'STAYED_ON'];

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

/** "22 min past grace", "22 and 9 min past grace", or the total for a long list ("41 min past grace in all"). */
export function pastGraceWords(board: Board): string {
  const minutes = board.people.flatMap((p) => p.shifts).filter((s) => s.state === 'LATE' && s.minutesAfterGrace > 0).map((s) => s.minutesAfterGrace);
  if (minutes.length === 0 || minutes.length > 3) return `${board.tiles.late.minutesPastGrace} min past grace${minutes.length > 1 ? ' in all' : ''}`;
  const list = minutes.length === 1 ? String(minutes[0]) : `${minutes.slice(0, -1).join(', ')} and ${minutes[minutes.length - 1]}`;
  return `${list} min past grace`;
}

/** The earliest start of a shift nobody clocked in for: "due 06:00, no clock-in". */
const dueWords = (board: Board, ending: string): string => {
  const first = board.people.flatMap((p) => p.shifts).filter((s) => s.state === 'NOT_IN' || s.state === 'MISSED').map((s) => s.startTime).sort()[0];
  return `due ${first ?? 'earlier'}, ${ending}`;
};

const onLeaveCell = (board: Board, label: string): WorkforceKpiCell =>
  board.tiles.onLeave.available ? { key: 'leave', label, value: String(board.tiles.onLeave.count), detail: 'approved' } : { key: 'leave', label, value: '—', detail: 'not counted yet' };

/**
 * The four numbers under the title (Paper Schedule V1). Three modes, all from the server's board: a live day (ON SHIFT with "expected by",
 * LATE, NOT IN, ON LEAVE TODAY), a day that is over (WORKED, LATE, ABSENT, ON LEAVE, named by `pastDay.tiles`), and a branch whose clock is
 * off ("Not tracked / clock is off", with On leave still real).
 */
export function kpiCells(board: Board, go?: { late: () => void; notIn: () => void }): WorkforceKpiCell[] {
  const { onShift, late, notIn } = board.tiles;
  if (!board.clock.on) {
    const off = (key: string, label: string): WorkforceKpiCell => ({ key, label, value: 'Not tracked', detail: 'clock is off', tone: 'muted' });
    return [off('on-shift', 'ON SHIFT'), off('late', 'LATE'), off('not-in', 'NOT IN'), onLeaveCell(board, 'ON LEAVE TODAY')];
  }
  if (board.pastDay) {
    const names = board.pastDay.tiles;
    return [
      { key: 'on-shift', label: names.onShift, value: `${onShift.count} of ${onShift.expected}`, detail: 'rostered, clocked in' },
      { key: 'late', label: names.late, value: String(late.count), detail: late.count > 0 ? pastGraceWords(board) : 'nobody was late', tone: late.count > 0 ? 'warning' : undefined },
      { key: 'not-in', label: names.notIn, value: String(notIn.count), detail: notIn.count > 0 ? dueWords(board, 'never clocked in') : 'everyone due clocked in', tone: notIn.count > 0 ? 'error' : undefined },
      onLeaveCell(board, names.onLeave),
    ];
  }
  return [
    { key: 'on-shift', label: 'ON SHIFT', value: `${onShift.count} of ${onShift.expected}`, detail: board.asOf ? `expected by ${board.asOf}` : 'expected so far' },
    { key: 'late', label: 'LATE', value: String(late.count), detail: late.count > 0 ? pastGraceWords(board) : 'nobody late', actionable: late.count > 0 && !!go, onSelect: late.count > 0 ? go?.late : undefined },
    { key: 'not-in', label: 'NOT IN', value: String(notIn.count), detail: notIn.count > 0 ? dueWords(board, 'no clock-in') : 'everyone due is in', actionable: notIn.count > 0 && !!go, onSelect: notIn.count > 0 ? go?.notIn : undefined },
    onLeaveCell(board, 'ON LEAVE TODAY'),
  ];
}

/** Who holds the clock switch, in words: "the Director or the System Admin". */
export function whoCanSwitchWords(roles: readonly string[]): string {
  const named = roles.map((r) => `the ${r}`);
  if (named.length === 0) return 'someone who can';
  if (named.length === 1) return named[0] ?? '';
  return `${named.slice(0, -1).join(', ')} or ${named[named.length - 1]}`;
}

export interface ClockOffCopy {
  title: string;
  why: string;
  /** What to do. A person who can switch the clock is told to; anyone else is told whom to ask. */
  todo: string;
  canSwitch: boolean;
}

/** The card that stands in for the people when the branch clock is off (Paper 2.1 and 2.2). */
export function clockOffCopy(board: Board, fallbackSite: string): ClockOffCopy {
  const site = board.clock.organizationName ?? fallbackSite;
  return {
    title: `The clock is off at ${site}`,
    why: 'This branch still records time the old way. The board only fills when the clock is on, so it cannot say who is in, late or missing.',
    todo: board.clock.canSwitch
      ? `Switch the clock on for ${site}. Today's times are copied over and the board fills at once.`
      : `Ask ${whoCanSwitchWords(board.clock.whoCanSwitch)} to switch the clock on for ${site}. Shifts and leave work as normal in the meantime.`,
    canSwitch: board.clock.canSwitch,
  };
}

/** The line under the title on a day with no live clock. */
export const CLOCK_OFF_LINE = 'The clock is off at this branch. Nobody is being clocked in or out.';

export interface ExceptionRow {
  key: string;
  employeeId: string;
  entryId: string;
  name: string;
  /** "Absent · due 06:00, never clocked in · Service" or "Late 22 min · clocked in 06:22 · Service". */
  status: string;
  tone: 'error' | 'warning';
  date: string;
}

/** A past day's exceptions: absent first, then late (the server's order inside each). Same people as "Needs a look", worded for a day that is over. */
export function exceptionRows(board: Board): ExceptionRow[] {
  const rows: ExceptionRow[] = [];
  for (const person of board.people) {
    const shift = lookShiftOf(person);
    if (!shift || (shift.state !== 'NOT_IN' && shift.state !== 'MISSED' && shift.state !== 'LATE')) continue;
    const department = person.departmentName ?? 'No department';
    const status =
      shift.state === 'LATE'
        ? `Late ${shift.minutesLate} min${shift.clockedInAt ? ` · clocked in ${hmOf(shift.clockedInAt)}` : ''} · ${department}`
        : `Absent · due ${shift.startTime}, never clocked in · ${department}`;
    rows.push({ key: `${person.employeeId}:${shift.entryId}`, employeeId: person.employeeId, entryId: shift.entryId, name: person.name, status, tone: shift.state === 'LATE' ? 'warning' : 'error', date: board.date });
  }
  return rows.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'error' ? -1 : 1));
}

export interface DepartmentCountRow {
  key: string;
  name: string;
  /** "9 / 10": in over expected. Amber when someone is late or missing. */
  ratio: string;
  problem: boolean;
  /** "Head Nancy Wangari · 2 late, 1 absent", or "Head Kelvin Kings · Complete". */
  note: string;
}

/** The "By department" rows of a past day and of the phone: in over expected, the head, and what went wrong ("absent" on a past day, "not in" on a live one). */
export function departmentCountRows(board: Board, missing: 'absent' | 'not in'): DepartmentCountRow[] {
  return board.departments.map((d) => {
    const problems = [d.late > 0 ? `${d.late} late` : '', d.notIn > 0 ? `${d.notIn} ${missing}` : ''].filter(Boolean).join(', ');
    const head = d.head ? `Head ${d.head.name}${d.head.isActing ? ' (acting)' : ''}` : d.departmentId ? 'No head assigned' : '';
    return { key: d.departmentId ?? 'none', name: d.name, ratio: `${d.present} / ${d.expected}`, problem: d.late > 0 || d.notIn > 0, note: [head, problems || (d.complete ? 'Complete' : '')].filter(Boolean).join(' · ') };
  });
}

/** "2 clock times changed after the day" for the side panel; the server sends a count, not the sentence. */
export const fixedWords = (changes: number): string => `${changes} ${changes === 1 ? 'clock time was' : 'clock times were'} changed after the day ended.`;

/** "Morning shift started 06:00." for the line under the page title. */
export function liveLine(board: Board, today: boolean): string {
  if (!today) return 'A day that has passed. Times are as they were recorded.';
  const shifts = new Map<string, string>();
  for (const s of board.people.flatMap((p) => p.shifts)) if (!shifts.has(s.templateName)) shifts.set(s.templateName, s.startTime);
  const parts = Array.from(shifts.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([name, start]) => `${name} starts ${start}`);
  return parts.length > 0 ? `Live. ${parts.join('. ')}.` : 'Live. Nobody is rostered today.';
}
