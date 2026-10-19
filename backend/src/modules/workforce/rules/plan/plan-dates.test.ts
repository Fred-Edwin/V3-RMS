import { describe, expect, it } from 'vitest';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';
import { assertStartAllowed, assertWeekStartDay, defaultStartFor, earliestStartFor, MAX_DAYS_AHEAD } from './plan-dates';

const d = parseNairobiDate;
const live = (version: number, iso: string) => ({ version, effectiveFrom: new Date(`${iso}T00:00:00Z`) });
const NOW = new Date('2026-10-06T21:30:00Z'); // 00:30 on 7 Oct in Nairobi, still 6 Oct in UTC and in Los Angeles

describe('the suggested start day (D10)', () => {
  it('a pay change starts on the first of next month', () => {
    expect(defaultStartFor('LATENESS', ['graceMinutes'], d('2026-10-07'))).toBe('2026-11-01');
    expect(defaultStartFor('OVERTIME', ['multipliers'], d('2026-10-31'))).toBe('2026-11-01');
    expect(defaultStartFor('CASUAL_WORK', ['rates'], d('2026-10-07'))).toBe('2026-11-01');
    expect(defaultStartFor('HOLIDAYS', ['payMultiplier'], d('2026-10-07'))).toBe('2026-11-01');
    expect(defaultStartFor('STATUTORY', ['tables'], d('2026-10-07'))).toBe('2026-11-01');
  });

  it('December rolls into January', () => {
    expect(defaultStartFor('LATENESS', ['graceMinutes'], d('2026-12-15'))).toBe('2027-01-01');
  });

  it('everything else starts today', () => {
    expect(defaultStartFor('ATTENDANCE', ['undoWindowSeconds'], d('2026-10-07'))).toBe('2026-10-07');
    expect(defaultStartFor('LEAVE', ['minimumCover'], d('2026-10-07'))).toBe('2026-10-07');
    expect(defaultStartFor('PROBATION', ['defaultMonths'], d('2026-10-07'))).toBe('2026-10-07');
    expect(defaultStartFor('CONDUCT', ['levels'], d('2026-10-07'))).toBe('2026-10-07');
    expect(defaultStartFor('WEEK_AND_BREAKS', ['weekStartsOn'], d('2026-10-07'))).toBe('2026-10-07');
    expect(defaultStartFor('HOLIDAYS', ['holidays'], d('2026-10-07'))).toBe('2026-10-07');
  });
});

describe('the earliest start day', () => {
  it('is today (the caller passes the Nairobi day; the create tests prove the zone)', async () => {
    expect(await earliestStartFor('c1', 'LATENESS', d('2026-10-07'), null, NOW)).toBe('2026-10-07');
  });

  it('a later stored version pushes it forward (one timeline)', async () => {
    expect(await earliestStartFor('c1', 'LATENESS', d('2026-10-07'), new Date('2026-11-02T00:00:00Z'), NOW)).toBe('2026-11-02');
  });

  it('only Statutory may go back, and only to the first day of the open month', async () => {
    expect(await earliestStartFor('c1', 'STATUTORY', d('2026-10-07'), null, NOW)).toBe('2026-10-01');
  });
});

describe('a start day is allowed or refused with the dialog’s own words', () => {
  const base = { today: d('2026-10-07'), floor: d('2026-10-07'), latestLive: null };

  it('today and later are allowed', () => {
    expect(() => assertStartAllowed({ ...base, group: 'LATENESS', effectiveFrom: d('2026-10-07') })).not.toThrow();
    expect(() => assertStartAllowed({ ...base, group: 'LATENESS', effectiveFrom: d('2026-12-01') })).not.toThrow();
  });

  it('a past day is RULE_BACKDATED', () => {
    expect(() => assertStartAllowed({ ...base, group: 'LATENESS', effectiveFrom: d('2026-10-06') })).toThrow(expect.objectContaining({ code: 'RULE_BACKDATED', statusCode: 400 }));
  });

  it('Statutory inside an approved month is RULE_MONTH_APPROVED; inside the open month it is allowed', () => {
    const statutory = { ...base, group: 'STATUTORY' as const, floor: d('2026-10-01') };
    expect(() => assertStartAllowed({ ...statutory, effectiveFrom: d('2026-09-30') })).toThrow(expect.objectContaining({ code: 'RULE_MONTH_APPROVED' }));
    expect(() => assertStartAllowed({ ...statutory, effectiveFrom: d('2026-10-01') })).not.toThrow();
  });

  it('too far ahead is refused', () => {
    expect(() => assertStartAllowed({ ...base, group: 'LATENESS', effectiveFrom: d('2062-01-01') })).toThrow(expect.objectContaining({ code: 'RULE_DATE_TOO_FAR' }));
    expect(MAX_DAYS_AHEAD).toBe(730);
  });

  it('a day before a version already stored names that version and says whether it can be withdrawn', () => {
    const attempt = () => assertStartAllowed({ ...base, group: 'LATENESS', effectiveFrom: d('2026-11-01'), latestLive: live(3, '2026-11-02') });
    expect(attempt).toThrow(expect.objectContaining({ code: 'RULE_FUTURE_VERSION_EXISTS', statusCode: 409, details: { version: 3, effectiveFrom: '2026-11-02', withdrawable: true } }));
    expect(attempt).toThrow(/Version 3 already starts on 2026-11-02/);
  });

  it('the same day as a stored version is allowed (it becomes the higher number)', () => {
    expect(() => assertStartAllowed({ ...base, group: 'LATENESS', effectiveFrom: d('2026-11-02'), latestLive: live(3, '2026-11-02') })).not.toThrow();
  });

  it('a version that has started cannot be withdrawn to free its day', () => {
    expect(() => assertStartAllowed({ ...base, group: 'STATUTORY', floor: d('2026-10-01'), effectiveFrom: d('2026-10-03'), latestLive: live(2, '2026-10-05') })).toThrow(
      expect.objectContaining({ details: expect.objectContaining({ withdrawable: false }) }),
    );
  });
});

describe('a new week start must itself start on that day', () => {
  it('2 Nov 2026 is a Monday', () => {
    expect(() => assertWeekStartDay(d('2026-11-02'), 1)).not.toThrow();
    expect(() => assertWeekStartDay(d('2026-11-01'), 7)).not.toThrow(); // a Sunday
  });

  it('any other day says which to pick', () => {
    expect(() => assertWeekStartDay(d('2026-11-02'), 7)).toThrow(expect.objectContaining({ code: 'RULE_DATE_NOT_WEEK_START', message: 'Pick a Sunday' }));
  });
});
