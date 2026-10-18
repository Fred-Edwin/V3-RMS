import { describe, expect, it } from 'vitest';

import { instantAt } from '../../_shared/lib/nairobi-clock';
import type { Board, BoardPerson, BoardShift } from '../../_shared/types/attendance-types';
import { bodyOf, changeProblem, eventRows, inOutWords, workedChangeWords } from '../../fixes/lib/fix-model';
import { chipItems, departmentRows, kpiCells, liveLine, lookItems } from './board-view';

const shift = (over: Partial<BoardShift> = {}): BoardShift => ({
  entryId: 'e1',
  templateName: 'Morning',
  startTime: '06:00',
  endTime: '14:00',
  state: 'ON_SHIFT',
  clockedInAt: instantAt('2026-10-12', '05:58'),
  clockedOutAt: null,
  minutesLate: 0,
  minutesAfterGrace: 0,
  late: false,
  recordedForBy: null,
  skewFlagged: false,
  ...over,
});
const person = (employeeId: string, name: string, dept: string, over: Partial<BoardShift> = {}): BoardPerson => {
  const s = shift({ entryId: `e-${employeeId}`, ...over });
  return { employeeId, name, departmentId: dept === 'Service' ? 'd1' : 'd2', departmentName: dept, state: s.state, shifts: [s] };
};
const board: Board = {
  enabled: true,
  organizationId: 'o1',
  date: '2026-10-12',
  asOf: '06:42',
  tiles: { onShift: { count: 1, expected: 4 }, late: { count: 1, minutesPastGrace: 7 }, notIn: { count: 1 }, onLeave: { count: 0, available: false } },
  departments: [
    { departmentId: 'd1', name: 'Service', head: { name: 'Nancy Wangari', isActing: false }, present: 2, expected: 3, late: 1, notIn: 1, complete: false },
    { departmentId: 'd2', name: 'Kitchen', head: null, present: 1, expected: 1, late: 0, notIn: 0, complete: true },
  ],
  people: [
    person('p1', 'Esther Mwende', 'Service', { state: 'NOT_IN', clockedInAt: null }),
    person('p2', 'Lucy Wambui', 'Service', { state: 'LATE', minutesLate: 22, minutesAfterGrace: 7, late: true, clockedInAt: instantAt('2026-10-12', '06:22') }),
    person('p3', 'Brian Otieno', 'Service'),
    person('p4', 'Kelvin Kings', 'Kitchen'),
  ],
  attention: [{ kind: 'AUTO_CLOSED', employeeId: 'p9', name: 'Cynthia Wairimu', entryId: 'e9', date: '2026-10-10', templateName: 'Afternoon', closedAt: instantAt('2026-10-10', '22:00') }],
};

describe('the Today board words', () => {
  it('puts not in first, then the phone-closed shift, then late, and adds an earlier closed shift until a manager answers', () => {
    const items = lookItems(board);
    expect(items.map((i) => `${i.name}:${i.kind}`)).toEqual(['Esther Mwende:NOT_IN', 'Cynthia Wairimu:AUTO_CLOSED', 'Lucy Wambui:LATE']);
    expect(items[0]?.status).toBe('Not in · due 06:00');
    expect(items[1]?.status).toBe('Closed by the phone at 22:00 · Sat 10 Oct');
    expect(items[2]).toMatchObject({ status: 'Late 22 min · clocked in 06:22', late: { grace: 50, minutes: 7 } });
  });

  it('hides a person the manager chose to wait for', () => {
    expect(lookItems(board, new Set(['p1'])).map((i) => i.name)).not.toContain('Esther Mwende');
  });

  it('chips mark a department with someone not in (red) or late (amber)', () => {
    expect(chipItems(board)).toEqual([
      { key: 'all', label: 'All', count: 4 },
      { key: 'd1', label: 'Service', count: 3, marker: 'error' },
      { key: 'd2', label: 'Kitchen', count: 1, marker: undefined },
    ]);
  });

  it('departments say their head, their problems, and a missing head in red', () => {
    const rows = departmentRows(board);
    expect(rows[0]).toMatchObject({ name: 'Service', onTime: 1, note: { text: 'Head Nancy Wangari · 1 late, 1 not in', tone: 'warning' } });
    expect(rows[1]?.note).toEqual({ text: 'No head assigned', tone: 'error' });
  });

  it('the four numbers: on leave is a dash until the Leave slice, and the cells act only when asked to', () => {
    const cells = kpiCells(board);
    expect(cells.map((c) => c.value)).toEqual(['1 of 4', '1', '1', '—']);
    expect(cells[1]).toMatchObject({ actionable: false });
    const go = { late: () => undefined, notIn: () => undefined };
    expect(kpiCells(board, go)[1]).toMatchObject({ actionable: true });
    expect(cells[3]?.detail).toBe('arrives with Leave');
  });

  it('the line under the title says what started, or that the day has passed', () => {
    expect(liveLine(board, true)).toBe('Live. Morning starts 06:00.');
    expect(liveLine(board, false)).toContain('passed');
  });
});

describe('the Edit time model', () => {
  const history = {
    employeeId: 'p1',
    name: 'Mark Njoroge',
    date: '2026-10-08',
    entries: [
      {
        entryId: 'e1',
        templateName: 'Afternoon',
        startTime: '14:00',
        endTime: '22:00',
        state: 'AUTO_CLOSED',
        workedMinutes: 480,
        afterEndMinutes: 0,
        leftEarlyMinutes: 0,
        minutesLate: 0,
        countsAsLate: false,
        events: [
          { id: 'a', type: 'IN', source: 'PHONE', recordedAt: instantAt('2026-10-08', '13:58'), countsAt: instantAt('2026-10-08', '13:58'), status: 'COUNTS' as const, reasonCode: null, reason: null, recordedBy: null, correctsEventId: null, skewFlagged: false, createdAt: '' },
          { id: 'b', type: 'OUT', source: 'SYSTEM', recordedAt: instantAt('2026-10-08', '22:00'), countsAt: instantAt('2026-10-08', '22:00'), status: 'COUNTS' as const, reasonCode: null, reason: null, recordedBy: null, correctsEventId: null, skewFlagged: false, createdAt: '' },
          { id: 'c', type: 'OUT', source: 'PHONE', recordedAt: instantAt('2026-10-08', '21:00'), countsAt: null, status: 'REMOVED' as const, reasonCode: null, reason: null, recordedBy: null, correctsEventId: null, skewFlagged: false, createdAt: '' },
        ],
      },
    ],
    unscheduled: [],
  };

  it('lists only the events that still count, with their source in words', () => {
    expect(eventRows(history, 'e1')).toEqual([
      { id: 'a', label: 'Clock in', recorded: '13:58', type: 'IN', source: 'Their phone', auto: false },
      { id: 'b', label: 'Clock out', recorded: '22:00', type: 'OUT', source: 'Set by the system', auto: true },
    ]);
  });

  it('refuses a change with no time, a time in the future, or no reason, in words', () => {
    const now = Date.parse(instantAt('2026-10-08', '23:00'));
    expect(changeProblem(null, '2026-10-08', 'Phone problem', now)).toBe('Choose what to change first.');
    expect(changeProblem({ action: 'EDIT', eventId: 'b', hm: '25:00' }, '2026-10-08', 'Phone problem', now)).toBe('Use a time like 14:30.');
    expect(changeProblem({ action: 'EDIT', eventId: 'b', hm: '23:30' }, '2026-10-08', 'Phone problem', now)).toBe('That time has not happened yet.');
    expect(changeProblem({ action: 'EDIT', eventId: 'b', hm: '22:40' }, '2026-10-08', null, now)).toBe('Say why.');
    expect(changeProblem({ action: 'EDIT', eventId: 'b', hm: '22:40' }, '2026-10-08', 'Phone problem', now)).toBeNull();
    expect(changeProblem({ action: 'VOID', eventId: 'b' }, '2026-10-08', 'Phone problem', now)).toBeNull();
  });

  it('builds the body the API takes, with the Nairobi instant', () => {
    expect(bodyOf({ action: 'EDIT', eventId: 'b', hm: '22:40' }, 'p1', '2026-10-08', 'I saw them working', 'e1')).toEqual({
      action: 'EDIT',
      eventId: 'b',
      at: '2026-10-08T22:40:00+03:00',
      employeeId: 'p1',
      date: '2026-10-08',
      reason: 'I saw them working',
      rotaEntryId: 'e1',
    });
    expect(bodyOf({ action: 'ADD', type: 'OUT', hm: 'bad' }, 'p1', '2026-10-08', 'x', undefined)).toBeNull();
  });

  it('says the day before and after in words', () => {
    const before = { workedMinutes: 480, afterEndMinutes: 0, leftEarlyMinutes: 0, minutesLate: 0, countsAsLate: false, clockedInAt: instantAt('2026-10-08', '13:58'), clockedOutAt: instantAt('2026-10-08', '22:00') };
    const after = { ...before, workedMinutes: 520, clockedOutAt: instantAt('2026-10-08', '22:40') };
    expect(inOutWords(after)).toBe('In 13:58 · Out 22:40');
    expect(inOutWords(null)).toBe('No clock events');
    expect(workedChangeWords(before, after)).toBe('Worked time changes from 8 h 0 m to 8 h 40 m.');
    expect(workedChangeWords(before, before)).toBe('Worked time stays the same.');
  });
});
