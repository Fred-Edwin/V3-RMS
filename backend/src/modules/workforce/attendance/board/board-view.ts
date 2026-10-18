import { addDays, nairobiClockOf, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, DayData, EntryDay, EntryState, PersonRow } from '../attendance.types';
import { buildPersonDay } from '../days/person-day';

/**
 * The state of one person's shift on the board.
 *  NOT_STARTED  the shift has not begun       NOT_IN    began, no clock-in      MISSED     over, no clock-in
 *  ON_SHIFT     in on time (or within grace)  LATE      in, past the grace      ENDING     past the end, prompt waiting
 *  STAYED_ON    working past the end          FINISHED  clocked out             AUTO_CLOSED the phone closed it
 */
export type BoardState = 'NOT_STARTED' | 'NOT_IN' | 'ON_SHIFT' | 'LATE' | 'ENDING' | 'STAYED_ON' | 'FINISHED' | 'AUTO_CLOSED' | 'MISSED';

export interface BoardShift {
  entryId: string;
  templateName: string;
  startTime: string;
  endTime: string;
  state: BoardState;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  minutesLate: number;
  minutesAfterGrace: number;
  late: boolean;
  recordedForBy: string | null;
  skewFlagged: boolean;
}

export interface BoardPerson {
  employeeId: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  /** The state that matters most when a person has two shifts. */
  state: BoardState | 'NO_SHIFT';
  shifts: BoardShift[];
}

export interface BoardDepartment {
  departmentId: string | null;
  name: string;
  head: { name: string; isActing: boolean } | null;
  /** Clocked in at some point today, of those whose shift has started. */
  present: number;
  expected: number;
  late: number;
  notIn: number;
  /** Nothing to chase: nobody late and nobody missing. */
  complete: boolean;
}

export interface BoardView {
  enabled: boolean;
  siteId: string;
  date: NairobiDate;
  /** "expected by 06:42": the Nairobi time the counts are as of. */
  asOf: string;
  tiles: {
    onShift: { count: number; expected: number };
    late: { count: number; minutesPastGrace: number };
    notIn: { count: number };
    /** Leave is slice 5; until then this is zero and `available` is false. */
    onLeave: { count: number; available: boolean };
  };
  departments: BoardDepartment[];
  people: BoardPerson[];
  /** Shifts the phone closed (today or yesterday) that a manager has not put right. */
  attention: { kind: 'AUTO_CLOSED'; employeeId: string; name: string; entryId: string; date: NairobiDate; templateName: string; closedAt: string | null }[];
}

const STARTED: readonly EntryState[] = ['NOT_IN', 'ON_SHIFT', 'PROMPT_DUE', 'STAYING_ON', 'DONE', 'AUTO_CLOSED', 'MISSED'];
const IN_NOW: readonly BoardState[] = ['ON_SHIFT', 'LATE', 'ENDING', 'STAYED_ON'];
const PRIORITY: Record<BoardState | 'NO_SHIFT', number> = { NOT_IN: 0, MISSED: 1, AUTO_CLOSED: 2, LATE: 3, ENDING: 4, STAYED_ON: 5, ON_SHIFT: 6, NOT_STARTED: 7, FINISHED: 8, NO_SHIFT: 9 };

export const boardStateOf = (day: EntryDay): BoardState => {
  const late = day.lateness?.countsAsLate === true;
  switch (day.state) {
    case 'UPCOMING':
    case 'CLOCK_IN_OPEN':
      return 'NOT_STARTED';
    case 'NOT_IN':
      return 'NOT_IN';
    case 'ON_SHIFT':
      return late ? 'LATE' : 'ON_SHIFT';
    case 'PROMPT_DUE':
      return 'ENDING';
    case 'STAYING_ON':
      return 'STAYED_ON';
    case 'DONE':
      return 'FINISHED';
    case 'AUTO_CLOSED':
      return 'AUTO_CLOSED';
    case 'MISSED':
      return 'MISSED';
  }
};

const shiftOf = (day: EntryDay): BoardShift => ({
  entryId: day.entryId,
  templateName: day.templateName,
  startTime: day.shift.startTime,
  endTime: day.shift.endTime,
  state: boardStateOf(day),
  clockedInAt: day.clockedInAt?.toISOString() ?? null,
  clockedOutAt: day.clockedOutAt?.toISOString() ?? null,
  minutesLate: day.lateness?.minutesLate ?? 0,
  minutesAfterGrace: day.lateness?.minutesAfterGrace ?? 0,
  late: day.lateness?.countsAsLate === true,
  recordedForBy: day.flags.recordedForBy,
  skewFlagged: day.flags.skew,
});

export interface DepartmentFacts {
  id: string;
  name: string;
  heads: { isActing: boolean; employee: { name: string } }[];
}

export function buildBoard(args: { siteId: string; date: NairobiDate; people: readonly PersonRow[]; departments: readonly DepartmentFacts[]; data: DayData; rules: AttendanceRuleSet; now: Date }): BoardView {
  const { siteId, date, people, departments, data, rules, now } = args;
  const rows: { person: PersonRow; days: EntryDay[] }[] = people.map((person) => ({ person, days: buildPersonDay(person, date, data, rules, now).entries }));

  const boardPeople: BoardPerson[] = rows
    .map(({ person, days }) => {
      const shifts = days.map(shiftOf);
      const state = shifts.length ? shifts.reduce((a, b) => (PRIORITY[a.state] <= PRIORITY[b.state] ? a : b)).state : 'NO_SHIFT';
      return { employeeId: person.id, name: person.name, departmentId: person.departmentId, departmentName: person.departmentName, state, shifts } satisfies BoardPerson;
    })
    .sort((a, b) => PRIORITY[a.state] - PRIORITY[b.state] || a.name.localeCompare(b.name));

  const flat = rows.flatMap(({ days }) => days);
  const started = flat.filter((d) => STARTED.includes(d.state));
  const lateDays = flat.filter((d) => d.clockedInAt && d.lateness?.countsAsLate);

  const groups = new Map<string | null, BoardPerson[]>();
  for (const person of boardPeople) groups.set(person.departmentId, [...(groups.get(person.departmentId) ?? []), person]);
  const departmentRows: BoardDepartment[] = [...groups.entries()].map(([departmentId, members]) => {
    const facts = departments.find((d) => d.id === departmentId);
    const shifts = members.flatMap((m) => m.shifts);
    const expected = shifts.filter((s) => s.state !== 'NOT_STARTED').length;
    const notIn = shifts.filter((s) => s.state === 'NOT_IN' || s.state === 'MISSED').length;
    const late = shifts.filter((s) => s.late && s.clockedInAt).length;
    const head = facts?.heads[0];
    return {
      departmentId,
      name: facts?.name ?? members[0]?.departmentName ?? 'No department',
      head: head ? { name: head.employee.name, isActing: head.isActing } : null,
      present: expected - notIn,
      expected,
      late,
      notIn,
      complete: late === 0 && notIn === 0,
    };
  });
  departmentRows.sort((a, b) => Number(a.complete) - Number(b.complete) || a.name.localeCompare(b.name));

  const yesterday = addDays(date, -1);
  const attention = people.flatMap((person) =>
    [yesterday, date].flatMap((day) =>
      buildPersonDay(person, day, data, rules, now)
        .entries.filter((e) => e.flags.autoClosed && !e.flags.fixed)
        .map((e) => ({ kind: 'AUTO_CLOSED' as const, employeeId: person.id, name: person.name, entryId: e.entryId, date: day, templateName: e.templateName, closedAt: e.clockedOutAt?.toISOString() ?? null })),
    ),
  );

  return {
    enabled: true,
    siteId,
    date,
    asOf: nairobiClockOf(now),
    tiles: {
      onShift: { count: flat.filter((d) => IN_NOW.includes(boardStateOf(d))).length, expected: started.length },
      late: { count: lateDays.length, minutesPastGrace: lateDays.reduce((sum, d) => sum + (d.lateness?.minutesAfterGrace ?? 0), 0) },
      notIn: { count: flat.filter((d) => d.state === 'NOT_IN' || d.state === 'MISSED').length },
      onLeave: { count: 0, available: false },
    },
    departments: departmentRows,
    people: boardPeople,
    attention,
  };
}
