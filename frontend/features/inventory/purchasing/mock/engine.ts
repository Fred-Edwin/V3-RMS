import type { Capability } from '../../_shared/lib/capabilities';
import { amountInWords } from '../lib/amount-in-words';
import {
  PurchasingError,
  type CancelReason,
  type CatalogResult,
  type DepositInput,
  type Delivery,
  type FileRef,
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
  type Person,
  type PurchaseFile,
  type ReceiveInput,
  type SendVia,
  type Stage,
  type Summary,
  type SupplierCard,
  type TrackerItem,
  type WhatsappMessage,
} from '../types';
import { DEMO_PIN, ITEMS, LINES, SUPPLIERS, type FixtureItem, type FixtureLine, type FixtureSupplier } from './fixtures';

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
  payments: Payment[];
  cancelled: Order['cancelled'];
  activity: PurchaseFile['activity'];
}

export interface State {
  version: number;
  scenario: string;
  seq: number;
  counters: { LPO: number; PAY: number; GRN: number };
  orders: StoredOrder[];
  files: Record<string, FileRef>;
}

export const STATE_VERSION = 1;
export const emptyState = (scenario = 'fresh'): State => ({ version: STATE_VERSION, scenario, seq: 0, counters: { LPO: 0, PAY: 0, GRN: 0 }, orders: [], files: {} });

// ---------------------------------------------------------------- helpers

const money = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);
const qtyStr = (n: number): string => String(Math.round(n * 1000) / 1000);
const num = (s: string): number => Number.parseFloat(s);
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
const dayDiff = (iso: string, now: Date): number => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${isoDay(now)}T00:00:00Z`)) / 86_400_000);
const pad = (n: number, w = 4): string => String(n).padStart(w, '0');

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
const paidOf = (o: StoredOrder): number => o.payments.filter((p) => p.status === 'RECORDED').reduce((t, p) => t + num(p.amount), 0);

const log = (o: StoredOrder, ctx: Ctx, what: string, now: Date): void => {
  o.activity.unshift({ at: now.toISOString(), actor: { id: ctx.actor.id, name: ctx.actor.name }, what });
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
    { step: 'INVOICED', done: false, at: null, note: null },
    { step: 'PAID', done: o.status === 'CLOSED', at: null, note: null },
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
    recordPayment: ctx.can('payables.record_payment') && o.status === 'INVOICED',
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
  const dueIn = o.expectedDate && (o.status === 'APPROVED' || o.status === 'SENT') ? dayDiff(o.expectedDate, now) : null;
  const m: OrderMoney = { ordered: money(ordered), delivered: delivered === null ? null : money(delivered), invoiced: null, paid: money(paid), stillToPay: money(Math.max(base - paid, 0)) };
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
    invoice: null,
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

function visible(o: StoredOrder, ctx: Ctx): boolean {
  if (ctx.can('orders.read')) return true;
  // Phone roles see what they raised and what is due to be received.
  return o.raisedBy.id === ctx.actor.id || (ctx.can('orders.receive') && stageOf(o.status) === 'RECEIVE');
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
        termsLabel: sup ? (sup.termsDays ? `Regular · Invoice ${sup.termsDays} days` : 'Regular · Cash on delivery') : null,
        itemCount: ls.length,
        estimatedTotal: showMoney ? money(ls.reduce((t, l) => t + num(l.estimatedTotal ?? '0'), 0)) : '',
        lines: ls,
      };
    });
  return { itemCount: sorted.length, supplierCount: groups.filter((g) => g.supplier).length, groups };
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
    return { ...rest, itemSummary: itemSummary(o) };
  });
  return { orders, total: orders.length, valueTotal: ctx.can('payables.read') ? money(rows.reduce((t, o) => t + orderedTotalOf(o), 0)) : '' };
}

export function getOrder(s: State, ctx: Ctx, id: string, now: Date): PurchaseFile {
  needAny(ctx, 'orders.read', 'orders.request', 'orders.receive');
  const o = find(s, id);
  if (!visible(o, ctx)) throw forbidden();
  const documents: PurchaseFile['documents'] = [];
  if (o.approvedBy) documents.push({ kind: 'LPO', title: `${o.reference} (LPO)`, at: o.approvedBy.signedAt, fileRef: null });
  if (o.delivery) documents.push({ kind: 'DELIVERY_NOTE', title: `Delivery note ${o.delivery.deliveryNoteNo}`, at: o.delivery.receivedAt, fileRef: o.delivery.photo });
  return { ...viewOrder(o, ctx, now), documents, activity: o.activity };
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
    message: `Hello ${first}, please find attached our local purchase order ${o.reference}${o.expectedDate ? ` for delivery on ${o.expectedDate}` : ''}. Please confirm receipt and quote ${o.reference} on your delivery note. Thank you, Wendo Coffee Bistro.`,
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
    const price = num(l.unitPrice);
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
    payments: [],
    cancelled: null,
    activity: [],
  };
  log(o, ctx, 'saved a draft', now);
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
  log(o, ctx, 'edited the order', now);
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
  log(o, ctx, 'sent the order for approval', now);
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
  log(o, ctx, 'approved the order with a PIN', now);
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
  log(o, ctx, `returned the order: ${note.trim()}`, now);
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
    log(o, ctx, via === 'MANUAL' ? 'marked the order as sent' : `sent the order (${via.toLowerCase()})`, now);
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
  log(o, ctx, 'cancelled the order', now);
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
    recordedBy: ctx.actor,
    recordedAt: now.toISOString(),
  };
  o.payments.push(p);
  log(o, ctx, `recorded an advance of KES ${money(amount)} (${p.reference})`, now);
  return p;
}

const MAX_UPLOAD = 10 * 1024 * 1024;
export function addUpload(s: State, file: { fileName: string; size: number; mime: string; thumbnail: string | null }): FileRef {
  if (file.size > MAX_UPLOAD) throw new PurchasingError('UPLOAD_TOO_LARGE', 'That file is too large. The limit is 10 MB.');
  if (!/^image\/|^application\/pdf$/.test(file.mime)) throw new PurchasingError('UPLOAD_BAD_TYPE', 'Add a photo or a PDF.');
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
  log(o, ctx, `received the delivery (${o.delivery.reference}), delivery note ${o.delivery.deliveryNoteNo}`, now);
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
