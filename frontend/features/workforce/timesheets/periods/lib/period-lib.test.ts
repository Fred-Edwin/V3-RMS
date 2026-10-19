import { describe, expect, it } from 'vitest';

import type { PeriodView, PersonRow } from '../../_shared/types/timesheet-types';
import { chosenRange, rangeQuery, shownRange, wholeMonth } from './period-range';
import { apiFilterOf, canCloseNow, filterCounts, kpiCells, needsLine } from './period-view';

const view = (over: Partial<PeriodView['summary']> = {}, counts = { all: 31, needsLook: 5, late: 6 }): PeriodView => ({
  period: { id: 'p', organizationId: 's', start: '2026-10-01', end: '2026-10-31', label: 'October 2026', cutoffAt: '2026-11-02T15:00:00.000Z', state: 'OPEN', reportNumber: 1, closeKind: null, closedAt: null, closedById: null, signedById: null, signedAt: null, reopenedAt: null, reopenedById: null, reopenReason: null },
  summary: { people: 31, plannedMinutes: 62_000, workedMinutes: 62_760, overtimeAuthorisedMinutes: 145, lateMinutes: 97, lateDays: 6, absentDays: 1, autoApprovedDays: 127, needsLookDays: 4, needsLookPeople: 4, pendingOvertimeItems: 2, ...over },
  weeks: {},
  carriedInDays: 0,
  counts,
  people: { rows: [], page: 1, pageSize: 25, total: 5 },
});

const row = (over: Partial<PersonRow>): PersonRow => ({ employeeId: 'e', name: 'Amina', departmentId: null, departmentName: null, plannedMinutes: 0, workedMinutes: 0, lateMinutes: 0, lateDays: 0, absentDays: 0, overtimeAuthorisedMinutes: 0, overtimePendingMinutes: 0, needsLookDays: 0, status: 'AUTO_APPROVED', ...over });

describe('the four numbers', () => {
  it('shows days approved by themselves, people who need you, late days and hours', () => {
    const cells = kpiCells(view());
    expect(cells.map((c) => [c.label, c.value])).toEqual([
      ['APPROVED BY ITSELF', '127 days'],
      ['NEEDS YOU', '5'],
      ['LATE, RECORDED', '6'],
      ['HOURS WORKED', '1,046 h'],
    ]);
    expect(cells[3]?.detail).toBe('plan was 1,033 h');
    expect(cells[1]?.actionable).toBe(true);
  });

  it('does not ask for action when nobody needs you', () => {
    const cell = kpiCells(view({}, { all: 31, needsLook: 0, late: 6 }))[1];
    expect(cell?.actionable).toBe(false);
    expect(cell?.detail).toBe('nothing to decide');
  });
});

describe('the "what needs you" line', () => {
  it('names the days to look at and the overtime waiting', () => {
    expect(needsLine(row({ needsLookDays: 2, overtimePendingMinutes: 100 }))).toEqual({ text: '2 days to look at · overtime 1 h 40', needs: true });
    expect(needsLine(row({ needsLookDays: 1 }))).toEqual({ text: '1 day to look at', needs: true });
  });

  it('says the system took care of a person with nothing open', () => {
    expect(needsLine(row({}))).toEqual({ text: 'Nothing. Approved by the system', needs: false });
    expect(needsLine(row({ lateDays: 2 })).needs).toBe(false);
  });
});

describe('the filter chips', () => {
  it('uses the clean address for "Needs a look" and counts each chip', () => {
    expect(apiFilterOf(undefined)).toBe('NEEDS_LOOK');
    expect(apiFilterOf('LATE')).toBe('LATE');
    expect(apiFilterOf('ALL')).toBe('ALL');
    expect(filterCounts(view())).toEqual({ filter: { '': 5, LATE: 6, ALL: 31 } });
    expect(filterCounts(null)).toBeUndefined();
  });
});

describe('the week picker', () => {
  const october = { start: '2026-10-01', end: '2026-10-31' };

  it('opens on the whole month up to today, and the whole month once it is over', () => {
    expect(wholeMonth(october, '2026-10-19')).toEqual({ from: '2026-10-01', to: '2026-10-19' });
    expect(wholeMonth(october, '2026-11-02')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(shownRange(null, october, '2026-10-19')).toEqual({ from: '2026-10-01', to: '2026-10-19' });
  });

  it('keeps a range only if it narrows something, clamped to the month', () => {
    expect(chosenRange({ from: '2026-10-05', to: '2026-10-11' }, october, '2026-10-19')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(chosenRange({ from: '2026-10-01', to: '2026-10-19' }, october, '2026-10-19')).toBeNull();
    expect(chosenRange({ from: '2026-09-28', to: '2026-10-04' }, october, '2026-10-19')).toEqual({ from: '2026-10-01', to: '2026-10-04' });
    expect(chosenRange({ from: '2026-09-01', to: '2026-09-07' }, october, '2026-10-19')).toBeNull();
    expect(chosenRange(null, october, '2026-10-19')).toBeNull();
  });

  it('sends both dates or neither', () => {
    expect(rangeQuery({ from: '2026-10-05', to: '2026-10-11' })).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(rangeQuery(null)).toEqual({});
  });
});

describe('closing early', () => {
  it('is possible only on the last day or after, and only while open', () => {
    const p = { state: 'OPEN', end: '2026-10-31' };
    expect(canCloseNow(p, '2026-10-30')).toBe(false);
    expect(canCloseNow(p, '2026-10-31')).toBe(true);
    expect(canCloseNow(p, '2026-11-01')).toBe(true);
    expect(canCloseNow({ ...p, state: 'CLOSED' }, '2026-11-01')).toBe(false);
  });
});
