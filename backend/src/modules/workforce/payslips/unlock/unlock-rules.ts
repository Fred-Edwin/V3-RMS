/**
 * The payslip code rules (PD1 to PD4), pure and clock-free: every function takes the time it needs.
 *
 * Nobody is ever locked out. After the 5th wrong try in 15 minutes the server answers each next try only after a growing pause
 * (2, 4, 8, 16, then 30 seconds): a pause, never a lock. After the 3rd wrong try in the window the System Admin and the person are
 * told, once per window. A correct code ends the count.
 */
export const WINDOW_MS = 15 * 60_000;
export const ALERT_AT = 3;
export const SLOW_AFTER = 5;
export const MAX_PAUSE_SECONDS = 30;
/** PD2: a screen lock, not a sign-out. 10 minutes without a tap relocks; the hard cap bounds a token that is somehow kept alive. */
export const IDLE_MS = 10 * 60_000;
export const HARD_CAP_MS = 8 * 3_600_000;

/** The pause that follows the n-th wrong try of the window: none before the 5th, then 2, 4, 8, 16 and 30 seconds. */
export function pauseSeconds(wrongInWindow: number): number {
  if (wrongInWindow < SLOW_AFTER) return 0;
  return Math.min(MAX_PAUSE_SECONDS, 2 ** (wrongInWindow - SLOW_AFTER + 1));
}

/** Seconds still to wait before a try is answered, given the wrong tries of the window and when the last one happened. */
export function waitRemaining(wrongInWindow: number, lastWrongAt: Date | null, now: Date): number {
  const pause = pauseSeconds(wrongInWindow);
  if (pause === 0 || lastWrongAt === null) return 0;
  const left = lastWrongAt.getTime() + pause * 1000 - now.getTime();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

/** The third wrong try of a window raises the notices, and only if this window has not raised them already. */
export const shouldAlert = (wrongInWindow: number, alreadyAlertedInWindow: boolean): boolean => wrongInWindow >= ALERT_AT && !alreadyAlertedInWindow;

export interface UnlockTimes {
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type UnlockState = 'OPEN' | 'IDLE' | 'EXPIRED' | 'REVOKED';

export function unlockState(unlock: UnlockTimes, now: Date): UnlockState {
  if (unlock.revokedAt !== null) return 'REVOKED';
  if (now.getTime() >= unlock.expiresAt.getTime()) return 'EXPIRED';
  if (now.getTime() - unlock.lastUsedAt.getTime() >= IDLE_MS) return 'IDLE';
  return 'OPEN';
}

/** "Android, Chrome" from a User-Agent: a label for the audit log, never an address or an identifier. */
export function deviceLabelOf(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const os = /Android/i.test(userAgent) ? 'Android' : /iPhone|iPad|iPod/i.test(userAgent) ? 'iPhone' : /Windows/i.test(userAgent) ? 'Windows' : /Mac OS X/i.test(userAgent) ? 'Mac' : /Linux/i.test(userAgent) ? 'Linux' : null;
  const browser = /Edg\//i.test(userAgent) ? 'Edge' : /Firefox\//i.test(userAgent) ? 'Firefox' : /Chrome\//i.test(userAgent) ? 'Chrome' : /Safari\//i.test(userAgent) ? 'Safari' : null;
  const parts = [os, browser].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(', ') : null;
}
