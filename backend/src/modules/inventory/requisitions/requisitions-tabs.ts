import { WAITING_FOR_BRANCH_AFTER_HOURS } from '../dispatch/_shared/dispatch-contract';
import type { RequisitionStatus, RequisitionTab, SectionStatus } from './_shared/requisitions-contract';

/**
 * Which stage tab a requisition sits in (contract R1, Paper steps 7 and 7b; Block 2 dispatch contract Amendment 1 row 9). Pure, so
 * the whole table is tested without a database. This is the ONE function that reads dispatches for the list.
 *
 *   Collecting (OPEN)                          -> collecting
 *   Ready to approve (PENDING_APPROVAL)        -> to-approve
 *   Approved with an addition waiting          -> to-approve   (contract §5: "Addition waiting ... shown in To approve")
 *   Approved (checked in this order):
 *     any discrepancy Open (or reversed)       -> discrepancies
 *     a Sent department with no live dispatch signed -> to-pack   (none, TO_PACK or PACKING; a cancelled dispatch does not count)
 *     a department waiting more than 2 hours   -> to-confirm   (ON_THE_WAY and `signedAt` older than 2 hours: what the Branch Manager acts on)
 *     a department still ON_THE_WAY            -> on-the-way
 *     every Sent department counted            -> closed       (shown there; CLOSED itself is set when the last discrepancy settles)
 *   Cancelled, Closed                          -> closed
 */
export type DispatchFactStatus = 'TO_PACK' | 'PACKING' | 'ON_THE_WAY' | 'CONFIRMED' | 'CLOSED';

/** A Sent department's live (not cancelled) dispatch; null while the department has none. */
export interface DispatchFact {
  status: DispatchFactStatus;
  signedAt: Date | null;
  /** A discrepancy of this dispatch is OPEN, or was reversed and is held again. */
  discrepancyOpen: boolean;
}

export interface TabFacts {
  status: RequisitionStatus;
  additionWaiting: boolean;
  /** One entry per Sent department that has lines to pack. */
  sentDepartments: ReadonlyArray<{ dispatch: DispatchFact | null }>;
  now: Date;
}

const WAITING_MS = WAITING_FOR_BRANCH_AFTER_HOURS * 60 * 60 * 1000;

export const isWaitingForBranch = (d: Pick<DispatchFact, 'status' | 'signedAt'>, now: Date): boolean =>
  d.status === 'ON_THE_WAY' && d.signedAt !== null && now.getTime() - d.signedAt.getTime() > WAITING_MS;

export const tabOf = (f: TabFacts): RequisitionTab => {
  if (f.status === 'OPEN') return 'collecting';
  if (f.status === 'PENDING_APPROVAL') return 'to-approve';
  if (f.status === 'CANCELLED' || f.status === 'CLOSED') return 'closed';
  if (f.additionWaiting) return 'to-approve';
  const dispatches = f.sentDepartments.map((d) => d.dispatch);
  if (dispatches.some((d) => d?.discrepancyOpen)) return 'discrepancies';
  if (dispatches.length === 0 || dispatches.some((d) => d === null || d.status === 'TO_PACK' || d.status === 'PACKING')) return 'to-pack';
  if (dispatches.some((d) => d !== null && isWaitingForBranch(d, f.now))) return 'to-confirm';
  if (dispatches.some((d) => d?.status === 'ON_THE_WAY')) return 'on-the-way';
  return 'closed';
};

/** What the caller's dark badge counts, by role family (see `waitingTab`). */
export type WaitingFamily = 'APPROVER' | 'STORE' | 'HEAD' | 'NONE';

/** The tab whose rows are "waiting for you": approvers wait on To approve, the store on To pack. A head's wait is their own unsent list. */
export const waitingTab = (family: WaitingFamily): RequisitionTab | null => (family === 'APPROVER' ? 'to-approve' : family === 'STORE' ? 'to-pack' : null);

/** A head's list is waiting for them while they have not sent it and the requisition is still collecting. */
export const headIsWaited = (requisitionStatus: RequisitionStatus, sectionStatus: SectionStatus): boolean =>
  requisitionStatus === 'OPEN' && (sectionStatus === 'NOT_STARTED' || sectionStatus === 'DRAFT');

/** The caller's own tab when the screen asks for none. */
export const defaultTab = (family: WaitingFamily): RequisitionTab => (family === 'STORE' ? 'to-pack' : family === 'APPROVER' ? 'to-approve' : 'collecting');
