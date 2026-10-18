import { describe, expect, it } from 'vitest';
import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import { instantAt, parseClockTime, parseNairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, DayData, EntryRow, EventRow, PersonRow } from '../attendance.types';
import { buildBoard, type DepartmentFacts } from './board-view';

const RULES: AttendanceRuleSet = { attendance: RULE_DEFAULTS.ATTENDANCE, lateness: { ...RULE_DEFAULTS.LATENESS, graceMinutes: 5 } };
const DAY = parseNairobiDate('2026-10-12');
const at = (clock: string) => instantAt(DAY, parseClockTime(clock));
const NOW = at('06:42');

const person = (id: string, name: string, departmentId: string, departmentName: string): PersonRow => ({ id, name, userId: `u-${id}`, siteId: 's1', departmentId, departmentName, tracksTime: true });
const entry = (employeeId: string, start = '06:00', end = '14:00'): EntryRow => ({ id: `e-${employeeId}`, employeeId, date: DAY, templateName: 'Morning', colour: 'BLUE', startTime: start, endTime: end, unpaidBreakMinutes: 0 });
let seq = 0;
const clockIn = (employeeId: string, clock: string, extra: Partial<EventRow> = {}): EventRow => {
  seq += 1;
  return {
    id: `ev${seq}`, employeeId, rotaEntryId: `e-${employeeId}`, shiftDate: DAY, type: 'IN', source: 'PHONE', occurredAt: at(clock), serverAt: at(clock),
    createdAt: new Date(at(clock).getTime() + seq), clientEventId: null, correctsEventId: null, voidsCorrected: false, skewFlagged: false,
    reasonCode: null, reason: null, recordedById: null, ...extra,
  };
};

// Service: Amina on time, Joy 22 minutes late, Peter 9 minutes late, Esther not in. Kitchen: Mark in on time. Grace is 5 minutes.
const people = [person('amina', 'Amina Hassan', 'svc', 'Service'), person('joy', 'Joy Wanjiru', 'svc', 'Service'), person('peter', 'Peter Kamau', 'svc', 'Service'), person('esther', 'Esther Mwende', 'svc', 'Service'), person('mark', 'Mark Njoroge', 'kit', 'Kitchen')];
const data: DayData = {
  entries: people.map((p) => entry(p.id)),
  events: [clockIn('amina', '05:58'), clockIn('joy', '06:22'), clockIn('peter', '06:09'), clockIn('mark', '05:55')],
  answers: [],
};
const departments: DepartmentFacts[] = [
  { id: 'svc', name: 'Service', heads: [{ isActing: false, employee: { name: 'Nancy Wangari' } }] },
  { id: 'kit', name: 'Kitchen', heads: [] },
];
const board = buildBoard({ siteId: 's1', date: DAY, people, departments, data, rules: RULES, now: NOW });

describe('the Today board at 06:42', () => {
  it('counts who is on shift, late and not in, with the minutes past grace', () => {
    expect(board.tiles.onShift).toEqual({ count: 4, expected: 5 });
    expect(board.tiles.late).toEqual({ count: 2, minutesPastGrace: 17 + 4 }); // Joy 22 min (17 after grace) and Peter 9 min (4 after grace)
    expect(board.tiles.notIn).toEqual({ count: 1 });
    expect(board.tiles.onLeave).toEqual({ count: 0, available: false });
    expect(board.asOf).toBe('06:42');
  });

  it('gives each person a state and puts the people to chase first', () => {
    const states = Object.fromEntries(board.people.map((p) => [p.name, p.state]));
    expect(states).toEqual({ 'Amina Hassan': 'ON_SHIFT', 'Joy Wanjiru': 'LATE', 'Peter Kamau': 'LATE', 'Esther Mwende': 'NOT_IN', 'Mark Njoroge': 'ON_SHIFT' });
    expect(board.people[0]?.name).toBe('Esther Mwende');
  });

  it('rolls up by department: the one with problems first, the healthy one folded as complete', () => {
    expect(board.departments.map((d) => d.name)).toEqual(['Service', 'Kitchen']);
    expect(board.departments[0]).toMatchObject({ name: 'Service', present: 3, expected: 4, late: 2, notIn: 1, complete: false, head: { name: 'Nancy Wangari', isActing: false } });
    expect(board.departments[1]).toMatchObject({ name: 'Kitchen', present: 1, expected: 1, late: 0, notIn: 0, complete: true, head: null });
  });

  it('before the shift starts nobody is "not in"', () => {
    const early = buildBoard({ siteId: 's1', date: DAY, people, departments, data: { ...data, events: [] }, rules: RULES, now: at('05:50') });
    expect(early.tiles.notIn.count).toBe(0);
    expect(early.people.every((p) => p.state === 'NOT_STARTED')).toBe(true);
  });

  it('a phone-closed shift is listed for the manager until someone fixes it', () => {
    const auto = clockIn('amina', '05:58');
    const closed = buildBoard({
      siteId: 's1', date: DAY, people, departments, rules: RULES, now: at('15:00'),
      data: { ...data, events: [auto, { ...clockIn('amina', '14:00'), type: 'AUTO_OUT', source: 'SYSTEM', reasonCode: 'NO_ANSWER' }] },
    });
    expect(closed.attention).toEqual([expect.objectContaining({ name: 'Amina Hassan', kind: 'AUTO_CLOSED' })]);
    expect(closed.people.find((p) => p.name === 'Amina Hassan')?.state).toBe('AUTO_CLOSED');
  });

  it('a person with no shift today shows as having none', () => {
    const solo = buildBoard({ siteId: 's1', date: DAY, people: [person('zed', 'Zed', 'svc', 'Service')], departments, data: { entries: [], events: [], answers: [] }, rules: RULES, now: NOW });
    expect(solo.people[0]?.state).toBe('NO_SHIFT');
    expect(solo.tiles.onShift).toEqual({ count: 0, expected: 0 });
  });
});
