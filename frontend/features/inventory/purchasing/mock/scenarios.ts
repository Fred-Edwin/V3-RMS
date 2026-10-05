import type { PayMethod } from '../types';
import { ctxFor } from './demo-actors';
import {
  addInvoice,
  addUpload,
  approveOrder,
  cancelOrder,
  createOrder,
  emptyState,
  getOrder,
  receiveOrder,
  recordDeposit,
  recordPayment,
  returnOrder,
  reversePayment,
  sendOrder,
  setDeliveryPrice,
  setPreviousPrice,
  submitOrder,
  voidInvoice,
  type Ctx,
  type State,
} from './engine';
import { LINES } from './fixtures';

/**
 * Demo scenarios: every one is built by running the real engine operations, so a scenario can never hold a state the rules
 * would not allow. The demo bar lists them; the demo script (docs/features/inventory/purchasing-mock/demo-script.md) says which
 * one to jump to for each role's walkthrough.
 */
export interface Scenario {
  key: string;
  label: string;
  description: string;
  build: (now: Date) => State;
}

const sm = ctxFor('STORE_MANAGER');
const att = ctxFor('STORE_ATTENDANT');
const acc = ctxFor('ACCOUNTANT');

const addDays = (now: Date, days: number): Date => new Date(now.getTime() + days * 86_400_000);
const day = (now: Date, days: number): string => addDays(now, days).toISOString().slice(0, 10);
const at = (now: Date, hours: number): Date => new Date(now.getTime() + hours * 3_600_000);

interface Spec {
  supplierId: string;
  by?: Ctx;
  lines: Array<[itemId: string, qty: number, price?: number]>;
  dueIn?: number;
  note?: string;
  attendantNote?: string;
}

function place(s: State, spec: Spec, now: Date, hoursAgo = 26): string {
  const by = spec.by ?? sm;
  const o = createOrder(
    s,
    by,
    {
      supplierId: spec.supplierId,
      expectedDate: spec.dueIn === undefined ? null : day(now, spec.dueIn),
      supplierNote: spec.note ?? null,
      attendantNote: spec.attendantNote ?? null,
      lines: spec.lines.map(([itemId, qty, price]) => ({
        inventoryItemId: itemId,
        qty: String(qty),
        unitPrice: String(price ?? LINES.find((l) => l.supplierId === spec.supplierId && l.itemId === itemId)?.price ?? 0),
      })),
    },
    at(now, -hoursAgo)
  );
  return o.id;
}

const SAMRAT: Spec = {
  supplierId: 'sup-samrat',
  dueIn: 1,
  note: 'Please deliver before 10am and quote the LPO number on your delivery note.',
  lines: [
    ['it-sugar', 82],
    ['it-oil', 4],
    ['it-margarine', 2],
    ['it-yeast', 2],
  ],
};

function approveAndSend(s: State, id: string, now: Date): void {
  approveOrder(s, sm, id, '1234', at(now, -25));
  sendOrder(s, sm, id, 'WHATSAPP', at(now, -24));
}

function attendantRequest(s: State, spec: Spec, now: Date): string {
  const id = place(s, { ...spec, by: att }, now);
  submitOrder(s, att, id, at(now, -4));
  return id;
}

/** The standard Samrat delivery from Paper: oil price up to 2,400, one box of margarine short. Delivered value 27,486. */
function deliverSamrat(s: State, id: string, now: Date, hoursAgo: number): void {
  setDeliveryPrice(s, id, 'it-oil', 2400);
  deliver(s, id, { note: 'DN-77120', short: { 'it-margarine': 1 }, priceConfirmed: ['it-oil'] }, now, hoursAgo);
}

interface DeliverOpts {
  note: string;
  /** Quantity actually received for these items (the rest is received in full). */
  short?: Record<string, number>;
  priceConfirmed?: string[];
}

function deliver(s: State, id: string, opts: DeliverOpts, now: Date, hoursAgo: number): void {
  const photo = addUpload(s, { fileName: 'IMG_2041.jpg', size: 1_800_000, mime: 'image/jpeg', thumbnail: null });
  const order = s.orders.find((x) => x.id === id);
  const lines = order?.lines.map((l) => ({ lineId: l.id, receivedQty: String(opts.short?.[l.itemId] ?? l.qty), priceConfirmed: opts.priceConfirmed?.includes(l.itemId) ?? false })) ?? [];
  receiveOrder(s, att, id, { lines, deliveryNoteNo: opts.note, deliveryNotePhotoId: photo.id, pin: '1234' }, at(now, -hoursAgo));
}

interface Journey {
  spec: Spec;
  /** Days ago the order was raised. Approval, sending, advance and delivery follow on the next days. */
  ago: number;
  advance?: number;
  deliver?: DeliverOpts & { prices?: Record<string, number> };
  invoice?: { number: string; ageDays: number; amount?: number; reason?: string };
  pay?: Array<{ amount: number; ageDays: number; method: PayMethod; ref?: string; cheque?: string }>;
  reverseFirstPayment?: { ageDays: number };
  voidInvoice?: boolean;
  cancel?: boolean;
}

/** Take one order through its life on a timeline of days, using only engine operations. Returns the order id and invoice id (if any). */
function journey(s: State, j: Journey, now: Date): { orderId: string; invoiceId: string | null } {
  const created = -j.ago * 24;
  const orderId = place(s, { ...j.spec, dueIn: -j.ago + 1 }, now, j.ago * 24);
  approveOrder(s, sm, orderId, '1234', at(now, created + 1));
  sendOrder(s, sm, orderId, 'WHATSAPP', at(now, created + 2));
  if (j.advance) {
    recordDeposit(s, acc, orderId, { amount: String(j.advance), paidOn: day(now, -j.ago + 1), method: 'MPESA_PAYBILL', methodRef: 'QDJ4H8K2', chequeNo: null, note: null }, at(now, created + 3));
  }
  if (j.cancel) {
    cancelOrder(s, sm, orderId, { reason: 'SUPPLIER_CANNOT_SUPPLY', note: 'Supplier is out of stock until next week.', pin: '1234' }, at(now, created + 5));
    return { orderId, invoiceId: null };
  }
  if (!j.deliver) return { orderId, invoiceId: null };
  for (const [item, price] of Object.entries(j.deliver.prices ?? {})) setDeliveryPrice(s, orderId, item, price);
  deliver(s, orderId, { ...j.deliver, priceConfirmed: Object.keys(j.deliver.prices ?? {}) }, now, -created - 24);
  if (!j.invoice) return { orderId, invoiceId: null };
  const delivered = Number.parseFloat(getOrder(s, acc, orderId, now).deliveredTotal ?? '0');
  const inv = addInvoice(
    s,
    acc,
    orderId,
    {
      number: j.invoice.number,
      date: day(now, -j.invoice.ageDays),
      amount: String(j.invoice.amount ?? delivered),
      photoId: addUpload(s, { fileName: `Invoice ${j.invoice.number}.pdf`, size: 412_000, mime: 'application/pdf', thumbnail: null }).id,
      varianceReason: j.invoice.reason ?? null,
    },
    at(now, -j.invoice.ageDays * 24)
  );
  const payments = (j.pay ?? []).map((p) =>
    recordPayment(s, acc, inv.id, { amount: String(p.amount), paidOn: day(now, -p.ageDays), method: p.method, methodRef: p.ref ?? null, chequeNo: p.cheque ?? null, proofPhotoId: null }, at(now, -p.ageDays * 24)).payment
  );
  if (j.reverseFirstPayment && payments[0]) {
    reversePayment(s, acc, payments[0].id, { reason: 'WRONG_AMOUNT', note: 'Sent to the wrong till.', approverPin: '1234' }, at(now, -j.reverseFirstPayment.ageDays * 24));
  }
  if (j.voidInvoice) voidInvoice(s, acc, inv.id, { reason: 'WRONG_AMOUNT', pin: '1234' }, at(now, -(j.invoice.ageDays - 1) * 24));
  return { orderId, invoiceId: inv.id };
}

const SAMRAT_DELIVERY: Journey['deliver'] = { note: 'DN-77120', short: { 'it-margarine': 1 }, prices: { 'it-oil': 2400 } };

/**
 * The paperwork the Accountant works through: invoices overdue, due soon and disputed, advances, a paid-in-full order by cheque
 * and by M-Pesa, a payment that was reversed, a cancelled order, and orders waiting for their invoice.
 */
function accountsHistory(s: State, now: Date): void {
  journey(s, { spec: { supplierId: 'sup-samrat', lines: [['it-mayo', 10], ['it-tea', 10]] }, ago: 34, deliver: { note: 'DN-70412' }, invoice: { number: 'INV-05121', ageDays: 32 } }, now);
  journey(s, { spec: { supplierId: 'sup-samrat', lines: [['it-brownsugar', 30], ['it-tea', 12]] }, ago: 45, deliver: { note: 'DN-69201' }, invoice: { number: 'INV-05004', ageDays: 43 }, pay: [{ amount: 10740, ageDays: 35, method: 'CHEQUE', cheque: '000398' }] }, now);
  journey(s, { spec: { supplierId: 'sup-kagumo', lines: [['it-chicken', 5, 2450]] }, ago: 20, deliver: { note: 'DN-K2208' }, invoice: { number: 'INV-0411', ageDays: 16 } }, now);
  journey(s, { spec: { supplierId: 'sup-kagumo', lines: [['it-wings', 4]] }, ago: 28, deliver: { note: 'DN-K2104' }, invoice: { number: 'INV-0390', ageDays: 26 }, pay: [{ amount: 7600, ageDays: 20, method: 'MPESA_SEND_MONEY', ref: 'QDG2K8T1' }], reverseFirstPayment: { ageDays: 18 } }, now);
  journey(s, { spec: { supplierId: 'sup-summer', lines: [['it-flour', 2], ['it-water', 4]] }, ago: 8, advance: 5000, deliver: { note: 'DN-S4418' }, invoice: { number: 'INV-88213', ageDays: 4 } }, now);
  journey(s, { spec: { supplierId: 'sup-kimathi', lines: [['it-beef', 20], ['it-goat', 10]] }, ago: 12, deliver: { note: 'DN-KB772' }, invoice: { number: 'INV-3390', ageDays: 10, amount: 26200, reason: 'The butcher added a cutting fee that was not agreed.' } }, now);
  journey(s, { spec: { supplierId: 'sup-karatina', lines: [['it-carrots', 20], ['it-cabbage', 20]] }, ago: 14, deliver: { note: 'DN-KF310' }, invoice: { number: 'INV-9921', ageDays: 12 }, pay: [{ amount: 2200, ageDays: 6, method: 'MPESA_SEND_MONEY', ref: 'QDJ7R3N8' }] }, now);
  journey(s, { spec: { supplierId: 'sup-demka', lines: [['it-yoghurt', 24]] }, ago: 9, cancel: true }, now);
  journey(s, { spec: { supplierId: 'sup-demka', lines: [['it-yoghurt', 24]] }, ago: 4, deliver: { note: 'DN-DD118' } }, now);
  journey(s, { spec: { ...SAMRAT }, ago: 3, advance: 10000, deliver: SAMRAT_DELIVERY }, now);
}

export const SCENARIOS: Scenario[] = [
  { key: 'fresh', label: 'Fresh start', description: 'No orders yet. Needs restocking shows what is low.', build: () => emptyState('fresh') },
  {
    key: 'default',
    label: 'A normal day',
    description:
      'Two requests waiting for approval and four orders on their way (one due today, one overdue, one with an advance), plus the Accountant’s paperwork: invoices to add, overdue and disputed invoices to pay, and paid orders. Samrat still needs ordering.',
    build: (now) => {
      const s = emptyState('default');
      accountsHistory(s, now);
      const chicken = attendantRequest(
        s,
        {
          supplierId: 'sup-kagumo',
          dueIn: 1,
          attendantNote: 'Chicken is finishing before the weekend. Wings for the Saturday special.',
          lines: [
            ['it-chicken', 5, 2450],
            ['it-wings', 2, 1900],
          ],
        },
        now
      );
      setPreviousPrice(s, chicken, 'it-chicken', 2356);
      attendantRequest(s, { supplierId: 'sup-kimathi', dueIn: 2, lines: [['it-beef', 20], ['it-goat', 10]] }, now);
      // Samrat is left un-ordered on purpose, so Needs restocking shows a full supplier group to start the demo from.
      const summer = place(s, { supplierId: 'sup-summer', dueIn: 2, lines: [['it-flour', 2], ['it-water', 4]] }, now);
      approveAndSend(s, summer, now);
      const market = place(s, { supplierId: 'sup-market', by: att, dueIn: 3, lines: [['it-potatoes', 50], ['it-onions', 20], ['it-tomatoes', 20]] }, now);
      submitOrder(s, att, market, at(now, -30));
      approveAndSend(s, market, now);
      recordDeposit(s, acc, market, { amount: '3000', paidOn: day(now, -1), method: 'MPESA_SEND_MONEY', methodRef: 'QDJ9K2M1', chequeNo: null, note: null }, at(now, -20));
      const karatina = place(s, { supplierId: 'sup-karatina', dueIn: -1, lines: [['it-carrots', 20], ['it-cabbage', 20], ['it-spinach', 10]] }, now);
      approveAndSend(s, karatina, now);
      const demka = place(s, { supplierId: 'sup-demka', dueIn: 0, lines: [['it-yoghurt', 24]] }, now);
      approveAndSend(s, demka, now);
      return s;
    },
  },
  {
    key: 'accounts-day',
    label: "The Accountant's day",
    description: 'Only paperwork, no open orders: invoices to add (Samrat is the Paper example), overdue, disputed and part-paid invoices, a payment reversed, a cheque payment, a cancelled order.',
    build: (now) => {
      const s = emptyState('accounts-day');
      accountsHistory(s, now);
      return s;
    },
  },
  {
    key: 'awaiting-approval',
    label: 'An order awaiting approval',
    description: 'The Attendant has sent a request; the Store Manager approves it with PIN 1234.',
    build: (now) => {
      const s = emptyState('awaiting-approval');
      attendantRequest(s, { supplierId: 'sup-kagumo', dueIn: 1, attendantNote: 'Chicken is finishing before the weekend.', lines: [['it-chicken', 5], ['it-wings', 2]] }, now);
      return s;
    },
  },
  {
    key: 'returned-order',
    label: 'An order returned with a note',
    description: 'The Store Manager sent the Attendant’s request back with a note. The Attendant edits it and sends it again (Paper step 32).',
    build: (now) => {
      const s = emptyState('returned-order');
      const id = attendantRequest(s, { supplierId: 'sup-kagumo', dueIn: 1, attendantNote: 'Chicken is finishing before the weekend.', lines: [['it-chicken', 8], ['it-wings', 4]] }, now);
      returnOrder(s, sm, id, 'That is too much for a weekend. Order 5 trays of chicken and leave the wings this time.', at(now, -2));
      return s;
    },
  },
  {
    key: 'ready-to-send',
    label: 'Approved, ready to send',
    description: "The Store Manager's own order, approved and signed, waiting to be sent on WhatsApp.",
    build: (now) => {
      const s = emptyState('ready-to-send');
      approveOrder(s, sm, place(s, SAMRAT, now), '1234', at(now, -2));
      return s;
    },
  },
  {
    key: 'sent-with-deposit',
    label: 'Sent, with an advance paid',
    description: 'Samrat has the order and the Accountant has paid KES 10,000 up front.',
    build: (now) => {
      const s = emptyState('sent-with-deposit');
      const id = place(s, SAMRAT, now);
      approveAndSend(s, id, now);
      recordDeposit(s, acc, id, { amount: '10000', paidOn: day(now, -1), method: 'MPESA_PAYBILL', methodRef: 'QDJ4H8K2', chequeNo: null, note: null }, at(now, -20));
      return s;
    },
  },
  {
    key: 'price-change-delivery',
    label: 'Delivery due, with a price change',
    description: 'Samrat is due today and the cooking oil price has gone up: the receiver must confirm it, and can mark the margarine short.',
    build: (now) => {
      const s = emptyState('price-change-delivery');
      const id = place(s, { ...SAMRAT, dueIn: 0 }, now);
      approveAndSend(s, id, now);
      setDeliveryPrice(s, id, 'it-oil', 2400);
      return s;
    },
  },
  {
    key: 'delivered-awaiting-invoice',
    label: 'Delivered, awaiting invoice',
    description: 'Samrat delivered one box short with a price change (delivered value 27,486). The advance is paid. Add the invoice as the Accountant: 27,486 matches; 27,986 is disputed.',
    build: (now) => {
      const s = emptyState('delivered-awaiting-invoice');
      const o = place(s, { ...SAMRAT, dueIn: 0 }, now);
      approveAndSend(s, o, now);
      recordDeposit(s, acc, o, { amount: '10000', paidOn: day(now, -2), method: 'MPESA_PAYBILL', methodRef: 'QDJ4H8K2', chequeNo: null, note: null }, at(now, -40));
      deliverSamrat(s, o, now, 2);
      return s;
    },
  },
  {
    key: 'invoice-disputed',
    label: 'Invoice higher than delivery (disputed)',
    description: 'Samrat invoiced 27,986 against 27,486 delivered. Saved as disputed for 500; it cannot be paid until the Accountant settles it with the supplier.',
    build: (now) => {
      const s = emptyState('invoice-disputed');
      journey(s, { spec: { ...SAMRAT }, ago: 3, advance: 10000, deliver: SAMRAT_DELIVERY, invoice: { number: 'INV-05188', ageDays: 1, amount: 27986, reason: 'Supplier charged delivery that was not agreed.' } }, now);
      return s;
    },
  },
  {
    key: 'invoice-to-pay',
    label: 'Invoiced, ready to pay',
    description: 'Samrat invoiced exactly what was delivered (27,486). The 10,000 advance is applied; the balance to pay is 17,486.',
    build: (now) => {
      const s = emptyState('invoice-to-pay');
      journey(s, { spec: { ...SAMRAT }, ago: 3, advance: 10000, deliver: SAMRAT_DELIVERY, invoice: { number: 'INV-05188', ageDays: 1 } }, now);
      return s;
    },
  },
  {
    key: 'invoice-overdue',
    label: 'Invoice overdue',
    description: 'A Samrat invoice dated 32 days ago on 14-day terms: 18 days overdue.',
    build: (now) => {
      const s = emptyState('invoice-overdue');
      journey(s, { spec: { supplierId: 'sup-samrat', lines: [['it-mayo', 10], ['it-tea', 10]] }, ago: 34, deliver: { note: 'DN-70412' }, invoice: { number: 'INV-05121', ageDays: 32 } }, now);
      return s;
    },
  },
  {
    key: 'part-paid',
    label: 'Part paid',
    description: 'Samrat has been paid 7,486 of the 17,486 balance; 10,000 is still owing.',
    build: (now) => {
      const s = emptyState('part-paid');
      journey(s, { spec: { ...SAMRAT }, ago: 4, advance: 10000, deliver: SAMRAT_DELIVERY, invoice: { number: 'INV-05188', ageDays: 2 }, pay: [{ amount: 7486, ageDays: 1, method: 'BANK_TRANSFER', ref: 'FT26275NK2' }] }, now);
      return s;
    },
  },
  {
    key: 'paid-in-full',
    label: 'Paid in full by cheque',
    description: 'A closed purchase file: invoice paid by cheque, payment advice printed. Everything stays on record.',
    build: (now) => {
      const s = emptyState('paid-in-full');
      journey(s, { spec: { ...SAMRAT }, ago: 12, advance: 10000, deliver: SAMRAT_DELIVERY, invoice: { number: 'INV-05188', ageDays: 9 }, pay: [{ amount: 17486, ageDays: 2, method: 'CHEQUE', cheque: '000412' }] }, now);
      return s;
    },
  },
  {
    key: 'payment-reversed',
    label: 'A payment reversed',
    description: 'The Accountant paid the wrong amount, the Store Manager approved the reversal. The payment stays on the statement marked Reversed and the invoice is back in To pay.',
    build: (now) => {
      const s = emptyState('payment-reversed');
      journey(s, { spec: { supplierId: 'sup-kagumo', lines: [['it-wings', 4]] }, ago: 10, deliver: { note: 'DN-K2104' }, invoice: { number: 'INV-0390', ageDays: 8 }, pay: [{ amount: 7600, ageDays: 3, method: 'MPESA_SEND_MONEY', ref: 'QDG2K8T1' }], reverseFirstPayment: { ageDays: 2 } }, now);
      return s;
    },
  },
  {
    key: 'invoice-voided',
    label: 'An invoice voided',
    description: 'The wrong invoice was voided with a PIN. The order is back to Delivered, awaiting invoice, and the voided invoice stays on the statement.',
    build: (now) => {
      const s = emptyState('invoice-voided');
      journey(s, { spec: { ...SAMRAT }, ago: 3, advance: 10000, deliver: SAMRAT_DELIVERY, invoice: { number: 'INV-05187', ageDays: 2, amount: 26486, reason: 'Typed wrongly.' }, voidInvoice: true }, now);
      return s;
    },
  },
  {
    key: 'cancelled-order',
    label: 'An order cancelled',
    description: 'Approved and sent, then cancelled by the Store Manager before anything arrived. It stays under Closed as Cancelled.',
    build: (now) => {
      const s = emptyState('cancelled-order');
      journey(s, { spec: { ...SAMRAT }, ago: 2, advance: 3000, cancel: true }, now);
      return s;
    },
  },
];

export const DEFAULT_SCENARIO = 'default';

export function buildScenario(key: string, now: Date): State {
  const found = SCENARIOS.find((s) => s.key === key) ?? SCENARIOS.find((s) => s.key === DEFAULT_SCENARIO);
  return (found as Scenario).build(now);
}
