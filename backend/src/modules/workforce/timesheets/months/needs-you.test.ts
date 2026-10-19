import { describe, expect, it } from 'vitest';
import { day, item, request } from './month-fixtures';
import { blockingTotal, dayNeed, needsYou, requestNeed, settledWithMonth } from './needs-you';

describe('what blocks approving the month (D2)', () => {
  it('a matched or approved day never blocks', () => {
    expect(dayNeed(day('2026-09-01'))).toBeNull();
    expect(dayNeed(day('2026-09-01', { status: 'APPROVED' }))).toBeNull();
  });
  it('late, left early, absent and edited days never block: they are facts, payroll applies the Rules', () => {
    for (const reasons of [['LATE'], ['LEFT_EARLY'], ['ABSENT'], ['EDITED'], ['LATE', 'LEFT_EARLY']] as const) {
      expect(dayNeed(day('2026-09-01', { status: 'NEEDS_LOOK', reasons: [...reasons] }))).toBeNull();
    }
  });
  it('an open shift or a phone-closed shift is a clock-out fix', () => {
    expect(dayNeed(day('2026-09-01', { status: 'NEEDS_LOOK', reasons: ['OPEN_SHIFT'] }))).toBe('CLOCK_OUT_FIX');
    expect(dayNeed(day('2026-09-01', { status: 'NEEDS_LOOK', reasons: ['LATE', 'AUTO_CLOSED'] }))).toBe('CLOCK_OUT_FIX');
  });
  it('a wrong phone clock, work with no shift, and a day changed after approval need a look', () => {
    for (const reason of ['PHONE_CLOCK', 'UNSCHEDULED', 'CHANGED_AFTER_APPROVAL'] as const) expect(dayNeed(day('2026-09-01', { status: 'NEEDS_LOOK', reasons: [reason] }))).toBe('DAY_LOOK');
  });
  it('a held day always blocks, whatever its reasons', () => {
    expect(dayNeed(day('2026-09-01', { status: 'HELD', reasons: ['LATE'] }))).toBe('DAY_LOOK');
  });
  it('the overtime of a day is the overtime item\'s business, not the day\'s', () => {
    expect(dayNeed(day('2026-09-01', { status: 'NEEDS_LOOK', reasons: ['OVERTIME'] }))).toBeNull();
  });
  it('a request with the manager blocks; one moved to HR only gets listed', () => {
    expect(requestNeed(request('2026-09-08'))).toBe('WITH_MANAGER');
    expect(requestNeed(request('2026-09-08', { escalatedAt: new Date(), waitingOnRole: 'HR_MANAGER' }))).toBe('WITH_HR');
    expect(requestNeed(request('2026-09-08', { waitingOnRole: 'HR_MANAGER' }))).toBe('WITH_HR');
    expect(requestNeed(request('2026-09-08', { state: 'APPROVED' }))).toBeNull();
    expect(requestNeed(request('2026-09-08', { state: 'WITHDRAWN' }))).toBeNull();
  });
  it('counts the parts and totals only what blocks', () => {
    const counts = needsYou(
      [day('2026-09-11', { status: 'NEEDS_LOOK', reasons: ['OPEN_SHIFT'] }), day('2026-09-12', { status: 'NEEDS_LOOK', reasons: ['LATE'] }), day('2026-09-13', { status: 'HELD', reasons: [] })],
      [item('2026-09-12'), item('2026-09-14', { status: 'APPROVED' }), item('2026-09-15', { status: 'APPROVED_PART' }), item('2026-09-16', { status: 'DECLINED' })],
      [request('2026-09-08'), request('2026-09-09', { waitingOnRole: 'HR_MANAGER' })],
    );
    expect(counts).toEqual({ clockOutFixes: 1, daysToLookAt: 1, overtimeDecisions: 1, requestsWithManager: 1, requestsWithHr: 1 });
    expect(blockingTotal(counts)).toBe(4);
  });
  it('days that only carry facts are settled with the month', () => {
    expect(settledWithMonth(day('2026-09-01', { status: 'NEEDS_LOOK', reasons: ['LATE'] }))).toBe(true);
    expect(settledWithMonth(day('2026-09-01', { status: 'NEEDS_LOOK', reasons: ['OPEN_SHIFT'] }))).toBe(false);
    expect(settledWithMonth(day('2026-09-01', { status: 'HELD', reasons: ['LATE'] }))).toBe(false);
    expect(settledWithMonth(day('2026-09-01'))).toBe(false);
  });
});
