import { ForbiddenError } from '../../../../utils/errors';

export interface PreparerFacts {
  sentById: string | null;
  runByIds: readonly (string | null)[]; // who calculated or recalculated; null is the system
  checkedByIds: readonly (string | null)[]; // who ticked a line
  adjustmentByIds: readonly (string | null)[]; // who added or removed a line
  leftOutByIds: readonly (string | null)[];
}

/** E1, P20: everyone who touched the month on the way to the Accountant. */
export function preparerIds(facts: PreparerFacts): Set<string> {
  const ids = new Set<string>();
  for (const id of [facts.sentById, ...facts.runByIds, ...facts.checkedByIds, ...facts.adjustmentByIds, ...facts.leftOutByIds]) if (id) ids.add(id);
  return ids;
}

/** The approver is never the user who sent, recalculated, ticked, adjusted or left someone out (403 SELF_APPROVAL). */
export function assertNotPreparer(approverId: string, facts: PreparerFacts): void {
  if (preparerIds(facts).has(approverId)) throw new ForbiddenError('You prepared this month, so someone else must approve it.', 'SELF_APPROVAL');
}
