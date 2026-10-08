import { logger } from '../../../utils/logger';

/**
 * The seam between the requisition writes (back end A) and the notification layer (back end B, `_shared/notify.ts`).
 * A write publishes ONE named event AFTER its transaction commits; back end B subscribes once and decides the push, the badge and
 * the socket nudge (contract §7, map rows 1, 2, 3, 4 and 13). A subscriber that throws never fails the write.
 *
 * Nothing here knows how a message is delivered. The payloads carry ids and the facts a message needs, never a person's contact data.
 */
export interface RequisitionEventBase {
  requisitionId: string;
  reference: string;
  /** The branch Site. */
  siteId: string;
  /** Who did it. */
  actorId: string;
}

export type RequisitionNotice =
  /** Map row 1: a head sent a section (the Branch Manager hears; badge and tab count). */
  | (RequisitionEventBase & { type: 'SECTION_SENT'; departmentId: string; departmentName: string; readyToApprove: boolean; onBehalf?: boolean })
  /** Amendment 2: the Branch Manager filled a department's list for its head ("Fill it myself"); the head is told. */
  | (RequisitionEventBase & { type: 'SECTION_EDITED_ON_BEHALF'; departmentId: string; departmentName: string })
  /** Map row 2: the manager changed a quantity (the head of that department hears what changed). */
  | (RequisitionEventBase & { type: 'QUANTITY_CHANGED'; departmentId: string; departmentName: string; itemName: string; from: string; to: string; reason: string | null })
  /** Map row 3 starts here: Urgent was set (the Branch Manager hears now; the Director after 1 hour, by the worker job). */
  | (RequisitionEventBase & { type: 'URGENT_SET' })
  /** The manager nudged a department (its head hears). */
  | (RequisitionEventBase & { type: 'NUDGED'; departmentId: string; departmentName: string })
  /** Map row 4: signed (the store hears through the badge; every head is told). `signedAs` is the role the signer signed as. */
  | (RequisitionEventBase & { type: 'APPROVED'; signedAs: 'BRANCH_MANAGER' | 'DIRECTOR' | 'SYSTEM_ADMIN' })
  /** Map row 13: cancelled (the heads hear; the store too if it had been approved, which Block 1 never allows). */
  | (RequisitionEventBase & { type: 'CANCELLED'; reason: string })
  /** A head added lines after approval (the approver hears). */
  | (RequisitionEventBase & { type: 'ADDITION_ADDED'; additionId: string; departmentId: string; departmentName: string })
  /** An addition was approved (the head hears). */
  | (RequisitionEventBase & { type: 'ADDITION_APPROVED'; additionId: string; departmentId: string; departmentName: string });

export type RequisitionNoticeType = RequisitionNotice['type'];
export type RequisitionListener = (notice: RequisitionNotice) => void | Promise<void>;

const listeners = new Set<RequisitionListener>();

export const requisitionNotices = {
  /** Back end B calls this once at start-up. Returns the unsubscribe function. */
  subscribe: (listener: RequisitionListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Fire and forget: a failing subscriber is logged, never raised. */
  publish: (notice: RequisitionNotice): void => {
    for (const listener of listeners) {
      void Promise.resolve()
        .then(() => listener(notice))
        .catch((error: unknown) => logger.error({ type: notice.type, requisitionId: notice.requisitionId, err: error }, 'Requisition notice subscriber failed'));
    }
  },
};
