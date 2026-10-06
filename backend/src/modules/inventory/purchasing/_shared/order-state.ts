import type { Capability } from '../../_shared/central-store-access';

/**
 * The order state machine, as pure functions (docs/features/inventory/purchasing-mock/backend-rules.md §1).
 * Nothing here touches the database: the services read the facts, ask these functions, then write.
 */
export const ORDER_STATUSES = ['DRAFT', 'AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT', 'DELIVERED', 'INVOICED', 'CLOSED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Stage = 'NEEDS' | 'APPROVAL' | 'RECEIVE' | 'INVOICE' | 'PAY' | 'CLOSED';
export type TrackerStep = 'RAISED' | 'APPROVED' | 'SENT' | 'DELIVERED' | 'INVOICED' | 'PAID';
export type SendVia = 'WHATSAPP' | 'PRINT' | 'LINK' | 'MANUAL';

/** An order is "open" while it holds the supplier's one slot (Q-07): nothing has been received yet. */
export const OPEN_STATUSES: readonly OrderStatus[] = ['DRAFT', 'AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'];

export const stageOf = (status: OrderStatus): Stage => {
  switch (status) {
    case 'DRAFT':
    case 'AWAITING_APPROVAL':
    case 'RETURNED':
      return 'APPROVAL';
    case 'APPROVED':
    case 'SENT':
      return 'RECEIVE';
    case 'DELIVERED':
      return 'INVOICE';
    case 'INVOICED':
      return 'PAY';
    default:
      return 'CLOSED';
  }
};

/** Statuses an action may start from. A service checks `canMove` before it writes. */
const FROM: Record<string, readonly OrderStatus[]> = {
  edit: ['DRAFT', 'RETURNED'],
  discard: ['DRAFT'],
  submit: ['DRAFT', 'RETURNED'],
  approve: ['AWAITING_APPROVAL', 'DRAFT'], // a draft is approved straight away by an approver for their own order
  return: ['AWAITING_APPROVAL'],
  send: ['APPROVED', 'SENT'], // a second send is idempotent
  cancel: ['AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'],
  receive: ['APPROVED', 'SENT'],
  deposit: ['APPROVED', 'SENT', 'DELIVERED', 'INVOICED'],
  invoice: ['DELIVERED'],
};
export type OrderAction = keyof typeof FROM;
export const canMove = (status: OrderStatus, action: OrderAction): boolean => (FROM[action] ?? []).includes(status);

/** What the screens need to know about an order to decide what this caller may do (the `can{}` block). */
export interface OrderFacts {
  status: OrderStatus;
  raisedById: string;
  hasInvoice: boolean;
  invoiceDisputed: boolean;
  /** Money paid against the invoice itself (an advance does not count). */
  invoicePaid: boolean;
}

export interface OrderCan {
  edit: boolean;
  submit: boolean;
  approve: boolean;
  return: boolean;
  send: boolean;
  cancel: boolean;
  receive: boolean;
  recordDeposit: boolean;
  addInvoice: boolean;
  recordPayment: boolean;
  settleDispute: boolean;
  voidInvoice: boolean;
  reversePayment: boolean;
  addDocument: boolean;
}

export interface Caller {
  id: string;
  can: (capability: Capability) => boolean;
}

export const canOf = (o: OrderFacts, caller: Caller): OrderCan => {
  const mine = o.raisedById === caller.id;
  const editable = canMove(o.status, 'edit') && (mine || caller.can('orders.approve'));
  return {
    edit: editable && caller.can('orders.request'),
    submit: editable && caller.can('orders.request'),
    approve: caller.can('orders.approve') && canMove(o.status, 'approve'),
    return: caller.can('orders.approve') && canMove(o.status, 'return'),
    send: (caller.can('orders.approve') || caller.can('orders.request')) && canMove(o.status, 'send'),
    cancel: caller.can('orders.cancel') && canMove(o.status, 'cancel'),
    receive: caller.can('orders.receive') && canMove(o.status, 'receive'),
    recordDeposit: caller.can('payables.record_deposit') && canMove(o.status, 'deposit'),
    addInvoice: caller.can('payables.record_invoice') && canMove(o.status, 'invoice'),
    recordPayment: caller.can('payables.record_payment') && o.status === 'INVOICED' && o.hasInvoice && !o.invoiceDisputed,
    settleDispute: caller.can('payables.record_invoice') && o.status === 'INVOICED' && o.invoiceDisputed,
    // An invoice is voided only while nothing is paid against it; otherwise the payment is reversed first.
    voidInvoice: caller.can('payables.record_invoice') && o.status === 'INVOICED' && o.hasInvoice && !o.invoicePaid,
    reversePayment: caller.can('payables.record_payment') && (o.status === 'INVOICED' || o.status === 'CLOSED') && o.invoicePaid,
    addDocument: o.status !== 'DRAFT' && (caller.can('payables.record_invoice') || caller.can('payables.record_payment') || caller.can('orders.approve')),
  };
};

export interface TrackerFacts {
  status: OrderStatus;
  raisedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  sentVia: SendVia | null;
  deliveredAt: string | null;
  deliveredShort: boolean;
  invoicedAt: string | null;
  invoiceNote: 'disputed' | 'settled' | null;
  paidAt: string | null;
}

export interface TrackerItem {
  step: TrackerStep;
  state: 'DONE' | 'CURRENT' | 'TODO';
  at: string | null;
  note: string | null;
}

const VIA_WORD: Record<SendVia, string> = { WHATSAPP: 'WhatsApp', PRINT: 'Printed', LINK: 'Link', MANUAL: 'Phoned in' };

/** The six-step tracker. The first step not done is the current one, except on a cancelled order. */
export const trackerOf = (t: TrackerFacts): TrackerItem[] => {
  const steps: Array<{ step: TrackerStep; done: boolean; at: string | null; note: string | null }> = [
    { step: 'RAISED', done: t.status !== 'DRAFT', at: t.submittedAt ?? t.raisedAt, note: null },
    { step: 'APPROVED', done: t.approvedAt !== null, at: t.approvedAt, note: t.approvedAt ? 'PIN' : null },
    { step: 'SENT', done: t.sentAt !== null, at: t.sentAt, note: t.sentVia ? VIA_WORD[t.sentVia] : null },
    { step: 'DELIVERED', done: t.deliveredAt !== null, at: t.deliveredAt, note: t.deliveredAt && t.deliveredShort ? 'short' : null },
    { step: 'INVOICED', done: t.invoicedAt !== null, at: t.invoicedAt, note: t.invoicedAt ? t.invoiceNote : null },
    { step: 'PAID', done: t.status === 'CLOSED', at: t.status === 'CLOSED' ? t.paidAt : null, note: null },
  ];
  const firstTodo = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({
    step: s.step,
    state: s.done ? 'DONE' : i === firstTodo && t.status !== 'CANCELLED' ? 'CURRENT' : 'TODO',
    at: s.at,
    note: s.note,
  }));
};

export type DueLabel = 'DUE_TODAY' | 'OVERDUE' | 'UPCOMING';

/** Whole days from `today` to `dateIso` (both `YYYY-MM-DD`); negative when the date has passed. */
export const dayDiff = (dateIso: string, todayIso: string): number =>
  Math.round((Date.parse(`${dateIso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86_400_000);

/**
 * Days to the date that matters now: the expected delivery for an approved or sent order, the invoice due date for an
 * invoiced one, otherwise nothing.
 */
export const dueInDaysOf = (o: { status: OrderStatus; expectedDate: string | null; invoiceDueDate: string | null }, todayIso: string): number | null => {
  if ((o.status === 'APPROVED' || o.status === 'SENT') && o.expectedDate) return dayDiff(o.expectedDate, todayIso);
  if (o.status === 'INVOICED' && o.invoiceDueDate) return dayDiff(o.invoiceDueDate, todayIso);
  return null;
};

export const dueLabelOf = (dueInDays: number | null): DueLabel | null => (dueInDays === null ? null : dueInDays < 0 ? 'OVERDUE' : dueInDays === 0 ? 'DUE_TODAY' : 'UPCOMING');
