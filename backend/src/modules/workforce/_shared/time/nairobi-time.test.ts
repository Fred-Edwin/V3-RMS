import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  eachDay,
  instantAt,
  isoWeekday,
  minutesOfDay,
  monthKey,
  nairobiClockOf,
  nairobiDateOf,
  nairobiToday,
  parseClockTime,
  parseNairobiDate,
  weekStart,
} from './nairobi-time';

const d = parseNairobiDate;
const t = parseClockTime;

describe('Nairobi date and clock', () => {
  it('rolls the date at 21:00Z', () => {
    expect(nairobiDateOf(new Date('2026-10-05T20:59:59Z'))).toBe('2026-10-05');
    expect(nairobiDateOf(new Date('2026-10-05T21:00:00Z'))).toBe('2026-10-06');
    expect(nairobiClockOf(new Date('2026-10-05T21:00:00Z'))).toBe('00:00');
    expect(nairobiToday(new Date('2026-10-05T21:00:00Z'))).toBe('2026-10-06');
  });

  it('a 06:00 Nairobi shift is 03:00Z', () => {
    expect(instantAt(d('2026-10-06'), t('06:00')).toISOString()).toBe('2026-10-06T03:00:00.000Z');
    expect(instantAt(d('2026-10-06'), t('00:30')).toISOString()).toBe('2026-10-05T21:30:00.000Z');
  });

  it('round-trips instantAt through nairobiClockOf and nairobiDateOf', () => {
    const instant = instantAt(d('2026-10-06'), t('22:45'));
    expect(nairobiClockOf(instant)).toBe('22:45');
    expect(nairobiDateOf(instant)).toBe('2026-10-06');
  });

  it('is not moved by the Los Angeles daylight-saving changes', () => {
    expect(nairobiClockOf(new Date('2026-03-08T10:00:00Z'))).toBe('13:00');
    expect(nairobiClockOf(new Date('2026-11-01T10:00:00Z'))).toBe('13:00');
    expect(instantAt(d('2026-03-08'), t('06:00')).toISOString()).toBe('2026-03-08T03:00:00.000Z');
    expect(instantAt(d('2026-11-01'), t('06:00')).toISOString()).toBe('2026-11-01T03:00:00.000Z');
  });

  it('handles year end and the leap day', () => {
    expect(nairobiDateOf(new Date('2026-12-31T21:00:00Z'))).toBe('2027-01-01');
    expect(nairobiDateOf(new Date('2028-02-28T21:00:00Z'))).toBe('2028-02-29');
    expect(parseNairobiDate('2028-02-29')).toBe('2028-02-29');
  });

  it('rejects things that are not real dates or times', () => {
    expect(() => parseNairobiDate('2026-02-30')).toThrow();
    expect(() => parseNairobiDate('2026-1-5')).toThrow();
    expect(() => parseNairobiDate('2027-02-29')).toThrow();
    expect(() => parseClockTime('24:00')).toThrow();
    expect(() => parseClockTime('6:00')).toThrow();
    expect(() => parseClockTime('06:60')).toThrow();
  });

  it('minutesOfDay', () => {
    expect(minutesOfDay(t('06:05'))).toBe(365);
    expect(minutesOfDay(t('23:59'))).toBe(1439);
  });
});

describe('day arithmetic', () => {
  it('addDays crosses months and years, forwards and backwards', () => {
    expect(addDays(d('2026-01-31'), 1)).toBe('2026-02-01');
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(d('2026-03-01'), -1)).toBe('2026-02-28');
  });

  it('daysBetween is signed', () => {
    expect(daysBetween(d('2026-10-01'), d('2026-10-06'))).toBe(5);
    expect(daysBetween(d('2026-10-06'), d('2026-10-01'))).toBe(-5);
  });

  it('eachDay is inclusive and empty when to is before from', () => {
    expect(eachDay(d('2026-10-05'), d('2026-10-07'))).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect(eachDay(d('2026-10-07'), d('2026-10-05'))).toEqual([]);
  });

  it('monthKey', () => {
    expect(monthKey(d('2026-10-06'))).toBe('2026-10');
  });
});

describe('weeks', () => {
  it('isoWeekday of known dates', () => {
    expect(isoWeekday(d('2026-10-05'))).toBe(1); // Monday
    expect(isoWeekday(d('2026-10-07'))).toBe(3);
    expect(isoWeekday(d('2026-10-11'))).toBe(7); // Sunday
  });

  it('a Sunday belongs to the week that began the previous Monday', () => {
    expect(weekStart(d('2026-10-11'), 1)).toBe('2026-10-05');
  });

  it('a Monday is its own week start', () => {
    expect(weekStart(d('2026-10-05'), 1)).toBe('2026-10-05');
  });

  it('a Sunday week start also works', () => {
    expect(weekStart(d('2026-10-11'), 7)).toBe('2026-10-11');
    expect(weekStart(d('2026-10-10'), 7)).toBe('2026-10-04');
  });

  it('weeks cross month and year boundaries', () => {
    expect(weekStart(d('2027-01-01'), 1)).toBe('2026-12-28');
    expect(weekStart(d('2026-11-01'), 1)).toBe('2026-10-26');
  });
});
