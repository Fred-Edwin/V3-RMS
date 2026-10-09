import { socketService } from '../../../sockets/socket-service';
import { logger } from '../../../utils/logger';
import { inventoryNotify, type Notification } from '../_shared/notify';
import type { PushMessage } from '../counting/_shared/count-notify';

/**
 * The notices and socket events of the store-side Dispatch writes (docs/features/inventory/dispatch-contract.md §7), sent AFTER the
 * transaction commits and never failing the write. Everything goes through the one layer (`_shared/notify.ts`); wording uses titles
 * and department names, never a person's name. There is no Inbox row (Amendment 1).
 *
 *   Signed (P5)    -> push to the head and the members of each shipped department; badge on the branch (the Branch Manager's Deliveries
 *                     and Requisitions badges) and on the hub (the Attendant's Dispatch badge)
 *   Cancelled (P8) -> badge on the branch and the hub only. The department is told by its next write getting DISPATCH_CANCELLED (no push).
 * and `dispatch:changed` per record to the rooms of the branch and the hub.
 */
export interface DispatchNoticeDeps {
  send: (n: Notification) => Promise<void>;
  emitChanged: (hubId: string, payload: { id: string; reference: string | null; siteId: string; reason: string }) => void;
}

const defaultDeps: DispatchNoticeDeps = {
  send: (n) => inventoryNotify.send(n),
  emitChanged: (hubId, payload) => socketService.emitDispatchChanged(hubId, payload),
};

export interface SignedBatch {
  hubId: string;
  branchId: string;
  requisitionReference: string;
  dispatches: Array<{ id: string; reference: string; departmentId: string; departmentName: string }>;
}

const linkOf = (dispatchId: string): string => `/app/branch/deliveries/${dispatchId}`;

export const createDispatchNotices = (deps: DispatchNoticeDeps = defaultDeps) => {
  const changed = (hubId: string, branchId: string, rows: Array<{ id: string; reference: string | null }>, reason: string): void => {
    for (const row of rows) {
      try {
        deps.emitChanged(hubId, { id: row.id, reference: row.reference, siteId: branchId, reason });
      } catch (error) {
        logger.warn({ error, dispatchId: row.id, reason }, 'dispatch:changed socket event failed');
      }
    }
  };

  return {
    /** P5 committed: tell every shipped department, nudge the badges, emit the events. */
    signed: async (batch: SignedBatch): Promise<void> => {
      changed(batch.hubId, batch.branchId, batch.dispatches, 'dispatch.signed');
      for (const d of batch.dispatches) {
        const message: PushMessage = {
          title: 'A delivery is on the way',
          body: `${d.departmentName}: ${d.reference} has left the Central Store.`,
          link: linkOf(d.id),
          tag: `dispatch-signed-${d.id}`,
          data: { type: 'dispatch_signed', dispatchId: d.id },
          urgency: 'normal',
        };
        await deps.send({
          audiences: [{ kind: 'department', siteId: batch.branchId, departmentIds: [d.departmentId], headsOnly: false }],
          message,
          badgeSites: [batch.branchId, batch.hubId],
          reason: 'dispatch.signed',
        });
      }
    },

    /** P8 committed: badges and events only. */
    cancelled: async (c: { hubId: string; branchId: string; id: string; reference: string | null }): Promise<void> => {
      changed(c.hubId, c.branchId, [{ id: c.id, reference: c.reference }], 'dispatch.cancelled');
      await deps.send({ audiences: [], message: { title: '', body: '', link: linkOf(c.id), tag: `dispatch-cancelled-${c.id}`, data: { type: 'dispatch_cancelled', dispatchId: c.id }, urgency: 'normal' }, badgeSites: [c.branchId, c.hubId], reason: 'dispatch.cancelled' });
    },

    /** A pack save moved the queue (a department started or finished): the store's badge and open queues refresh. */
    packed: async (c: { hubId: string; branchId: string; id: string }): Promise<void> => {
      changed(c.hubId, c.branchId, [{ id: c.id, reference: null }], 'dispatch.packed');
    },
  };
};

export const dispatchNotices = createDispatchNotices();
