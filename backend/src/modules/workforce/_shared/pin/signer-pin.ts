import { AppError, ForbiddenError } from '../../../../utils/errors';
import { comparePin } from '../../../../utils/password';
import { announceWrongThreshold, attemptWithPause, resetPinTries as resetTries, type PinPurpose } from './pin-door';
import { pauseSeconds } from './pin-pause';
import { signerPinRepository } from './signer-pin-repository';

/**
 * The signer's own PIN, checked in the request that signs (the same PIN the shell's sign dialog collects). The PIN is never
 * stored or logged; the audit entry records the method and the time only.
 *
 * - wrong PIN: 403 PIN_INVALID (not 401, which the apps treat as "logged out"). From the 5th wrong try in 15 minutes the answer
 *   carries `waitSeconds`.
 * - a pause is running: 429 PIN_SLOWED, "Wait {n} seconds, then try again." Nobody is ever locked out (owner, 20 Oct 2026, SD16):
 *   the schedule is 2, 4, 8, 16, then 30 seconds, from the shared door (`pin-door.ts`), and the count is stored.
 * - no PIN set: 403 PIN_NOT_SET, so the screen can send the person to set one. It reveals nothing about anyone else.
 * There is no PIN expiry on the platform, so none is checked here.
 */
export interface PinSignature {
  method: 'PIN';
  signedAt: Date;
}

export async function verifySignerPin(userId: string, pin: string, now: number = Date.now(), purpose: PinPurpose = 'SIGNER'): Promise<PinSignature> {
  const hash = await signerPinRepository.hashOf(userId);
  if (hash === null) throw new ForbiddenError('Set your signing PIN first', 'PIN_NOT_SET');
  const at = new Date(now);
  const outcome = await attemptWithPause(userId, purpose, () => comparePin(pin, hash), at);
  if (outcome.kind === 'SLOW') throw new AppError(429, 'PIN_SLOWED', `Wait ${outcome.wait} seconds, then try again.`, { waitSeconds: outcome.wait });
  if (outcome.kind === 'WRONG') {
    if (outcome.alert) await announceWrongThreshold({ userId, purpose, count: outcome.count, at });
    const wait = pauseSeconds(outcome.count);
    throw new ForbiddenError('That PIN is not right. Try again.', 'PIN_INVALID', wait > 0 ? { waitSeconds: wait } : undefined);
  }
  return { method: 'PIN', signedAt: at };
}

/** For tests: forget every wrong try. */
export const resetPinTries = (): void => resetTries();
