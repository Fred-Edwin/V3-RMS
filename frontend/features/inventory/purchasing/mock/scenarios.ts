import { ctxFor } from './demo-actors';
import {
  addUpload,
  approveOrder,
  createOrder,
  emptyState,
  receiveOrder,
  recordDeposit,
  sendOrder,
  setDeliveryPrice,
  setPreviousPrice,
  submitOrder,
  type Ctx,
  type State,
} from './engine';
import { LINES } from './fixtures';

/**
 * Demo scenarios: every one is built by running the real engine operations, so a scenario can never hold a state the rules
 * would not allow. Register the rest as Session 2 completes the invoice and payment screens.
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

function place(s: State, spec: Spec, now: Date): string {
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
    at(now, -26)
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

export const SCENARIOS: Scenario[] = [
  { key: 'fresh', label: 'Fresh start', description: 'No orders yet. Needs restocking shows what is low.', build: () => emptyState('fresh') },
  {
    key: 'default',
    label: 'A normal day',
    description: 'Two requests waiting for approval and four orders on their way (one due today, one overdue, one with an advance). Samrat still needs ordering.',
    build: (now) => {
      const s = emptyState('default');
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
    description: 'Samrat delivered one box short with a price change. The advance is paid; the invoice is the next step (Session 2).',
    build: (now) => {
      const s = emptyState('delivered-awaiting-invoice');
      const o = place(s, { ...SAMRAT, dueIn: 0 }, now);
      approveAndSend(s, o, now);
      setDeliveryPrice(s, o, 'it-oil', 2400);
      recordDeposit(s, acc, o, { amount: '10000', paidOn: day(now, -2), method: 'MPESA_PAYBILL', methodRef: 'QDJ4H8K2', chequeNo: null, note: null }, at(now, -40));
      const photo = addUpload(s, { fileName: 'IMG_2041.jpg', size: 1_800_000, mime: 'image/jpeg', thumbnail: null });
      const order = s.orders.find((x) => x.id === o);
      const lines = order?.lines.map((l) => ({ lineId: l.id, receivedQty: l.itemId === 'it-margarine' ? '1' : String(l.qty), priceConfirmed: l.itemId === 'it-oil' })) ?? [];
      receiveOrder(s, att, o, { lines, deliveryNoteNo: 'DN-77120', deliveryNotePhotoId: photo.id, pin: '1234' }, at(now, -2));
      return s;
    },
  },
];

export const DEFAULT_SCENARIO = 'default';

export function buildScenario(key: string, now: Date): State {
  const found = SCENARIOS.find((s) => s.key === key) ?? SCENARIOS.find((s) => s.key === DEFAULT_SCENARIO);
  return (found as Scenario).build(now);
}
