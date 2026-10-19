import { describe, expect, it } from 'vitest';
import { day, item, person, request } from './month-fixtures';
import { chipCounts, filterPeople, monthTotals, personMonthRows, sortPeople, withinRange } from './people-rows';

const cynthia = person('e1', 'Cynthia Wairimu', 'Barista');
const amina = person('e2', 'Amina Hassan', 'Barista');
const dan = person('e3', 'Dan Kiprop', 'Kitchen');

const days = [
  { day: day('2026-09-12', { status: 'NEEDS_LOOK', reasons: ['OVERTIME'], workedMinutes: 515 }, 'e1'), person: cynthia },
  { day: day('2026-09-13', {}, 'e1'), person: cynthia },
  { day: day('2026-09-12', { minutesLate: 5, minutesAfterGrace: 0, reasons: ['LATE'], status: 'NEEDS_LOOK' }, 'e2'), person: amina },
  { day: day('2026-09-12', { status: 'NEEDS_LOOK', reasons: ['OPEN_SHIFT'], workedMinutes: 0 }, 'e3'), person: dan },
  { day: day('2026-09-14', { status: 'NEEDS_LOOK', reasons: ['ABSENT'], workedMinutes: 0 }, 'e3'), person: dan },
];
const items = [item('2026-09-12', { rawMinutes: 35, needsMinutes: 35 }, 'e1')];
const requests = [request('2026-09-08', {}, 'e2')];
const rows = personMonthRows(days, items, requests);
const by = (id: string) => rows.find((r) => r.employeeId === id)!;

describe('the people table of a month', () => {
  it('sums planned, worked, overtime recorded and late per person', () => {
    expect(by('e1')).toMatchObject({ plannedMinutes: 960, workedMinutes: 995, overtimeMinutes: 35, overtimeAuthorisedMinutes: 0, lateDays: 0 });
    expect(by('e2')).toMatchObject({ lateMinutes: 5, lateDays: 1 });
  });
  it('says the most urgent thing first', () => {
    expect(by('e1').status).toEqual({ kind: 'OVERTIME_TO_DECIDE', minutes: 35 });
    expect(by('e2').status).toEqual({ kind: 'REQUEST_TO_ANSWER', date: '2026-09-08' });
    expect(by('e3').status).toEqual({ kind: 'CLOCK_OUT_FIX', date: '2026-09-12' });
  });
  it('says "several" when more than one kind needs the manager', () => {
    const several = personMonthRows([days[0]!, days[3]!].map((d) => ({ person: cynthia, day: { ...d.day, employeeId: 'e1' } })), items, []);
    expect(several[0]!.status).toEqual({ kind: 'SEVERAL', count: 2 });
  });
  it('an absence is a fact, not a decision; it does not need the manager', () => {
    const only = personMonthRows([days[4]!], [], []);
    expect(only[0]!.status).toEqual({ kind: 'ABSENT', date: '2026-09-14' });
    expect(only[0]!.needsYou).toBe(0);
    expect(only[0]!.absentDays).toBe(1);
  });
  it('turns green after the decisions', () => {
    const decided = (status: 'APPROVED' | 'APPROVED_PART' | 'DECLINED') =>
      personMonthRows([days[1]!], [item('2026-09-12', { status, decidedById: 'm1', authorisedMinutes: status === 'APPROVED' ? 35 : status === 'APPROVED_PART' ? 20 : 0 }, 'e1')], [])[0]!.status;
    expect(decided('APPROVED')).toEqual({ kind: 'OVERTIME_APPROVED', minutes: 35 });
    expect(decided('APPROVED_PART')).toEqual({ kind: 'OVERTIME_APPROVED_PART', minutes: 20 });
    expect(decided('DECLINED')).toEqual({ kind: 'OVERTIME_NOT_APPROVED' });
  });
  it('filters by needs, late, department and a name, and counts the chips without the search', () => {
    expect(filterPeople(rows, { view: 'needs' }).map((r) => r.employeeId).sort()).toEqual(['e1', 'e2', 'e3']);
    expect(filterPeople(rows, { view: 'late' }).map((r) => r.employeeId)).toEqual(['e2']);
    expect(filterPeople(rows, { view: 'all', departmentId: 'dep-Kitchen' }).map((r) => r.employeeId)).toEqual(['e3']);
    expect(filterPeople(rows, { view: 'all', search: 'AMINA' }).map((r) => r.employeeId)).toEqual(['e2']);
    expect(chipCounts(rows)).toEqual({ needs: 3, late: 1, all: 3 });
  });
  it('sorts department then name A to Z by default, and by worked or late on request', () => {
    expect(sortPeople(rows, 'department', 'asc').map((r) => r.name)).toEqual(['Amina Hassan', 'Cynthia Wairimu', 'Dan Kiprop']);
    expect(sortPeople(rows, 'worked', 'desc')[0]!.employeeId).toBe('e1');
    expect(sortPeople(rows, 'late', 'desc')[0]!.employeeId).toBe('e2');
  });
  it('narrows to a range: the days outside it do not count, and a person with no days in it is not listed', () => {
    const inRange = withinRange(days, ({ day: d }) => d.shiftDate, { from: '2026-09-13', to: '2026-09-14' });
    expect(personMonthRows(inRange, items, []).map((r) => r.employeeId).sort()).toEqual(['e1', 'e3']);
    expect(withinRange(days, ({ day: d }) => d.shiftDate, {})).toHaveLength(days.length);
  });
});

describe('the KPI numbers add up (D19)', () => {
  it('recorded overtime = approved + not approved + still to decide', () => {
    const all = [
      item('2026-09-01', { status: 'PENDING', rawMinutes: 135, needsMinutes: 135, authorisedMinutes: 0 }, 'e1'),
      item('2026-09-02', { status: 'APPROVED', rawMinutes: 90, needsMinutes: 90, authorisedMinutes: 90, decidedById: 'm' }, 'e1'),
      item('2026-09-03', { status: 'APPROVED_PART', rawMinutes: 35, needsMinutes: 35, authorisedMinutes: 20, decidedById: 'm' }, 'e1'),
      item('2026-09-04', { status: 'AUTO_AUTHORISED', rawMinutes: 20, needsMinutes: 0, autoMinutes: 20, authorisedMinutes: 20 }, 'e1'),
      item('2026-09-05', { status: 'DECLINED', rawMinutes: 45, needsMinutes: 45, autoMinutes: 0, authorisedMinutes: 0, decidedById: 'm' }, 'e1'),
    ];
    const totals = monthTotals(personMonthRows([{ day: day('2026-09-01'), person: cynthia }], all, []), all);
    expect(totals.overtimeRecordedMinutes).toBe(325);
    expect(totals.overtimeApprovedMinutes).toBe(130);
    expect(totals.overtimePartNotApprovedMinutes).toBe(60);
    expect(totals.overtimeToDecideMinutes).toBe(135);
    expect(totals.overtimeApprovedMinutes + totals.overtimePartNotApprovedMinutes + totals.overtimeToDecideMinutes).toBe(totals.overtimeRecordedMinutes);
  });
  it('hours worked is the sum of the people\'s minutes', () => {
    const totals = monthTotals(rows, items);
    expect(totals.workedMinutes).toBe(rows.reduce((sum, r) => sum + r.workedMinutes, 0));
    expect(totals.people).toBe(3);
    expect(totals.lateCount).toBe(1);
    expect(totals.absentDays).toBe(1);
  });
});
