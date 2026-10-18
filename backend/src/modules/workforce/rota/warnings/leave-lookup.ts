import type { NairobiDate } from '../../_shared/time/nairobi-time';

/** Approved leave per person, as a set of Nairobi dates. */
export type LeaveLookup = (employeeIds: readonly string[], from: NairobiDate, to: NairobiDate) => Promise<Map<string, Set<string>>>;

/** Until slice 5 (Leave) exists nobody is on approved leave, so the leave warning and the copy clash return none. */
const noLeave: LeaveLookup = async () => new Map();

let lookup: LeaveLookup = noLeave;

/** Slice 5 registers the real lookup at start-up; `null` restores the empty answer (tests). */
export function registerLeaveLookup(next: LeaveLookup | null): void {
  lookup = next ?? noLeave;
}

export const approvedLeave: LeaveLookup = (employeeIds, from, to) => lookup(employeeIds, from, to);
