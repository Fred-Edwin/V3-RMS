import { socketService } from '../../../sockets/socket-service';
import { logger } from '../../../utils/logger';
import { trimDecimal } from '../catalog/item-history';
import { inventoryNotify, type Notification } from '../_shared/notify';
import type { PushMessage } from '../counting/_shared/count-notify';

/**
 * The notices and socket events of the branch side (docs/features/inventory/dispatch-contract.md §7, notification map rows 6, 14, 17
 * and 20 on Paper "Inventory · Final design pass: map"), sent AFTER the transaction commits and never failing the write. Everything
 * goes through the one layer (`_shared/notify.ts`); wording uses titles and department names, never a person's name. There is no
 * Inbox row (Amendment 1).
 *
 *   Confirmed with gaps  -> Store Manager (push, Discrepancies badge) and Director (push, row 17); badge on the branch
 *   Confirmed, no gap    -> badges only (the Branch Manager's and the store's counts change)
 *   Waiting 2 hours      -> Branch Manager (push, row 20); badge on the branch and the hub
 * and `dispatch:changed` / `discrepancy:changed` per record. The department's chip on My deliveries (row 14) is the socket event.
 * A cancelled dispatch sends no push (row 21; Dispatch's notices).
 */
export interface BranchNoticeDeps {
  send: (n: Notification) => Promise<void>;
  emitDispatchChanged: (hubId: string, payload: { id: string; reference: string | null; siteId: string; reason: string }) => void;
  emitDiscrepancyChanged: (hubId: string, payload: { id: string; reference: string; siteId: string; reason: string }) => void;
}

export const defaultBranchNoticeDeps: BranchNoticeDeps = {
  send: (n) => inventoryNotify.send(n),
  emitDispatchChanged: (hubId, payload) => socketService.emitDispatchChanged(hubId, payload),
  emitDiscrepancyChanged: (hubId, payload) => socketService.emitDiscrepancyChanged(hubId, payload),
};

/** Where a tap on the push goes: the discrepancy file, the dispatch file (the front end owns these paths). */
export const discrepancyLink = (id: string): string => `/app/inventory/requisitions/discrepancies/${id}`;
/** The store's view of a dispatch file (Store Manager, Director). */
export const dispatchLink = (id: string): string => `/app/inventory/requisitions/dispatch/${id}`;
/** The Branch Manager's view of the same file. */
export const branchDispatchLink = (id: string): string => `/app/branch/requisitions/dispatch/${id}`;

/** "Milk 1L is short by 2 at Nyeri Town (DSC-NYR-0007)." (map row 17) */
export const gapSentence = (g: { itemName: string; gapQty: string; reference: string }, branchName: string): string => {
  const n = trimDecimal(g.gapQty.replace('-', ''));
  return g.gapQty.startsWith('-') ? `${g.itemName} is short by ${n} at ${branchName} (${g.reference}).` : `${g.itemName} has ${n} extra at ${branchName} (${g.reference}).`;
};

export interface ConfirmedBatch {
  hubId: string;
  branchId: string;
  branchName: string;
  dispatchId: string;
  dispatchReference: string;
  departmentName: string;
  discrepancies: Array<{ id: string; reference: string; itemName: string; gapQty: string }>;
}

export const createBranchNotices = (deps: BranchNoticeDeps = defaultBranchNoticeDeps) => {
  const safely = (label: string, fn: () => void): void => {
    try {
      fn();
    } catch (error) {
      logger.warn({ error, label }, 'Inventory socket event failed');
    }
  };

  return {
    /** V6 committed. */
    confirmed: async (b: ConfirmedBatch): Promise<void> => {
      safely('dispatch.confirmed', () => deps.emitDispatchChanged(b.hubId, { id: b.dispatchId, reference: b.dispatchReference, siteId: b.branchId, reason: 'dispatch.confirmed' }));
      for (const d of b.discrepancies) safely('discrepancy.opened', () => deps.emitDiscrepancyChanged(b.hubId, { id: d.id, reference: d.reference, siteId: b.branchId, reason: 'discrepancy.opened' }));
      const first = b.discrepancies[0];
      if (!first) {
        await deps.send({ audiences: [], message: emptyMessage(b.dispatchId), badgeSites: [b.branchId, b.hubId], reason: 'dispatch.confirmed' });
        return;
      }
      const message: PushMessage =
        b.discrepancies.length === 1
          ? { title: 'A delivery does not match', body: gapSentence(first, b.branchName), link: discrepancyLink(first.id), tag: `discrepancy-opened-${first.id}`, data: { type: 'discrepancy_opened', discrepancyId: first.id }, urgency: 'normal' }
          : {
              title: 'A delivery does not match',
              body: `${b.discrepancies.length} lines of ${b.departmentName}'s delivery are different at ${b.branchName} (${b.dispatchReference}).`,
              link: dispatchLink(b.dispatchId),
              tag: `discrepancy-opened-${b.dispatchId}`,
              data: { type: 'discrepancy_opened', dispatchId: b.dispatchId },
              urgency: 'normal',
            };
      await deps.send({
        audiences: [{ kind: 'roles', siteId: b.hubId, roles: ['STORE_MANAGER'] }, { kind: 'directors' }],
        message,
        badgeSites: [b.branchId, b.hubId],
        reason: 'discrepancy.opened',
      });
    },

    /** V2 stamped `arrivedAt`: the store's open dispatch file shows "Arrived 3:28 pm". No push, no badge. */
    arrived: async (a: { hubId: string; branchId: string; dispatchId: string; reference: string | null }): Promise<void> => {
      safely('dispatch.arrived', () => deps.emitDispatchChanged(a.hubId, { id: a.dispatchId, reference: a.reference, siteId: a.branchId, reason: 'dispatch.arrived' }));
    },

    /** The 2-hour job: nobody has counted the delivery since it left the store. Tells the Branch Manager (map row 20). */
    waiting: async (w: { hubId: string; branchId: string; dispatchId: string; reference: string; departmentName: string }): Promise<void> => {
      safely('dispatch.waiting', () => deps.emitDispatchChanged(w.hubId, { id: w.dispatchId, reference: w.reference, siteId: w.branchId, reason: 'dispatch.waiting' }));
      await deps.send({
        audiences: [{ kind: 'roles', siteId: w.branchId, roles: ['MANAGER'] }],
        message: {
          title: 'Waiting for the branch',
          body: `Nobody in ${w.departmentName} has counted ${w.reference} yet. Confirm ${w.departmentName}'s delivery for them.`,
          link: branchDispatchLink(w.dispatchId),
          tag: `dispatch-waiting-${w.dispatchId}`,
          data: { type: 'dispatch_waiting', dispatchId: w.dispatchId },
          urgency: 'high',
        },
        badgeSites: [w.branchId, w.hubId],
        reason: 'dispatch.waiting',
      });
    },
  };
};

const emptyMessage = (dispatchId: string): PushMessage => ({ title: '', body: '', link: dispatchLink(dispatchId), tag: `dispatch-confirmed-${dispatchId}`, data: { type: 'dispatch_confirmed', dispatchId }, urgency: 'normal' });

export const branchNotices = createBranchNotices();
