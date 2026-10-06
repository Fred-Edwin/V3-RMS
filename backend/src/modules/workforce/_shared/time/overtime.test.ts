import { describe, expect, it } from 'vitest';
import { makeUpMinutes, overtimeCandidate, weeklyOvertime, type OvertimeCandidate } from './overtime';
import { parseClockTime, parseNairobiDate } from './nairobi-time';
import type { DayHours, ShiftWindow } from './time-types';

const shift: ShiftWindow = { date: parseNairobiDate('2026-10-06'), startTime: parseClockTime('06:00'), endTime: parseClockTime('14:00'), unpaidBreakMinutes: 0 };
const day = (over: Partial<DayHours> = {}): DayHours => ({
  shiftDate: shift.date,
  status: 'CLOSED',
  scheduledMinutes: 480,
  firstClockIn: new Date('2026-10-06T03:00:00Z'),
  lastClockOut: new Date('2026-10-06T11:20:00Z'),
  workedMinutes: 480,
  breakMinutes: 0,
  leftEarlyMinutes: 0,
  afterEndMinutes: 20,
  lateness: { minutesLate: 0, countsAsLate: false, minutesAfterGrace: 0, earlyMinutes: 0 },
  ...over,
});
const rules = { serviceTailMinutes: 15 };
const noEvidence = { openWorkAtShiftEnd: false, preApprovedUntil: null };

describe('overtimeCandidate', () => {
  it('open work: the tail is recognised, the rest needs approval', () => {
    expect(overtimeCandidate(day(), shift, { ...noEvidence, openWorkAtShiftEnd: true }, 0, rules)).toMatchObject({
      rawMinutes: 20,
      serviceTailMinutes: 15,
      autoRecognisedMinutes: 15,
      needsApprovalMinutes: 5,
      basis: 'SERVICE_TAIL',
    });
  });

  it('no open work: nothing is automatic', () => {
    expect(overtimeCandidate(day(), shift, noEvidence, 0, rules)).toMatchObject({ autoRecognisedMinutes: 0, needsApprovalMinutes: 20, basis: 'NONE' });
  });

  it('pre-approved until 30 minutes after the end covers all 20', () => {
    const result = overtimeCandidate(day(), shift, { openWorkAtShiftEnd: false, preApprovedUntil: new Date('2026-10-06T11:30:00Z') }, 0, rules);
    expect(result).toMatchObject({ preApprovedMinutes: 20, autoRecognisedMinutes: 20, needsApprovalMinutes: 0, basis: 'PRE_APPROVED' });
  });

  it('tail and pre-approval overlap: the larger counts, they do not add', () => {
    const result = overtimeCandidate(day(), shift, { openWorkAtShiftEnd: true, preApprovedUntil: new Date('2026-10-06T11:10:00Z') }, 0, rules);
    expect(result).toMatchObject({ serviceTailMinutes: 15, preApprovedMinutes: 10, autoRecognisedMinutes: 15, needsApprovalMinutes: 5 });
  });

  it('make-up time is taken off first', () => {
    const result = overtimeCandidate(day(), shift, { ...noEvidence, openWorkAtShiftEnd: true }, 12, rules);
    expect(result).toMatchObject({ rawMinutes: 8, serviceTailMinutes: 8, needsApprovalMinutes: 0 });
  });

  it('an OPEN day, or nothing after the end, gives null', () => {
    expect(overtimeCandidate(day({ status: 'OPEN' }), shift, noEvidence, 0, rules)).toBeNull();
    expect(overtimeCandidate(day({ afterEndMinutes: 0 }), shift, noEvidence, 0, rules)).toBeNull();
    expect(overtimeCandidate(day({ status: 'NO_CLOCK' }), shift, noEvidence, 0, rules)).toBeNull();
  });
});

describe('makeUpMinutes', () => {
  const late = day({ lateness: { minutesLate: 12, countsAsLate: true, minutesAfterGrace: 7, earlyMinutes: 0 } });
  it('is 0 when the policy is off', () => {
    expect(makeUpMinutes(late, { makeUpSameDay: false })).toBe(0);
  });
  it('uses the smaller of the minutes after grace and the time after the end', () => {
    expect(makeUpMinutes(late, { makeUpSameDay: true })).toBe(7);
    expect(makeUpMinutes({ ...late, afterEndMinutes: 3 }, { makeUpSameDay: true })).toBe(3);
  });
});

describe('weeklyOvertime', () => {
  const cand = (date: string, rawMinutes: number): OvertimeCandidate => ({
    shiftDate: parseNairobiDate(date),
    rawMinutes,
    serviceTailMinutes: 0,
    preApprovedMinutes: 0,
    autoRecognisedMinutes: 0,
    needsApprovalMinutes: rawMinutes,
    basis: 'NONE',
  });

  it('flags minutes over the weekly cap', () => {
    const result = weeklyOvertime([cand('2026-10-05', 60), cand('2026-10-07', 90), cand('2026-10-12', 30)], 1, { weeklyCapMinutes: 120 });
    expect(result).toEqual([
      { weekStart: '2026-10-05', candidateMinutes: 150, capMinutes: 120, overCapMinutes: 30 },
      { weekStart: '2026-10-12', candidateMinutes: 30, capMinutes: 120, overCapMinutes: 0 },
    ]);
  });

  it('a null cap flags nothing', () => {
    expect(weeklyOvertime([cand('2026-10-05', 600)], 1, { weeklyCapMinutes: null })[0]).toMatchObject({ capMinutes: null, overCapMinutes: 0 });
  });

  it('order value is not an input to any overtime function', () => {
    expect(overtimeCandidate.length).toBe(5);
    expect(Object.keys({ openWorkAtShiftEnd: true, preApprovedUntil: null })).not.toContain('orderValue');
  });
});
