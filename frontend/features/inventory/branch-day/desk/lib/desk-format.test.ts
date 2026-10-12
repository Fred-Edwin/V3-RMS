import { describe, expect, it } from 'vitest';

import { clock12, itemsText, kes, longDay, longDayYear, nairobiDay, qty, shortDay, shortDayClock, signedUnits, weekdayClock } from './desk-format';

describe('Branch day desktop formatting (Paper words)', () => {
  it('writes Nairobi clock times the way Paper does', () => {
    expect(clock12('2026-10-07T15:20:00.000Z')).toBe('6:20 pm');
    expect(clock12('2026-10-07T04:14:00.000Z')).toBe('7:14 am');
    expect(clock12('2026-10-07T16:48:00.000Z')).toBe('7:48 pm');
  });

  it('writes days as Paper does', () => {
    expect(longDay('2026-10-07')).toBe('Wednesday 7 October');
    expect(longDayYear('2026-10-07')).toBe('Wednesday 7 October 2026');
    expect(shortDay('2026-10-08')).toBe('Thu 8 Oct');
    expect(shortDayClock('2026-10-08T06:15:00.000Z')).toBe('Thu 8 Oct, 9:15 am');
    expect(weekdayClock('2026-10-08T06:14:00.000Z')).toBe('Thu 9:14 am');
  });

  it('finds the Nairobi day across midnight UTC', () => {
    expect(nairobiDay('2026-10-07T21:30:00.000Z')).toBe('2026-10-08');
    expect(nairobiDay('2026-10-07T20:59:00.000Z')).toBe('2026-10-07');
  });

  it('formats money and quantities', () => {
    expect(kes('50060.00')).toBe('50,060');
    expect(kes(null)).toBe('–');
    expect(kes(undefined)).toBe('–');
    expect(qty('3')).toBe('3');
    expect(qty('-1')).toBe('−1');
    expect(qty('2.5000')).toBe('2.5');
    expect(qty(null)).toBe('–');
  });

  it('signs ledger quantities with their unit', () => {
    expect(signedUnits('-3', 'bags')).toBe('−3 bags');
    expect(signedUnits('-1', 'tins')).toBe('−1 tin');
    expect(signedUnits('2', 'cans')).toBe('+2 cans');
  });

  it('counts items', () => {
    expect(itemsText(1)).toBe('1 item');
    expect(itemsText(8)).toBe('8 items');
  });
});
