import { describe, expect, it } from 'vitest';
import { HARD_CAP_MS, IDLE_MS, deviceLabelOf, pauseSeconds, shouldAlert, unlockState, waitRemaining } from './unlock-rules';

describe('the pause after wrong tries (PD3): a pause, never a lock', () => {
  it('there is no pause for the first four wrong tries', () => {
    for (const n of [0, 1, 2, 3, 4]) expect(pauseSeconds(n)).toBe(0);
  });
  it('from the fifth the pause grows 2, 4, 8, 16 and stops at 30 seconds', () => {
    expect([5, 6, 7, 8, 9, 10, 40].map(pauseSeconds)).toEqual([2, 4, 8, 16, 30, 30, 30]);
  });
  it('the wait counts down from the last wrong try and then ends', () => {
    const last = new Date('2026-10-19T10:00:00.000Z');
    expect(waitRemaining(6, last, new Date('2026-10-19T10:00:01.000Z'))).toBe(3); // 4 s pause, 1 s gone
    expect(waitRemaining(6, last, new Date('2026-10-19T10:00:04.000Z'))).toBe(0);
    expect(waitRemaining(4, last, last)).toBe(0); // under five wrong tries nobody waits
    expect(waitRemaining(9, null, last)).toBe(0);
  });
  it('a try 30 seconds after the 9th wrong one is never refused for ever', () => {
    const last = new Date('2026-10-19T10:00:00.000Z');
    expect(waitRemaining(50, last, new Date(last.getTime() + 30_001))).toBe(0);
  });
});

describe('the alert after the 3rd wrong try (PD3)', () => {
  it('fires at three, once per window', () => {
    expect(shouldAlert(2, false)).toBe(false);
    expect(shouldAlert(3, false)).toBe(true);
    expect(shouldAlert(4, false)).toBe(true);
    expect(shouldAlert(3, true)).toBe(false);
    expect(shouldAlert(7, true)).toBe(false);
  });
});

describe('the unlock token (PD2)', () => {
  const t0 = new Date('2026-10-19T10:00:00.000Z');
  const token = { lastUsedAt: t0, expiresAt: new Date(t0.getTime() + HARD_CAP_MS), revokedAt: null };
  it('is open until 10 minutes pass without a tap', () => {
    expect(unlockState(token, new Date(t0.getTime() + IDLE_MS - 1))).toBe('OPEN');
    expect(unlockState(token, new Date(t0.getTime() + IDLE_MS))).toBe('IDLE');
  });
  it('a tap keeps it open (lastUsedAt moves)', () => {
    const tapped = { ...token, lastUsedAt: new Date(t0.getTime() + 9 * 60_000) };
    expect(unlockState(tapped, new Date(t0.getTime() + 18 * 60_000))).toBe('OPEN');
  });
  it('ends at the hard cap even with taps, and a leave (revoke) ends it at once', () => {
    const tapped = { ...token, lastUsedAt: new Date(t0.getTime() + HARD_CAP_MS - 1000) };
    expect(unlockState(tapped, new Date(t0.getTime() + HARD_CAP_MS))).toBe('EXPIRED');
    expect(unlockState({ ...token, revokedAt: t0 }, t0)).toBe('REVOKED');
  });
});

describe('device label', () => {
  it('names the system and browser only', () => {
    expect(deviceLabelOf('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36')).toBe('Android, Chrome');
    expect(deviceLabelOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1')).toBe('iPhone, Safari');
    expect(deviceLabelOf(undefined)).toBeNull();
    expect(deviceLabelOf('curl/8.0')).toBeNull();
  });
});
