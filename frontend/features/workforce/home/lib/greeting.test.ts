import { describe, expect, it } from 'vitest';

import { dayPartOf, greetingFor, homeClock, homeDate } from './greeting';

// 2026-10-04 is a Sunday. Nairobi is UTC+3 all year.
const at = (utc: string): Date => new Date(`2026-10-04T${utc}:00Z`);

describe('Home greeting (Nairobi time)', () => {
  it('says morning before noon, afternoon until five, evening after', () => {
    expect(dayPartOf(at('06:59'))).toBe('morning'); // 09:59 in Nairobi
    expect(dayPartOf(at('09:00'))).toBe('afternoon'); // 12:00
    expect(dayPartOf(at('13:59'))).toBe('afternoon'); // 16:59
    expect(dayPartOf(at('14:00'))).toBe('evening'); // 17:00
  });

  it('uses Nairobi, not the device zone, across midnight', () => {
    // 21:30 UTC on Saturday is 00:30 Sunday in Nairobi: morning, and Sunday.
    const late = new Date('2026-10-03T21:30:00Z');
    expect(dayPartOf(late)).toBe('morning');
    expect(homeDate(late)).toBe('Sunday 4 October');
    expect(homeClock(late)).toBe('00:30');
  });

  it('greets by first name only', () => {
    expect(greetingFor(at('07:42'), 'Mercy Achieng')).toBe('Good morning, Mercy');
    expect(greetingFor(at('07:42'), '  ')).toBe('Good morning');
  });

  it('writes the date and clock as Paper does', () => {
    expect(homeDate(at('07:42'))).toBe('Sunday 4 October');
    expect(homeClock(at('07:42'))).toBe('10:42');
  });
});
