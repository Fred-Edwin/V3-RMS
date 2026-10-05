import type { Capability } from '../../_shared/lib/capabilities';
import { amountInWords } from '../lib/amount-in-words';
import {
  PurchasingError,
  type ActivityEntry,
  type AuditArea,
  type AuditRow,
  type CancelReason,
  type DocumentInput,
  type FileDocument,
  type CatalogResult,
  type DepositInput,
  type Delivery,
  type FileRef,
  type Invoice,
  type InvoiceInput,
  type LineResult,
  type LpoPrint,
  type NeedsGroup,
  type NeedsLine,
  type NeedsQuery,
  type NeedsRestocking,
  type Order,
  type OrderCan,
  type OrderInput,
  type OrderLine,
  type OrderMoney,
  type OrderRow,
  type OrdersQuery,
  type OrderStatus,
  type Payment,
  type PaymentAdvice,
  type PaymentInput,
  type PaymentResult,
  type Person,
  type PurchaseFile,
  type ReceiveInput,
  type ReverseReason,
  type SendVia,
  type Stage,
  type StatementLine,
  type Summary,
  type SupplierCard,
  type SupplierOwing,
  type SupplierPurchasing,
  type SupplierStatement,
  type TrackerItem,
  type VoidReason,
  type WhatsappMessage,
} from '../types';
import { DEMO_PIN, ITEMS, KRA_PINS, LINES, PEOPLE, SUPPLIERS, type FixtureItem, type FixtureLine, type FixtureSupplier } from './fixtures';

/**
 * The mock engine: the business rules of `purchasing-mock/backend-rules.md` as pure functions over a plain state object.
 * A write mutates the `State` it is given and returns the new view; the service clones the state first and keeps the
 * result only if nothing threw. Every function takes the caller (`Ctx`) so access follows the one permissions table, never
 * a role name. Time is passed in so tests are exact.
 */
export interface Ctx {
  actor: Person;
  can: (capability: Capability) => boolean;
}

interface StoredLine {
  id: string;
  itemId: string;
  qty: number;
  unitPrice: number;
  previousPrice: number | null;
  deliveryPrice: number | null;
  receivedQty: number | null;
  confirmedPrice: number | null;
  result: LineResult | null;
}

interface StoredOrder {
  id: string;
  reference: string | null;
  status: OrderStatus;
  supplierId: string;
  raisedBy: Person;
  raisedAt: string;
  submittedAt: string | null;
  approvedBy: (Person & { signedAt: string }) | null;
  returnedNote: string | null;
  returnedBy: { id: string; name: string } | null;
  sentAt: string | null;
  sentVia: SendVia | null;
  expectedDate: string | null;
  supplierNote: string | null;
  attendantNote: string | null;
  lines: StoredLine[];
  delivery: Delivery | null;
  /** The one live invoice (a voided one moves to `voidedInvoices`). */
  invoice: Invoice | null;
  voidedInvoices: Invoice[];
  payments: Payment[];
  /** Documents added by hand to the file (Paper "+ Add a document"). */
  extraDocs: FileDocument[];
  cancelled: Order['cancelled'];
  activity: ActivityEntry[];
}

export interface State {
  version: number;
  scenario: string;
  seq: number;
  counters: { LPO: number; PAY: number; GRN: number };
  orders: StoredOrder[];
  files: Record<string, FileRef>;
}

export const STATE_VERSION = 2;
export const emptyState = (scenario = 'fresh'): State => ({ version: STATE_VERSION, scenario, seq: 0, counters: { LPO: 0, PAY: 0, GRN: 0 }, orders: [], files: {} });

// ---------------------------------------------------------------- helpers

const money = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);
const qtyStr = (n: number): string => String(Math.round(n * 1000) / 1000);
const num = (s: string): number => Number.parseFloat(s);
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
const dayDiff = (iso: string, now: Date): number => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${isoDay(now)}T00:00:00Z`)) / 86_400_000);
const pad = (n: number, w = 4): string => String(n).padStart(w, '0');

const METHOD_WORD: Record<string, string> = { BANK_TRANSFER: 'Bank transfer', MPESA_PAYBILL: 'M-Pesa Paybill', MPESA_TILL: 'M-Pesa Till', MPESA_SEND_MONEY: 'M-Pesa', CHEQUE: 'Cheque', CASH: 'Cash' };
const VOID_WORD: Record<VoidReason, string> = { WRONG_AMOUNT: 'Wrong amount entered', WRONG_SUPPLIER_OR_ORDER: 'Wrong supplier or order', DUPLICATE: 'Duplicate', OTHER: 'Other' };
const REVERSE_WORD: Record<ReverseReason, string> = { WRONG_AMOUNT: 'Wrong amount', WRONG_REFERENCE: 'Wrong reference number', WRONG_INVOICE: 'Wrong invoice', PAYMENT_BOUNCED: 'Payment bounced', OTHER: 'Other' };

const supplierOf = (id: string): FixtureSupplier => {
  const s = SUPPLIERS.find((x) => x.id === id);
  if (!s) throw new PurchasingError('VALIDATION', 'Unknown supplier');
  return s;
};
const itemOf = (id: string): FixtureItem => {
  const i = ITEMS.find((x) => x.id === id);
  if (!i) throw new PurchasingError('VALIDATION', 'Unknown item');
  return i;
};
const lineOf = (supplierId: string, itemId: string): FixtureLine | undefined => LINES.find((l) => l.supplierId === supplierId && l.itemId === itemId);

const termsLabelOf = (s: FixtureSupplier): string => (s.termsDays ? `Regular · Invoice ${s.termsDays} days` : 'Regular · Cash on delivery');

const forbidden = (): PurchasingError => new PurchasingError('FORBIDDEN', 'You do not have permission to perform this action');
const needAny = (ctx: Ctx, ...caps: Capability[]): void => {
  if (!caps.some((c) => ctx.can(c))) throw forbidden();
};
const checkPin = (pin: string): void => {
  if (pin !== DEMO_PIN) throw new PurchasingError('INVALID_PIN', 'That PIN is not right.');
};
const nextId = (s: State, prefix: string): string => `${prefix}-${++s.seq}`;
const nextRef = (s: State, prefix: 'LPO' | 'PAY' | 'GRN'): string => `${prefix}-${pad(++s.counters[prefix])}`;

const OPEN: OrderStatus[] = ['DRAFT', 'AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'];

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

const orderedTotalOf = (o: StoredOrder): number => o.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
const deliveredTotalOf = (o: StoredOrder): number | null =>
  o.delivery ? o.lines.reduce((t, l) => t + (l.receivedQty ?? 0) * (l.confirmedPrice ?? l.unitPrice), 0) : null;
/** Money actually out: recorded advances and invoice payments. A reversed payment and its REVERSAL line both drop out. */
const paidOf = (o: StoredOrder): number => o.payments.filter((p) => p.status === 'RECORDED' && p.kind !== 'REVERSAL').reduce((t, p) => t + num(p.amount), 0);
const advancesOf = (o: StoredOrder): number => o.payments.filter((p) => p.kind === 'ADVANCE' && p.status === 'RECORDED').reduce((t, p) => t + num(p.amount), 0);
const invoicePaidOf = (o: StoredOrder): number => o.payments.filter((p) => p.kind === 'INVOICE' && p.status === 'RECORDED').reduce((t, p) => t + num(p.amount), 0);

/**
 * Recompute the live invoice from what has been paid, and move the order between To pay and Closed. Call after anything that
 * changes an advance, a payment, a dispute or the invoice itself. An advance is applied up to the invoice amount; anything
 * above stays as credit with the supplier.
 */
function refreshInvoice(o: StoredOrder): void {
  const inv = o.invoice;
  if (!inv) return;
  const amount = num(inv.amount);
  const applied = Math.min(advancesOf(o), amount);
  const balance = Math.max(amount - applied - invoicePaidOf(o), 0);
  inv.advanceApplied = money(applied);
  inv.balance = money(balance);
  inv.status = balance < 0.005 && !inv.disputed ? 'PAID' : 'OPEN';
  o.status = inv.status === 'PAID' ? 'CLOSED' : 'INVOICED';
}

const addDaysIso = (iso: string, days: number): string => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

interface Audit {
  action: string;
  area?: AuditArea;
  document: string | null;
  detail: string;
}

/** Record what happened on an order: the sentence for the Activity tab and the structured row for the Audit log. */
const log = (o: StoredOrder, ctx: Ctx, what: string, now: Date, audit: Audit): void => {
  o.activity.unshift({
    at: now.toISOString(),
    actor: { id: ctx.actor.id, name: ctx.actor.name, role: ctx.actor.role },
    what,
    action: audit.action,
    area: audit.area ?? 'Purchasing',
    document: audit.document,
    detail: audit.detail,
  });
};

// ---------------------------------------------------------------- views

const tracker = (o: StoredOrder): TrackerItem[] => {
  const steps: Array<{ step: TrackerItem['step']; done: boolean; at: string | null; note: string | null }> = [
    { step: 'RAISED', done: o.status !== 'DRAFT', at: o.submittedAt ?? o.raisedAt, note: null },
    { step: 'APPROVED', done: !!o.approvedBy, at: o.approvedBy?.signedAt ?? null, note: o.approvedBy ? 'PIN' : null },
    { step: 'SENT', done: !!o.sentAt, at: o.sentAt, note: o.sentVia ? ({ WHATSAPP: 'WhatsApp', PRINT: 'Printed', LINK: 'Link', MANUAL: 'Phoned in' } as const)[o.sentVia] : null },
    {
      step: 'DELIVERED',
      done: !!o.delivery,
      at: o.delivery?.receivedAt ?? null,
      note: o.delivery && o.lines.some((l) => l.result === 'SHORT' || l.result === 'NOT_SUPPLIED') ? 'short' : null,
    },
    { step: 'INVOICED', done: !!o.invoice, at: o.invoice?.enteredAt ?? null, note: o.invoice ? (o.invoice.disputed ? 'disputed' : o.invoice.settled ? 'settled' : null) : null },
    {
      step: 'PAID',
      done: o.status === 'CLOSED',
      at: o.status === 'CLOSED' ? ([...o.payments].reverse().find((p) => p.kind === 'INVOICE' && p.status === 'RECORDED')?.recordedAt ?? o.invoice?.enteredAt ?? null) : null,
      note: null,
    },
  ];
  const firstTodo = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ step: s.step, state: s.done ? 'DONE' : i === firstTodo && o.status !== 'CANCELLED' ? 'CURRENT' : 'TODO', at: s.at, note: s.note }));
};

const canOf = (o: StoredOrder, ctx: Ctx): OrderCan => {
  const mine = o.raisedBy.id === ctx.actor.id;
  const editable = (o.status === 'DRAFT' || o.status === 'RETURNED') && (mine || ctx.can('orders.approve'));
  return {
    edit: editable && ctx.can('orders.request'),
    submit: editable && ctx.can('orders.request'),
    approve: ctx.can('orders.approve') && (o.status === 'AWAITING_APPROVAL' || o.status === 'DRAFT'),
    return: ctx.can('orders.approve') && o.status === 'AWAITING_APPROVAL',
    send: (ctx.can('orders.approve') || ctx.can('orders.request')) && (o.status === 'APPROVED' || o.status === 'SENT'),
    cancel: ctx.can('orders.cancel') && ['AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'].includes(o.status),
    receive: ctx.can('orders.receive') && (o.status === 'APPROVED' || o.status === 'SENT'),
    recordDeposit: ctx.can('payables.record_deposit') && ['APPROVED', 'SENT', 'DELIVERED', 'INVOICED'].includes(o.status),
    addInvoice: ctx.can('payables.record_invoice') && o.status === 'DELIVERED',
    recordPayment: ctx.can('payables.record_payment') && o.status === 'INVOICED' && !!o.invoice && !o.invoice.disputed,
    settleDispute: ctx.can('payables.record_invoice') && o.status === 'INVOICED' && !!o.invoice?.disputed,
    // An invoice can be voided only while nothing is paid against it; otherwise the payment is reversed first.
    voidInvoice: ctx.can('payables.record_invoice') && o.status === 'INVOICED' && !!o.invoice && invoicePaidOf(o) === 0,
    reversePayment: ctx.can('payables.record_payment') && (o.status === 'INVOICED' || o.status === 'CLOSED') && invoicePaidOf(o) > 0,
    addDocument: o.status !== 'DRAFT' && (ctx.can('payables.record_invoice') || ctx.can('payables.record_payment') || ctx.can('orders.approve')),
  };
};

const supplierCard = (sup: FixtureSupplier, ctx: Ctx): SupplierCard => ({
  id: sup.id,
  name: sup.name,
  code: sup.code,
  contactName: sup.contactName,
  whatsapp: sup.whatsapp,
  termsDays: sup.termsDays,
  payMethods: ctx.can('suppliers.read_payment_details') ? sup.payMethods : [],
});

function viewLine(l: StoredLine, o: StoredOrder, ctx: Ctx): OrderLine {
  const item = itemOf(l.itemId);
  const fl = lineOf(o.supplierId, l.itemId);
  const showMoney = ctx.can('payables.read');
  const changed = l.deliveryPrice !== null && l.deliveryPrice !== l.unitPrice;
  return {
    id: l.id,
    inventoryItemId: l.itemId,
    itemName: item.name,
    supplierItemName: fl?.supplierItemName ?? null,
    supplierItemCode: fl?.supplierItemCode ?? null,
    buyUnit: fl?.buyUnit ?? item.usageUnit,
    packSize: fl ? String(fl.pack) : null,
    orderedQty: qtyStr(l.qty),
    unitPrice: showMoney ? money(l.unitPrice) : '',
    lineTotal: showMoney ? money(l.qty * l.unitPrice) : '',
    previousPrice: showMoney && l.previousPrice !== null ? money(l.previousPrice) : null,
    deliveryPrice: showMoney && l.deliveryPrice !== null ? money(l.deliveryPrice) : null,
    priceChanged: changed,
    receivedQty: l.receivedQty === null ? null : qtyStr(l.receivedQty),
    confirmedPrice: showMoney && l.confirmedPrice !== null ? money(l.confirmedPrice) : null,
    result: l.result,
  };
}

export function viewOrder(o: StoredOrder, ctx: Ctx, now: Date): Order {
  const showMoney = ctx.can('payables.read');
  const ordered = orderedTotalOf(o);
  const delivered = deliveredTotalOf(o);
  const paid = paidOf(o);
  const base = delivered ?? ordered;
  const dueIn =
    o.expectedDate && (o.status === 'APPROVED' || o.status === 'SENT')
      ? dayDiff(o.expectedDate, now)
      : o.status === 'INVOICED' && o.invoice
        ? dayDiff(o.invoice.dueDate, now)
        : null;
  const m: OrderMoney = {
    ordered: money(ordered),
    delivered: delivered === null ? null : money(delivered),
    invoiced: o.invoice ? o.invoice.amount : null,
    paid: money(paid),
    stillToPay: o.invoice ? o.invoice.balance : money(Math.max(base - paid, 0)),
  };
  return {
    id: o.id,
    reference: o.reference,
    status: o.status,
    stage: stageOf(o.status),
    supplier: supplierCard(supplierOf(o.supplierId), ctx),
    raisedBy: o.raisedBy,
    raisedAt: o.raisedAt,
    submittedAt: o.submittedAt,
    approvedBy: o.approvedBy,
    returnedNote: o.returnedNote,
    returnedBy: o.returnedBy,
    sentAt: o.sentAt,
    sentVia: o.sentVia,
    expectedDate: o.expectedDate,
    supplierNote: o.supplierNote,
    attendantNote: o.attendantNote,
    lines: o.lines.map((l) => viewLine(l, o, ctx)),
    orderedTotal: showMoney ? money(ordered) : '',
    deliveredTotal: showMoney && delivered !== null ? money(delivered) : null,
    delivery: o.delivery && !showMoney ? { ...o.delivery, deliveredTotal: '', notSuppliedTotal: '' } : o.delivery,
    invoice: showMoney ? o.invoice : null,
    payments: showMoney ? o.payments : [],
    money: showMoney ? m : null,
    dueLabel: dueIn === null ? null : dueIn < 0 ? 'OVERDUE' : dueIn === 0 ? 'DUE_TODAY' : 'UPCOMING',
    dueInDays: dueIn,
    cancelled: o.cancelled,
    tracker: tracker(o),
    can: canOf(o, ctx),
  };
}

const itemSummary = (o: StoredOrder): string => {
  const names = o.lines.map((l) => itemOf(l.itemId).name);
  const short = names.slice(0, 3).map((n) => n.toLowerCase());
  const more = names.length > 3 ? ` and ${names.length - 3} more` : '';
  return `${names.length} item${names.length === 1 ? '' : 's'} · ${short.join(', ')}${more}`;
};

/** What happened at the delivery, in a line: "4 items · 1 short · price change on salt cooking oil". Null before delivery. */
const deliverySummary = (o: StoredOrder): string | null => {
  if (!o.delivery) return null;
  const n = o.lines.length;
  const short = o.lines.filter((l) => l.result === 'SHORT' || l.result === 'NOT_SUPPLIED').length;
  const changed = o.lines.filter((l) => l.result === 'PRICE_CHANGED' || (l.confirmedPrice !== null && l.confirmedPrice !== l.unitPrice));
  const parts = [`${n} item${n === 1 ? '' : 's'}`];
  if (short) parts.push(`${short} short`);
  if (changed.length) parts.push(`price change on ${itemOf((changed[0] as StoredLine).itemId).name.toLowerCase().split(' ').slice(0, 3).join(' ')}`);
  if (!short && !changed.length) parts.push(o.lines.slice(0, 2).map((l) => itemOf(l.itemId).name.toLowerCase()).join(', '));
  return parts.join(' · ');
};

function visible(o: StoredOrder, ctx: Ctx): boolean {
  if (ctx.can('orders.read')) return true;
  // Phone roles see what they raised and what is due to be received.
  return o.raisedBy.id === ctx.actor.id || o.delivery?.receivedBy.id === ctx.actor.id || (ctx.can('orders.receive') && stageOf(o.status) === 'RECEIVE');
}

function find(s: State, id: string): StoredOrder {
  const o = s.orders.find((x) => x.id === id);
  if (!o) throw new PurchasingError('ORDER_NOT_FOUND', 'That order does not exist.');
  return o;
}
function wrongState(o: StoredOrder): PurchasingError {
  return new PurchasingError('ORDER_WRONG_STATE', `This order is ${o.status.toLowerCase().replace('_', ' ')}, so you cannot do that.`);
}

// ---------------------------------------------------------------- reads

export function getSummary(s: State, ctx: Ctx, now: Date): Summary {
  needAny(ctx, 'orders.read', 'orders.request', 'orders.receive');
  const mine = s.orders.filter((o) => visible(o, ctx));
  const stageCount = (st: Stage): number => mine.filter((o) => stageOf(o.status) === st).length;
  const approvalValue = mine.filter((o) => o.status === 'AWAITING_APPROVAL').reduce((t, o) => t + orderedTotalOf(o), 0);
  const dueToReceive = mine.filter((o) => (o.status === 'SENT' || o.status === 'APPROVED') && o.expectedDate !== null && dayDiff(o.expectedDate, now) <= 0).length;
  return {
    counts: {
      needs: needsRestocking(s, ctx, {}).itemCount,
      approval: stageCount('APPROVAL'),
      receive: stageCount('RECEIVE'),
      invoice: stageCount('INVOICE'),
      pay: stageCount('PAY'),
      closed: stageCount('CLOSED'),
    },
    awaitingApprovalValue: ctx.can('payables.read') ? money(approvalValue) : '',
    dueToReceiveCount: dueToReceive,
  };
}

export function needsRestocking(s: State, ctx: Ctx, q: NeedsQuery): NeedsRestocking {
  needAny(ctx, 'orders.read', 'orders.request');
  const showMoney = ctx.can('payables.read');
  const onOpen = new Set(s.orders.filter((o) => OPEN.includes(o.status)).flatMap((o) => o.lines.map((l) => l.itemId)));
  const search = q.q?.trim().toLowerCase();
  const lines: NeedsLine[] = [];
  for (const item of ITEMS) {
    if (item.level <= 0 || item.onHand >= item.level || !item.setupDone || onOpen.has(item.id)) continue;
    if (search && !item.name.toLowerCase().includes(search)) continue;
    const options = LINES.filter((l) => l.itemId === item.id && !supplierOf(l.supplierId).onHold);
    const chosen = [...options].sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.price - b.price)[0];
    if (q.supplierId && chosen?.supplierId !== q.supplierId) continue;
    const need = item.level - item.onHand;
    const suggested = chosen ? Math.ceil(need / chosen.pack) : null;
    lines.push({
      inventoryItemId: item.id,
      itemName: item.name,
      subLabel: chosen ? `${item.category} · bought by the ${chosen.buyUnit}${chosen.pack > 1 ? ` (${chosen.pack} ${item.usageUnit})` : ''}` : `${item.category} · never bought before`,
      status: item.onHand === 0 ? 'OUT' : 'LOW',
      onHand: qtyStr(item.onHand),
      level: qtyStr(item.level),
      usageUnit: item.usageUnit,
      supplierOptions: options.map((o) => ({
        supplierId: o.supplierId,
        name: supplierOf(o.supplierId).name,
        lastPrice: showMoney ? money(o.price) : '',
        lastBoughtAt: o.lastBoughtAt,
        preferred: o.preferred,
        cheaperBy: showMoney && chosen && o.price < chosen.price ? money(chosen.price - o.price) : null,
      })),
      chosenSupplierId: chosen?.supplierId ?? null,
      suggestedQty: suggested === null ? null : String(suggested),
      buyUnit: chosen?.buyUnit ?? null,
      lastPrice: showMoney && chosen ? money(chosen.price) : null,
      estimatedTotal: showMoney && chosen && suggested !== null ? money(suggested * chosen.price) : null,
    });
  }
  const sorted = [...lines].sort((a, b) => {
    if (q.sort === 'name') return a.itemName.localeCompare(b.itemName);
    if (q.sort === 'value') return num(b.estimatedTotal ?? '0') - num(a.estimatedTotal ?? '0');
    return Number(b.status === 'OUT') - Number(a.status === 'OUT') || num(a.onHand) / num(a.level) - num(b.onHand) / num(b.level);
  });
  const bySupplier = new Map<string, NeedsLine[]>();
  for (const l of sorted) {
    const key = l.chosenSupplierId ?? '';
    bySupplier.set(key, [...(bySupplier.get(key) ?? []), l]);
  }
  const groups: NeedsGroup[] = Array.from(bySupplier.entries())
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0))
    .map(([id, ls]) => {
      const sup = id ? supplierOf(id) : null;
      return {
        supplier: sup ? { id: sup.id, name: sup.name, code: sup.code } : null,
        termsLabel: sup ? termsLabelOf(sup) : null,
        itemCount: ls.length,
        estimatedTotal: showMoney ? money(ls.reduce((t, l) => t + num(l.estimatedTotal ?? '0'), 0)) : '',
        lines: ls,
      };
    });
  return {
    itemCount: sorted.length,
    supplierCount: groups.filter((g) => g.supplier).length,
    groups,
    suppliers: SUPPLIERS.filter((x) => !x.onHold).map((x) => ({ id: x.id, name: x.name, code: x.code, termsLabel: termsLabelOf(x) })),
  };
}

export function listOrders(s: State, ctx: Ctx, q: OrdersQuery, now: Date): { orders: OrderRow[]; total: number; valueTotal: string } {
  needAny(ctx, 'orders.read', 'orders.request', 'orders.receive');
  const search = q.q?.trim().toLowerCase();
  const rows = s.orders
    .filter((o) => visible(o, ctx))
    .filter((o) => !q.stage || stageOf(o.status) === q.stage)
    .filter((o) => !q.supplierId || o.supplierId === q.supplierId)
    .filter((o) => !q.raisedBy || o.raisedBy.id === q.raisedBy)
    .filter((o) => !search || (o.reference ?? '').toLowerCase().includes(search) || supplierOf(o.supplierId).name.toLowerCase().includes(search))
    .sort((a, b) => (b.submittedAt ?? b.raisedAt).localeCompare(a.submittedAt ?? a.raisedAt));
  const orders = rows.map((o): OrderRow => {
    const { lines: _lines, ...rest } = viewOrder(o, ctx, now);
    void _lines;
    return { ...rest, itemSummary: itemSummary(o), deliverySummary: deliverySummary(o) };
  });
  return { orders, total: orders.length, valueTotal: ctx.can('payables.read') ? money(rows.reduce((t, o) => t + orderedTotalOf(o), 0)) : '' };
}

export function getOrder(s: State, ctx: Ctx, id: string, now: Date): PurchaseFile {
  needAny(ctx, 'orders.read', 'orders.request', 'orders.receive');
  const o = find(s, id);
  if (!visible(o, ctx)) throw forbidden();
  const money$ = ctx.can('payables.read');
  const documents: FileDocument[] = [];
  const itemCount = `${o.lines.length} item${o.lines.length === 1 ? '' : 's'}`;
  if (o.approvedBy) {
    documents.push({
      kind: 'LPO',
      title: 'Local purchase order',
      subtitle: `${o.reference} · ${itemCount}${money$ ? ` · KES ${kes0(orderedTotalOf(o))}` : ''}`,
      step: 'Ordered',
      at: o.approvedBy.signedAt,
      addedBy: o.approvedBy.name,
      fileRef: null,
      action: 'Print',
      paymentId: null,
    });
  }
  if (o.delivery) {
    documents.push({ kind: 'DELIVERY_NOTE', title: 'Delivery note photo', subtitle: `${o.delivery.deliveryNoteNo}${o.delivery.photo ? ` · ${o.delivery.photo.fileName}` : ''}`, step: 'Delivered', at: o.delivery.receivedAt, addedBy: o.delivery.receivedBy.name, fileRef: o.delivery.photo, action: 'View', paymentId: null });
    documents.push({
      kind: 'GOODS_RECEIPT',
      title: 'Goods receipt',
      subtitle: `${o.delivery.reference} · signed with PIN${money$ ? ` · KES ${kes0(num(o.delivery.deliveredTotal))}` : ''}`,
      step: 'Delivered',
      at: o.delivery.receivedAt,
      addedBy: o.delivery.receivedBy.name,
      fileRef: null,
      action: 'Open',
      paymentId: null,
    });
  }
  if (money$) {
    if (o.invoice) {
      documents.push({
        kind: 'INVOICE',
        title: "Supplier's invoice",
        subtitle: `${o.invoice.number} · KES ${kes0(num(o.invoice.amount))}${o.invoice.photo ? ` · ${o.invoice.photo.fileName}` : ''}`,
        step: 'Invoiced',
        at: o.invoice.enteredAt,
        addedBy: o.invoice.enteredBy.name,
        fileRef: o.invoice.photo,
        action: 'View',
        paymentId: null,
      });
    }
    for (const p of o.payments.filter((x) => x.kind !== 'REVERSAL')) {
      documents.push({
        kind: p.kind === 'ADVANCE' ? 'ADVANCE_ADVICE' : 'PAYMENT_ADVICE',
        title: p.kind === 'ADVANCE' ? 'Advance payment advice' : 'Payment advice',
        subtitle: `${p.reference} · KES ${kes0(num(p.amount))} · ${p.chequeNo ? `Cheque ${p.chequeNo}` : `${METHOD_WORD[p.method]}${p.methodRef ? ` ${p.methodRef}` : ''}`}${p.status === 'REVERSED' ? ' · reversed' : ''}`,
        step: 'Paid',
        at: p.recordedAt,
        addedBy: p.recordedBy.name,
        fileRef: null,
        action: 'Print',
        paymentId: p.id,
      });
    }
  }
  documents.push(...o.extraDocs);
  return { ...viewOrder(o, ctx, now), documents, activity: o.activity };
}

const kes0 = (n: number): string => Math.round(n).toLocaleString('en-US');

/** Paper "+ Add a document": attach a photo or PDF (the supplier's receipt, a signed letter) to the purchase file. */
export function addDocument(s: State, ctx: Ctx, orderId: string, input: DocumentInput, now: Date): FileDocument {
  const o = find(s, orderId);
  if (!canOf(o, ctx).addDocument) throw forbidden();
  if (!input.title.trim()) throw new PurchasingError('VALIDATION', 'Give the document a name.');
  const file = s.files[input.fileId];
  if (!file) throw new PurchasingError('VALIDATION', 'Add the photo or PDF first.');
  const doc: FileDocument = { kind: 'OTHER', title: input.title.trim(), subtitle: file.fileName, step: o.status === 'CLOSED' ? 'Paid' : o.invoice ? 'Invoiced' : o.delivery ? 'Delivered' : 'Ordered', at: now.toISOString(), addedBy: ctx.actor.name, fileRef: file, action: 'View', paymentId: null };
  o.extraDocs.push(doc);
  log(o, ctx, `added the document "${doc.title}"`, now, { action: 'Added document', document: o.reference, detail: `${doc.title} · ${file.fileName}` });
  return doc;
}

export function lpoPrint(s: State, ctx: Ctx, id: string, now: Date): LpoPrint {
  needAny(ctx, 'orders.read', 'orders.request');
  const o = find(s, id);
  const sup = supplierOf(o.supplierId);
  const total = orderedTotalOf(o);
  return {
    reference: o.reference ?? 'DRAFT',
    date: (o.submittedAt ?? o.raisedAt).slice(0, 10),
    supplier: { name: sup.name, address: sup.address, contact: sup.contactName, phone: sup.whatsapp },
    expectedDate: o.expectedDate,
    termsLabel: sup.termsDays ? `Invoice, ${sup.termsDays} days` : 'Cash on delivery',
    deliverTo: 'Wendo Central Store',
    raisedByName: o.raisedBy.name,
    lines: o.lines.map((l, i) => {
      const fl = lineOf(o.supplierId, l.itemId);
      const item = itemOf(l.itemId);
      return {
        n: i + 1,
        supplierItemName: fl?.supplierItemName ?? item.name.toUpperCase(),
        supplierItemCode: fl?.supplierItemCode ?? null,
        ourItemName: item.name,
        qty: qtyStr(l.qty),
        unit: fl?.buyUnit ?? item.usageUnit,
        price: money(l.unitPrice),
        total: money(l.qty * l.unitPrice),
      };
    }),
    total: money(total),
    amountInWords: amountInWords(total),
    note: o.supplierNote,
    raisedBy: { name: o.raisedBy.name, role: o.raisedBy.role, signedAt: o.submittedAt ?? o.raisedAt },
    authorisedBy: o.approvedBy ? { name: o.approvedBy.name, role: o.approvedBy.role, signedAt: o.approvedBy.signedAt } : null,
    generatedAt: now.toISOString(),
  };
}

export function whatsappMessage(s: State, ctx: Ctx, id: string): WhatsappMessage {
  needAny(ctx, 'orders.approve', 'orders.request');
  const o = find(s, id);
  const sup = supplierOf(o.supplierId);
  const first = (sup.contactName ?? 'there').split(' ')[0];
  return {
    to: `${sup.contactName ?? sup.name} · ${sup.name}${sup.whatsapp ? ` · ${sup.whatsapp}` : ''}`,
    phone: sup.whatsapp,
    message: `Hello ${first}, please find attached our local purchase order ${o.reference}${o.expectedDate ? ` for delivery on ${new Date(`${o.expectedDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}. Please confirm receipt and quote ${o.reference} on your delivery note. Thank you, Wendo Coffee Bistro.`,
    pdfFileName: `${o.reference}.pdf`,
    pdfSizeLabel: '96 KB · ready',
  };
}

export function catalog(s: State, ctx: Ctx, q: { supplierId: string; q?: string; filter?: 'low' | 'all' | 'selected' }): CatalogResult {
  needAny(ctx, 'orders.request');
  const showMoney = ctx.can('payables.read');
  const search = q.q?.trim().toLowerCase();
  const all = LINES.filter((l) => l.supplierId === q.supplierId).map((l) => {
    const item = itemOf(l.itemId);
    const status = item.onHand === 0 && item.level > 0 ? 'OUT' : item.level > 0 && item.onHand < item.level ? 'LOW' : 'OK';
    const suggested = status === 'OK' ? null : String(Math.ceil((item.level - item.onHand) / l.pack));
    return { inventoryItemId: item.id, itemName: item.name, category: item.category, status, onHand: qtyStr(item.onHand), level: qtyStr(item.level), soldAs: `${l.buyUnit}${l.pack > 1 ? ` (${l.pack} ${item.usageUnit})` : ''}`, buyUnit: l.buyUnit, price: showMoney ? money(l.price) : '', qty: suggested } as const;
  });
  const lowOrOut = all.filter((i) => i.status !== 'OK');
  const base = q.filter === 'all' ? all : lowOrOut;
  const items = base.filter((i) => !search || i.itemName.toLowerCase().includes(search)).map((i) => ({ ...i }));
  void s;
  return { items, shown: items.length, total: all.length, counts: { lowOrOut: lowOrOut.length, all: all.length } };
}

// ---------------------------------------------------------------- order writes

function buildLines(s: State, supplierId: string, input: OrderInput): StoredLine[] {
  if (!input.lines.length) throw new PurchasingError('VALIDATION', 'Add at least one item to the order.');
  return input.lines.map((l) => {
    const item = itemOf(l.inventoryItemId);
    if (!item.setupDone) throw new PurchasingError('ITEM_SETUP_INCOMPLETE', `${item.name} is not set up yet, so it cannot be ordered.`);
    const qty = num(l.qty);
    // A caller who may not see money (the Attendant) sends no price; the supplier's usual price is used.
    const price = l.unitPrice === '' ? (lineOf(supplierId, item.id)?.price ?? Number.NaN) : num(l.unitPrice);
    if (!(qty > 0) || !(price >= 0)) throw new PurchasingError('VALIDATION', 'Quantities must be more than zero.');
    const prior = [...s.orders]
      .filter((o) => o.supplierId === supplierId && o.status !== 'DRAFT' && o.status !== 'CANCELLED')
      .flatMap((o) => o.lines.filter((x) => x.itemId === item.id).map((x) => x.unitPrice));
    return { id: nextId(s, 'ln'), itemId: item.id, qty, unitPrice: price, previousPrice: prior.length ? (prior[prior.length - 1] ?? null) : null, deliveryPrice: null, receivedQty: null, confirmedPrice: null, result: null };
  });
}

export function createOrder(s: State, ctx: Ctx, input: OrderInput, now: Date): Order {
  needAny(ctx, 'orders.request');
  const sup = supplierOf(input.supplierId);
  if (sup.onHold) throw new PurchasingError('SUPPLIER_ON_HOLD', `${sup.name} is on hold.`);
  const open = s.orders.find((o) => o.supplierId === sup.id && OPEN.includes(o.status));
  if (open) throw new PurchasingError('SUPPLIER_ORDER_OPEN', `${open.reference ?? 'A draft'} to ${sup.name} is still open.`, { openOrderId: open.id, openReference: open.reference });
  const o: StoredOrder = {
    id: nextId(s, 'ord'),
    reference: null,
    status: 'DRAFT',
    supplierId: sup.id,
    raisedBy: ctx.actor,
    raisedAt: now.toISOString(),
    submittedAt: null,
    approvedBy: null,
    returnedNote: null,
    returnedBy: null,
    sentAt: null,
    sentVia: null,
    expectedDate: input.expectedDate,
    supplierNote: input.supplierNote,
    attendantNote: input.attendantNote,
    lines: buildLines(s, sup.id, input),
    delivery: null,
    invoice: null,
    voidedInvoices: [],
    payments: [],
    extraDocs: [],
    cancelled: null,
    activity: [],
  };
  log(o, ctx, 'saved a draft', now, { action: 'Saved draft order', document: null, detail: `${sup.name} · ${o.lines.length} item${o.lines.length === 1 ? '' : 's'}` });
  s.orders.push(o);
  return viewOrder(o, ctx, now);
}

export function updateOrder(s: State, ctx: Ctx, id: string, input: Partial<OrderInput>, now: Date): Order {
  const o = find(s, id);
  if (!canOf(o, ctx).edit) {
    if (o.status !== 'DRAFT' && o.status !== 'RETURNED') throw wrongState(o);
    throw forbidden();
  }
  if (input.lines) o.lines = buildLines(s, o.supplierId, { ...(input as OrderInput), supplierId: o.supplierId });
  if (input.expectedDate !== undefined) o.expectedDate = input.expectedDate;
  if (input.supplierNote !== undefined) o.supplierNote = input.supplierNote;
  if (input.attendantNote !== undefined) o.attendantNote = input.attendantNote;
  log(o, ctx, 'edited the order', now, { action: 'Edited order', document: o.reference, detail: `${o.lines.length} item${o.lines.length === 1 ? '' : 's'} · KES ${money(orderedTotalOf(o))}` });
  return viewOrder(o, ctx, now);
}

export function discardOrder(s: State, ctx: Ctx, id: string): void {
  const o = find(s, id);
  if (o.status !== 'DRAFT') throw wrongState(o);
  if (o.raisedBy.id !== ctx.actor.id && !ctx.can('orders.approve')) throw forbidden();
  s.orders = s.orders.filter((x) => x.id !== id);
}

export function submitOrder(s: State, ctx: Ctx, id: string, now: Date): Order {
  needAny(ctx, 'orders.request');
  const o = find(s, id);
  if (o.status !== 'DRAFT' && o.status !== 'RETURNED') throw wrongState(o);
  if (!o.reference) o.reference = nextRef(s, 'LPO');
  o.status = 'AWAITING_APPROVAL';
  o.submittedAt = now.toISOString();
  o.returnedNote = null;
  o.returnedBy = null;
  log(o, ctx, 'sent the order for approval', now, { action: 'Raised order', document: o.reference, detail: `To ${supplierOf(o.supplierId).name} · KES ${money(orderedTotalOf(o))} · sent for approval` });
  return viewOrder(o, ctx, now);
}

export function approveOrder(s: State, ctx: Ctx, id: string, pin: string, now: Date): Order {
  needAny(ctx, 'orders.approve');
  const o = find(s, id);
  if (o.status !== 'AWAITING_APPROVAL' && o.status !== 'DRAFT') throw wrongState(o);
  checkPin(pin);
  if (!o.reference) o.reference = nextRef(s, 'LPO');
  o.submittedAt ??= now.toISOString();
  o.status = 'APPROVED';
  o.approvedBy = { ...ctx.actor, signedAt: now.toISOString() };
  log(o, ctx, 'approved the order with a PIN', now, { action: 'Approved order', document: o.reference, detail: `To ${supplierOf(o.supplierId).name} · KES ${money(orderedTotalOf(o))} · signed with PIN` });
  return viewOrder(o, ctx, now);
}

export function returnOrder(s: State, ctx: Ctx, id: string, note: string, now: Date): Order {
  needAny(ctx, 'orders.approve');
  const o = find(s, id);
  if (o.status !== 'AWAITING_APPROVAL') throw wrongState(o);
  if (!note.trim()) throw new PurchasingError('REASON_REQUIRED', 'Say why you are sending it back.');
  o.status = 'RETURNED';
  o.returnedNote = note.trim();
  o.returnedBy = { id: ctx.actor.id, name: ctx.actor.name };
  log(o, ctx, `returned the order: ${note.trim()}`, now, { action: 'Returned order', document: o.reference, detail: note.trim() });
  return viewOrder(o, ctx, now);
}

export function sendOrder(s: State, ctx: Ctx, id: string, via: SendVia, now: Date): Order {
  needAny(ctx, 'orders.approve', 'orders.request');
  const o = find(s, id);
  if (o.status !== 'APPROVED' && o.status !== 'SENT') throw wrongState(o);
  if (o.status === 'APPROVED') {
    o.status = 'SENT';
    o.sentAt = now.toISOString();
    o.sentVia = via;
    const sup = supplierOf(o.supplierId);
    log(o, ctx, via === 'MANUAL' ? 'marked the order as sent' : `sent the order (${via.toLowerCase()})`, now, {
      action: via === 'WHATSAPP' ? 'Sent order on WhatsApp' : via === 'MANUAL' ? 'Marked order as sent' : via === 'PRINT' ? 'Printed order' : 'Copied order link',
      document: o.reference,
      detail: via === 'WHATSAPP' ? `To ${sup.contactName ?? sup.name}${sup.whatsapp ? `, ${sup.whatsapp}` : ''}` : via === 'MANUAL' ? `Phoned in to ${sup.name}` : `For ${sup.name}`,
    });
  }
  return viewOrder(o, ctx, now);
}

export function cancelOrder(s: State, ctx: Ctx, id: string, input: { reason: CancelReason; note: string | null; pin: string }, now: Date): Order {
  needAny(ctx, 'orders.cancel');
  const o = find(s, id);
  if (o.delivery || o.status === 'DELIVERED' || o.status === 'INVOICED' || o.status === 'CLOSED') {
    throw new PurchasingError('CANNOT_CANCEL_AFTER_DELIVERY', "Once goods have arrived an order can't be cancelled.");
  }
  if (!['AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'].includes(o.status)) throw wrongState(o);
  checkPin(input.pin);
  o.status = 'CANCELLED';
  o.cancelled = { reason: input.reason, note: input.note, by: { id: ctx.actor.id, name: ctx.actor.name }, at: now.toISOString() };
  log(o, ctx, 'cancelled the order', now, {
    action: 'Cancelled order',
    document: o.reference,
    detail: `${({ ORDERED_BY_MISTAKE: 'Ordered by mistake', SUPPLIER_CANNOT_SUPPLY: 'Supplier cannot supply', NO_LONGER_NEEDED: 'No longer needed', OTHER: 'Other' } as const)[input.reason]} · KES ${money(orderedTotalOf(o))}${input.note ? ` · ${input.note}` : ''}`,
  });
  return viewOrder(o, ctx, now);
}

// ---------------------------------------------------------------- deposit, uploads, receiving

export function recordDeposit(s: State, ctx: Ctx, id: string, input: DepositInput, now: Date): Payment {
  needAny(ctx, 'payables.record_deposit');
  const o = find(s, id);
  if (!['APPROVED', 'SENT', 'DELIVERED', 'INVOICED'].includes(o.status)) throw wrongState(o);
  const amount = num(input.amount);
  if (!(amount > 0)) throw new PurchasingError('VALIDATION', 'Enter an amount more than zero.');
  if (input.method === 'CHEQUE' && !input.chequeNo?.trim()) throw new PurchasingError('CHEQUE_NUMBER_REQUIRED', 'Enter the cheque number.');
  const advances = o.payments.filter((p) => p.kind === 'ADVANCE' && p.status === 'RECORDED').reduce((t, p) => t + num(p.amount), 0);
  if (advances + amount > orderedTotalOf(o) + 0.001) throw new PurchasingError('DEPOSIT_EXCEEDS_ORDER', 'An advance cannot be more than the order total.');
  const p: Payment = {
    id: nextId(s, 'pay'),
    reference: nextRef(s, 'PAY'),
    kind: 'ADVANCE',
    amount: money(amount),
    paidOn: input.paidOn,
    method: input.method,
    methodRef: input.methodRef,
    chequeNo: input.chequeNo,
    status: 'RECORDED',
    reversesId: null,
    reason: null,
    invoiceId: null,
    proof: null,
    approvedBy: null,
    recordedBy: ctx.actor,
    recordedAt: now.toISOString(),
  };
  o.payments.push(p);
  refreshInvoice(o);
  log(o, ctx, `recorded an advance of KES ${money(amount)} (${p.reference})`, now, {
    action: 'Recorded advance payment',
    area: 'Payments',
    document: p.reference,
    detail: `KES ${money(amount)} · ${METHOD_WORD[p.method]}${p.methodRef ? ` ${p.methodRef}` : ''} · for ${o.reference}`,
  });
  return p;
}

const MAX_UPLOAD = 10 * 1024 * 1024;
export function addUpload(s: State, file: { fileName: string; size: number; mime: string; thumbnail: string | null }): FileRef {
  if (file.size > MAX_UPLOAD) throw new PurchasingError('UPLOAD_TOO_LARGE', 'That file is too large. The limit is 10 MB.');
  if (!/^image\/|^application\/pdf$/.test(file.mime)) throw new PurchasingError('UPLOAD_BAD_TYPE', 'Add a photo or a PDF.');
  // Demo hook for Paper step 35: a file with "fail" in its name behaves like a dropped connection, so the retry state can be shown.
  if (/fail/i.test(file.fileName)) throw new PurchasingError('UPLOAD_FAILED', 'The upload did not go through. Check the connection and try again.');
  const ref: FileRef = { id: nextId(s, 'file'), fileName: file.fileName, size: file.size, thumbnail: file.thumbnail };
  s.files[ref.id] = ref;
  return ref;
}

export function receiveOrder(s: State, ctx: Ctx, id: string, input: ReceiveInput, now: Date): Order {
  needAny(ctx, 'orders.receive');
  const o = find(s, id);
  if (o.status !== 'SENT' && o.status !== 'APPROVED') throw wrongState(o);
  if (!input.deliveryNoteNo.trim() || !input.deliveryNotePhotoId) throw new PurchasingError('DELIVERY_NOTE_REQUIRED', 'Add the delivery note number and a photo of it.');
  const unconfirmed: string[] = [];
  for (const l of o.lines) {
    const got = input.lines.find((x) => x.lineId === l.id);
    const received = got ? num(got.receivedQty) : l.qty;
    if (!(received >= 0)) throw new PurchasingError('VALIDATION', 'Quantities cannot be negative.');
    if (received > l.qty) throw new PurchasingError('RECEIVED_EXCEEDS_ORDERED', 'You cannot receive more than was ordered.', { lineId: l.id });
    if (received > 0 && l.deliveryPrice !== null && l.deliveryPrice !== l.unitPrice && !got?.priceConfirmed) unconfirmed.push(l.id);
  }
  if (unconfirmed.length) throw new PurchasingError('PRICE_CHANGE_UNCONFIRMED', 'Confirm the price change before you sign.', { lineIds: unconfirmed });
  checkPin(input.pin);
  let notSupplied = 0;
  for (const l of o.lines) {
    const got = input.lines.find((x) => x.lineId === l.id);
    const received = got ? num(got.receivedQty) : l.qty;
    const priceChanged = received > 0 && l.deliveryPrice !== null && l.deliveryPrice !== l.unitPrice;
    l.receivedQty = received;
    l.confirmedPrice = priceChanged ? l.deliveryPrice : l.unitPrice;
    l.result = received === 0 ? 'NOT_SUPPLIED' : received < l.qty ? 'SHORT' : priceChanged ? 'PRICE_CHANGED' : 'AS_ORDERED';
    notSupplied += (l.qty - received) * l.unitPrice;
  }
  const photo = s.files[input.deliveryNotePhotoId] ?? null;
  o.delivery = {
    id: nextId(s, 'dlv'),
    reference: nextRef(s, 'GRN'),
    deliveryNoteNo: input.deliveryNoteNo.trim(),
    photo,
    receivedBy: ctx.actor,
    receivedAt: now.toISOString(),
    deliveredTotal: money(deliveredTotalOf(o) ?? 0),
    notSuppliedTotal: money(notSupplied),
  };
  o.status = 'DELIVERED';
  const shortLines = o.lines.filter((l) => l.result === 'SHORT' || l.result === 'NOT_SUPPLIED').length;
  log(o, ctx, `received the delivery (${o.delivery.reference}), delivery note ${o.delivery.deliveryNoteNo}`, now, {
    action: 'Received goods',
    document: o.reference,
    detail: `${o.lines.length} item${o.lines.length === 1 ? '' : 's'}${shortLines ? `, ${shortLines} short` : ''} · delivered value KES ${o.delivery.deliveredTotal} · ${o.delivery.reference}`,
  });
  return viewOrder(o, ctx, now);
}

/** Test and scenario hook: the supplier's price on the delivery differs from the order (the receiver must confirm it). */
export function setDeliveryPrice(s: State, orderId: string, itemId: string, price: number): void {
  const l = find(s, orderId).lines.find((x) => x.itemId === itemId);
  if (l) l.deliveryPrice = price;
}

export function setPreviousPrice(s: State, orderId: string, itemId: string, price: number): void {
  const l = find(s, orderId).lines.find((x) => x.itemId === itemId);
  if (l) l.previousPrice = price;
}

// ---------------------------------------------------------------- invoice, dispute, void

const VOID_REASONS: VoidReason[] = ['WRONG_AMOUNT', 'WRONG_SUPPLIER_OR_ORDER', 'DUPLICATE', 'OTHER'];
const REVERSE_REASONS: ReverseReason[] = ['WRONG_AMOUNT', 'WRONG_REFERENCE', 'WRONG_INVOICE', 'PAYMENT_BOUNCED', 'OTHER'];

function findByInvoice(s: State, invoiceId: string): StoredOrder {
  const o = s.orders.find((x) => x.invoice?.id === invoiceId);
  if (!o) throw new PurchasingError('INVOICE_NOT_FOUND', 'That invoice does not exist, or it was voided.');
  return o;
}

function findByPayment(s: State, paymentId: string): { order: StoredOrder; payment: Payment } {
  for (const o of s.orders) {
    const payment = o.payments.find((p) => p.id === paymentId);
    if (payment) return { order: o, payment };
  }
  throw new PurchasingError('PAYMENT_NOT_FOUND', 'That payment does not exist.');
}

/** Add the supplier's invoice (one per order). An amount that differs from the delivered value needs a reason and is saved as disputed. */
export function addInvoice(s: State, ctx: Ctx, orderId: string, input: InvoiceInput, now: Date): Invoice {
  needAny(ctx, 'payables.record_invoice');
  const o = find(s, orderId);
  if (o.invoice) throw new PurchasingError('INVOICE_EXISTS', 'This order already has an invoice.');
  if (o.status !== 'DELIVERED') throw wrongState(o);
  const number = input.number.trim();
  if (!number) throw new PurchasingError('VALIDATION', "Enter the supplier's invoice number.");
  const amount = num(input.amount);
  if (!(amount > 0)) throw new PurchasingError('VALIDATION', 'Enter the invoice amount.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new PurchasingError('VALIDATION', 'Enter the invoice date.');
  const dup = s.orders.find((x) => x.id !== o.id && x.supplierId === o.supplierId && x.invoice && x.invoice.number.toLowerCase() === number.toLowerCase());
  if (dup && !input.differentInvoice) {
    throw new PurchasingError('DUPLICATE_INVOICE_NUMBER', `${supplierOf(o.supplierId).name} already has an invoice ${number} on ${dup.reference}.`, { existingOrderId: dup.id, existingReference: dup.reference });
  }
  const delivered = deliveredTotalOf(o) ?? 0;
  const variance = Math.round((amount - delivered) * 100) / 100;
  const differs = Math.abs(variance) >= 0.005;
  if (differs && !input.varianceReason?.trim()) throw new PurchasingError('REASON_REQUIRED', 'Say why the invoice differs from what was delivered.');
  const terms = supplierOf(o.supplierId).termsDays ?? 0;
  const inv: Invoice = {
    id: nextId(s, 'inv'),
    number,
    date: input.date,
    dueDate: addDaysIso(input.date, terms),
    amount: money(amount),
    status: 'OPEN',
    disputed: differs,
    varianceAmount: differs ? money(variance) : null,
    varianceReason: differs ? (input.varianceReason as string).trim() : null,
    settled: null,
    voided: null,
    advanceApplied: '0.00',
    balance: money(amount),
    photo: input.photoId ? (s.files[input.photoId] ?? null) : null,
    enteredBy: ctx.actor,
    enteredAt: now.toISOString(),
  };
  o.invoice = inv;
  refreshInvoice(o);
  log(o, ctx, differs ? `added invoice ${number}, disputed for KES ${money(Math.abs(variance))}` : `added invoice ${number} for KES ${money(amount)}`, now, {
    action: 'Added invoice',
    area: 'Payments',
    document: number,
    detail: `KES ${money(amount)}${differs ? ` · KES ${money(Math.abs(variance))} ${variance > 0 ? 'above' : 'below'} delivery: ${inv.varianceReason}` : ' · matches delivery'} · for ${o.reference}`,
  });
  return inv;
}

/** Q-06: agree the figure with the supplier, then record it. The invoice takes the agreed amount and the dispute clears. */
export function settleDispute(s: State, ctx: Ctx, invoiceId: string, input: { agreedAmount: string; note: string }, now: Date): Invoice {
  needAny(ctx, 'payables.record_invoice');
  const o = findByInvoice(s, invoiceId);
  const inv = o.invoice as Invoice;
  if (!inv.disputed) throw new PurchasingError('INVOICE_NOT_DISPUTED', 'This invoice is not in dispute.');
  const agreed = num(input.agreedAmount);
  if (!(agreed > 0)) throw new PurchasingError('VALIDATION', 'Enter the amount you agreed with the supplier.');
  if (!input.note.trim()) throw new PurchasingError('REASON_REQUIRED', 'Say what was agreed with the supplier.');
  inv.settled = { agreedAmount: money(agreed), note: input.note.trim(), by: { id: ctx.actor.id, name: ctx.actor.name }, at: now.toISOString() };
  inv.amount = money(agreed);
  inv.disputed = false;
  refreshInvoice(o);
  log(o, ctx, `settled the dispute on invoice ${inv.number} at KES ${money(agreed)}: ${input.note.trim()}`, now, {
    action: 'Settled invoice dispute',
    area: 'Payments',
    document: inv.number,
    detail: `Agreed KES ${money(agreed)} · ${input.note.trim()}`,
  });
  return inv;
}

/** Void a wrong invoice (reason and PIN). Only while nothing is paid against it; the order goes back to Delivered, awaiting invoice. */
export function voidInvoice(s: State, ctx: Ctx, invoiceId: string, input: { reason: VoidReason; pin: string }, now: Date): Order {
  needAny(ctx, 'payables.record_invoice');
  const o = findByInvoice(s, invoiceId);
  const inv = o.invoice as Invoice;
  if (invoicePaidOf(o) > 0) throw new PurchasingError('INVOICE_HAS_PAYMENTS', 'A payment has been recorded against this invoice. Reverse the payment first.');
  if (!VOID_REASONS.includes(input.reason)) throw new PurchasingError('REASON_REQUIRED', 'Choose a reason.');
  checkPin(input.pin);
  inv.status = 'VOIDED';
  inv.voided = { reason: input.reason, by: { id: ctx.actor.id, name: ctx.actor.name }, at: now.toISOString() };
  o.voidedInvoices.push(inv);
  o.invoice = null;
  o.status = 'DELIVERED';
  log(o, ctx, `voided invoice ${inv.number}`, now, { action: 'Voided invoice', area: 'Payments', document: inv.number, detail: `KES ${inv.amount} · ${VOID_WORD[input.reason]} · ${o.reference} back to awaiting invoice` });
  return viewOrder(o, ctx, now);
}

// ---------------------------------------------------------------- payment, reversal

/** Record a payment against the live invoice. More than the balance needs `confirmOverpay`; the extra stays as credit with the supplier. */
export function recordPayment(s: State, ctx: Ctx, invoiceId: string, input: PaymentInput, now: Date): PaymentResult {
  needAny(ctx, 'payables.record_payment');
  const o = findByInvoice(s, invoiceId);
  const inv = o.invoice as Invoice;
  if (o.status !== 'INVOICED') throw wrongState(o);
  if (inv.disputed) throw new PurchasingError('INVOICE_DISPUTED', 'This invoice is in dispute. Settle it with the supplier before paying.');
  const amount = num(input.amount);
  if (!(amount > 0)) throw new PurchasingError('VALIDATION', 'Enter an amount more than zero.');
  if (input.method === 'CHEQUE' && !input.chequeNo?.trim()) throw new PurchasingError('CHEQUE_NUMBER_REQUIRED', 'Enter the cheque number.');
  const balance = num(inv.balance);
  if (amount > balance + 0.005 && !input.confirmOverpay) {
    throw new PurchasingError('PAYMENT_EXCEEDS_BALANCE', `That is more than the KES ${money(balance)} owed.`, { balance: money(balance) });
  }
  const p: Payment = {
    id: nextId(s, 'pay'),
    reference: nextRef(s, 'PAY'),
    kind: 'INVOICE',
    amount: money(amount),
    paidOn: input.paidOn,
    method: input.method,
    methodRef: input.methodRef,
    chequeNo: input.method === 'CHEQUE' ? (input.chequeNo?.trim() ?? null) : null,
    status: 'RECORDED',
    reversesId: null,
    reason: null,
    invoiceId: inv.id,
    proof: input.proofPhotoId ? (s.files[input.proofPhotoId] ?? null) : null,
    approvedBy: null,
    recordedBy: ctx.actor,
    recordedAt: now.toISOString(),
  };
  o.payments.push(p);
  refreshInvoice(o);
  log(o, ctx, `paid KES ${money(amount)} on invoice ${inv.number} (${p.reference})${inv.status === 'PAID' ? ', paid in full' : ''}`, now, {
    action: 'Recorded payment',
    area: 'Payments',
    document: p.reference,
    detail: `KES ${money(amount)} · ${METHOD_WORD[p.method]}${p.chequeNo ? ` ${p.chequeNo}` : p.methodRef ? ` ${p.methodRef}` : ''} · applied to ${inv.number} · ${inv.status === 'PAID' ? 'balance nil' : `balance KES ${inv.balance}`}`,
  });
  return { payment: p, order: viewOrder(o, ctx, now) };
}

/** The Accountant records the request and a Store Manager (or System Admin) approves it with their PIN, in the same drawer. */
export function reversePayment(s: State, ctx: Ctx, paymentId: string, input: { reason: ReverseReason; note: string | null; approverPin: string }, now: Date): PaymentResult {
  needAny(ctx, 'payables.record_payment');
  const { order: o, payment: p } = findByPayment(s, paymentId);
  if (p.kind !== 'INVOICE') throw new PurchasingError('VALIDATION', 'Only a payment against an invoice can be reversed.');
  if (p.status === 'REVERSED') throw new PurchasingError('PAYMENT_ALREADY_REVERSED', 'That payment has already been reversed.');
  if (!REVERSE_REASONS.includes(input.reason)) throw new PurchasingError('REASON_REQUIRED', 'Choose a reason.');
  checkPin(input.approverPin);
  const approver = ctx.can('orders.approve') ? ctx.actor : PEOPLE.STORE_MANAGER;
  const reversal: Payment = {
    id: nextId(s, 'pay'),
    reference: `${p.reference}-R`,
    kind: 'REVERSAL',
    amount: money(-num(p.amount)),
    paidOn: now.toISOString().slice(0, 10),
    method: p.method,
    methodRef: p.methodRef,
    chequeNo: p.chequeNo,
    status: 'RECORDED',
    reversesId: p.id,
    reason: input.note?.trim() ? `${input.reason}: ${input.note.trim()}` : input.reason,
    invoiceId: p.invoiceId,
    proof: null,
    approvedBy: { id: approver.id, name: approver.name },
    recordedBy: ctx.actor,
    recordedAt: now.toISOString(),
  };
  p.status = 'REVERSED';
  o.payments.push(reversal);
  refreshInvoice(o);
  log(o, ctx, `reversed payment ${p.reference} (KES ${money(num(p.amount))}), approved by ${approver.name}`, now, {
    action: 'Reversed payment',
    area: 'Payments',
    document: p.reference,
    detail: `KES ${money(num(p.amount))} · ${REVERSE_WORD[input.reason]} · approved by ${approver.name}`,
  });
  return { payment: reversal, order: viewOrder(o, ctx, now) };
}

export function paymentAdvice(s: State, ctx: Ctx, paymentId: string, now: Date): PaymentAdvice {
  needAny(ctx, 'payables.read');
  const { order: o, payment: p } = findByPayment(s, paymentId);
  const inv = o.invoice ?? o.voidedInvoices.find((i) => i.id === p.invoiceId);
  if (p.kind !== 'INVOICE' || !inv) throw new PurchasingError('PAYMENT_NOT_FOUND', 'There is no payment advice for that payment.');
  const sup = supplierOf(o.supplierId);
  // Payments are kept in the order they were made, so "before" is whatever sits earlier in the list (timestamps can tie).
  const earlierInvoicePayments = o.payments.slice(0, o.payments.indexOf(p)).filter((x) => x.kind === 'INVOICE' && x.status === 'RECORDED');
  const before = earlierInvoicePayments.reduce((t, x) => t + num(x.amount), 0);
  const balanceAfter = Math.max(num(inv.amount) - num(inv.advanceApplied) - before - num(p.amount), 0);
  const advances = o.payments.filter((x) => x.kind === 'ADVANCE' && x.status === 'RECORDED');
  const earlier = [...advances, ...earlierInvoicePayments].map((x) => ({ reference: x.reference, kind: x.kind as 'ADVANCE' | 'INVOICE', amount: x.amount, paidOn: x.paidOn, method: x.method, methodRef: x.methodRef }));
  return {
    reference: p.reference,
    date: p.paidOn,
    supplier: { name: sup.name, address: sup.address, contact: sup.contactName, kraPin: KRA_PINS[sup.id] ?? null },
    orderReference: o.reference ?? '',
    invoiceNumber: inv.number,
    invoiceDate: inv.date,
    invoiceAmount: inv.amount,
    advanceApplied: inv.advanceApplied,
    paidBefore: money(before + num(inv.advanceApplied)),
    amountPaid: p.amount,
    amountInWords: amountInWords(num(p.amount)),
    balanceAfter: money(balanceAfter),
    method: p.method,
    methodDetail: ctx.can('suppliers.read_payment_details') ? (sup.payMethods.find((m) => m.method === p.method)?.detail || null) : null,
    methodRef: p.methodRef,
    chequeNo: p.chequeNo,
    earlier,
    preparedBy: { name: p.recordedBy.name, role: p.recordedBy.role, signedAt: p.recordedAt },
    generatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------- supplier page, statement, audit

const creditOf = (o: StoredOrder): number => (o.invoice ? Math.max(paidOf(o) - num(o.invoice.amount), 0) : paidOf(o));

function owingFor(s: State, supplierId: string, ctx: Ctx, now: Date): SupplierOwing {
  const show = ctx.can('payables.read');
  const mine = s.orders.filter((o) => o.supplierId === supplierId);
  const open = mine.filter((o) => o.invoice && o.invoice.status === 'OPEN');
  const owing = open.reduce((t, o) => t + num((o.invoice as Invoice).balance), 0);
  const overdueOrders = open.filter((o) => dayDiff((o.invoice as Invoice).dueDate, now) < 0);
  const dues = open.map((o) => (o.invoice as Invoice).dueDate).sort();
  return {
    owing: show ? money(owing) : '',
    overdue: show ? money(overdueOrders.reduce((t, o) => t + num((o.invoice as Invoice).balance), 0)) : '',
    overdueCount: overdueOrders.length,
    openInvoices: open.length,
    disputedAmount: show ? money(open.filter((o) => (o.invoice as Invoice).disputed).reduce((t, o) => t + Math.abs(num((o.invoice as Invoice).varianceAmount ?? '0')), 0)) : '',
    creditHeld: show ? money(mine.reduce((t, o) => t + creditOf(o), 0)) : '',
    nextDueDate: dues[0] ?? null,
  };
}

function knownSupplier(supplierId: string): FixtureSupplier {
  const sup = SUPPLIERS.find((x) => x.id === supplierId);
  if (!sup) throw new PurchasingError('SUPPLIER_NOT_FOUND', 'That supplier does not exist.');
  return sup;
}

export function supplierPurchasing(s: State, ctx: Ctx, supplierId: string, now: Date): SupplierPurchasing {
  needAny(ctx, 'orders.read', 'payables.read');
  knownSupplier(supplierId);
  return { owing: owingFor(s, supplierId, ctx, now), orders: listOrders(s, ctx, { supplierId }, now).orders };
}

/**
 * The supplier's statement of account (Paper 26, 27). Read it as the supplier does: an invoice is a Credit (it adds to what we
 * owe), a payment, advance or voided invoice is a Debit (it reduces it). A voided invoice and a reversed payment stay on the
 * statement, struck through, with a line that cancels them: nothing is erased. `from` defaults to the first of last month.
 */
export function supplierStatement(s: State, ctx: Ctx, supplierId: string, now: Date, range: { from?: string; to?: string } = {}): SupplierStatement {
  needAny(ctx, 'payables.read');
  const sup = knownSupplier(supplierId);
  const today = isoDay(now);
  const to = range.to ?? today;
  const from = range.from ?? `${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10)}`;
  const raw: Array<Omit<StatementLine, 'balance'>> = [];
  for (const o of s.orders.filter((x) => x.supplierId === supplierId)) {
    const ref = o.reference ?? '';
    for (const inv of [...o.voidedInvoices, ...(o.invoice ? [o.invoice] : [])]) {
      const voided = inv.status === 'VOIDED';
      const amount = inv.settled ? inv.settled.agreedAmount : inv.amount;
      raw.push({ at: inv.enteredAt, date: inv.date, kind: 'INVOICE', reference: inv.number, description: `Invoice for ${ref}${inv.disputed ? ' (disputed)' : inv.settled ? ' (dispute settled)' : ''}`, debit: '', credit: amount, superseded: voided, orderId: o.id });
      if (voided && inv.voided) raw.push({ at: inv.voided.at, date: inv.voided.at.slice(0, 10), kind: 'VOID', reference: inv.number, description: `Invoice ${inv.number} voided`, debit: amount, credit: '', superseded: false, orderId: o.id });
    }
    for (const p of o.payments) {
      if (p.kind === 'REVERSAL') raw.push({ at: p.recordedAt, date: p.paidOn, kind: 'REVERSAL', reference: p.reference, description: `Payment reversed${p.reason ? ` (${p.reason})` : ''}`, debit: '', credit: money(-num(p.amount)), superseded: false, orderId: o.id });
      else raw.push({ at: p.recordedAt, date: p.paidOn, kind: p.kind === 'ADVANCE' ? 'ADVANCE' : 'PAYMENT', reference: p.reference, description: `${p.kind === 'ADVANCE' ? 'Advance' : 'Payment'} for ${ref}`, debit: p.amount, credit: '', superseded: p.status === 'REVERSED', orderId: o.id });
    }
  }
  // A statement reads in document-date order; entry time breaks ties.
  raw.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
  const net = (l: Pick<StatementLine, 'debit' | 'credit'>): number => num(l.credit || '0') - num(l.debit || '0');
  const opening = raw.filter((l) => l.date < from).reduce((t, l) => t + net(l), 0);
  let balance = opening;
  const inPeriod = raw.filter((l) => l.date >= from && l.date <= to);
  const lines: StatementLine[] = inPeriod.map((l) => {
    balance += net(l);
    return { ...l, balance: money(balance) };
  });
  // Ageing: open invoices by how many days past their due date they are on the closing day.
  const asOf = new Date(`${to}T00:00:00Z`);
  const open = s.orders.filter((o) => o.supplierId === supplierId && o.invoice && o.invoice.status === 'OPEN');
  const bucket = (test: (past: number) => boolean): string => money(open.filter((o) => test(-dayDiff((o.invoice as Invoice).dueDate, asOf))).reduce((t, o) => t + num((o.invoice as Invoice).balance), 0));
  return {
    supplier: { id: sup.id, name: sup.name, code: sup.code, address: sup.address, contactName: sup.contactName, termsDays: sup.termsDays },
    from,
    to,
    openingBalance: money(opening),
    lines,
    totalDebit: money(inPeriod.reduce((t, l) => t + num(l.debit || '0'), 0)),
    totalCredit: money(inPeriod.reduce((t, l) => t + num(l.credit || '0'), 0)),
    closingBalance: money(balance),
    ageing: {
      current: bucket((p) => p <= 0),
      days1to30: bucket((p) => p >= 1 && p <= 30),
      days31to60: bucket((p) => p >= 31 && p <= 60),
      days61to90: bucket((p) => p >= 61 && p <= 90),
      days90plus: bucket((p) => p > 90),
    },
    generatedAt: now.toISOString(),
  };
}

/** Every Purchasing and payment action, newest first, for the company-wide audit log. Filtering is done by the screen. */
export function auditLog(s: State, ctx: Ctx): AuditRow[] {
  needAny(ctx, 'audit.read');
  return s.orders
    .flatMap((o) =>
      o.activity.map((a, i) => ({
        id: `${o.id}-${i}`,
        at: a.at,
        actor: a.actor,
        action: a.action,
        area: a.area,
        document: a.document,
        detail: a.detail,
        what: a.what,
        orderId: o.id,
        orderReference: o.reference,
        supplierName: supplierOf(o.supplierId).name,
      }))
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}
