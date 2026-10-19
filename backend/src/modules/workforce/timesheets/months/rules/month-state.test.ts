import { describe, expect, it } from 'vitest';
import { nairobiToday, parseNairobiDate } from '../../../_shared/time/nairobi-time';
import { firstApprovalDay, isMonthKey, monthBounds, monthKeyOf, monthLabelOf, monthStateOf } from './month-state';

const d = parseNairobiDate;
const sept = { state: 'OPEN' as const, end: d('2026-09-30') };

describe('month state (derived, never stored by a sweep)', () => {
  it('is OPEN through the last day', () => {
    expect(monthStateOf(sept, d('2026-09-15'))).toBe('OPEN');
    expect(monthStateOf(sept, d('2026-09-30'))).toBe('OPEN');
  });
  it('is TO_APPROVE from the day after the last day, and stays so for as long as nobody approves', () => {
    expect(monthStateOf(sept, d('2026-10-01'))).toBe('TO_APPROVE');
    expect(monthStateOf(sept, d('2027-03-01'))).toBe('TO_APPROVE');
  });
  it('is APPROVED once approved, whatever the date', () => {
    expect(monthStateOf({ ...sept, state: 'APPROVED' }, d('2026-09-15'))).toBe('APPROVED');
    expect(monthStateOf({ ...sept, state: 'APPROVED' }, d('2026-12-15'))).toBe('APPROVED');
  });
  it('reads a retired CLOSED/CLOSING row as an unapproved month', () => {
    expect(monthStateOf({ ...sept, state: 'CLOSED' }, d('2026-10-05'))).toBe('TO_APPROVE');
    expect(monthStateOf({ ...sept, state: 'CLOSING' }, d('2026-09-05'))).toBe('OPEN');
  });
  it('switches at 00:00 Nairobi, not 00:00 UTC (21:00 UTC on 30 Sep is already 1 Oct in Nairobi)', () => {
    const before = new Date('2026-09-30T20:59:00.000Z');
    const after = new Date('2026-09-30T21:00:00.000Z');
    expect(monthStateOf(sept, nairobiToday(before))).toBe('OPEN');
    expect(monthStateOf(sept, nairobiToday(after))).toBe('TO_APPROVE');
  });
  it('February in a leap year and a 31-day month end on the right day', () => {
    expect(monthBounds('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
    expect(monthBounds('2027-02').last).toBe('2027-02-28');
    expect(monthBounds('2026-10').last).toBe('2026-10-31');
    expect(firstApprovalDay({ end: d('2026-10-31') })).toBe('2026-11-01');
    expect(firstApprovalDay({ end: d('2026-12-31') })).toBe('2027-01-01');
  });
  it('names a month by its last day and validates keys', () => {
    expect(monthKeyOf({ end: d('2026-09-30') })).toBe('2026-09');
    expect(monthLabelOf('2026-09')).toBe('September 2026');
    expect(['2026-09', '1999-12'].every(isMonthKey)).toBe(true);
    expect(['2026-9', '2026-13', '2026-00', 'sept'].some(isMonthKey)).toBe(false);
  });
});
