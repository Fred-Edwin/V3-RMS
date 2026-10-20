import { NOT_SIGNED_CHIPS } from '../../_shared/lib/conduct-words';
import type { DeskDetail, NotSignedReason } from '../../_shared/types/conduct-types';

/**
 * Rules of "Record that the notice was not signed" (spec S11), pure. The reason chips depend on whether the person has a login: someone
 * with none can only be recorded as "no login" (the printed route), and someone with a login never can. The desk detail does not carry the
 * login flag itself; a notice with no sign limit (`recordableFrom` null) is the printed route, as the server computes it.
 */
export const hasNoLogin = (d: DeskDetail): boolean => d.actions.recordableFrom === null;

export function reasonChips(d: DeskDetail): ReadonlyArray<{ value: NotSignedReason; label: string }> {
  return hasNoLogin(d) ? [{ value: 'NO_LOGIN', label: 'They have no login' }] : NOT_SIGNED_CHIPS;
}

/** The chip chosen for you when there is only one. */
export const defaultReason = (d: DeskDetail): NotSignedReason | null => (hasNoLogin(d) ? 'NO_LOGIN' : null);

export interface RecordInputs {
  reason: NotSignedReason | null;
  witnessId: string | null;
  pin: string;
  online: boolean;
  hasPin: boolean | null;
}

/** Why "Record it" waits, in the spec's words, or null. */
export function recordBlock(i: RecordInputs): string | null {
  if (!i.reason) return 'Choose what happened.';
  if (!i.witnessId) return 'Choose a witness.';
  if (i.hasPin === false) return 'Set your PIN first.';
  if (i.pin.length < 4) return 'Enter your PIN.';
  if (!i.online) return 'No signal. The record was not made. Try again when you are back online.';
  return null;
}

/** The small print: roles, not names (names appear on the signed record only). */
export const recordPrint = (d: DeskDetail): string => `${d.jobLabel}, the witness and HR are told. Recorded in the audit log with your name and the time.`;

export const keyRows = (d: DeskDetail): { label: string; value: string }[] => [
  { label: 'The notice', value: 'Stays in force, marked "given, not signed"' },
  { label: `${d.appealLine === 'No appeal on this notice' ? 'Appeal' : 'The days to appeal'}`, value: d.appealLine === 'No appeal on this notice' ? 'No appeal on this notice' : 'Carry on as before' },
];
