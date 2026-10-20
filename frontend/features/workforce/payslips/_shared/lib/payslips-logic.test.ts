import { describe, expect, it } from 'vitest';

import { bankLine, dayShort, money, monthLong, payLine, rowLine, yearBar, yearRange } from './pay-words';
import { clearSession, currentToken, isUnlocked, openSession, touchSession } from './unlock-session';

describe('pay words', () => {
  it('writes money with separators, whole shillings without cents, and a minus sign for a negative line', () => {
    expect(money('34860.00')).toBe('34,860');
    expect(money('7329.50')).toBe('7,329.50');
    expect(money('0.00')).toBe('0');
    expect(money('-205.00')).toBe('−205');
  });

  it('names months and pay days from the Nairobi calendar day, never the viewer time zone', () => {
    expect(monthLong('2026-09')).toBe('September 2026');
    expect(dayShort('2026-10-23')).toBe('Fri 23 Oct');
  });

  it('says pay day until the month is Paid, then Paid with the date (PD31)', () => {
    expect(payLine({ status: 'PUBLISHED', payDay: '2026-10-23', paidOn: null })).toEqual({ text: 'Pay day Fri 23 Oct', paid: false });
    expect(payLine({ status: 'PAID', payDay: '2026-09-25', paidOn: '2026-09-25' })).toEqual({ text: 'Paid Fri 25 Sep', paid: true });
    expect(payLine({ status: 'PUBLISHED', payDay: null, paidOn: null }).text).toBe('Pay day to be announced');
  });

  it('puts "Version 2 · corrected 20 Oct" in place of the pay line for a corrected payslip', () => {
    const row = { id: 'a', month: '2026-09', versionNumber: 2, correctedAt: '2026-10-20T07:15:00.000Z', payDay: '2026-10-23', paidOn: null, status: 'PUBLISHED' as const };
    expect(rowLine(row).text).toBe('Version 2 · corrected 20 Oct');
  });

  it('sizes the year bar as taken-off out of earned and never leaves the bar empty', () => {
    expect(yearBar('406420.00', '92770.00')).toEqual({ net: 77, off: 23 });
    expect(yearBar('0.00', '0.00')).toEqual({ net: 100, off: 0 });
    expect(yearBar('100.00', '300.00').off).toBe(100);
    expect(yearRange('2026-01', '2026-09')).toBe('JAN TO SEP');
    expect(yearRange('2026-07', '2026-07')).toBe('JUL');
  });

  it('shows the bank and last four digits, or says the bank details are to come', () => {
    expect(bankLine({ name: 'Equity', last4: '4412' })).toBe('KES net · to Equity •••• 4412');
    expect(bankLine(null)).toBe('KES net · bank details to come');
  });
});

describe('the unlock held in memory', () => {
  const T0 = 1_000_000;
  it('is open only for the person who unlocked, until the idle time or the cap passes', () => {
    openSession('u1', 'tok', new Date(T0 + 8 * 3600_000).toISOString(), 600, T0);
    expect(currentToken('u1', T0 + 1000)).toBe('tok');
    expect(currentToken('u2', T0 + 1000)).toBeNull();
    expect(isUnlocked('u1', T0 + 599_000)).toBe(true);
    expect(isUnlocked('u1', T0 + 601_000)).toBe(false);
  });

  it('a read keeps it open (it counts as a tap) and the hard cap still ends it', () => {
    openSession('u1', 'tok', new Date(T0 + 700_000).toISOString(), 600, T0);
    touchSession(T0 + 500_000);
    expect(isUnlocked('u1', T0 + 1_000_000)).toBe(false); // past the cap
    openSession('u1', 'tok', new Date(T0 + 8 * 3600_000).toISOString(), 600, T0);
    touchSession(T0 + 500_000);
    expect(isUnlocked('u1', T0 + 1_000_000)).toBe(true);
  });

  it('clears at once on Lock', () => {
    openSession('u1', 'tok', new Date(T0 + 3600_000).toISOString(), 600, Date.now());
    clearSession();
    expect(currentToken('u1')).toBeNull();
  });
});
