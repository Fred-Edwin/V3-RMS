/**
 * The pause schedule shared by every PIN or code check (the payslip code, the signer PIN, later Conduct signing). Pure and
 * clock-free. Nobody is ever locked out: after the 5th wrong try inside 15 minutes an answer waits 2, 4, 8, 16, then 30 seconds.
 * A pause, never a lock. The 3rd wrong try inside the window is the one that tells people. A correct try ends the count.
 */
export const WINDOW_MS = 15 * 60_000;
export const ALERT_AT = 3;
export const SLOW_AFTER = 5;
export const MAX_PAUSE_SECONDS = 30;

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
