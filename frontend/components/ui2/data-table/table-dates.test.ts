import { describe, expect, it } from 'vitest';

import { ANY_TIME, effectiveRange, nairobiToday, presetRange, rangeToFilters } from './table-dates';

const keys = { fromKey: 'from', toKey: 'to' };
const today = '2026-10-08';

describe('nairobiToday', () => {
  it('reads the Nairobi day, not the UTC day', () => {
    expect(nairobiToday(new Date('2026-10-07T22:30:00Z'))).toBe('2026-10-08');
    expect(nairobiToday(new Date('2026-10-08T20:59:00Z'))).toBe('2026-10-08');
  });
});

describe('presetRange', () => {
  it('counts the last 7 and 30 days including today', () => {
    expect(presetRange('today', today)).toEqual({ from: today, to: today });
    expect(presetRange('last7', today)).toEqual({ from: '2026-10-02', to: today });
    expect(presetRange('last30', today)).toEqual({ from: '2026-09-09', to: today });
    expect(presetRange('any', today)).toBeNull();
  });
});

describe('effectiveRange', () => {
  it('uses the starting range when the URL has no dates', () => {
    expect(effectiveRange({}, keys, 'last30', today)).toEqual({ from: '2026-09-09', to: today });
  });
  it('uses the dates in the URL', () => {
    expect(effectiveRange({ from: '2026-10-01', to: '2026-10-05' }, keys, 'today', today)).toEqual({ from: '2026-10-01', to: '2026-10-05' });
  });
  it('reads from=any as no dates at all', () => {
    expect(effectiveRange({ from: ANY_TIME }, keys, 'today', today)).toBeNull();
  });
  it('ignores a half-written, malformed or backwards pair', () => {
    expect(effectiveRange({ from: '2026-10-01' }, keys, 'today', today)).toEqual({ from: today, to: today });
    expect(effectiveRange({ from: 'soon', to: 'later' }, keys, 'today', today)).toEqual({ from: today, to: today });
    expect(effectiveRange({ from: '2026-10-05', to: '2026-10-01' }, keys, 'today', today)).toEqual({ from: today, to: today });
  });
});

describe('rangeToFilters', () => {
  it('writes nothing for the starting range', () => {
    expect(rangeToFilters({ from: today, to: today }, keys, 'today', today)).toEqual({ from: '', to: '' });
    expect(rangeToFilters(null, keys, 'any', today)).toEqual({ from: '', to: '' });
  });
  it('writes the two days for any other range', () => {
    expect(rangeToFilters({ from: '2026-10-01', to: '2026-10-05' }, keys, 'today', today)).toEqual({ from: '2026-10-01', to: '2026-10-05' });
  });
  it('writes from=any for "any time" when that is not the start', () => {
    expect(rangeToFilters(null, keys, 'last30', today)).toEqual({ from: ANY_TIME, to: '' });
  });
});
