import { inventoryNotify, type Notification } from '../../_shared/notify';
import type { PushMessage } from '../../counting/_shared/count-notify';

/**
 * The Purchasing rows of the notification map (docs/features/inventory/purchasing-attendant-api.md, "Notification rows"), sent AFTER
 * the transaction commits and never failing the write. Everything goes through the one layer (`_shared/notify.ts`): a push, plus the
 * `inventory:badges` nudge to the hub so open screens refetch their counts. The Notifications screen itself is NOT stored: it is
 * derived from the orders (`attendant/notices.ts`), as the layer's header says (no Inbox row).
 *
 *   21b sent for approval       -> nobody pushed; the hub's open screens refetch their counts (badge nudge only)
 *   22  approved                -> the person who raised it (push; "Ready to send")
 *   23  returned                -> the person who raised it (push; "Edit and resend")
 *   24  delivery due today      -> the hub's Store Attendants (push, 08:00 job)
 *   25  delivery overdue        -> the hub's Store Attendants (push, 08:00 job)
 *   26  closed (paid in full)   -> the person who raised it (push; "Paid in full", no figures)
 *   27  reminder                -> the hub's Store Manager (push; "Remind the Store Manager")
 * Wording names a person with their role ("Joseph (Store Manager)"), never the bare first name (owner, 10 Oct 2026).
 */
export interface PurchasingNoticeDeps {
  send: (n: Notification) => Promise<void>;
}

const defaultDeps: PurchasingNoticeDeps = { send: (n) => inventoryNotify.send(n) };

/** `/app/inventory/purchasing/<id>`: the purchase file (the front end owns the path). */
export const orderLink = (orderId: string): string => `/app/inventory/purchasing/${orderId}`;

const message = (title: string, body: string, orderId: string, type: string, urgency: PushMessage['urgency'] = 'normal'): PushMessage => ({
  title,
  body,
  link: orderLink(orderId),
  tag: `purchasing-${type}-${orderId}`,
  data: { type: `purchasing_${type}`, orderId },
  urgency,
});

export interface OrderNotice {
  hubId: string;
  orderId: string;
  reference: string;
  supplierName: string;
}

export const createPurchasingNotices = (deps: PurchasingNoticeDeps = defaultDeps) => ({
  /** Row 21b: an order is sent for approval. No push (the Store Manager's tab count and Receiving badge refetch on the nudge). */
  submitted: (o: OrderNotice): Promise<void> => deps.send({ audiences: [], message: message('Order waiting', o.reference, o.orderId, 'submitted'), badgeSites: [o.hubId], reason: 'purchasing.submitted' }),

  /** Row 22. */
  approved: (o: OrderNotice & { raisedById: string; approverLabel: string }): Promise<void> =>
    deps.send({
      audiences: [{ kind: 'users', userIds: [o.raisedById] }],
      message: message('Order approved', `${o.approverLabel} approved ${o.reference} to ${o.supplierName}. Ready to send.`, o.orderId, 'approved'),
      badgeSites: [o.hubId],
      reason: 'purchasing.approved',
    }),

  /** Row 23. */
  returned: (o: OrderNotice & { raisedById: string; returnerLabel: string; note: string }): Promise<void> =>
    deps.send({
      audiences: [{ kind: 'users', userIds: [o.raisedById] }],
      message: message('Order sent back', `${o.returnerLabel} sent ${o.reference} back: "${o.note}"`, o.orderId, 'returned', 'high'),
      badgeSites: [o.hubId],
      reason: 'purchasing.returned',
    }),

  /** Row 26. No figures: the person who raised it may be an Attendant. */
  closed: (o: OrderNotice & { raisedById: string }): Promise<void> =>
    deps.send({
      audiences: [{ kind: 'users', userIds: [o.raisedById] }],
      message: message('Order closed', `${o.reference} to ${o.supplierName} is paid in full.`, o.orderId, 'closed'),
      badgeSites: [o.hubId],
      reason: 'purchasing.closed',
    }),

  /** Row 27. */
  reminder: (o: OrderNotice & { fromLabel: string }): Promise<void> =>
    deps.send({
      audiences: [{ kind: 'roles', siteId: o.hubId, roles: ['STORE_MANAGER'] }],
      message: message('An order is waiting for you', `${o.fromLabel} is waiting for you to approve ${o.reference} to ${o.supplierName}.`, o.orderId, 'reminder'),
      badgeSites: [o.hubId],
      reason: 'purchasing.reminder',
    }),

  /** Rows 24 and 25, from the 08:00 job. */
  dueToday: (o: OrderNotice & { itemCount: number }): Promise<void> =>
    deps.send({
      audiences: [{ kind: 'roles', siteId: o.hubId, roles: ['STORE_ATTENDANT'] }],
      message: message('Delivery due today', `${o.supplierName} is due to deliver ${o.reference} (${o.itemCount} item${o.itemCount === 1 ? '' : 's'}).`, o.orderId, 'due'),
      badgeSites: [o.hubId],
      reason: 'purchasing.due_today',
    }),

  overdue: (o: OrderNotice & { daysLate: number }): Promise<void> =>
    deps.send({
      audiences: [{ kind: 'roles', siteId: o.hubId, roles: ['STORE_ATTENDANT'] }],
      message: message(
        `${o.daysLate} day${o.daysLate === 1 ? '' : 's'} overdue`,
        `${o.supplierName} has not delivered ${o.reference}. Call them to find out where it is.`,
        o.orderId,
        'overdue',
        'high',
      ),
      badgeSites: [o.hubId],
      reason: 'purchasing.overdue',
    }),
});

export const purchasingNotices = createPurchasingNotices();
