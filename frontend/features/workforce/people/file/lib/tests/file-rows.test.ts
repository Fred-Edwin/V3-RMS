import { describe, expect, it } from 'vitest';

import type { EmployeeFile, PayChangeRow, PayView } from '../../../_shared/types/people-types';
import { aboutRows, exitBanner, exitRows, jobLeaveRows, jobRows, payAmountLine, payHistoryLines, payRows } from '../file-rows';

const joy = (over: Partial<EmployeeFile> = {}): EmployeeFile =>
  ({
    id: 'e1',
    name: 'Joy Chebet',
    status: 'ACTIVE',
    employment: 'MONTHLY',
    contractStatus: 'NONE',
    tracksTime: true,
    tracksTimeFromPosition: true,
    organization: { id: 's1', name: 'Nyeri Town' },
    department: { id: 'd1', name: 'Barista' },
    position: { id: 'p1', name: 'Barista' },
    reportsTo: { id: 'e2', name: 'Victor Maina', isHead: true },
    startDate: '2026-07-14',
    hasLogin: true,
    loginRole: 'BARISTA',
    personalPhone: '0712 345 678',
    emergencyContact: null,
    locked: [],
    probation: { endsOn: '2026-10-14', dayNumber: 80, totalDays: 90, daysLeft: 10, extensions: 0, extensionsAllowed: 1, decidedOn: null, confirmedOn: null, confirmationWaitingForContract: false, notes: [] },
    exit: null,
    ...over,
  }) as unknown as EmployeeFile;

const change = (over: Partial<PayChangeRow>): PayChangeRow => ({
  id: 'c1', employeeId: 'e1', employeeName: 'Joy Chebet', amount: '28000.00', effectiveFrom: '2026-07-14', startsInFuture: false, reason: 'HIRING', status: 'APPROVED',
  requestedByName: 'Mercy Achieng', requestedByPosition: null, requestedBySite: null, requestedOn: '2026-07-14', decidedByName: null, decidedOn: null, decisionNote: null, ...over,
});
const pay = (over: Partial<PayView> = {}): PayView => ({
  payType: 'MONTHLY_SALARY', amount: '28000.00', overtimeEligible: true, standardWeekHours: null, standardDayHours: null, hourlyEquivalent: null,
  payoutMethod: 'BANK', bank: null, history: [change({})], pending: null, locked: [], ...over,
});

describe('job rows', () => {
  it('reads as Paper does for a monthly person on probation', () => {
    const rows = jobRows(joy());
    expect(rows.map((r) => `${r.label}: ${r.value}`)).toEqual([
      'Position: Barista',
      'Department: Barista · Nyeri Town',
      'Reports to: Victor Maina (head)',
      'Employment: Monthly, on probation',
      'Started: 14 Jul 2026',
      'Clocks in and out: Yes, from the position',
      'Login role: Barista',
    ]);
  });
  it('says a casual has no login and a manually set clock rule', () => {
    const rows = jobRows(joy({ employment: 'CASUAL', hasLogin: false, loginRole: null, tracksTimeFromPosition: false, probation: null }));
    expect(rows.find((r) => r.label === 'Employment')?.value).toBe('Casual, daily');
    expect(rows.find((r) => r.label === 'Login role')?.value).toBe('No login');
    expect(rows.find((r) => r.label === 'Clocks in and out')?.value).toBe('Yes, set on this file');
  });
  it('lists the onboarding key values with the probation day', () => {
    const rows = jobLeaveRows(joy({ status: 'ONBOARDING', probation: { ...joy().probation!, endsOn: '2027-01-05' } }));
    expect(rows.map((r) => r.label)).toEqual(['Position', 'Employment', 'Tracks time', 'Annual leave', 'Probation ends']);
    expect(rows[1]?.value).toBe('Monthly, no contract yet');
    expect(rows[4]?.value).toBe('Tue 5 Jan 2027');
  });
});

describe('what a Branch Manager sees about a person', () => {
  it('shows phone and a missing emergency contact, then the locked rows', () => {
    const rows = aboutRows(joy({ locked: ['pay', 'bank', 'ids', 'documents'] }));
    expect(rows.map((r) => `${r.label}: ${r.value}`)).toEqual(['Phone: 0712 345 678', 'Emergency contact: Not added yet', 'National ID: Locked for your role', 'Pay and bank: Locked for your role']);
    expect(rows[1]?.tone).toBe('warning');
  });
  it('names the emergency contact when there is one', () => {
    const rows = aboutRows(joy({ emergencyContact: { name: 'Ann Chebet', relation: 'Mother', phone: '0700 000 000' } }));
    expect(rows[1]?.value).toBe('Ann Chebet (Mother) · 0700 000 000');
  });
});

describe('the exited file', () => {
  const exited = joy({ status: 'EXITED', exit: { lastDay: '2026-10-31', reason: 'RESIGNED', note: null, uniformReturned: false, exitedByName: 'Mercy Achieng', recordedOn: '2026-11-03', finalized: false, undoUntil: '2026-11-07', canUndo: true, canRehire: false } });
  it('lists the exit rows', () => {
    expect(exitRows(exited).map((r) => `${r.label}: ${r.value}`)).toEqual([
      'Last day: Sat 31 Oct 2026',
      'Reason: Resigned',
      'Final pay: In the October pay run',
      'Uniform and keys: Not yet returned',
      'Exited by: Mercy Achieng · 3 Nov',
    ]);
  });
  it('counts the days left to undo, and says when the window has closed', () => {
    const open = exitBanner(exited, '2026-11-03');
    expect(open?.daysLeft).toBe(4);
    expect(open?.title).toBe('Joy left on Sat 31 Oct. You can still undo this until Sat 7 Nov.');
    const closed = exitBanner(joy({ status: 'EXITED', exit: { ...exited.exit!, canUndo: false, canRehire: true } }), '2026-11-09');
    expect(closed?.canUndo).toBe(false);
    expect(closed?.daysLeft).toBe(0);
  });
  it('is null for a file that has not exited', () => {
    expect(exitBanner(joy(), '2026-10-01')).toBeNull();
  });
});

describe('pay shows "starts <date>" before its start day', () => {
  it('shows the plain amount once the day has come', () => {
    expect(payAmountLine(pay(), '2026-10-05')).toEqual({ text: 'KES 28,000 / month', startsOn: null });
  });
  it('adds the start day while the only approved amount is in the future', () => {
    const future = pay({ history: [change({ effectiveFrom: '2026-10-05' })] });
    expect(payAmountLine(future, '2026-10-01').startsOn).toBe('2026-10-05');
    expect(payRows(future, 'NONE', '2026-10-01')[0]?.value).toBe('KES 28,000 / month · starts Mon 5 Oct');
  });
  it('does not call a raise that has not started the start of pay', () => {
    const raise = pay({ amount: '30000.00', history: [change({ effectiveFrom: '2026-07-14' }), change({ id: 'c2', amount: '30000.00', effectiveFrom: '2026-11-01', reason: 'PROMOTION' })] });
    expect(payAmountLine(raise, '2026-10-05').startsOn).toBeNull();
  });
  it('uses the day for a daily rate and says nothing is set when there is no pay', () => {
    expect(payAmountLine(pay({ payType: 'DAILY_RATE', amount: '1200.00' }), '2026-10-05').text).toBe('KES 1,200 / day');
    expect(payAmountLine(pay({ amount: null, history: [] }), '2026-10-05').text).toBe('Not set yet');
  });
  it('says which amount applies to which days of the run when the change is mid-month (finding 54)', () => {
    const mid = pay({ history: [change({}), change({ id: 'c2', amount: '26000.00', effectiveFrom: '2026-10-22', reason: 'CORRECTION' })] });
    const row = payRows(mid, 'ACTIVE', '2026-10-21').find((r) => r.label === 'Pay in the October run');
    expect(row?.value).toBe('KES 28,000 until 21 Oct, then KES 26,000 from 22 Oct');
    const first = pay({ history: [change({}), change({ id: 'c2', amount: '26000.00', effectiveFrom: '2026-11-01', reason: 'CORRECTION' })] });
    expect(payRows(first, 'ACTIVE', '2026-10-21').some((r) => r.label.startsWith('Pay in the'))).toBe(false);
  });
  it('flags the lateness rule while there is no contract', () => {
    expect(payRows(pay(), 'NONE', '2026-10-05')[3]).toMatchObject({ value: 'Company default · no contract yet', tone: 'warning' });
    expect(payRows(pay(), 'ACTIVE', '2026-10-05')[3]?.tone).toBe('default');
  });
});

describe('pay history', () => {
  it('lists newest first and says what is waiting or declined', () => {
    const lines = payHistoryLines([change({}), change({ id: 'c2', effectiveFrom: '2026-11-01', amount: '30000.00', reason: 'PROMOTION', status: 'PENDING' }), change({ id: 'c3', effectiveFrom: '2026-09-01', status: 'DECLINED', reason: 'CORRECTION' })]);
    expect(lines.map((l) => l.reason)).toEqual(['Promotion · waiting for the Director', 'Correction · declined', 'Hiring']);
    expect(lines[0]).toMatchObject({ from: '1 Nov 2026', amount: 'KES 30,000', tone: 'warning' });
  });
});
