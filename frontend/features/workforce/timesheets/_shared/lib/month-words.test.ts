import { describe, expect, it } from 'vitest';

import type { MonthView } from '../types/month-types';
import { clockHours, kpiCells, needsAnnouncement, needsParts, payrollWaitingNote, pickLimits, rangeLabel, spanCaption, statusWords, weekPicks } from './month-words';

const month = (patch: Partial<MonthView> = {}): MonthView => ({
  monthKey: '2026-09',
  label: 'September 2026',
  organization: { id: 's', name: 'Nyeri Town' },
  state: 'TO_APPROVE',
  window: { start: '2026-09-01', end: '2026-09-30' },
  range: { from: '2026-09-01', to: '2026-09-30' },
  kpis: { workedMinutes: 321_360, plannedMinutes: 327_360, headcount: 31, overtime: { recordedMinutes: 225, approvedMinutes: 90, partNotApprovedMinutes: 0, toDecideMinutes: 135 }, lateCount: 6, absentDays: 1 },
  soFar: null,
  needsYou: { clockOutFixes: 1, overtimeDecisions: 2, requestsWithManager: 0, daysToLookAt: 0, requestsWithHr: 0, total: 3 },
  approval: null,
  rulesUsed: [],
  otherSites: [],
  capabilities: { canApprove: true, canExport: true, canDecide: true },
  approvableFrom: '2026-10-01',
  ...patch,
});

describe('hours and ranges', () => {
  it('writes table hours as h:mm', () => {
    expect(clockHours(10_560)).toBe('176:00');
    expect(clockHours(35)).toBe('0:35');
  });
  it('writes ranges in the spec words', () => {
    expect(rangeLabel('2026-09-14', '2026-09-20')).toBe('14 to 20 Sep');
    expect(rangeLabel('2026-09-01', '2026-10-02')).toBe('1 Sep to 2 Oct');
  });
  it('counts days and names a Monday to Sunday week', () => {
    expect(spanCaption('2026-09-14', '2026-09-20')).toBe('7 days · one Monday to Sunday week');
    expect(spanCaption('2026-09-15', '2026-09-21')).toBe('7 days');
    expect(spanCaption('2026-09-15', '2026-09-15')).toBe('1 day');
  });
});

describe('week quick picks', () => {
  it('cuts the weeks at the month edges', () => {
    const labels = weekPicks('2026-09-01', '2026-09-30').map((w) => w.label);
    expect(labels).toEqual(['Week 1 · 1 to 6 Sep', 'Week 2 · 7 to 13 Sep', 'Week 3 · 14 to 20 Sep', 'Week 4 · 21 to 27 Sep', 'Week 5 · 28 to 30 Sep']);
  });
  it('stops at today for the open month and leaves out later weeks', () => {
    const picks = weekPicks('2026-10-01', '2026-10-19');
    expect(picks.at(-1)).toMatchObject({ from: '2026-10-19', to: '2026-10-19' });
    expect(picks).toHaveLength(4);
  });
  it('builds February and a 31-day month correctly', () => {
    expect(weekPicks('2026-02-01', '2026-02-28').at(-1)?.to).toBe('2026-02-28');
    expect(weekPicks('2026-10-01', '2026-10-31').at(-1)?.to).toBe('2026-10-31');
  });
  it('limits the picker to today in the open month only', () => {
    expect(pickLimits({ window: { start: '2026-10-01', end: '2026-10-31' }, state: 'OPEN' }, '2026-10-19')).toEqual({ first: '2026-10-01', last: '2026-10-19' });
    expect(pickLimits({ window: { start: '2026-09-01', end: '2026-09-30' }, state: 'TO_APPROVE' }, '2026-10-19')).toEqual({ first: '2026-09-01', last: '2026-09-30' });
  });
});

describe('the four numbers', () => {
  it('reads the month to approve as the spec does', () => {
    const cells = kpiCells(month());
    expect(cells[0]).toMatchObject({ label: 'SEPTEMBER · HOURS WORKED', value: '5,356 h', detail: 'plan was 5,456 h · 31 people' });
    expect(cells[1]).toMatchObject({ value: '3 h 45', detail: '1 h 30 approved · 2 h 15 to decide' });
    expect(cells[2]).toMatchObject({ value: '6', detail: 'for payroll, nothing to approve' });
    expect(cells[3]).toMatchObject({ label: 'NEEDS YOU BEFORE APPROVING', value: '3', detail: '1 clock-out fix · 2 overtime decisions', actionable: true });
  });
  it('adds the amount not approved only when there is one', () => {
    const cells = kpiCells(month({ kpis: { ...month().kpis, overtime: { recordedMinutes: 225, approvedMinutes: 205, partNotApprovedMinutes: 20, toDecideMinutes: 0 } } }));
    expect(cells[1]?.detail).toBe('3 h 25 approved · 20 min not approved');
  });
  it('shows hours so far for the open month and a quiet fourth cell when nothing is open', () => {
    const open = kpiCells(month({ state: 'OPEN', soFar: { workedMinutes: 187_080, plannedMinutes: 192_000, throughDate: '2026-10-19' }, needsYou: { clockOutFixes: 0, overtimeDecisions: 0, requestsWithManager: 0, daysToLookAt: 0, requestsWithHr: 0, total: 0 } }));
    expect(open[0]).toMatchObject({ label: 'SEPTEMBER · HOURS SO FAR', value: '3,118 h', detail: 'plan so far 3,200 h · open shifts not counted' });
    expect(open[3]).toMatchObject({ label: 'NEEDS YOU', value: '0', detail: 'Nothing to decide yet' });
    expect(open[3]?.actionable).toBeFalsy();
  });
  it('turns the fourth cell green once approved', () => {
    const cells = kpiCells(month({ state: 'APPROVED', approval: { approvedAt: '2026-10-19T08:42:00.000Z', approvedBy: { name: 'Faith Njeri', role: 'Branch Manager' }, documentNumber: 'TSH-0009', note: null, ownHoursIncluded: false } }));
    expect(cells[3]).toMatchObject({ label: 'APPROVED AND SENT TO PAYROLL', value: '✓', tone: 'success', detail: '19 Oct, 11:42 · Faith Njeri, Branch Manager' });
  });
  it('lists what needs the manager for the screen reader', () => {
    expect(needsAnnouncement(month())).toBe('Needs you before approving: 3. 1 clock-out fix, 2 overtime decisions.');
    expect(needsParts({ clockOutFixes: 0, overtimeDecisions: 1, requestsWithManager: 2, daysToLookAt: 1, requestsWithHr: 0, total: 4 })).toBe('1 overtime decision · 2 requests · 1 day to look at');
  });
});

describe('status words', () => {
  it('says the most urgent thing in amber, decisions in green and facts in grey', () => {
    expect(statusWords({ kind: 'CLOCK_OUT_FIX', date: '2026-09-11' })).toEqual({ text: 'Clock-out fix · Fri 11 Sep', tone: 'warning' });
    expect(statusWords({ kind: 'OVERTIME_TO_DECIDE', minutes: 100 })).toEqual({ text: 'Overtime 1 h 40 to decide', tone: 'warning' });
    expect(statusWords({ kind: 'SEVERAL', count: 3 }).text).toBe('Several things to decide (3)');
    expect(statusWords({ kind: 'OVERTIME_APPROVED', minutes: 35 })).toEqual({ text: 'Overtime 35 min approved', tone: 'success' });
    expect(statusWords({ kind: 'ABSENT', date: '2026-09-09' })).toEqual({ text: 'Absent Wed 9 Sep, unpaid', tone: 'muted' });
    expect(statusWords({ kind: 'NOTHING' }).text).toBe('Nothing to decide');
  });
});

describe('the note about other branches', () => {
  const others = [{ name: 'Nyeri Highway', approved: false }, { name: 'Central Store', approved: false }];
  it('covers every case in the spec', () => {
    expect(payrollWaitingNote('September', [])).toBe('Payroll can start as soon as you approve.');
    expect(payrollWaitingNote('September', [{ name: 'A', approved: true }])).toBe('Every branch has approved September. Payroll can start.');
    expect(payrollWaitingNote('September', others.slice(0, 1))).toBe('Today Nyeri Highway has not approved September yet, so payroll waits for it.');
    expect(payrollWaitingNote('September', others)).toBe('Today Nyeri Highway and Central Store have not approved September yet, so payroll waits for them.');
  });
});
