import { describe, expect, it } from 'vitest';

import { copyDayChanges, changeLines, dragDates, effectiveChanges, gateOf, peopleToldCount, reasonProblem, toldWords } from './rota-edits';
import { AFTERNOON, MORNING, person, shift, weekOf } from './rota-fixture';
import { hoursNumber, templateFits, toneOfColour } from './shift-look';
import { departmentStatus, footerRow, personNote, warningPhrase, weekNumbers } from './week-view';

const templates = new Map([MORNING, AFTERNOON].map((t) => [t.id, t] as const));

describe('Shift look', () => {
  it('writes hours the way the grid does', () => {
    expect(hoursNumber(2400)).toBe('40');
    expect(hoursNumber(450)).toBe('7.5');
  });
  it('maps colours to the kit tones, ROSE borrowing Early bake', () => {
    expect(toneOfColour('BLUE')).toBe('morning');
    expect(toneOfColour('ROSE')).toBe('earlyBake');
  });
  it('limits a shift to its departments and hides a retired one', () => {
    expect(templateFits(MORNING, 'd-x')).toBe(true);
    expect(templateFits({ ...MORNING, departments: [{ id: 'd-pastry', name: 'Pastry' }] }, 'd-barista')).toBe(false);
    expect(templateFits({ ...MORNING, isActive: false }, 'd-barista')).toBe(false);
  });
});

describe('Week view', () => {
  const amina = person('e1', 'Amina Hassan', { '2026-10-13': [shift('t-morning')] }, { plannedMinutes: 480, leaveDates: ['2026-10-15'] });
  const dan = person('e2', 'Dan Kiprop', { '2026-10-13': [shift('t-afternoon')], '2026-10-17': [shift('t-morning')] }, { plannedMinutes: 960 });
  const thin = { code: 'THIN_COVERAGE' as const, employeeId: null, departmentId: 'd-barista', date: '2026-10-17', message: 'Thin', detail: {} };
  const hours = { code: 'WEEKLY_HOURS' as const, employeeId: 'e2', departmentId: null, date: null, message: 'Over', detail: {} };
  const week = weekOf([amina, dan], { warnings: [thin, hours] });

  it('counts shifts, people, hours and leave for the chosen department', () => {
    const n = weekNumbers(week, 'd-barista');
    expect(n).toMatchObject({ shifts: 3, people: 2, plannedMinutes: 1440, onLeave: 1, needsLook: 2 });
    expect(n.lookPhrase).toBe('1 over hours, 1 thin day');
  });
  it('writes the footer with "thin" in amber where the server says so', () => {
    const f = footerRow(week, 'd-barista', week.warnings);
    expect(f.label).toBe('ON, NEEDS 2');
    expect(f.cells[1]).toEqual({ text: '2', tone: 'default' });
    expect(f.cells[5]).toEqual({ text: '1 thin', tone: 'warning' });
    expect(f.cells[0]).toEqual({ text: '0', tone: 'faint' });
  });
  it('says what a department row says', () => {
    const dept = week.departments[0]!;
    expect(departmentStatus(week, dept).text).toBe('2 need a look');
    expect(departmentStatus({ ...week, warnings: [thin] }, dept).text).toBe('Thin Sat');
    expect(departmentStatus({ ...week, warnings: [] }, dept)).toEqual({ text: 'Complete', tone: 'success' });
    expect(departmentStatus(week, { ...dept, shifts: 0 }).text).toBe('Not started');
  });
  it('puts an over-hours note under the name', () => {
    expect(personNote(dan, week.warnings)).toBe('Over contract hours');
    expect(personNote(amina, week.warnings)).toBeNull();
    expect(warningPhrase([])).toBe('');
  });
});

describe('Edits', () => {
  const amina = person('e1', 'Amina Hassan', { '2026-10-13': [shift('t-morning')] }, { leaveDates: ['2026-10-15'] });
  const dan = person('e2', 'Dan Kiprop');
  const week = weekOf([amina, dan]);

  it('drops a change that changes nothing, and any day that has passed', () => {
    const asked = [
      { employeeId: 'e1', date: '2026-10-13', templateIds: ['t-morning'] },
      { employeeId: 'e2', date: '2026-10-14', templateIds: ['t-morning'] },
      { employeeId: 'e2', date: '2026-10-11', templateIds: ['t-morning'] },
    ];
    expect(effectiveChanges(week, asked)).toEqual([asked[1]]);
  });
  it('asks for a reason on today and tomorrow, and an override on a leave day', () => {
    const gate = gateOf(week, [
      { employeeId: 'e1', date: '2026-10-13', templateIds: ['t-afternoon'] },
      { employeeId: 'e1', date: '2026-10-15', templateIds: ['t-morning'] },
      { employeeId: 'e1', date: '2026-10-16', templateIds: [] },
    ]);
    expect(gate.reasonDates).toEqual(['2026-10-13']);
    expect(gate.leaveCells).toEqual([{ employeeId: 'e1', name: 'Amina Hassan', date: '2026-10-15' }]);
  });
  it('writes the summary lines and who is told', () => {
    const lines = changeLines(week, [
      { employeeId: 'e1', date: '2026-10-13', templateIds: ['t-afternoon'] },
      { employeeId: 'e2', date: '2026-10-13', templateIds: ['t-morning'] },
      { employeeId: 'e1', date: '2026-10-14', templateIds: [] },
    ], templates);
    expect(lines[0]?.text).toBe('Amina Hassan · Tue 13: Morning becomes Afternoon');
    expect(lines[1]?.text).toBe('Dan Kiprop · Tue 13: day off becomes Morning');
    expect(peopleToldCount(lines)).toBe(2);
    expect(toldWords(['Amina', 'Dan', 'Amina'])).toBe('Amina and Dan are told');
    expect(toldWords(['Joy'])).toBe('Joy is told');
  });
  it('checks the reason length the server checks', () => {
    expect(reasonProblem('ok')).toMatch(/at least 3/);
    expect(reasonProblem('Cover for a gap')).toBeNull();
    expect(reasonProblem('x'.repeat(201))).toMatch(/200/);
  });
  it('drags across a row without touching the past', () => {
    const days = week.days.map((d) => d.date);
    expect(dragDates(days, 4, 1, '2026-10-14')).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
  });
  it('copies a day onto empty cells only and skips leave', () => {
    const changes = copyDayChanges(week, week.people, '2026-10-13', '2026-10-15');
    expect(changes).toEqual([]);
    expect(copyDayChanges(week, week.people, '2026-10-13', '2026-10-16')).toEqual([{ employeeId: 'e1', date: '2026-10-16', templateIds: ['t-morning'] }]);
  });
});
