import { describe, expect, it } from 'vitest';
import { assertPageReachable, rangeOf } from './audit-range';

const now = new Date('2026-10-19T11:00:00.000Z'); // 14:00 on 19 Oct in Nairobi

describe('the log date range', () => {
  it('defaults to the last 30 Nairobi days, today included', () => {
    const r = rangeOf(undefined, undefined, now);
    expect(r.to).toBe('2026-10-19');
    expect(r.from).toBe('2026-09-20');
  });

  it('starts and ends at Nairobi midnight (a late-evening entry belongs to its Nairobi day)', () => {
    const r = rangeOf('2026-10-19', '2026-10-19', now);
    expect(r.start.toISOString()).toBe('2026-10-18T21:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-10-19T21:00:00.000Z');
  });

  it('swaps from and to silently and never reaches past today', () => {
    expect(rangeOf('2026-10-19', '2026-10-01', now)).toMatchObject({ from: '2026-10-01', to: '2026-10-19' });
    expect(rangeOf('2026-10-01', '2027-01-01', now).to).toBe('2026-10-19');
  });

  it('a date that does not exist is RANGE_INVALID', () => {
    expect(() => rangeOf('2026-02-31', undefined, now)).toThrow(expect.objectContaining({ code: 'RANGE_INVALID' }));
  });

  it('marks a range that reaches past seven years', () => {
    expect(rangeOf('2019-01-01', undefined, now).reachesArchive).toBe(true);
    expect(rangeOf('2026-01-01', undefined, now).reachesArchive).toBe(false);
  });

  it('a deep page across a wide range needs dates; a narrow range is fine', () => {
    expect(() => assertPageReachable(201, rangeOf('2026-01-01', undefined, now))).toThrow(expect.objectContaining({ code: 'RANGE_REQUIRED' }));
    expect(() => assertPageReachable(201, rangeOf('2026-10-01', undefined, now))).not.toThrow();
    expect(() => assertPageReachable(200, rangeOf('2026-01-01', undefined, now))).not.toThrow();
  });
});
