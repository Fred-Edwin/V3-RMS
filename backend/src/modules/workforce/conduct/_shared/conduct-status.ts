import { ConflictError } from '../../../../utils/errors';
import type { ConductStatus } from './conduct-model';

/** Every move a notice can make. The decision events are chosen by the outcome, not by the caller. */
export type ConductMove = 'SIGN' | 'RECORD_NOT_SIGNED' | 'APPEAL' | 'KEEP' | 'REDUCE' | 'WITHDRAW' | 'END';

/** The status machine (spec section 3). One table; a move not listed for a status is refused. */
const TABLE: Record<ConductStatus, Partial<Record<ConductMove, ConductStatus>>> = {
  ISSUED: { SIGN: 'SIGNED', RECORD_NOT_SIGNED: 'GIVEN_NOT_SIGNED', APPEAL: 'APPEALED', WITHDRAW: 'WITHDRAWN', REDUCE: 'REPLACED', END: 'ENDED' },
  RECORDED: { APPEAL: 'APPEALED', WITHDRAW: 'WITHDRAWN', REDUCE: 'REPLACED', END: 'ENDED' },
  SIGNED: { APPEAL: 'APPEALED', WITHDRAW: 'WITHDRAWN', REDUCE: 'REPLACED', END: 'ENDED' },
  GIVEN_NOT_SIGNED: { SIGN: 'SIGNED', APPEAL: 'APPEALED', WITHDRAW: 'WITHDRAWN', REDUCE: 'REPLACED', END: 'ENDED' },
  APPEALED: { KEEP: 'KEPT', REDUCE: 'REPLACED', WITHDRAW: 'WITHDRAWN' }, // stands until decided; never ends by itself
  KEPT: { WITHDRAW: 'WITHDRAWN', REDUCE: 'REPLACED', END: 'ENDED' },
  ENDED: { WITHDRAW: 'WITHDRAWN' }, // a mistake on an ended notice can still be marked withdrawn
  REPLACED: {},
  WITHDRAWN: {},
};

/** The status after the move, or null when the move is not allowed from here. */
export const tryNextStatus = (from: ConductStatus, move: ConductMove): ConductStatus | null => TABLE[from][move] ?? null;

/** The status after the move, or 409 INVALID_TRANSITION carrying the status the notice is really in. */
export function nextStatus(from: ConductStatus, move: ConductMove): ConductStatus {
  const next = tryNextStatus(from, move);
  if (next === null) throw new ConflictError('This notice cannot change that way now.', 'INVALID_TRANSITION', { status: from, move });
  return next;
}

/** The statuses a move may start from (for the compare-and-set `WHERE status IN (...)`). */
export const statusesAllowing = (move: ConductMove): ConductStatus[] =>
  (Object.keys(TABLE) as ConductStatus[]).filter((status) => TABLE[status][move] !== undefined);

/** Statuses that count as "on the file now" (the ladder and the Active chip). A notice must also be inside its end date (see `isActiveOn`). */
export const ACTIVE_STATUSES: readonly ConductStatus[] = ['ISSUED', 'RECORDED', 'SIGNED', 'GIVEN_NOT_SIGNED', 'APPEALED', 'KEPT'];

export const isLive = (status: ConductStatus): boolean => ACTIVE_STATUSES.includes(status);

/** Statuses the person may still appeal from. */
export const APPEALABLE_STATUSES: readonly ConductStatus[] = statusesAllowing('APPEAL');
