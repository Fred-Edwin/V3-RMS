import { Prisma } from '@prisma/client';
import { nairobiDay } from '../../stock/_shared/nairobi-time';
import type { ReverseMode } from './branch.types';

export type BranchReverseCheck = 'OK' | 'NOT_YOUR_ENTRY' | 'REVERSAL_WINDOW_PASSED' | 'ALREADY_REVERSED';

/**
 * May this caller reverse this entry now? The one rule behind `can.reverse` on every row and behind BW7 (the Central Store
 * `reverseCheck` with the branch capabilities):
 *  - an entry already reversed can never be reversed again;
 *  - `ANY` (`branch_waste.reverse_any`) reverses any entry in the caller's reach, however old;
 *  - `OWN` (the department rule) reverses an entry the caller logged, and only on the same Nairobi day;
 *  - anyone else is refused as if the entry were not theirs.
 * Whether the entry is inside the caller's reach (their branch, their department) is the service's rule and comes first.
 */
export const branchReverseCheck = (
  mode: ReverseMode,
  callerId: string,
  log: { loggedById: string; createdAt: Date; reversedAt: Date | null },
  now: Date,
): BranchReverseCheck => {
  if (log.reversedAt) return 'ALREADY_REVERSED';
  if (mode === 'ANY') return 'OK';
  if (mode === 'NONE' || log.loggedById !== callerId) return 'NOT_YOUR_ENTRY';
  return nairobiDay(log.createdAt) === nairobiDay(now) ? 'OK' : 'REVERSAL_WINDOW_PASSED';
};

/**
 * The cost a branch entry is valued at: the cost carried into the department (the latest DISPATCH_IN row at its location), else the
 * item's current cost when nothing was ever dispatched in. Frozen on the entry when it is logged.
 */
export const branchUnitCost = (currentCost: Prisma.Decimal, lastDispatchInCost: Prisma.Decimal | null): Prisma.Decimal => lastDispatchInCost ?? currentCost;
