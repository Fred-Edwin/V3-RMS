import { describe, expect, it } from 'vitest';

import { dayPay, draftTotal, firstUnfinished, lineProblem, payWorking, shiftMinutes, timeRange } from './casual-pay';
import { clockOf, dayLong, kes } from './casual-words';

describe('casual day pay on the phone (same line as the server)', () => {
  it('pays exactly the day rate for 8 hours, less for less, and an eighth of the rate per hour over 8', () => {
    expect(dayPay('900.00', 480)).toBe(900);
    expect(dayPay('900.00', 240)).toBe(450);
    expect(dayPay('900.00', 540)).toBe(1013); // 1,012.50 rounds half up
  });
  it('rounds half up to the whole shilling', () => {
    expect(dayPay('900.00', 1)).toBe(2); // 1.875
    expect(dayPay('1000.00', 1)).toBe(2); // 2.083
    expect(dayPay('100.00', 24)).toBe(5); // 5.00
    expect(dayPay('150.00', 8)).toBe(3); // 2.5 rounds up
  });
  it('shows the working', () => {
    expect(payWorking('900.00', 480)).toBe('8 h × KES 900 ÷ 8 = 900');
    expect(payWorking('900.00', 90)).toBe('1.5 h × KES 900 ÷ 8 = 169');
  });
  it('works out hours across midnight and words the range', () => {
    expect(shiftMinutes('22:00', '02:00', true)).toBe(240);
    expect(timeRange('07:00', '15:00', false)).toBe('07:00 to 15:00 · 8 h');
    expect(timeRange('22:00', '02:30', true)).toBe('22:00 to 02:30 +1 · 4 h 30');
  });
  it('checks the line with the server words', () => {
    expect(lineProblem('15:00', '07:00', false)).toBe('END_BEFORE_START');
    expect(lineProblem('05:00', '23:00', false)).toBe('DAY_TOO_LONG');
    expect(lineProblem('07:00', '15:00', false)).toBeNull();
  });
  it('totals the lines held on the phone', () => {
    const line = (start: string, end: string) => ({ casualId: start, name: 'A B', idMasked: '3••21', start, end, endsNextDay: false });
    expect(draftTotal('900.00', [line('07:00', '15:00'), line('11:00', '19:00')])).toBe(1800);
  });
  it('holds Send back until every shift has ended (Nairobi time)', () => {
    const line = { casualId: 'c', name: 'Rose Wanjiru', idMasked: '', start: '11:00', end: '19:00', endsNextDay: false };
    const at1840 = Date.parse('2026-10-19T18:40:00+03:00');
    expect(firstUnfinished('2026-10-19', [line], at1840)?.name).toBe('Rose Wanjiru');
    expect(firstUnfinished('2026-10-19', [line], Date.parse('2026-10-19T19:00:00+03:00'))).toBeNull();
  });
});

describe('casual words', () => {
  it('writes the day, money and clock', () => {
    expect(dayLong('2026-10-19')).toBe('Monday 19 October');
    expect(kes('1800.00')).toBe('1,800');
    expect(kes('1012.50')).toBe('1,012.50');
    expect(clockOf('2026-10-19T11:40:00.000Z')).toBe('14:40');
  });
});
