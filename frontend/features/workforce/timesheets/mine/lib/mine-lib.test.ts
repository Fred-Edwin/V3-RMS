import { describe, expect, it } from 'vitest';

import type { MyDay, MyRota, MyTime } from '../../_shared/types/timesheet-types';
import { dayLine, overtimeLine, weekGroups } from './my-view';
import { EMPTY_FORM, bodyOf, goesToHr, problemOf, recordedWords, shouldBeWords, type ReportForm } from './report-form';
import { plannedMinutes, rotaLines, rotaSummary } from './rota-lines';

const day = (shiftDate: string, over: Partial<MyDay> = {}): MyDay => ({
  id: shiftDate, periodId: 'p', employeeId: 'e', shiftDate, status: 'AUTO_APPROVED', reasons: [], scheduledMinutes: 480, workedMinutes: 483, minutesLate: 0, minutesAfterGrace: 0, leftEarlyMinutes: 0, afterEndMinutes: 0, lateExcused: false,
  decidedById: null, decidedAt: null, decisionReason: null, carriedFromPeriodId: null,
  clockIn: `${shiftDate}T02:58:00.000Z`, clockOut: `${shiftDate}T11:01:00.000Z`, overtime: null, requests: [], ...over,
});

const time = (days: MyDay[], totals: Partial<MyTime['totals']> = {}): MyTime => ({
  enabled: true,
  period: null,
  periods: [],
  days,
  weeks: [{ weekStart: '2026-10-05', status: 'AUTO_APPROVED', scheduledMinutes: 0, workedMinutes: 0, partWeek: false }],
  totals: { plannedMinutes: 0, workedMinutes: 0, lateMinutes: 0, overtimeAuthorisedMinutes: 0, overtimePendingMinutes: 0, ...totals },
  openRequests: 0,
});

const PERIOD = { start: '2026-10-01', end: '2026-10-31' } as Parameters<typeof weekGroups>[1];

describe('a day on My time', () => {
  it('shows the clock range in Nairobi time and the hours', () => {
    expect(dayLine(day('2026-10-05'))).toMatchObject({ day: 'Mon 5', range: '05:58 → 14:01', hours: '8 h 03', state: 'ok', reportable: false });
  });

  it('draws a short day amber, and a day that looks wrong red with the question and the button', () => {
    expect(dayLine(day('2026-10-06', { workedMinutes: 420 })).state).toBe('short');
    const wrong = dayLine(day('2026-10-09', { reasons: ['LEFT_EARLY'], clockOut: '2026-10-09T08:20:00.000Z', workedMinutes: 322 }));
    expect(wrong).toMatchObject({ state: 'problem', range: '05:58 → 11:20', note: 'Clocked out early. Is this wrong?', reportable: true });
  });

  it('takes the button away once a report is waiting, and says so', () => {
    const sent = dayLine(day('2026-10-09', { reasons: ['LEFT_EARLY'], requests: [{ id: 'r', kind: 'CLOCK_TIME_WRONG', state: 'WAITING' }] }));
    expect(sent.reportable).toBe(false);
    expect(sent.note).toBe('You reported this. Your manager has it.');
  });

  it('says when there was no clock at all', () => {
    expect(dayLine(day('2026-10-07', { clockIn: null, clockOut: null, workedMinutes: 0, reasons: ['ABSENT'] })).range).toBe('No clock recorded');
  });
});

describe('weeks on My time', () => {
  it('lists the newest week and day first and leaves out days with nothing planned or worked', () => {
    const groups = weekGroups(time([day('2026-10-05'), day('2026-10-06'), day('2026-10-11', { scheduledMinutes: 0, workedMinutes: 0 }), day('2026-10-12')]), PERIOD);
    expect(groups.map((g) => [g.weekStart, g.lines.map((l) => l.day)])).toEqual([
      ['2026-10-12', ['Mon 12']],
      ['2026-10-05', ['Tue 6', 'Mon 5']],
    ]);
    expect(groups[1]?.label).toBe('5 Oct to 11 Oct');
  });

  it('says overtime as authorised or waiting, never as pay', () => {
    expect(overtimeLine(time([], { overtimeAuthorisedMinutes: 90, overtimePendingMinutes: 35 }))).toBe('1 h 30 overtime authorised · 35 min waiting for your manager');
    expect(overtimeLine(time([]))).toBeNull();
  });
});

describe('Report a problem', () => {
  const form = (over: Partial<ReportForm>): ReportForm => ({ ...EMPTY_FORM, kind: 'CLOCK_TIME_WRONG', date: '2026-10-09', type: 'OUT', time: '14:00', note: 'I tapped Clock out by accident', ...over });

  it('says what is missing, one thing at a time', () => {
    expect(problemOf(EMPTY_FORM)).toBe('Choose what went wrong.');
    expect(problemOf(form({ date: null }))).toBe('Choose the day.');
    expect(problemOf(form({ time: '25:00' }))).toBe('Say what time it should be, like 14:00.');
    expect(problemOf(form({ kind: 'WORKED_NOT_RECORDED', from: '14:00', to: '06:00' }))).toBe('The finish has to be after the start.');
    expect(problemOf(form({ note: 'ok' }))).toBe('Write one line about what happened.');
    expect(problemOf(form({}))).toBeNull();
  });

  it('turns a clock time into a Nairobi instant for the API', () => {
    expect(bodyOf(form({}))).toEqual({ kind: 'CLOCK_TIME_WRONG', date: '2026-10-09', type: 'OUT', at: '2026-10-09T14:00:00+03:00', note: 'I tapped Clock out by accident' });
    expect(bodyOf(form({ kind: 'CLOCKED_OUT_BY_MISTAKE', time: '' }))).toEqual({ kind: 'CLOCKED_OUT_BY_MISTAKE', date: '2026-10-09', note: 'I tapped Clock out by accident' });
    expect(bodyOf(form({ kind: 'WORKED_NOT_RECORDED', from: '06:00', to: '14:00' }))).toMatchObject({ clockIn: '2026-10-09T06:00:00+03:00', clockOut: '2026-10-09T14:00:00+03:00' });
  });

  it('sets recorded beside what the person says, and sends only pay questions to HR', () => {
    expect(recordedWords(form({}), { in: '05:58', out: '11:20' })).toBe('Out 11:20');
    expect(recordedWords(form({ kind: 'ROTA_WRONG' }), { in: '05:58', out: '11:20' })).toBeNull();
    expect(shouldBeWords(form({}))).toBe('Out 14:00');
    expect(shouldBeWords(form({ kind: 'CLOCKED_OUT_BY_MISTAKE', time: '' }))).toBe('Still on shift');
    expect(goesToHr('PAY_OTHER')).toBe(true);
    expect(goesToHr('CLOCK_TIME_WRONG')).toBe(false);
  });
});

describe('My rota', () => {
  const rota: MyRota = {
    enabled: true,
    from: '2026-10-12',
    to: '2026-10-14',
    shifts: [
      { entryId: 'a', date: '2026-10-12', name: 'Morning', colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 30 },
      { entryId: 'b', date: '2026-10-14', name: 'Afternoon', colour: 'GREEN', startTime: '14:00', endTime: '22:00', unpaidBreakMinutes: 0 },
    ],
  };

  it('has a card for every day, today marked, off days drawn as off', () => {
    const lines = rotaLines(rota, '2026-10-12');
    expect(lines.map((l) => [l.day, l.today, l.dayOff])).toEqual([['Mon 12', true, false], ['Tue 13', false, true], ['Wed 14', false, false]]);
    expect(lines[0]?.shift).toEqual({ tone: 'morning', label: 'Morning 06:00 to 14:00' });
  });

  it('days after the last planned shift read "Not planned yet"; a gap between planned shifts is a day off', () => {
    const longer = { ...rota, to: '2026-10-16' };
    const lines = rotaLines(longer, '2026-10-12');
    expect(lines.map((l) => [l.day, l.notPlanned])).toEqual([['Mon 12', false], ['Tue 13', false], ['Wed 14', false], ['Thu 15', true], ['Fri 16', true]]);
  });

  it('adds up paid hours less the unpaid break', () => {
    expect(plannedMinutes(rota)).toBe(450 + 480);
    expect(rotaSummary(rota)).toBe('2 shifts · 15.5 h planned');
  });
});
