import type { Request } from 'express';
import { actorCan } from '../../_shared/central-store-access';
import { nairobiDay } from '../../stock/_shared/nairobi-time';

type Actor = Pick<NonNullable<Request['user']>, 'id' | 'role'>;

export type ReverseCheck = 'OK' | 'NOT_YOUR_ENTRY' | 'REVERSAL_WINDOW_PASSED' | 'ALREADY_REVERSED';

/**
 * May this caller reverse this entry now? The one rule behind `can.reverse` on every row and behind W4:
 *  - an entry already reversed can never be reversed again;
 *  - `waste.reverse_any` reverses any entry, however old;
 *  - `waste.reverse_own` reverses an entry the caller logged, and only on the same Nairobi day;
 *  - anyone else is refused as if the entry were not theirs.
 */
export const reverseCheck = (
  actor: Actor,
  log: { loggedById: string; createdAt: Date; reversedAt: Date | null },
  now: Date,
): ReverseCheck => {
  if (log.reversedAt) return 'ALREADY_REVERSED';
  if (actorCan(actor, 'waste.reverse_any')) return 'OK';
  if (!actorCan(actor, 'waste.reverse_own') || log.loggedById !== actor.id) return 'NOT_YOUR_ENTRY';
  return nairobiDay(log.createdAt) === nairobiDay(now) ? 'OK' : 'REVERSAL_WINDOW_PASSED';
};

/**
 * Who sees only their own entries: a caller without `stock.read` (the Store Attendant holds `waste.read` but none of the
 * desktop reads). Decided by capability, never by role name; `scope` in the query cannot widen it.
 */
export const seesOwnEntriesOnly = (actor: Pick<NonNullable<Request['user']>, 'role'>): boolean => !actorCan(actor, 'stock.read');
