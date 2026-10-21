import { describe, expect, it } from 'vitest';

import type { AlertRow, Phone } from '../types/security-types';
import { alertTitle, checkPasswords, clearedByLine, noteOk, phoneMeta, phoneRegionName, placeWords, PHONE_COPY, WASNT_ME_COPY, whenLabel } from './security-words';

const NOW = new Date('2026-10-20T11:30:00Z'); // 14:30 in Nairobi

const phone = (over: Partial<Phone> = {}): Phone => ({
  id: 'p1',
  label: 'Tecno, Android',
  placeLabel: 'Nairobi',
  firstSeenAt: '2026-10-20T11:03:00Z',
  lastSeenAt: '2026-10-20T11:03:00Z',
  confirmed: false,
  confirmedMode: null,
  isThisPhone: false,
  notUsedFor12Months: false,
  ...over,
});

const alert = (over: Partial<AlertRow>): AlertRow => ({
  id: 'a1',
  kind: 'WASNT_ME',
  status: 'OPEN',
  occurredAt: '2026-10-19T11:05:00Z',
  person: { id: 'u1', name: 'Mercy Achieng', role: 'HR Manager' },
  deviceLabel: 'Tecno, Android',
  placeLabel: 'Nairobi',
  detail: null,
  siteId: null,
  auditEntryId: null,
  clearedBy: null,
  clearedAt: null,
  clearNote: null,
  ...over,
});

describe('phone words', () => {
  it('labels a place as approximate and says so when it is not known', () => {
    expect(placeWords('Nairobi')).toBe('Nairobi (approximate)');
    expect(placeWords(null)).toBe('Place not known');
  });

  it('writes the second line of a phone card', () => {
    expect(phoneMeta(phone(), NOW)).toBe('Nairobi · first used today 14:03 · last seen today 14:03');
    expect(phoneMeta(phone({ isThisPhone: true, firstSeenAt: '2026-07-14T08:00:00Z' }), NOW)).toBe('Nairobi · first used 14 Jul · last seen now');
    expect(phoneMeta(phone({ notUsedFor12Months: true, firstSeenAt: '2025-01-02T08:00:00Z' }), NOW)).toContain('not used for 12 months');
  });

  it('names each card for a screen reader', () => {
    expect(phoneRegionName(phone())).toBe('Tecno, Android, not confirmed');
    expect(phoneRegionName(phone({ confirmed: true, isThisPhone: true }))).toBe('Tecno, Android, this phone, confirmed');
  });

  it('never explains how phones are recognised', () => {
    const everything = JSON.stringify([PHONE_COPY, WASNT_ME_COPY]).toLowerCase();
    for (const word of ['device id', 'local storage', 'cookie', 'fingerprint', 'browser storage', 'hash']) expect(everything).not.toContain(word);
  });

  it('formats dates on Nairobi’s calendar', () => {
    expect(whenLabel('2026-10-19T06:10:00Z', NOW)).toBe('Yesterday 09:10');
    expect(whenLabel('2026-10-12T06:10:00Z', NOW)).toBe('Mon 12 Oct, 09:10');
  });
});

describe('the reset page checks', () => {
  it('wants 8 characters and two that match', () => {
    expect(checkPasswords('short', '')).toEqual({ newPassword: 'Use at least 8 characters.', confirm: null });
    expect(checkPasswords('longenough', 'different')).toEqual({ newPassword: null, confirm: 'The two passwords are different.' });
    expect(checkPasswords('longenough', 'longenough')).toEqual({ newPassword: null, confirm: null });
  });
});

describe('alert wording', () => {
  it('writes the four sentences of the spec, with a role beside every name', () => {
    expect(alertTitle(alert({}))).toBe("Mercy Achieng, HR Manager pressed This wasn't me for a payslip opening at 14:05. Every session was signed out. The audit row is open beside this.");
    expect(alertTitle(alert({ kind: 'UNCONFIRMED_PHONE', detail: '2026-09' }))).toBe("Mercy Achieng, HR Manager's September payslip was opened on a phone that is not confirmed: Tecno, Android, Nairobi, 14:05. Nothing is locked. The audit row is open beside this.");
    expect(alertTitle(alert({ kind: 'WRONG_CODES' }))).toBe("3 wrong codes on Mercy Achieng, HR Manager's payslips. Tecno, Android, Nairobi, 14:05. Nothing is locked.");
    expect(alertTitle(alert({ kind: 'CHAIN_FAILED', detail: '4182', person: null }))).toBe('The audit chain check found a problem at entry 4182.');
  });

  it('holds no amount in any sentence', () => {
    const all = (['WASNT_ME', 'UNCONFIRMED_PHONE', 'WRONG_CODES', 'CHAIN_FAILED'] as const).map((kind) => alertTitle(alert({ kind, detail: '2026-09' }))).join(' ');
    expect(all).not.toMatch(/KES|\bKsh\b|\d,\d{3}/);
  });

  it('says who cleared an alert and when, and asks for a note of 3 characters', () => {
    expect(clearedByLine({ name: 'Wendo Admin', role: 'System Admin' }, '2026-10-20T11:00:00Z')).toBe('Cleared by Wendo Admin, System Admin at 14:00.');
    expect(noteOk('ok')).toBe(false);
    expect(noteOk('  yes ')).toBe(true);
  });
});
