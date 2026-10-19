import { describe, expect, it } from 'vitest';
import { dayResult } from './day-result';
import { day, item, request } from '../month-fixtures';

describe('one word per day, the most urgent first', () => {
  it('a date with no stored day is a rest day', () => {
    expect(dayResult(null, null, [])).toEqual({ resultKey: 'REST', glance: 'REST', needsLook: false });
  });
  it('a clean day is on the rota', () => {
    expect(dayResult(day('2026-09-01'), null, [])).toEqual({ resultKey: 'ON_ROTA', glance: 'WORKED', needsLook: false });
  });
  it('a missing clock-out beats everything', () => {
    const open = day('2026-09-01', { status: 'NEEDS_LOOK', reasons: ['OPEN_SHIFT', 'LATE'], minutesLate: 10 });
    expect(dayResult(open, item('2026-09-01'), []).resultKey).toBe('CLOCK_OUT_MISSING');
  });
  it('overtime waiting shows as to decide and needs the manager', () => {
    const r = dayResult(day('2026-09-12', { status: 'NEEDS_LOOK', reasons: ['OVERTIME'] }), item('2026-09-12'), []);
    expect(r).toEqual({ resultKey: 'OVERTIME_TO_DECIDE', glance: 'OVERTIME_TO_DECIDE', needsLook: true });
  });
  it('a decided overtime item names the answer', () => {
    const d = (status: 'APPROVED' | 'APPROVED_PART' | 'DECLINED') => dayResult(day('2026-09-12'), item('2026-09-12', { status, decidedById: 'm' }), []).resultKey;
    expect([d('APPROVED'), d('APPROVED_PART'), d('DECLINED')]).toEqual(['OVERTIME_APPROVED', 'OVERTIME_APPROVED_PART', 'OVERTIME_NOT_APPROVED']);
  });
  it('a request waiting with the manager counts, one with HR does not', () => {
    expect(dayResult(day('2026-09-08'), null, [request('2026-09-08')])).toMatchObject({ resultKey: 'REQUEST_WAITING', needsLook: true });
    expect(dayResult(day('2026-09-08'), null, [request('2026-09-08', { waitingOnRole: 'HR_MANAGER' })]).needsLook).toBe(false);
  });
  it('late and absent are recorded, never "needs a look"', () => {
    expect(dayResult(day('2026-09-02', { minutesLate: 5, reasons: ['LATE'], status: 'NEEDS_LOOK' }), null, [])).toEqual({ resultKey: 'LATE', glance: 'LATE', needsLook: false });
    expect(dayResult(day('2026-09-03', { reasons: ['ABSENT'], status: 'NEEDS_LOOK', workedMinutes: 0 }), null, [])).toMatchObject({ resultKey: 'ABSENT', needsLook: false });
  });
  it('a day with no shift and no work is a rest day', () => {
    expect(dayResult(day('2026-09-06', { scheduledMinutes: 0, workedMinutes: 0 }), null, []).resultKey).toBe('REST');
  });
});
