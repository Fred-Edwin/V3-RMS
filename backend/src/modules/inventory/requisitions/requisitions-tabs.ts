import type { RequisitionStatus, RequisitionTab, SectionStatus } from './_shared/requisitions-contract';

/**
 * Which stage tab a requisition sits in (contract R1, Paper steps 7 and 7b). Pure, so the whole table is tested without a database.
 *
 * BLOCK 2 REPLACES `tabOf` (and only it): until packing, dispatch and deliveries are rebuilt, the four store-side tabs are derived
 * from the OLD dispatch rows (`Dispatch.status` per department) and the old discrepancy rows. Nothing else in the list reads
 * dispatches, so swapping this one function swaps the source.
 *
 *   Collecting (OPEN)                          -> collecting
 *   Ready to approve (PENDING_APPROVAL)        -> to-approve
 *   Approved with an addition waiting          -> to-approve   (contract §5: "Addition waiting ... shown in To approve")
 *   Approved:
 *     any dispatch with an open discrepancy    -> discrepancies
 *     a Sent department with no signed dispatch (none, or AWAITING) -> to-pack
 *     a dispatch IN_TRANSIT                    -> on-the-way
 *     every Sent department confirmed          -> closed       (shown there; `CLOSED` itself is set by Block 2 only)
 *   Cancelled, Closed                          -> closed
 *
 * `to-confirm` is empty until Block 2: in the old model a signed dispatch is IN_TRANSIT until the branch confirms it, which is
 * what `on-the-way` already says. A department added in Block 1 has no legacy key and the old dispatch cannot see it, so it never
 * holds a requisition in `to-pack`.
 */
export type DispatchState = 'AWAITING' | 'IN_TRANSIT' | 'CONFIRMED' | 'DISCREPANCY_OPEN';

export interface TabFacts {
  status: RequisitionStatus;
  additionWaiting: boolean;
  /** One entry per Sent department the old dispatch can see (it has a legacy key). `dispatch` is null while the store has not signed. */
  sentDepartments: ReadonlyArray<{ dispatch: DispatchState | null }>;
}

export const tabOf = (f: TabFacts): RequisitionTab => {
  if (f.status === 'OPEN') return 'collecting';
  if (f.status === 'PENDING_APPROVAL') return 'to-approve';
  if (f.status === 'CANCELLED' || f.status === 'CLOSED') return 'closed';
  if (f.additionWaiting) return 'to-approve';
  const states = f.sentDepartments.map((d) => d.dispatch);
  if (states.includes('DISCREPANCY_OPEN')) return 'discrepancies';
  if (states.length === 0 || states.some((s) => s === null || s === 'AWAITING')) return 'to-pack';
  if (states.includes('IN_TRANSIT')) return 'on-the-way';
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
