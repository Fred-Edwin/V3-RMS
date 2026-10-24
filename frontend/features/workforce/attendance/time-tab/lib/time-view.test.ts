import { describe, expect, it } from 'vitest';

import { instantAt } from '../../_shared/lib/nairobi-clock';
import type { TimeRow, TimeTiles } from '../../_shared/types/attendance-types';
import { dateCell, emptyCopy, hoursWords, lateLine, monthWords, problemCopy, rowView, shiftMonth, summaryCells, tileViews } from './time-view';
import { pageWindow } from '../components/time-pager';

const row = (over: Partial<TimeRow> = {}): TimeRow => ({
  date: '2026-10-22',
  kind: 'WORKED',
  shifts: [{ templateName: 'Morning', startTime: '06:00', endTime: '14:00' }],
  clockedInAt: instantAt('2026-10-22', '06:12'),
  clockedOutAt: instantAt('2026-10-22', '14:01'),
  workedMinutes: 469,
  late: true,
  minutesLate: 12,
  minutesAfterGrace: 7,
  overtimeApprovedMinutes: 0,
  soFarMinutes: null,
  edited: false,
  autoClosed: false,
  ...over,
});

describe('the words of the Time tab', () => {
  it('writes hours the way Paper does', () => {
    expect(hoursWords(9680)).toBe('161 h 20 m');
    expect(hoursWords(489)).toBe('8 h 09 m');
    expect(hoursWords(85)).toBe('1 h 25 m');
    expect(hoursWords(0)).toBe('0 h');
    expect(hoursWords(480)).toBe('8 h');
  });
  it('names the month and steps across a year', () => {
    expect(monthWords('2026-10')).toBe('October 2026');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('writes the date column in capitals', () => {
    expect(dateCell('2026-10-24')).toBe('SAT 24 OCT');
    expect(dateCell('2026-09-22')).toBe('TUE 22 SEP');
  });
  it('writes the late line with "Read only for your role." only when the viewer cannot edit', () => {
    const last30 = { from: '2026-09-25', to: '2026-10-24', lateDays: 3, lateMinutes: 29 };
    expect(lateLine({ last30, canEditTime: true })).toBe('Late in the last 30 days: 3 days, 29 minutes. Includes today.');
    expect(lateLine({ last30, canEditTime: false })).toBe('Late in the last 30 days: 3 days, 29 minutes. Includes today. Read only for your role.');
    expect(lateLine({ last30: { ...last30, lateDays: 1, lateMinutes: 1 }, canEditTime: true })).toBe('Late in the last 30 days: 1 day, 1 minute. Includes today.');
    expect(lateLine({ last30: { ...last30, lateDays: 0, lateMinutes: 0 }, canEditTime: true })).toBe('Late in the last 30 days: none. Includes today.');
  });
  it('makes the five figures, with late and absent red only when above zero', () => {
    const summary = { daysWorked: 19, rosteredDays: 20, workedMinutes: 9680, lateDays: 2, lateMinutes: 20, overtimeApprovedMinutes: 85, absentDays: 0 };
    const cells = summaryCells({ summary });
    expect(cells.map((c) => `${c.label}|${c.value}|${c.detail}`)).toEqual([
      'DAYS WORKED|19|of 20 rostered',
      'HOURS|161 h 20 m|clocked this month',
      'LATE DAYS|2|20 minutes in total',
      'OVERTIME|1 h 25 m|approved',
      'ABSENT DAYS|0|no clock, no leave',
    ]);
    expect(cells.map((c) => c.tone)).toEqual(['default', 'default', 'error', 'default', 'default']);
  });
});

describe('a day in the table', () => {
  it('shows "Late 12 min" from the minutes past the grace time, not the raw minutes', () => {
    const v = rowView(row({ minutesLate: 12, minutesAfterGrace: 7 }), true);
    expect(v.tag).toEqual({ tone: 'error', text: 'Late 7 min' });
    expect(v.inAt).toBe('06:12');
    expect(v.out).toBe('14:01');
    expect(v.hours).toBe('7 h 49 m');
    expect(v.shift).toBe('06:00 – 14:00');
  });
  it('tints today and says "so far"', () => {
    const v = rowView(row({ kind: 'ON_SHIFT', late: false, clockedOutAt: null, soFarMinutes: 252, workedMinutes: 0 }), true);
    expect(v.today).toBe(true);
    expect(v.out).toBe('On shift');
    expect(v.hours).toBe('so far 4 h 12 m');
  });
  it('writes approved overtime on the day, and a dash otherwise', () => {
    expect(rowView(row({ late: false, overtimeApprovedMinutes: 85 }), true).overtime).toBe('1 h 25 m approved');
    expect(rowView(row({ late: false }), true).overtime).toBe('—');
  });
  it('marks an absent day with a tag and 0 h', () => {
    const v = rowView(row({ kind: 'ABSENT', late: false, clockedInAt: null, clockedOutAt: null, workedMinutes: 0 }), true);
    expect(v.tag).toEqual({ tone: 'error', text: 'Absent' });
    expect(v.hours).toBe('0 h');
  });
  it('draws a day off as one grey line with no Edit time', () => {
    const v = rowView(row({ kind: 'DAY_OFF', shifts: [], late: false }), true);
    expect(v).toMatchObject({ shift: 'Day off', quiet: true, canEdit: false, inAt: '', out: '' });
  });
  it('offers Edit time only when the server says the viewer may (the Accountant reads only)', () => {
    expect(rowView(row(), true).canEdit).toBe(true);
    expect(rowView(row(), false).canEdit).toBe(false);
    expect(rowView(row({ kind: 'ABSENT' }), false).canEdit).toBe(false);
  });
  it('never offers Edit time on a day still to come', () => {
    expect(rowView(row({ kind: 'UPCOMING', late: false }), true).canEdit).toBe(false);
  });
});

describe('the empty and error states', () => {
  const base = { name: 'Faith Njeri', positionName: 'Branch Manager', organizationName: 'Nyeri Town' as string | null };
  it('says a person who does not clock has no days, with their pay as a fixed amount', () => {
    expect(emptyCopy({ ...base, emptyReason: 'DOES_NOT_CLOCK' })).toEqual({
      title: 'Faith Njeri · Branch Manager does not clock in',
      line: 'Branch Managers are not on the clock, so there are no days to show. Their pay is a fixed amount each month.',
    });
  });
  it('says the clock is off at the branch and who can switch it on', () => {
    const copy = emptyCopy({ ...base, emptyReason: 'CLOCK_OFF' });
    expect(copy?.title).toBe('The clock is off at Nyeri Town');
    expect(copy?.line).toContain('The Director or the System Admin can switch it on.');
  });
  it('does not print "undefined" when the branch name is missing', () => {
    expect(emptyCopy({ ...base, organizationName: null, emptyReason: 'CLOCK_OFF' })?.title).toBe('The clock is off at this branch');
  });
  it('has no empty copy when there are days', () => {
    expect(emptyCopy({ ...base, emptyReason: null })).toBeNull();
  });
  it('tells busy from error', () => {
    expect(problemCopy(503, 'Agnes Wanjiru', 'Barista')).toMatchObject({ busy: true, title: 'The system is busy' });
    const error = problemCopy(500, 'Agnes Wanjiru', 'Barista');
    expect(error).toMatchObject({ busy: false, title: 'We could not load this' });
    expect(error.line).toBe('The time for Agnes Wanjiru · Barista did not load. Nothing was changed.');
  });
});

describe('the Overview tiles', () => {
  const tiles = (over: Partial<TimeTiles> = {}): TimeTiles => ({
    employeeId: 'e1',
    clocks: true,
    clockOn: true,
    onTime: { tracked: true, onTime: 17, worked: 20, from: '2026-09-25', to: '2026-10-24' },
    overtime: { tracked: true, month: '2026-10', approvedMinutes: 85 },
    leaveLeft: { state: 'NOT_SET' },
    ...over,
  });
  it('reads 17/20 shifts and 1 h 25 m for a person who clocks, and "Not set" for leave', () => {
    expect(tileViews(tiles()).map((t) => `${t.value}|${t.detail}`)).toEqual(['17/20|shifts, last 30 days', '1 h 25 m|approved this month', 'Not set|No leave rule for this position yet']);
  });
  it('reads "Not tracked" for a person who does not clock', () => {
    const v = tileViews(tiles({ clocks: false, onTime: { tracked: false, onTime: 0, worked: 0, from: '', to: '' }, overtime: { tracked: false, month: '2026-10', approvedMinutes: 0 } }));
    expect(v.slice(0, 2).map((t) => `${t.value}|${t.detail}|${t.muted}`)).toEqual(['Not tracked|Does not clock in|true', 'Not tracked|Does not clock in|true']);
  });
});

describe('the pager', () => {
  it('lists every page when there are few and leaves gaps when there are many', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(6, 20)).toEqual([1, null, 5, 6, 7, null, 20]);
  });
});
