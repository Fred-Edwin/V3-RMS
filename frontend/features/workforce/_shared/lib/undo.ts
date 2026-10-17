import { UNDO_WINDOW_MS } from './interaction';

/**
 * The undo window (rule 03): after an answer a toast offers Undo for 30 seconds.
 * After that a mistake is corrected with a new, linked entry, never by editing
 * the old one. Pure time maths so it is tested without a clock.
 */
export function undoRemainingMs(startedAt: number, now: number, windowMs: number = UNDO_WINDOW_MS): number {
  return Math.max(0, startedAt + windowMs - now);
}

export function undoExpired(startedAt: number, now: number, windowMs: number = UNDO_WINDOW_MS): boolean {
  return undoRemainingMs(startedAt, now, windowMs) === 0;
}

/** Whole seconds left, rounded up, so "1 s" shows until the very end and never "0 s" while undo still works. */
export function undoSecondsLeft(startedAt: number, now: number, windowMs: number = UNDO_WINDOW_MS): number {
  return Math.ceil(undoRemainingMs(startedAt, now, windowMs) / 1000);
}
