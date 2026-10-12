import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { branchReverseCheck, branchUnitCost } from './branch-rules';

// 2026-10-13 is a Tuesday. Nairobi is UTC+3, so 21:30 UTC on the 12th is 00:30 on the 13th there.
const NOW = new Date('2026-10-13T11:20:00Z');
const entry = (over: Partial<{ loggedById: string; createdAt: Date; reversedAt: Date | null }> = {}) => ({
  loggedById: 'u-grace',
  createdAt: new Date('2026-10-13T06:05:00Z'),
  reversedAt: null,
  ...over,
});

describe('branchReverseCheck: the one rule behind can.reverse and BW7', () => {
  it('ANY reverses any entry of the reach, however old and whoever logged it', () => {
    expect(branchReverseCheck('ANY', 'u-bm', entry(), NOW)).toBe('OK');
    expect(branchReverseCheck('ANY', 'u-bm', entry({ createdAt: new Date('2026-09-01T06:00:00Z') }), NOW)).toBe('OK');
  });

  it('OWN reverses an entry the caller logged earlier the same Nairobi day', () => {
    expect(branchReverseCheck('OWN', 'u-grace', entry(), NOW)).toBe('OK');
  });

  it('OWN is refused on someone else’s entry, even the same day', () => {
    expect(branchReverseCheck('OWN', 'u-joseph', entry(), NOW)).toBe('NOT_YOUR_ENTRY');
  });

  it('OWN is refused once the Nairobi day has changed, even a minute later', () => {
    expect(branchReverseCheck('OWN', 'u-grace', entry({ createdAt: new Date('2026-10-12T20:59:00Z') }), NOW)).toBe('REVERSAL_WINDOW_PASSED');
    expect(branchReverseCheck('OWN', 'u-grace', entry({ createdAt: new Date('2026-10-12T21:00:00Z') }), NOW)).toBe('OK');
  });

  it('the window is the Nairobi day, not the UTC day: logged 23:50 Nairobi on the 12th, now 00:10 on the 13th', () => {
    const loggedLate = entry({ createdAt: new Date('2026-10-12T20:50:00Z') });
    expect(branchReverseCheck('OWN', 'u-grace', loggedLate, new Date('2026-10-12T21:10:00Z'))).toBe('REVERSAL_WINDOW_PASSED');
    expect(branchReverseCheck('OWN', 'u-grace', loggedLate, new Date('2026-10-12T20:55:00Z'))).toBe('OK');
  });

  it('a caller who may not reverse (NONE) is refused as if the entry were not theirs, even on their own entry', () => {
    expect(branchReverseCheck('NONE', 'u-grace', entry(), NOW)).toBe('NOT_YOUR_ENTRY');
  });

  it.each(['ANY', 'OWN', 'NONE'] as const)('%s: an entry already reversed can never be reversed again (it wins over every other refusal)', (mode) => {
    const reversed = entry({ reversedAt: new Date('2026-10-13T07:00:00Z'), createdAt: new Date('2026-09-01T06:00:00Z'), loggedById: 'someone-else' });
    expect(branchReverseCheck(mode, 'u-grace', reversed, NOW)).toBe('ALREADY_REVERSED');
  });
});

describe('branchUnitCost', () => {
  it('uses the cost carried into the department when something was dispatched in', () => {
    expect(branchUnitCost(new Prisma.Decimal(420), new Prisma.Decimal(380)).toString()).toBe('380');
  });

  it('falls back to the item’s current cost when nothing was ever dispatched in', () => {
    expect(branchUnitCost(new Prisma.Decimal(420), null).toString()).toBe('420');
  });
});
