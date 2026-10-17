import { describe, expect, it } from 'vitest';

import { formatDuration, formatHms, formatHoursMinutes, formatHoursMinutesUnit, formatMmSs, maskClock, minutesBetween, parseClock } from './time';

describe('time formatters', () => {
  it('formats a running clock', () => {
    expect(formatHms(0)).toBe('00:00:00');
    expect(formatHms(27501)).toBe('07:38:21');
    expect(formatHms(-5)).toBe('00:00:00');
    expect(formatHms(Number.NaN)).toBe('00:00:00');
  });

  it('formats the undo countdown without padding the minutes', () => {
    expect(formatMmSs(112)).toBe('1:52');
    expect(formatMmSs(30)).toBe('0:30');
    expect(formatMmSs(5)).toBe('0:05');
  });

  it('formats hours and minutes the way the sheets show them', () => {
    expect(formatHoursMinutes(41 * 60 + 5)).toBe('41 h 05');
    expect(formatHoursMinutesUnit(8 * 60 + 2)).toBe('8 h 02 m');
    expect(formatHoursMinutes(0)).toBe('0 h 00');
  });

  it('formats a spoken duration', () => {
    expect(formatDuration(90)).toBe('1 h 30');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(125)).toBe('2 h 05');
  });

  it('masks a clock time while typing', () => {
    expect(maskClock('0')).toBe('0');
    expect(maskClock('043')).toBe('04:3');
    expect(maskClock('04:30pm')).toBe('04:30');
    expect(maskClock('123456')).toBe('12:34');
  });

  it('reads a finished clock time or says it is not one', () => {
    expect(parseClock('04:00')).toBe('04:00');
    expect(parseClock('430')).toBe('04:30');
    expect(parseClock('4')).toBe('04:00');
    expect(parseClock('14:5')).toBe('14:50');
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock('12:60')).toBeNull();
    expect(parseClock('abc')).toBeNull();
    expect(parseClock('')).toBeNull();
  });

  it('measures a shift, wrapping past midnight', () => {
    expect(minutesBetween('06:00', '14:00')).toBe(480);
    expect(minutesBetween('22:00', '06:00')).toBe(480);
  });
});
