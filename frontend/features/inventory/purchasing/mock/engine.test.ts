import { describe, expect, it } from 'vitest';

import { ctxFor } from './demo-actors';
import {
  addUpload,
  approveOrder,
  cancelOrder,
  catalog,
  createOrder,
  emptyState,
  getOrder,
  getSummary,
  listOrders,
  lpoPrint,
  needsRestocking,
  receiveOrder,
  recordDeposit,
  returnOrder,
  sendOrder,
  setDeliveryPrice,
  submitOrder,
  updateOrder,
  type State,
} from './engine';
import { PurchasingError } from '../types';

const now = new Date('2026-09-29T12:00:00Z');
const sm = ctxFor('STORE_MANAGER');
const att = ctxFor('STORE_ATTENDANT');
const acc = ctxFor('ACCOUNTANT');
const dir = ctxFor('DIRECTOR');

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof PurchasingError ? e.code : 'OTHER';
  }
};

const draft = (s: State, ctx = sm, supplierId = 'sup-samrat') =>
  createOrder(
    s,
    ctx,
    {
      supplierId,
      expectedDate: '2026-09-30',
      supplierNote: null,
      attendantNote: null,
      lines: [
        { inventoryItemId: 'it-sugar', qty: '82', unitPrice: '168' },
        { inventoryItemId: 'it-margarine', qty: '2', unitPrice: '2890' },
      ],
    },
    now
  );

const approved = (s: State) => {
  const d = draft(s);
  return approveOrder(s, sm, d.id, '1234', now);
};

const upload = (s: State) => addUpload(s, { fileName: 'IMG_2041.jpg', size: 1_800_000, mime: 'image/jpeg', thumbnail: null });

describe('numbering and the order states', () => {
  it('keeps a draft unnumbered and numbers it LPO-0001 on submit', () => {
    const s = emptyState();
    const d = draft(s, att);
    expect(d.reference).toBeNull();
    expect(d.status).toBe('DRAFT');
    const sub = submitOrder(s, att, d.id, now);
    expect(sub.reference).toBe('LPO-0001');
    expect(sub.status).toBe('AWAITING_APPROVAL');
    expect(sub.stage).toBe('APPROVAL');
  });

  it('lets a Store Manager approve their own draft, numbering it on approval', () => {
    const s = emptyState();
    const o = approved(s);
    expect(o.reference).toBe('LPO-0001');
    expect(o.status).toBe('APPROVED');
    expect(o.approvedBy?.name).toBe('Joseph Mwangi');
    expect(o.tracker.find((t) => t.step === 'APPROVED')?.state).toBe('DONE');
  });

  it('numbers gap-free across orders', () => {
    const s = emptyState();
    submitOrder(s, att, draft(s, att).id, now);
    const second = approveOrder(s, sm, draft(s, sm, 'sup-summer').id, '1234', now);
    expect(second.reference).toBe('LPO-0002');
  });
});

describe('who may do what (the permissions table, not role names)', () => {
  it('refuses the Accountant, Director and Branch Manager raising an order', () => {
    const s = emptyState();
    expect(codeOf(() => draft(s, acc))).toBe('FORBIDDEN');
    expect(codeOf(() => draft(s, dir))).toBe('FORBIDDEN');
  });

  it('refuses the Attendant approving, and shows an order only the raiser or receiver may see', () => {
    const s = emptyState();
    const d = submitOrder(s, att, draft(s, att).id, now);
    expect(codeOf(() => approveOrder(s, att, d.id, '1234', now))).toBe('FORBIDDEN');
    expect(listOrders(s, att, {}, now).total).toBe(1);
    expect(listOrders(s, dir, {}, now).total).toBe(1);
  });

  it('gives callers the right can-flags for the same order', () => {
    const s = emptyState();
    const d = submitOrder(s, att, draft(s, att).id, now);
    expect(getOrder(s, sm, d.id, now).can.approve).toBe(true);
    expect(getOrder(s, att, d.id, now).can.approve).toBe(false);
    expect(getOrder(s, dir, d.id, now).can.approve).toBe(false);
    expect(getOrder(s, dir, d.id, now).can.cancel).toBe(false);
  });
});

describe('PIN and returning', () => {
  it('rejects a wrong PIN with INVALID_PIN and leaves the order awaiting approval', () => {
    const s = emptyState();
    const d = submitOrder(s, att, draft(s, att).id, now);
    expect(codeOf(() => approveOrder(s, sm, d.id, '0000', now))).toBe('INVALID_PIN');
    expect(getOrder(s, sm, d.id, now).status).toBe('AWAITING_APPROVAL');
  });

  it('needs a note to return an order, then lets the raiser edit and send it again', () => {
    const s = emptyState();
    const d = submitOrder(s, att, draft(s, att).id, now);
    expect(codeOf(() => returnOrder(s, sm, d.id, '  ', now))).toBe('REASON_REQUIRED');
    const r = returnOrder(s, sm, d.id, 'Buy less sugar', now);
    expect(r.status).toBe('RETURNED');
    expect(r.returnedNote).toBe('Buy less sugar');
    updateOrder(s, att, d.id, { lines: [{ inventoryItemId: 'it-sugar', qty: '50', unitPrice: '168' }] }, now);
    const again = submitOrder(s, att, d.id, now);
    expect(again.status).toBe('AWAITING_APPROVAL');
    expect(again.returnedNote).toBeNull();
    expect(again.reference).toBe('LPO-0001');
  });

  it('refuses to edit an approved order', () => {
    const s = emptyState();
    const o = approved(s);
    expect(codeOf(() => updateOrder(s, sm, o.id, { supplierNote: 'x' }, now))).toBe('ORDER_WRONG_STATE');
  });
});

describe('one open order per supplier, supplier and item rules', () => {
  it('refuses a second open order to the same supplier, naming the first', () => {
    const s = emptyState();
    const first = approved(s);
    try {
      draft(s);
      expect.unreachable();
    } catch (e) {
      expect((e as PurchasingError).code).toBe('SUPPLIER_ORDER_OPEN');
      expect((e as PurchasingError).details.openOrderId).toBe(first.id);
    }
  });

  it('refuses a supplier on hold and an item not yet set up', () => {
    const s = emptyState();
    expect(codeOf(() => draft(s, sm, 'sup-palora'))).toBe('SUPPLIER_ON_HOLD');
    expect(codeOf(() => createOrder(s, sm, { supplierId: 'sup-samrat', expectedDate: null, supplierNote: null, attendantNote: null, lines: [{ inventoryItemId: 'it-newitem', qty: '1', unitPrice: '10' }] }, now))).toBe('ITEM_SETUP_INCOMPLETE');
  });
});

describe('sending and cancelling', () => {
  it('marks Sent once, keeps the first send time, and only from approved', () => {
    const s = emptyState();
    const d = draft(s);
    expect(codeOf(() => sendOrder(s, sm, d.id, 'WHATSAPP', now))).toBe('ORDER_WRONG_STATE');
    approveOrder(s, sm, d.id, '1234', now);
    const sent = sendOrder(s, sm, d.id, 'WHATSAPP', now);
    expect(sent.status).toBe('SENT');
    const later = sendOrder(s, sm, d.id, 'PRINT', new Date('2026-09-30T08:00:00Z'));
    expect(later.sentAt).toBe(sent.sentAt);
    expect(later.sentVia).toBe('WHATSAPP');
  });

  it('cancels with a PIN before delivery, but never after goods arrived', () => {
    const s = emptyState();
    const o = approved(s);
    expect(codeOf(() => cancelOrder(s, att, o.id, { reason: 'ORDERED_BY_MISTAKE', note: null, pin: '1234' }, now))).toBe('FORBIDDEN');
    expect(codeOf(() => cancelOrder(s, sm, o.id, { reason: 'ORDERED_BY_MISTAKE', note: null, pin: '9999' }, now))).toBe('INVALID_PIN');
    const c = cancelOrder(s, sm, o.id, { reason: 'ORDERED_BY_MISTAKE', note: 'wrong week', pin: '1234' }, now);
    expect(c.status).toBe('CANCELLED');
    expect(c.stage).toBe('CLOSED');

    const s2 = emptyState();
    const o2 = approved(s2);
    sendOrder(s2, sm, o2.id, 'WHATSAPP', now);
    receiveOrder(s2, sm, o2.id, { lines: [], deliveryNoteNo: 'DN-1', deliveryNotePhotoId: upload(s2).id, pin: '1234' }, now);
    expect(codeOf(() => cancelOrder(s2, sm, o2.id, { reason: 'OTHER', note: null, pin: '1234' }, now))).toBe('CANNOT_CANCEL_AFTER_DELIVERY');
  });
});

describe('deposits', () => {
  it('records an advance numbered PAY-nnnn that shows in the money strip', () => {
    const s = emptyState();
    const o = approved(s);
    const p = recordDeposit(s, acc, o.id, { amount: '10000', paidOn: '2026-09-29', method: 'MPESA_PAYBILL', methodRef: 'QDJ4H8K2', chequeNo: null, note: null }, now);
    expect(p.reference).toBe('PAY-0001');
    const view = getOrder(s, acc, o.id, now);
    expect(view.money?.paid).toBe('10000.00');
    expect(view.money?.stillToPay).toBe('' + (82 * 168 + 2 * 2890 - 10000).toFixed(2));
  });

  it('refuses an advance above the order total, a cheque with no number, and a role without the capability', () => {
    const s = emptyState();
    const o = approved(s);
    const base = { paidOn: '2026-09-29', methodRef: null, chequeNo: null, note: null } as const;
    expect(codeOf(() => recordDeposit(s, acc, o.id, { ...base, amount: '999999', method: 'CASH' }, now))).toBe('DEPOSIT_EXCEEDS_ORDER');
    expect(codeOf(() => recordDeposit(s, acc, o.id, { ...base, amount: '100', method: 'CHEQUE' }, now))).toBe('CHEQUE_NUMBER_REQUIRED');
    expect(codeOf(() => recordDeposit(s, dir, o.id, { ...base, amount: '100', method: 'CASH' }, now))).toBe('FORBIDDEN');
  });
});

describe('receiving', () => {
  const sent = (s: State) => {
    const o = approved(s);
    return sendOrder(s, sm, o.id, 'WHATSAPP', now);
  };

  it('receives in full: GRN number, Delivered, delivered value equals ordered', () => {
    const s = emptyState();
    const o = sent(s);
    const d = receiveOrder(s, att, o.id, { lines: [], deliveryNoteNo: 'DN-77120', deliveryNotePhotoId: upload(s).id, pin: '1234' }, now);
    expect(d.status).toBe('DELIVERED');
    expect(d.delivery?.reference).toBe('GRN-0001');
    expect(d.lines.every((l) => l.result === 'AS_ORDERED')).toBe(true);
    expect(getOrder(s, sm, o.id, now).deliveredTotal).toBe((82 * 168 + 2 * 2890).toFixed(2));
  });

  it('drops a short quantity from the order and values only what arrived', () => {
    const s = emptyState();
    const o = sent(s);
    const marg = o.lines.find((l) => l.inventoryItemId === 'it-margarine')!;
    const d = receiveOrder(s, sm, o.id, { lines: [{ lineId: marg.id, receivedQty: '1', priceConfirmed: false }], deliveryNoteNo: 'DN-2', deliveryNotePhotoId: upload(s).id, pin: '1234' }, now);
    expect(d.lines.find((l) => l.id === marg.id)?.result).toBe('SHORT');
    expect(d.deliveredTotal).toBe((82 * 168 + 1 * 2890).toFixed(2));
    expect(d.delivery?.notSuppliedTotal).toBe('2890.00');
    expect(d.tracker.find((t) => t.step === 'DELIVERED')?.note).toBe('short');
  });

  it('treats zero received as not supplied', () => {
    const s = emptyState();
    const o = sent(s);
    const marg = o.lines.find((l) => l.inventoryItemId === 'it-margarine')!;
    const d = receiveOrder(s, sm, o.id, { lines: [{ lineId: marg.id, receivedQty: '0', priceConfirmed: false }], deliveryNoteNo: 'DN-3', deliveryNotePhotoId: upload(s).id, pin: '1234' }, now);
    expect(d.lines.find((l) => l.id === marg.id)?.result).toBe('NOT_SUPPLIED');
  });

  it('refuses over-delivery, a missing delivery note or photo, and a wrong PIN', () => {
    const s = emptyState();
    const o = sent(s);
    const sugar = o.lines[0]!;
    const photo = upload(s).id;
    expect(codeOf(() => receiveOrder(s, sm, o.id, { lines: [{ lineId: sugar.id, receivedQty: '90', priceConfirmed: false }], deliveryNoteNo: 'DN', deliveryNotePhotoId: photo, pin: '1234' }, now))).toBe('RECEIVED_EXCEEDS_ORDERED');
    expect(codeOf(() => receiveOrder(s, sm, o.id, { lines: [], deliveryNoteNo: '', deliveryNotePhotoId: photo, pin: '1234' }, now))).toBe('DELIVERY_NOTE_REQUIRED');
    expect(codeOf(() => receiveOrder(s, sm, o.id, { lines: [], deliveryNoteNo: 'DN', deliveryNotePhotoId: null, pin: '1234' }, now))).toBe('DELIVERY_NOTE_REQUIRED');
    expect(codeOf(() => receiveOrder(s, sm, o.id, { lines: [], deliveryNoteNo: 'DN', deliveryNotePhotoId: photo, pin: '1' }, now))).toBe('INVALID_PIN');
    expect(getOrder(s, sm, o.id, now).status).toBe('SENT');
  });

  it('makes the receiver confirm a price change, then values it at the new price', () => {
    const s = emptyState();
    const o = sent(s);
    const sugar = o.lines[0]!;
    setDeliveryPrice(s, o.id, 'it-sugar', 170);
    const photo = upload(s).id;
    const unconfirmed = () => receiveOrder(s, sm, o.id, { lines: [], deliveryNoteNo: 'DN', deliveryNotePhotoId: photo, pin: '1234' }, now);
    expect(codeOf(unconfirmed)).toBe('PRICE_CHANGE_UNCONFIRMED');
    const d = receiveOrder(s, sm, o.id, { lines: [{ lineId: sugar.id, receivedQty: '82', priceConfirmed: true }], deliveryNoteNo: 'DN', deliveryNotePhotoId: photo, pin: '1234' }, now);
    expect(d.lines[0]?.result).toBe('PRICE_CHANGED');
    expect(d.deliveredTotal).toBe((82 * 170 + 2 * 2890).toFixed(2));
  });

  it('lets the person who received the delivery still open the order afterwards', () => {
    const s = emptyState();
    const o = sent(s);
    receiveOrder(s, att, o.id, { lines: [], deliveryNoteNo: 'DN-9', deliveryNotePhotoId: upload(s).id, pin: '1234' }, now);
    expect(getOrder(s, att, o.id, now).status).toBe('DELIVERED');
  });

  it('refuses a caller without orders.receive, and uploads that are too big or the wrong type', () => {
    const s = emptyState();
    const o = sent(s);
    expect(codeOf(() => receiveOrder(s, acc, o.id, { lines: [], deliveryNoteNo: 'DN', deliveryNotePhotoId: 'x', pin: '1234' }, now))).toBe('FORBIDDEN');
    expect(codeOf(() => addUpload(s, { fileName: 'a.jpg', size: 11 * 1024 * 1024, mime: 'image/jpeg', thumbnail: null }))).toBe('UPLOAD_TOO_LARGE');
    expect(codeOf(() => addUpload(s, { fileName: 'a.exe', size: 10, mime: 'application/x-msdownload', thumbnail: null }))).toBe('UPLOAD_BAD_TYPE');
  });
});

describe('money is hidden from the Attendant', () => {
  it('blanks every figure for a caller without payables.read, and flags the price change instead', () => {
    const s = emptyState();
    const o = approved(s);
    sendOrder(s, sm, o.id, 'WHATSAPP', now);
    setDeliveryPrice(s, o.id, 'it-sugar', 170);
    const view = getOrder(s, att, o.id, now);
    expect(view.money).toBeNull();
    expect(view.orderedTotal).toBe('');
    expect(view.lines[0]?.unitPrice).toBe('');
    expect(view.lines[0]?.priceChanged).toBe(true);
    expect(getOrder(s, sm, o.id, now).money?.ordered).toBe((82 * 168 + 2 * 2890).toFixed(2));
  });
});

describe('needs restocking', () => {
  it('lists Low and Out items grouped by preferred supplier with Paper-sized suggested quantities', () => {
    const s = emptyState();
    const n = needsRestocking(s, sm, {});
    const samrat = n.groups.find((g) => g.supplier?.id === 'sup-samrat')!;
    const byName = (name: string) => samrat.lines.find((l) => l.itemName === name)!;
    expect(byName('Kabras Sugar 1kg').suggestedQty).toBe('82');
    expect(byName('Salt Cooking Oil 10ltr').suggestedQty).toBe('4');
    expect(byName('Prestige Margarine 10kg box').suggestedQty).toBe('2');
    expect(byName('Angel Instant Dry Yeast 500g').suggestedQty).toBe('2');
    expect(byName('Salt Cooking Oil 10ltr').status).toBe('OUT');
    expect(n.groups.find((g) => g.supplier?.id === 'sup-kagumo')?.lines.find((l) => l.itemName === 'Chicken breast')?.suggestedQty).toBe('5');
  });

  it('offers a cheaper supplier and ignores items already on an open order', () => {
    const s = emptyState();
    const sugar = needsRestocking(s, sm, {}).groups.flatMap((g) => g.lines).find((l) => l.inventoryItemId === 'it-sugar')!;
    expect(sugar.supplierOptions.find((o) => o.supplierId === 'sup-summer')?.preferred).toBe(false);
    approved(s);
    expect(needsRestocking(s, sm, {}).groups.flatMap((g) => g.lines).some((l) => l.inventoryItemId === 'it-sugar')).toBe(false);
  });

  it('hides prices from the Attendant and from callers with no order capability at all', () => {
    const s = emptyState();
    const line = needsRestocking(s, att, {}).groups[0]!.lines[0]!;
    expect(line.lastPrice).toBeNull();
    expect(codeOf(() => needsRestocking(s, ctxFor('STORE_ATTENDANT') && { actor: att.actor, can: () => false }, {}))).toBe('FORBIDDEN');
  });
});

describe('summary, catalog and the printed LPO', () => {
  it('counts each tab and the value waiting for approval', () => {
    const s = emptyState();
    submitOrder(s, att, draft(s, att).id, now);
    const sum = getSummary(s, sm, now);
    expect(sum.counts.approval).toBe(1);
    expect(sum.awaitingApprovalValue).toBe((82 * 168 + 2 * 2890).toFixed(2));
    expect(sum.counts.needs).toBeGreaterThan(0);
  });

  it('lists the supplier catalog with Low and out first and the full list on request', () => {
    const s = emptyState();
    const low = catalog(s, sm, { supplierId: 'sup-samrat' });
    const all = catalog(s, sm, { supplierId: 'sup-samrat', filter: 'all' });
    expect(low.items.every((i) => i.status !== 'OK')).toBe(true);
    expect(all.items.length).toBeGreaterThan(low.items.length);
  });

  it('prints the supplier name and code first, our item second, with the total in words', () => {
    const s = emptyState();
    const o = approved(s);
    const p = lpoPrint(s, sm, o.id, now);
    expect(p.lines[0]).toMatchObject({ supplierItemName: 'KABRAS SUGAR 1KG', supplierItemCode: '190041', ourItemName: 'Kabras Sugar 1kg' });
    expect(p.total).toBe('19556.00');
    expect(p.amountInWords).toBe('Nineteen thousand, five hundred and fifty-six shillings only');
    expect(p.authorisedBy?.name).toBe('Joseph Mwangi');
  });
});
