import type { Request } from 'express';
import { Prisma, type SupplierPayMethodType } from '@prisma/client';
import { blindnessOf, withoutFinancials } from '../../_shared/blind-rule';
import { actorCan } from '../../_shared/central-store-access';
import { toFileRef } from './file-ref';
import {
  invoiceFigures,
  invoicePaymentsTotal,
  orderedTotal,
  paidTotal,
  toMoney,
  toQty,
  type PaymentFacts,
} from './money';
import { canOf, dueInDaysOf, dueLabelOf, stageOf, trackerOf, type Caller } from './order-state';
import type { OrderRecord } from './order-record';
import type {
  ActivityEntryView,
  DeliveryView,
  FileDocumentView,
  InvoiceView,
  OrderLineView,
  OrderMoney,
  OrderRowView,
  OrderView,
  PayMethod,
  PaymentView,
  Person,
  PurchaseFileView,
  SupplierCardView,
  SupplierPayMethodView,
} from './purchasing.types';

type Actor = NonNullable<Request['user']>;

const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);
const iso = (d: Date): string => d.toISOString();
const day = (d: Date): string => d.toISOString().slice(0, 10);
/** "STORE_MANAGER" -> "Store Manager"; the Branch Manager's role code is MANAGER. */
export const roleLabel = (role: string): string =>
  role === 'MANAGER' ? 'Branch Manager' : role.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
export const person = (u: { id: string; name: string; role: string }): Person => ({ id: u.id, name: u.name, role: roleLabel(u.role) });
const nameOf = (u: { id: string; name: string }): { id: string; name: string } => ({ id: u.id, name: u.name });

export const METHOD_WORD: Record<PayMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  MPESA_PAYBILL: 'M-Pesa Paybill',
  MPESA_TILL: 'M-Pesa Till',
  MPESA_SEND_MONEY: 'M-Pesa',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
};

const CANCEL_WORD = { ORDERED_BY_MISTAKE: 'Ordered by mistake', SUPPLIER_CANNOT_SUPPLY: 'Supplier cannot supply', NO_LONGER_NEEDED: 'No longer needed', OTHER: 'Other' } as const;
export const cancelWord = (reason: keyof typeof CANCEL_WORD): string => CANCEL_WORD[reason];

/** The supplier's terms as whole days: null for cash on delivery. */
export const termsDaysOf = (s: { defaultPaymentTerms: string; paymentDays: number }): number | null =>
  s.defaultPaymentTerms === 'PAY_NOW' || s.paymentDays <= 0 ? null : s.paymentDays;

type PayMethodRow = OrderRecord['supplier']['payMethods'][number];

const payMethodDetail = (m: PayMethodRow): string => {
  const last4 = (n: string | null): string => (n ? `····${n.slice(-4)}` : '');
  switch (m.type) {
    case 'BANK_TRANSFER':
      return [m.bankName, last4(m.accountNumber)].filter(Boolean).join(' · ');
    case 'MPESA_PAYBILL':
      return `Paybill ${m.paybillNumber ?? ''}`.trim();
    case 'MPESA_TILL':
      return `Till ${m.tillNumber ?? ''}`.trim();
    case 'MPESA_SEND_MONEY':
      return m.phone ?? '';
    case 'CHEQUE':
      return m.registeredName ? `Payable to ${m.registeredName}` : '';
    default:
      return '';
  }
};

export const payMethodView = (m: PayMethodRow): SupplierPayMethodView => ({
  method: m.type as SupplierPayMethodType as PayMethod,
  label: METHOD_WORD[m.type as PayMethod],
  detail: payMethodDetail(m),
  isDefault: m.isDefault,
});

const callerOf = (actor: Actor): Caller => ({ id: actor.id, can: (c) => actorCan(actor, c) });

const paymentFacts = (o: OrderRecord): PaymentFacts[] => o.payments.map((p) => ({ kind: p.kind, status: p.status, amount: p.amount }));

/** The one invoice that is not voided. */
export const liveInvoiceOf = (o: Pick<OrderRecord, 'invoices'>): OrderRecord['invoices'][number] | null => o.invoices.find((i) => i.status !== 'VOIDED') ?? null;

const supplierCard = (actor: Actor, o: OrderRecord): SupplierCardView => ({
  id: o.supplier.id,
  name: o.supplier.name,
  code: o.supplier.code,
  contactName: o.supplier.contacts[0]?.name ?? null,
  whatsapp: o.supplier.contacts[0]?.whatsapp ?? o.supplier.contacts[0]?.phone ?? null,
  termsDays: o.termsDays,
  payMethods: actorCan(actor, 'suppliers.read_payment_details') ? o.supplier.payMethods.map(payMethodView) : [],
});

const lineView = (actor: Actor, l: OrderRecord['lines'][number]): OrderLineView => {
  const blind = blindnessOf(actor).itemCosts;
  const changedTo = l.confirmedPrice ?? l.deliveredPrice;
  return {
    id: l.id,
    inventoryItemId: l.inventoryItemId,
    itemName: l.inventoryItem.name,
    supplierItemName: l.supplierItemName,
    supplierItemCode: l.supplierItemCode,
    buyUnit: l.buyUnit,
    packSize: l.packSize ? toQty(l.packSize) : null,
    orderedQty: toQty(l.orderedQty),
    unitPrice: blind ? '' : toMoney(l.unitPrice),
    lineTotal: blind ? '' : toMoney(D(l.orderedQty).mul(l.unitPrice)),
    previousPrice: blind || !l.previousPrice ? null : toMoney(l.previousPrice),
    deliveryPrice: blind || !l.deliveredPrice ? null : toMoney(l.deliveredPrice),
    priceChanged: changedTo !== null && !D(changedTo).equals(l.unitPrice),
    receivedQty: l.receivedQty === null ? null : toQty(l.receivedQty),
    confirmedPrice: blind || !l.confirmedPrice ? null : toMoney(l.confirmedPrice),
    result: l.result,
  };
};

const deliveryView = (o: OrderRecord): DeliveryView | null =>
  o.delivery && {
    id: o.delivery.id,
    reference: o.delivery.reference,
    deliveryNoteNo: o.delivery.deliveryNoteNo,
    photo: o.delivery.deliveryNoteFile ? toFileRef(o.delivery.deliveryNoteFile) : null,
    receivedBy: person(o.delivery.receivedBy),
    receivedAt: iso(o.delivery.receivedAt),
    deliveredTotal: toMoney(o.delivery.deliveredTotal),
    notSuppliedTotal: toMoney(o.delivery.notSuppliedTotal),
  };

export const invoiceView = (o: OrderRecord, inv: OrderRecord['invoices'][number]): InvoiceView => {
  const figures = invoiceFigures(inv.amount, paymentFacts(o), inv.disputed);
  return {
    id: inv.id,
    number: inv.number,
    date: day(inv.invoiceDate),
    dueDate: day(inv.dueDate),
    amount: toMoney(inv.amount),
    status: inv.status === 'VOIDED' ? 'VOIDED' : figures.paidInFull ? 'PAID' : 'OPEN',
    disputed: inv.disputed,
    varianceAmount: inv.varianceAmount ? toMoney(inv.varianceAmount) : null,
    varianceReason: inv.varianceReason,
    settled:
      inv.settledAt && inv.settledBy && inv.settledAmount
        ? { agreedAmount: toMoney(inv.settledAmount), note: inv.settledNote ?? '', by: nameOf(inv.settledBy), at: iso(inv.settledAt) }
        : null,
    voided: inv.voidedAt && inv.voidedBy && inv.voidReason ? { reason: inv.voidReason, by: nameOf(inv.voidedBy), at: iso(inv.voidedAt) } : null,
    advanceApplied: toMoney(figures.advanceApplied),
    balance: toMoney(figures.balance),
    photo: inv.file ? toFileRef(inv.file) : null,
    enteredBy: person(inv.enteredBy),
    enteredAt: iso(inv.enteredAt),
  };
};

export const paymentView = (p: OrderRecord['payments'][number]): PaymentView => ({
  id: p.id,
  reference: p.reference,
  kind: p.kind,
  amount: toMoney(p.amount),
  paidOn: day(p.paidOn),
  method: p.method as PayMethod,
  methodRef: p.methodRef,
  chequeNo: p.chequeNo,
  status: p.status,
  reversesId: p.reversesId,
  reason: p.reverseReason ? (p.note ? `${p.reverseReason}: ${p.note}` : p.reverseReason) : null,
  invoiceId: p.invoiceId,
  proof: p.proofFile ? toFileRef(p.proofFile) : null,
  approvedBy: p.approvedBy ? nameOf(p.approvedBy) : null,
  recordedBy: person(p.recordedBy),
  recordedAt: iso(p.recordedAt),
});

const moneyOf = (o: OrderRecord, live: OrderRecord['invoices'][number] | null): OrderMoney => {
  const facts = paymentFacts(o);
  const priced = o.lines.map((l) => ({ orderedQty: l.orderedQty, unitPrice: l.unitPrice, receivedQty: l.receivedQty, confirmedPrice: l.confirmedPrice }));
  const ordered = orderedTotal(priced);
  const delivered = o.delivery ? o.delivery.deliveredTotal : null;
  const paid = paidTotal(facts);
  const stillToPay = live ? invoiceFigures(live.amount, facts, live.disputed).balance : Prisma.Decimal.max(D(delivered ?? ordered).minus(paid), 0);
  return { ordered: toMoney(ordered), delivered: delivered === null ? null : toMoney(delivered), invoiced: live ? toMoney(live.amount) : null, paid: toMoney(paid), stillToPay: toMoney(stillToPay) };
};

export const viewOrder = (actor: Actor, o: OrderRecord, now: Date): OrderView => {
  const blind = blindnessOf(actor);
  const live = liveInvoiceOf(o);
  const facts = paymentFacts(o);
  const priced = o.lines.map((l) => ({ orderedQty: l.orderedQty, unitPrice: l.unitPrice, receivedQty: l.receivedQty, confirmedPrice: l.confirmedPrice }));
  const dueIn = dueInDaysOf({ status: o.status, expectedDate: o.expectedDate ? day(o.expectedDate) : null, invoiceDueDate: live ? day(live.dueDate) : null }, day(now));
  const shortLines = o.lines.some((l) => l.result === 'SHORT' || l.result === 'NOT_SUPPLIED');
  const lastInvoicePayment = [...o.payments].reverse().find((p) => p.kind === 'INVOICE' && p.status === 'RECORDED');
  const view: OrderView = {
    id: o.id,
    reference: o.reference,
    status: o.status,
    stage: stageOf(o.status),
    supplier: supplierCard(actor, o),
    raisedBy: person(o.raisedBy),
    raisedAt: iso(o.createdAt),
    submittedAt: o.submittedAt ? iso(o.submittedAt) : null,
    approvedBy: o.approvedBy && o.approvedAt ? { ...person(o.approvedBy), signedAt: iso(o.approvedAt) } : null,
    returnedNote: o.status === 'RETURNED' ? o.returnedNote : null,
    returnedBy: o.status === 'RETURNED' && o.returnedBy ? nameOf(o.returnedBy) : null,
    sentAt: o.sentAt ? iso(o.sentAt) : null,
    sentVia: o.sentVia,
    expectedDate: o.expectedDate ? day(o.expectedDate) : null,
    supplierNote: o.supplierNote,
    attendantNote: o.attendantNote,
    lines: o.lines.map((l) => lineView(actor, l)),
    orderedTotal: blind.itemCosts ? '' : toMoney(orderedTotal(priced)),
    deliveredTotal: !blind.itemCosts && o.delivery ? toMoney(o.delivery.deliveredTotal) : null,
    delivery: deliveryView(o),
    invoice: live ? invoiceView(o, live) : null,
    payments: o.payments.map(paymentView),
    money: moneyOf(o, live),
    dueLabel: dueLabelOf(dueIn),
    dueInDays: dueIn,
    cancelled:
      o.status === 'CANCELLED' && o.cancelReason && o.cancelledBy && o.cancelledAt
        ? { reason: o.cancelReason, note: o.cancelNote, by: nameOf(o.cancelledBy), at: iso(o.cancelledAt) }
        : null,
    tracker: trackerOf({
      status: o.status,
      raisedAt: iso(o.createdAt),
      submittedAt: o.submittedAt ? iso(o.submittedAt) : null,
      approvedAt: o.approvedAt ? iso(o.approvedAt) : null,
      sentAt: o.sentAt ? iso(o.sentAt) : null,
      sentVia: o.sentVia,
      deliveredAt: o.delivery ? iso(o.delivery.receivedAt) : null,
      deliveredShort: shortLines,
      invoicedAt: live ? iso(live.enteredAt) : null,
      invoiceNote: live ? (live.disputed ? 'disputed' : live.settledAt ? 'settled' : null) : null,
      paidAt: lastInvoicePayment ? iso(lastInvoicePayment.recordedAt) : live ? iso(live.enteredAt) : null,
    }),
    can: canOf(
      {
        status: o.status,
        raisedById: o.raisedById,
        hasInvoice: live !== null,
        invoiceDisputed: live?.disputed ?? false,
        invoicePaid: invoicePaymentsTotal(facts).gt(0),
      },
      callerOf(actor),
    ),
  };
  if (!blind.financials) return view;
  // Blind to invoices, payments and balances (owner decision, 6 Oct 2026); item prices and order totals stay.
  return { ...withoutFinancials(actor, view), invoice: null, payments: [], money: null };
};

const summaryOfItems = (names: readonly string[]): string => {
  const short = names.slice(0, 3).map((n) => n.toLowerCase());
  const more = names.length > 3 ? ` and ${names.length - 3} more` : '';
  return `${names.length} item${names.length === 1 ? '' : 's'} · ${short.join(', ')}${more}`;
};

/** "4 items · 1 short · price change on salt cooking oil" once delivered; null before. */
const deliverySummaryOf = (o: OrderRecord): string | null => {
  if (!o.delivery) return null;
  const n = o.lines.length;
  const short = o.lines.filter((l) => l.result === 'SHORT' || l.result === 'NOT_SUPPLIED').length;
  const changed = o.lines.filter((l) => l.confirmedPrice !== null && !D(l.confirmedPrice).equals(l.unitPrice));
  const parts = [`${n} item${n === 1 ? '' : 's'}`];
  if (short) parts.push(`${short} short`);
  const first = changed[0];
  if (first) parts.push(`price change on ${first.inventoryItem.name.toLowerCase().split(' ').slice(0, 3).join(' ')}`);
  if (!short && !first) parts.push(o.lines.slice(0, 2).map((l) => l.inventoryItem.name.toLowerCase()).join(', '));
  return parts.join(' · ');
};

export const viewRow = (actor: Actor, o: OrderRecord, now: Date): OrderRowView => {
  const { lines: _lines, ...rest } = viewOrder(actor, o, now);
  void _lines;
  const names = o.lines.map((l) => l.inventoryItem.name);
  return { ...rest, itemSummary: summaryOfItems(names), itemNames: `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`, deliverySummary: deliverySummaryOf(o) };
};

const kes0 = (v: Prisma.Decimal.Value): string => Math.round(Number(v)).toLocaleString('en-US');

const documentsOf = (actor: Actor, o: OrderRecord): FileDocumentView[] => {
  const blind = blindnessOf(actor);
  const docs: FileDocumentView[] = [];
  const itemCount = `${o.lines.length} item${o.lines.length === 1 ? '' : 's'}`;
  const total = orderedTotal(o.lines.map((l) => ({ orderedQty: l.orderedQty, unitPrice: l.unitPrice })));
  // The printed LPO carries no prices, but the file's list shows the order total to anyone who may see item prices.
  if (o.approvedBy && o.approvedAt) {
    docs.push({ kind: 'LPO', title: 'Local purchase order', subtitle: `${o.reference} · ${itemCount}${blind.itemCosts ? '' : ` · KES ${kes0(total)}`}`, step: 'Ordered', at: iso(o.approvedAt), addedBy: o.approvedBy.name, fileRef: null, action: 'Print', paymentId: null });
  }
  if (o.delivery) {
    const photo = o.delivery.deliveryNoteFile ? toFileRef(o.delivery.deliveryNoteFile) : null;
    docs.push({ kind: 'DELIVERY_NOTE', title: 'Delivery note photo', subtitle: `${o.delivery.deliveryNoteNo}${photo ? ` · ${photo.fileName}` : ''}`, step: 'Delivered', at: iso(o.delivery.receivedAt), addedBy: o.delivery.receivedBy.name, fileRef: photo, action: 'View', paymentId: null });
    docs.push({ kind: 'GOODS_RECEIPT', title: 'Goods receipt', subtitle: `${o.delivery.reference} · signed with PIN${blind.itemCosts ? '' : ` · KES ${kes0(o.delivery.deliveredTotal)}`}`, step: 'Delivered', at: iso(o.delivery.receivedAt), addedBy: o.delivery.receivedBy.name, fileRef: null, action: 'Open', paymentId: null });
  }
  if (!blind.financials) {
    const live = liveInvoiceOf(o);
    if (live) {
      const photo = live.file ? toFileRef(live.file) : null;
      docs.push({ kind: 'INVOICE', title: "Supplier's invoice", subtitle: `${live.number} · KES ${kes0(live.amount)}${photo ? ` · ${photo.fileName}` : ''}`, step: 'Invoiced', at: iso(live.enteredAt), addedBy: live.enteredBy.name, fileRef: photo, action: 'View', paymentId: null });
    }
    for (const p of o.payments.filter((x) => x.kind !== 'REVERSAL')) {
      const how = p.chequeNo ? `Cheque ${p.chequeNo}` : `${METHOD_WORD[p.method as PayMethod]}${p.methodRef ? ` ${p.methodRef}` : ''}`;
      docs.push({ kind: p.kind === 'ADVANCE' ? 'ADVANCE_ADVICE' : 'PAYMENT_ADVICE', title: p.kind === 'ADVANCE' ? 'Advance payment advice' : 'Payment advice', subtitle: `${p.reference} · KES ${kes0(p.amount)} · ${how}${p.status === 'REVERSED' ? ' · reversed' : ''}`, step: 'Paid', at: iso(p.recordedAt), addedBy: p.recordedBy.name, fileRef: null, action: 'Print', paymentId: p.id });
    }
  }
  const stepOf = (): FileDocumentView['step'] => (o.status === 'CLOSED' ? 'Paid' : liveInvoiceOf(o) ? 'Invoiced' : o.delivery ? 'Delivered' : 'Ordered');
  for (const d of o.documents) {
    docs.push({ kind: 'OTHER', title: d.title, subtitle: d.file.fileName, step: stepOf(), at: iso(d.addedAt), addedBy: d.addedBy.name, fileRef: toFileRef(d.file), action: 'View', paymentId: null });
  }
  return docs;
};

const activityOf = (actor: Actor, o: OrderRecord): ActivityEntryView[] =>
  o.audit
    .filter((a) => !(a.area === 'PAYMENTS' && blindnessOf(actor).financials))
    .map((a) => ({ at: iso(a.at), actor: person(a.actor), what: a.what, action: a.action, area: a.area === 'PAYMENTS' ? 'Payments' : 'Purchasing', document: a.document, detail: a.detail }));

export const viewFile = (actor: Actor, o: OrderRecord, now: Date): PurchaseFileView => ({
  ...viewOrder(actor, o, now),
  documents: documentsOf(actor, o),
  activity: activityOf(actor, o),
});
