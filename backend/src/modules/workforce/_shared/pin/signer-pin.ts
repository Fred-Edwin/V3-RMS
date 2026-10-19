import { AppError, ForbiddenError } from '../../../../utils/errors';
import { comparePin } from '../../../../utils/password';
import { signerPinRepository } from './signer-pin-repository';

/**
 * The signer's own PIN, checked in the request that signs (the same PIN the shell's sign dialog collects). The PIN is never
 * stored or logged; the audit entry records the method and the time only.
 *
 * - wrong PIN: 403 PIN_INVALID (not 401, which the apps treat as "logged out").
 * - no PIN set: 403 PIN_NOT_SET, so the screen can send the person to set one. It reveals nothing about anyone else.
 * - too many wrong tries: 429 PIN_LOCKED for ten minutes. The count is kept in this process (a restart clears it); the
 *   platform has no shared PIN lock yet, and bcrypt already makes each guess slow.
 * There is no PIN expiry on the platform, so none is checked here.
 */
export const MAX_WRONG_PINS = 5;
export const LOCK_WINDOW_MS = 10 * 60 * 1000;

const wrongTries = new Map<string, number[]>();

const recent = (userId: string, now: number): number[] => (wrongTries.get(userId) ?? []).filter((at) => now - at < LOCK_WINDOW_MS);

export interface PinSignature {
  method: 'PIN';
  signedAt: Date;
}

export async function verifySignerPin(userId: string, pin: string, now: number = Date.now()): Promise<PinSignature> {
  const tries = recent(userId, now);
  if (tries.length >= MAX_WRONG_PINS) throw new AppError(429, 'PIN_LOCKED', 'Too many wrong PINs. Try again in 10 minutes.');
  const hash = await signerPinRepository.hashOf(userId);
  if (hash === null) throw new ForbiddenError('Set your signing PIN first', 'PIN_NOT_SET');
  if (!(await comparePin(pin, hash))) {
    wrongTries.set(userId, [...tries, now]);
    throw new ForbiddenError('That PIN is not right. Try again.', 'PIN_INVALID');
  }
  wrongTries.delete(userId);
  return { method: 'PIN', signedAt: new Date(now) };
}

/** For tests: forget every wrong try. */
export const resetPinTries = (): void => wrongTries.clear();
