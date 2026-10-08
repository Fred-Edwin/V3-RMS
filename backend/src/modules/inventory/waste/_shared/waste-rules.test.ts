import { describe, expect, it } from 'vitest';
import { reverseCheck, seesOwnEntriesOnly } from './waste-rules';

const NOW = new Date('2026-10-13T11:20:00Z'); // 14:20 Nairobi, 13 Oct
const mine = { loggedById: 'u-peter', createdAt: new Date('2026-10-13T06:05:00Z'), reversedAt: null };

const attendant = { id: 'u-peter', role: 'STORE_ATTENDANT' as const };
const manager = { id: 'u-sam', role: 'STORE_MANAGER' as const };

describe('reverseCheck', () => {
  it('lets the Attendant reverse their own entry of the same Nairobi day', () => {
    expect(reverseCheck(attendant, mine, NOW)).toBe('OK');
  });

  it('counts the Nairobi day, not the UTC day: 23:30 Nairobi last night is yesterday, 00:30 today is today', () => {
    expect(reverseCheck(attendant, { ...mine, createdAt: new Date('2026-10-12T20:30:00Z') }, NOW)).toBe('REVERSAL_WINDOW_PASSED');
    expect(reverseCheck(attendant, { ...mine, createdAt: new Date('2026-10-12T21:30:00Z') }, NOW)).toBe('OK');
  });

  it('refuses the Attendant someone else’s entry', () => {
    expect(reverseCheck(attendant, { ...mine, loggedById: 'u-other' }, NOW)).toBe('NOT_YOUR_ENTRY');
  });

  it('refuses the Attendant an entry from an earlier day', () => {
    expect(reverseCheck(attendant, { ...mine, createdAt: new Date('2026-10-11T08:00:00Z') }, NOW)).toBe('REVERSAL_WINDOW_PASSED');
  });

  it('lets the Manager reverse any entry, however old', () => {
    expect(reverseCheck(manager, { ...mine, createdAt: new Date('2026-08-01T08:00:00Z') }, NOW)).toBe('OK');
  });

  it('refuses a role that holds neither reverse capability, even for its own entry', () => {
    expect(reverseCheck({ id: 'u-peter', role: 'ACCOUNTANT' as const }, mine, NOW)).toBe('NOT_YOUR_ENTRY');
  });

  it('says ALREADY_REVERSED first, to everyone', () => {
    const reversed = { ...mine, reversedAt: new Date('2026-10-13T06:12:00Z') };
    expect(reverseCheck(manager, reversed, NOW)).toBe('ALREADY_REVERSED');
    expect(reverseCheck(attendant, reversed, NOW)).toBe('ALREADY_REVERSED');
  });
});

describe('seesOwnEntriesOnly', () => {
  it('is decided by the stock.read capability: the Attendant lacks it, the five desktop roles hold it', () => {
    expect(seesOwnEntriesOnly({ role: 'STORE_ATTENDANT' })).toBe(true);
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER'] as const) expect(seesOwnEntriesOnly({ role })).toBe(false);
  });
});
