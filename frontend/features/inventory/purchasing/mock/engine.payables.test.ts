import { describe, expect, it } from 'vitest';

import { PurchasingError } from '../types';
import { ctxFor } from './demo-actors';
import {
  addDocument,
  addInvoice,
  addUpload,
  approveOrder,
  auditLog,
  createOrder,
  emptyState,
  getOrder,
  listOrders,
  paymentAdvice,
  receiveOrder,
  recordDeposit,
  recordPayment,
  reversePayment,
  sendOrder,
  setDeliveryPrice,
  settleDispute,
  supplierPurchasing,
  supplierStatement,
  voidInvoice,
  type State,
} from './engine';
import { SCENARIOS } from './scenarios';
import { SUPPLIERS } from './fixtures';

const now = new Date('2026-10-05T12:00:00Z');
const sm = ctxFor('STORE_MANAGER');
const att = ctxFor('STORE_ATTENDANT');
const acc = ctxFor('ACCOUNTANT');
const dir = ctxFor('DIRECTOR');
const bm = ctxFor('MANAGER');
const sa = ctxFor('SYSTEM_ADMIN');

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof PurchasingError ? e.code : 'OTHER';
  }
};

/** Samrat's order from Paper, delivered with the oil price up and one box of margarine short: delivered value 27,486. */
const delivered = (s: State = emptyState(), advance = 0): { s: State; id: string } => {
  const o = createOrder(
    s,
    sm,
    {
      supplierId: 'sup-samrat',
      expectedDate: '2026-10-05',
      supplierNote: null,
      attendantNote: null,
      lines: [
        { inventoryItemId: 'it-sugar', qty: '82', unitPrice: '168' },
        { inventoryItemId: 'it-oil', qty: '4', unitPrice: '2340' },
        { inventoryItemId: 'it-margarine', qty: '2', unitPrice: '2890' },
        { inventoryItemId: 'it-yeast', qty: '2', unitPrice: '610' },
      ],
    },
    now
  );
  approveOrder(s, sm, o.id, '1234', now);
  sendOrder(s, sm, o.id, 'WHATSAPP', now);
  if (advance) recordDeposit(s, acc, o.id, { amount: String(advance), paidOn: '2026-09-28', method: 'BANK_TRANSFER', methodRef: null, chequeNo: null, note: null }, now);
  setDeliveryPrice(s, o.id, 'it-oil', 2400);
  const photo = addUpload(s, { fileName: 'IMG_2041.jpg', size: 1_800_000, mime: 'image/jpeg', thumbnail: null });
  const order = s.orders.find((x) => x.id === o.id);
  const lines = order?.lines.map((l) => ({ lineId: l.id, receivedQty: l.itemId === 'it-margarine' ? '1' : String(l.qty), priceConfirmed: l.itemId === 'it-oil' })) ?? [];
  receiveOrder(s, att, o.id, { lines, deliveryNoteNo: 'DN-77120', deliveryNotePhotoId: photo.id, pin: '1234' }, now);
  return { s, id: o.id };
};

const invoiceInput = (over: Partial<Parameters<typeof addInvoice>[3]> = {}) => ({ number: 'INV-05188', date: '2026-10-01', amount: '27486', photoId: null, varianceReason: null, ...over });
const payInput = (over: Partial<Parameters<typeof recordPayment>[3]> = {}) => ({ amount: '17486', paidOn: '2026-10-05', method: 'BANK_TRANSFER' as const, methodRef: null, chequeNo: null, proofPhotoId: null, ...over });

const invoiced = (advance = 10000, over: Partial<Parameters<typeof addInvoice>[3]> = {}) => {
  const d = delivered(emptyState(), advance);
  const inv = addInvoice(d.s, acc, d.id, invoiceInput(over), now);
  return { ...d, inv };
};

describe('adding an invoice (Paper 17, 18)', () => {
  it('matches the delivered value, applies the advance and moves the order to To pay', () => {
    const { s, id, inv } = invoiced();
    expect(inv.disputed).toBe(false);
    expect(inv.advanceApplied).toBe('10000.00');
    expect(inv.balance).toBe('17486.00');
    const o = getOrder(s, acc, id, now);
    expect(o.status).toBe('INVOICED');
    expect(o.stage).toBe('PAY');
    expect(o.money).toMatchObject({ delivered: '27486.00', invoiced: '27486.00', paid: '10000.00', stillToPay: '17486.00' });
    expect(o.tracker.find((t) => t.step === 'INVOICED')?.state).toBe('DONE');
  });

  it('works out the due date from the supplier terms (Samrat: 14 days)', () => {
    expect(invoiced().inv.dueDate).toBe('2026-10-15');
  });

  it('needs a reason when the invoice is higher, and saves it as disputed for the difference', () => {
    const d = delivered(emptyState(), 10000);
    expect(codeOf(() => addInvoice(d.s, acc, d.id, invoiceInput({ amount: '27986' }), now))).toBe('REASON_REQUIRED');
    const inv = addInvoice(d.s, acc, d.id, invoiceInput({ amount: '27986', varianceReason: 'Delivery charged that was not agreed.' }), now);
    expect(inv).toMatchObject({ disputed: true, varianceAmount: '500.00', balance: '17986.00' });
    expect(getOrder(d.s, acc, d.id, now).tracker.find((t) => t.step === 'INVOICED')?.note).toBe('disputed');
  });

  it('treats a lower invoice as a variance too (Q-06)', () => {
    const d = delivered();
    const inv = addInvoice(d.s, acc, d.id, invoiceInput({ amount: '27000', varianceReason: 'Supplier gave a discount.' }), now);
    expect(inv).toMatchObject({ disputed: true, varianceAmount: '-486.00' });
  });

  it('keeps an advance bigger than the invoice as credit with the supplier', () => {
    const { s, id, inv } = invoiced(30000);
    expect(inv.advanceApplied).toBe('27486.00');
    expect(inv.balance).toBe('0.00');
    expect(inv.status).toBe('PAID');
    expect(getOrder(s, acc, id, now).status).toBe('CLOSED');
    expect(supplierPurchasing(s, acc, 'sup-samrat', now).owing.creditHeld).toBe('2514.00');
  });

  it('allows one invoice per order and only after delivery', () => {
    const { s, id } = invoiced();
    expect(codeOf(() => addInvoice(s, acc, id, invoiceInput({ number: 'INV-1' }), now))).toBe('INVOICE_EXISTS');
    const fresh = emptyState();
    const o = createOrder(fresh, sm, { supplierId: 'sup-samrat', expectedDate: null, supplierNote: null, attendantNote: null, lines: [{ inventoryItemId: 'it-sugar', qty: '1', unitPrice: '168' }] }, now);
    expect(codeOf(() => addInvoice(fresh, acc, o.id, invoiceInput(), now))).toBe('ORDER_WRONG_STATE');
  });

  it('refuses a duplicate invoice number for the same supplier unless it is marked a different invoice', () => {
    const { s } = invoiced();
    const second = delivered(s);
    expect(codeOf(() => addInvoice(second.s, acc, second.id, invoiceInput({ number: 'inv-05188 ' }), now))).toBe('DUPLICATE_INVOICE_NUMBER');
    expect(codeOf(() => addInvoice(second.s, acc, second.id, invoiceInput({ number: 'INV-05188', differentInvoice: true }), now))).toBeNull();
  });

  it('checks the number, amount and date, and refuses callers without the capability', () => {
    const d = delivered();
    expect(codeOf(() => addInvoice(d.s, acc, d.id, invoiceInput({ number: ' ' }), now))).toBe('VALIDATION');
    expect(codeOf(() => addInvoice(d.s, acc, d.id, invoiceInput({ amount: '0' }), now))).toBe('VALIDATION');
    expect(codeOf(() => addInvoice(d.s, acc, d.id, invoiceInput({ date: '30 Sep' }), now))).toBe('VALIDATION');
    for (const who of [att, dir, bm]) expect(codeOf(() => addInvoice(d.s, who, d.id, invoiceInput(), now))).toBe('FORBIDDEN');
    expect(codeOf(() => addInvoice(d.s, sm, d.id, invoiceInput(), now))).toBeNull();
  });

  it('shows the invoice only to roles that may read money', () => {
    const { s, id } = invoiced();
    expect(getOrder(s, dir, id, now).invoice?.number).toBe('INV-05188');
    expect(getOrder(s, att, id, now).invoice).toBeNull();
    expect(getOrder(s, att, id, now).money).toBeNull();
  });
});

describe('settling a dispute (Q-06)', () => {
  const disputed = () => invoiced(10000, { amount: '27986', varianceReason: 'Delivery charged that was not agreed.' });

  it('cannot be paid until it is settled', () => {
    const { s, id, inv } = disputed();
    expect(getOrder(s, acc, id, now).can.recordPayment).toBe(false);
    expect(getOrder(s, acc, id, now).can.settleDispute).toBe(true);
    expect(codeOf(() => recordPayment(s, acc, inv.id, payInput(), now))).toBe('INVOICE_DISPUTED');
  });

  it('takes the agreed figure, clears the dispute and keeps the history', () => {
    const { s, id, inv } = disputed();
    const settled = settleDispute(s, acc, inv.id, { agreedAmount: '27486', note: 'Supplier agreed to drop the delivery charge.' }, now);
    expect(settled).toMatchObject({ disputed: false, amount: '27486.00', balance: '17486.00', varianceAmount: '500.00' });
    expect(settled.settled?.note).toMatch(/drop the delivery/);
    expect(getOrder(s, acc, id, now).can.recordPayment).toBe(true);
  });

  it('needs a note and an amount, only works on a disputed invoice, and only for the right capability', () => {
    const { s, inv } = disputed();
    expect(codeOf(() => settleDispute(s, acc, inv.id, { agreedAmount: '27486', note: ' ' }, now))).toBe('REASON_REQUIRED');
    expect(codeOf(() => settleDispute(s, acc, inv.id, { agreedAmount: '0', note: 'x' }, now))).toBe('VALIDATION');
    expect(codeOf(() => settleDispute(s, dir, inv.id, { agreedAmount: '27486', note: 'x' }, now))).toBe('FORBIDDEN');
    settleDispute(s, acc, inv.id, { agreedAmount: '27486', note: 'ok' }, now);
    expect(codeOf(() => settleDispute(s, acc, inv.id, { agreedAmount: '27486', note: 'ok' }, now))).toBe('INVOICE_NOT_DISPUTED');
    expect(codeOf(() => settleDispute(s, acc, 'nope', { agreedAmount: '1', note: 'x' }, now))).toBe('INVOICE_NOT_FOUND');
  });

  it('shows the disputed amount on the supplier page', () => {
    const { s } = disputed();
    expect(supplierPurchasing(s, acc, 'sup-samrat', now).owing).toMatchObject({ disputedAmount: '500.00', owing: '17986.00' });
  });
});

describe('recording a payment (Paper 20, 20b, 39)', () => {
  it('a part payment leaves the invoice in To pay with the balance', () => {
    const { s, id, inv } = invoiced();
    const r = recordPayment(s, acc, inv.id, payInput({ amount: '7486' }), now);
    expect(r.payment).toMatchObject({ kind: 'INVOICE', reference: 'PAY-0002', invoiceId: inv.id });
    expect(r.order.status).toBe('INVOICED');
    expect(r.order.invoice?.balance).toBe('10000.00');
    expect(getOrder(s, acc, id, now).money?.paid).toBe('17486.00');
  });

  it('paying the full balance closes the order', () => {
    const { s, id, inv } = invoiced();
    const r = recordPayment(s, acc, inv.id, payInput(), now);
    expect(r.order.status).toBe('CLOSED');
    expect(r.order.invoice?.status).toBe('PAID');
    expect(getOrder(s, acc, id, now).tracker.find((t) => t.step === 'PAID')?.state).toBe('DONE');
    expect(getOrder(s, acc, id, now).can.recordPayment).toBe(false);
    expect(codeOf(() => recordPayment(s, acc, inv.id, payInput({ amount: '1' }), now))).toBe('ORDER_WRONG_STATE');
  });

  it('paying more than is owed needs an explicit confirmation, and the extra stays as credit', () => {
    const { s, inv } = invoiced();
    let details: unknown;
    try {
      recordPayment(s, acc, inv.id, payInput({ amount: '20000' }), now);
    } catch (e) {
      expect(e).toBeInstanceOf(PurchasingError);
      details = (e as PurchasingError).details;
      expect((e as PurchasingError).code).toBe('PAYMENT_EXCEEDS_BALANCE');
    }
    expect(details).toEqual({ balance: '17486.00' });
    const r = recordPayment(s, acc, inv.id, payInput({ amount: '20000', confirmOverpay: true }), now);
    expect(r.order.status).toBe('CLOSED');
    expect(supplierPurchasing(s, acc, 'sup-samrat', now).owing.creditHeld).toBe('2514.00');
  });

  it('a cheque payment needs the cheque number; other methods ignore it', () => {
    const { s, inv } = invoiced();
    expect(codeOf(() => recordPayment(s, acc, inv.id, payInput({ method: 'CHEQUE' }), now))).toBe('CHEQUE_NUMBER_REQUIRED');
    const r = recordPayment(s, acc, inv.id, payInput({ amount: '1000', method: 'CHEQUE', chequeNo: ' 000412 ' }), now);
    expect(r.payment.chequeNo).toBe('000412');
    const m = recordPayment(s, acc, inv.id, payInput({ amount: '1000', method: 'MPESA_PAYBILL', methodRef: 'QDJ4H8K2', chequeNo: '999' }), now);
    expect(m.payment.chequeNo).toBeNull();
  });

  it('accepts every method (cash, M-Pesa, bank, cheque) and checks the amount', () => {
    const { s, inv } = invoiced();
    for (const method of ['CASH', 'MPESA_SEND_MONEY', 'MPESA_TILL', 'BANK_TRANSFER'] as const) {
      expect(codeOf(() => recordPayment(s, acc, inv.id, payInput({ amount: '100', method }), now))).toBeNull();
    }
    expect(codeOf(() => recordPayment(s, acc, inv.id, payInput({ amount: '0' }), now))).toBe('VALIDATION');
  });

  it('is for the Accountant, Store Manager and System Admin only', () => {
    const { s, inv } = invoiced();
    for (const who of [att, dir, bm]) expect(codeOf(() => recordPayment(s, who, inv.id, payInput({ amount: '100' }), now))).toBe('FORBIDDEN');
    for (const who of [acc, sm, sa]) expect(codeOf(() => recordPayment(s, who, inv.id, payInput({ amount: '100' }), now))).toBeNull();
  });

  it('numbers payments gap-free with the advance', () => {
    const { s, inv } = invoiced();
    const a = recordPayment(s, acc, inv.id, payInput({ amount: '100' }), now).payment.reference;
    const b = recordPayment(s, acc, inv.id, payInput({ amount: '100' }), now).payment.reference;
    expect([a, b]).toEqual(['PAY-0002', 'PAY-0003']);
  });
});

describe('payment advice (Paper 21, 21b)', () => {
  it('shows the invoice, the advance, what was paid before, this payment and the balance after', () => {
    const { s, inv } = invoiced();
    recordPayment(s, acc, inv.id, payInput({ amount: '7486' }), now);
    const second = recordPayment(s, acc, inv.id, payInput({ amount: '10000', method: 'CHEQUE', chequeNo: '000412' }), now).payment;
    const adv = paymentAdvice(s, acc, second.id, now);
    // "Paid earlier" is everything against the invoice before this payment: the 10,000 advance plus the 7,486 payment.
    expect(adv).toMatchObject({ reference: 'PAY-0003', invoiceNumber: 'INV-05188', invoiceAmount: '27486.00', advanceApplied: '10000.00', paidBefore: '17486.00', amountPaid: '10000.00', balanceAfter: '0.00', chequeNo: '000412', method: 'CHEQUE' });
    expect(adv.amountInWords).toMatch(/^Ten thousand/);
    expect(adv.supplier.kraPin).toBe('P051234567X');
    expect(adv.methodDetail).toMatch(/Equity Bank/);
    expect(adv.earlier.map((e) => e.reference)).toEqual(['PAY-0001', 'PAY-0002']);
    expect(adv.preparedBy).toMatchObject({ name: 'Margaret', role: 'Accountant' });
  });

  it('is refused for an advance, an unknown payment and a caller who cannot read payables', () => {
    const { s, inv } = invoiced();
    const p = recordPayment(s, acc, inv.id, payInput({ amount: '100' }), now).payment;
    const advance = s.orders[0]?.payments.find((x) => x.kind === 'ADVANCE');
    expect(codeOf(() => paymentAdvice(s, acc, advance?.id ?? '', now))).toBe('PAYMENT_NOT_FOUND');
    expect(codeOf(() => paymentAdvice(s, acc, 'nope', now))).toBe('PAYMENT_NOT_FOUND');
    expect(codeOf(() => paymentAdvice(s, att, p.id, now))).toBe('FORBIDDEN');
  });
});

describe('reversing a payment (Paper 38)', () => {
  const paid = () => {
    const x = invoiced();
    const p = recordPayment(x.s, acc, x.inv.id, payInput(), now).payment;
    return { ...x, p };
  };

  it('is requested by the Accountant, approved with a Store Manager PIN, and reopens the invoice', () => {
    const { s, id, p } = paid();
    expect(getOrder(s, acc, id, now).status).toBe('CLOSED');
    expect(getOrder(s, acc, id, now).can.reversePayment).toBe(true);
    const r = reversePayment(s, acc, p.id, { reason: 'WRONG_AMOUNT', note: 'Wrong amount typed.', approverPin: '1234' }, now);
    expect(r.payment).toMatchObject({ kind: 'REVERSAL', amount: '-17486.00', reversesId: p.id, approvedBy: { name: 'Joseph Mwangi' } });
    expect(r.order.status).toBe('INVOICED');
    expect(r.order.invoice).toMatchObject({ status: 'OPEN', balance: '17486.00' });
    const file = getOrder(s, acc, id, now);
    expect(file.payments.find((x) => x.id === p.id)?.status).toBe('REVERSED');
    expect(file.money?.paid).toBe('10000.00');
    expect(file.can.recordPayment).toBe(true);
  });

  it('keeps the original payment, so nothing is deleted, and the payment can be recorded again correctly', () => {
    const { s, id, inv, p } = paid();
    reversePayment(s, acc, p.id, { reason: 'PAYMENT_BOUNCED', note: null, approverPin: '1234' }, now);
    expect(getOrder(s, acc, id, now).payments).toHaveLength(3);
    expect(recordPayment(s, acc, inv.id, payInput(), now).order.status).toBe('CLOSED');
  });

  it('refuses a wrong approver PIN, a missing reason, a second reversal and an advance', () => {
    const { s, p } = paid();
    expect(codeOf(() => reversePayment(s, acc, p.id, { reason: 'WRONG_AMOUNT', note: null, approverPin: '0000' }, now))).toBe('INVALID_PIN');
    expect(codeOf(() => reversePayment(s, acc, p.id, { reason: '' as never, note: null, approverPin: '1234' }, now))).toBe('REASON_REQUIRED');
    reversePayment(s, acc, p.id, { reason: 'WRONG_AMOUNT', note: null, approverPin: '1234' }, now);
    expect(codeOf(() => reversePayment(s, acc, p.id, { reason: 'WRONG_AMOUNT', note: null, approverPin: '1234' }, now))).toBe('PAYMENT_ALREADY_REVERSED');
    const advance = s.orders[0]?.payments.find((x) => x.kind === 'ADVANCE');
    expect(codeOf(() => reversePayment(s, acc, advance?.id ?? '', { reason: 'WRONG_AMOUNT', note: null, approverPin: '1234' }, now))).toBe('VALIDATION');
    expect(codeOf(() => reversePayment(s, acc, 'nope', { reason: 'WRONG_AMOUNT', note: null, approverPin: '1234' }, now))).toBe('PAYMENT_NOT_FOUND');
  });

  it('is for callers who record payments, and the Store Manager approving their own request is allowed', () => {
    const { s, p } = paid();
    expect(codeOf(() => reversePayment(s, dir, p.id, { reason: 'OTHER', note: null, approverPin: '1234' }, now))).toBe('FORBIDDEN');
    expect(reversePayment(s, sm, p.id, { reason: 'OTHER', note: null, approverPin: '1234' }, now).payment.approvedBy?.name).toBe('Joseph Mwangi');
  });
});

describe('voiding an invoice (Paper 37)', () => {
  it('needs a reason and a PIN, returns the order to Delivered and lets the right invoice be added', () => {
    const { s, id, inv } = invoiced();
    expect(codeOf(() => voidInvoice(s, acc, inv.id, { reason: 'WRONG_AMOUNT', pin: '0000' }, now))).toBe('INVALID_PIN');
    expect(codeOf(() => voidInvoice(s, acc, inv.id, { reason: '' as never, pin: '1234' }, now))).toBe('REASON_REQUIRED');
    const o = voidInvoice(s, acc, inv.id, { reason: 'WRONG_AMOUNT', pin: '1234' }, now);
    expect(o.status).toBe('DELIVERED');
    expect(o.invoice).toBeNull();
    expect(getOrder(s, acc, id, now).can.addInvoice).toBe(true);
    expect(codeOf(() => addInvoice(s, acc, id, invoiceInput({ number: 'INV-05188' }), now))).toBeNull();
  });

  it('is refused once a payment is recorded against the invoice: reverse the payment first', () => {
    const { s, inv } = invoiced();
    const p = recordPayment(s, acc, inv.id, payInput({ amount: '100' }), now).payment;
    expect(codeOf(() => voidInvoice(s, acc, inv.id, { reason: 'WRONG_AMOUNT', pin: '1234' }, now))).toBe('INVOICE_HAS_PAYMENTS');
    reversePayment(s, acc, p.id, { reason: 'WRONG_AMOUNT', note: null, approverPin: '1234' }, now);
    expect(codeOf(() => voidInvoice(s, acc, inv.id, { reason: 'WRONG_AMOUNT', pin: '1234' }, now))).toBeNull();
  });

  it('keeps the advance on the order and the voided invoice on the statement', () => {
    const { s, inv } = invoiced();
    voidInvoice(s, acc, inv.id, { reason: 'DUPLICATE', pin: '1234' }, now);
    const st = supplierStatement(s, acc, 'sup-samrat', now);
    expect(st.lines.map((l) => l.kind)).toEqual(['ADVANCE', 'INVOICE', 'VOID']);
    expect(st.lines.find((l) => l.kind === 'INVOICE')?.superseded).toBe(true);
    expect(st.closingBalance).toBe('-10000.00');
    expect(supplierPurchasing(s, acc, 'sup-samrat', now).owing.owing).toBe('0.00');
  });

  it('is for callers who record invoices', () => {
    const { s, inv } = invoiced();
    for (const who of [att, dir, bm]) expect(codeOf(() => voidInvoice(s, who, inv.id, { reason: 'OTHER', pin: '1234' }, now))).toBe('FORBIDDEN');
  });
});

describe('the supplier page and statement (Paper 25 to 27)', () => {
  it('owing is the open balance; overdue counts only invoices past their due date', () => {
    const { s } = invoiced();
    const sp = supplierPurchasing(s, acc, 'sup-samrat', now);
    expect(sp.owing).toMatchObject({ owing: '17486.00', overdue: '0.00', overdueCount: 0, openInvoices: 1, nextDueDate: '2026-10-15' });
    const later = new Date('2026-10-20T12:00:00Z');
    expect(supplierPurchasing(s, acc, 'sup-samrat', later).owing).toMatchObject({ overdue: '17486.00', overdueCount: 1 });
    expect(supplierPurchasing(s, acc, 'sup-samrat', later).orders).toHaveLength(1);
  });

  it('refuses a caller who may not read money or orders, and an unknown supplier', () => {
    const { s } = invoiced();
    expect(codeOf(() => supplierPurchasing(s, att, 'sup-samrat', now))).toBe('FORBIDDEN');
    expect(codeOf(() => supplierStatement(s, att, 'sup-samrat', now))).toBe('FORBIDDEN');
    expect(codeOf(() => supplierPurchasing(s, acc, 'nope', now))).toBe('SUPPLIER_NOT_FOUND');
    expect(codeOf(() => supplierStatement(s, acc, 'nope', now))).toBe('SUPPLIER_NOT_FOUND');
  });

  it('the Branch Manager reads the supplier page and statement (without payment details, which are on the supplier card)', () => {
    const { s } = invoiced();
    expect(supplierPurchasing(s, bm, 'sup-samrat', now).owing.owing).toBe('17486.00');
    expect(supplierStatement(s, bm, 'sup-samrat', now).lines.length).toBeGreaterThan(0);
  });

  it('reads as the supplier does: an invoice is a Credit, a payment or advance a Debit, with a running balance and period totals (Paper 26)', () => {
    const { s, inv } = invoiced();
    recordPayment(s, acc, inv.id, payInput({ amount: '7486' }), now);
    const st = supplierStatement(s, acc, 'sup-samrat', now);
    expect(st.lines.map((l) => [l.kind, l.debit, l.credit, l.balance])).toEqual([
      ['ADVANCE', '10000.00', '', '-10000.00'],
      ['INVOICE', '', '27486.00', '17486.00'],
      ['PAYMENT', '7486.00', '', '10000.00'],
    ]);
    expect(st).toMatchObject({ openingBalance: '0.00', totalDebit: '17486.00', totalCredit: '27486.00', closingBalance: '10000.00', from: '2026-09-01', to: '2026-10-05' });
  });

  it('carries what was owed before the period as the opening balance, and honours a chosen period', () => {
    const { s } = invoiced();
    const st = supplierStatement(s, acc, 'sup-samrat', now, { from: '2026-10-02', to: '2026-10-05' });
    expect(st.openingBalance).toBe('17486.00');
    expect(st.lines).toHaveLength(0);
    expect(st.closingBalance).toBe('17486.00');
    expect(supplierStatement(s, acc, 'sup-samrat', now, { from: '2026-09-01', to: '2026-09-30' }).closingBalance).toBe('-10000.00');
  });

  it('ages open invoices by days past due into five buckets', () => {
    const { s } = invoiced();
    expect(supplierStatement(s, acc, 'sup-samrat', now).ageing).toEqual({ current: '17486.00', days1to30: '0.00', days31to60: '0.00', days61to90: '0.00', days90plus: '0.00' });
    const at = (iso: string) => supplierStatement(s, acc, 'sup-samrat', new Date(iso), { to: iso.slice(0, 10) }).ageing;
    expect(at('2026-10-30T12:00:00Z').days1to30).toBe('17486.00');
    expect(at('2026-11-25T12:00:00Z').days31to60).toBe('17486.00');
    expect(at('2026-12-20T12:00:00Z').days61to90).toBe('17486.00');
    expect(at('2027-02-01T12:00:00Z').days90plus).toBe('17486.00');
  });

  it('shows a reversed payment struck through with a reversal line, and nothing is erased', () => {
    const { s, inv } = invoiced();
    const p = recordPayment(s, acc, inv.id, payInput(), now).payment;
    reversePayment(s, acc, p.id, { reason: 'WRONG_AMOUNT', note: null, approverPin: '1234' }, now);
    const st = supplierStatement(s, acc, 'sup-samrat', now);
    expect(st.lines.find((l) => l.kind === 'PAYMENT')?.superseded).toBe(true);
    expect(st.lines.find((l) => l.kind === 'REVERSAL')?.credit).toBe('17486.00');
    expect(st.closingBalance).toBe('17486.00');
  });

  it('a settled dispute appears on the statement at the agreed figure', () => {
    const { s, inv } = invoiced(10000, { amount: '27986', varianceReason: 'Charged delivery.' });
    settleDispute(s, acc, inv.id, { agreedAmount: '27486', note: 'Agreed.' }, now);
    const line = supplierStatement(s, acc, 'sup-samrat', now).lines.find((l) => l.kind === 'INVOICE');
    expect(line?.credit).toBe('27486.00');
    expect(line?.description).toMatch(/settled/);
  });
});

describe('the purchase file: documents and the added-document action (Paper 22)', () => {
  it('lists every document with its step, who added it and its link, in Paper order', () => {
    const { s, id, inv } = invoiced();
    recordPayment(s, acc, inv.id, payInput(), now);
    const docs = getOrder(s, acc, id, now).documents;
    expect(docs.map((d) => [d.kind, d.step, d.action])).toEqual([
      ['LPO', 'Ordered', 'Print'],
      ['DELIVERY_NOTE', 'Delivered', 'View'],
      ['GOODS_RECEIPT', 'Delivered', 'Open'],
      ['INVOICE', 'Invoiced', 'View'],
      ['ADVANCE_ADVICE', 'Paid', 'Print'],
      ['PAYMENT_ADVICE', 'Paid', 'Print'],
    ]);
    expect(docs.find((d) => d.kind === 'LPO')?.subtitle).toMatch(/^LPO-0001 · 4 items · KES 30,136$/);
    expect(docs.find((d) => d.kind === 'PAYMENT_ADVICE')?.paymentId).not.toBeNull();
  });

  it('records the receipt with its own delivered and not-supplied totals (regression: it used to store 0)', () => {
    const { s, id } = delivered();
    const d = getOrder(s, acc, id, now).delivery;
    expect(d?.deliveredTotal).toBe('27486.00');
    expect(d?.notSuppliedTotal).toBe('2890.00');
    expect(getOrder(s, acc, id, now).documents.find((x) => x.kind === 'GOODS_RECEIPT')?.subtitle).toMatch(/GRN-0001 · signed with PIN · KES 27,486$/);
    expect(getOrder(s, acc, id, now).activity.find((a) => a.action === 'Received goods')?.detail).toMatch(/delivered value KES 27,486\.00 · GRN-0001$/);
  });

  it('hides invoice and payment documents, and every figure, from a caller who may not read money', () => {
    const { s, id } = invoiced();
    const docs = getOrder(s, att, id, now).documents;
    expect(docs.every((d) => !/KES/.test(d.subtitle))).toBe(true);
    expect(docs.some((d) => d.kind === 'INVOICE' || d.kind === 'PAYMENT_ADVICE')).toBe(false);
  });

  it('lets someone who handles the paperwork add a document, which is logged', () => {
    const { s, id } = invoiced();
    const file = addUpload(s, { fileName: 'Samrat receipt 11 Oct.jpg', size: 800_000, mime: 'image/jpeg', thumbnail: null });
    expect(getOrder(s, acc, id, now).can.addDocument).toBe(true);
    expect(getOrder(s, dir, id, now).can.addDocument).toBe(false);
    expect(codeOf(() => addDocument(s, dir, id, { title: "Supplier's receipt", fileId: file.id }, now))).toBe('FORBIDDEN');
    expect(codeOf(() => addDocument(s, acc, id, { title: ' ', fileId: file.id }, now))).toBe('VALIDATION');
    expect(codeOf(() => addDocument(s, acc, id, { title: 'x', fileId: 'nope' }, now))).toBe('VALIDATION');
    const doc = addDocument(s, acc, id, { title: "Supplier's receipt", fileId: file.id }, now);
    expect(doc).toMatchObject({ kind: 'OTHER', step: 'Invoiced', subtitle: 'Samrat receipt 11 Oct.jpg', addedBy: 'Margaret' });
    expect(getOrder(s, acc, id, now).documents.at(-1)?.title).toBe("Supplier's receipt");
    expect(getOrder(s, acc, id, now).activity[0]?.action).toBe('Added document');
  });
});

describe('the audit log (Paper 23)', () => {
  it('lists every Purchasing and payment action, newest first, for roles that may read the audit log', () => {
    const { s, inv } = invoiced();
    recordPayment(s, acc, inv.id, payInput({ amount: '100' }), now);
    for (const who of [acc, sm, dir, bm, sa]) {
      const rows = auditLog(s, who);
      expect(rows.length).toBeGreaterThan(5);
      expect(rows[0]?.what).toMatch(/paid KES 100/);
      expect(rows[0]?.supplierName).toBe('Samrat Supermarket Ltd');
    }
    expect(codeOf(() => auditLog(s, att))).toBe('FORBIDDEN');
  });

  it('gives each row the columns Paper shows: who and role, action, area, document and what changed', () => {
    const { s, inv } = invoiced();
    const p = recordPayment(s, acc, inv.id, payInput({ amount: '100', method: 'CHEQUE', chequeNo: '000412' }), now).payment;
    const rows = auditLog(s, acc);
    expect(rows[0]).toMatchObject({ actor: { name: 'Margaret', role: 'Accountant' }, action: 'Recorded payment', area: 'Payments', document: p.reference });
    expect(rows[0]?.detail).toMatch(/KES 100\.00 · Cheque 000412 · applied to INV-05188/);
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ['Saved draft order', 'Approved order', 'Sent order on WhatsApp', 'Recorded advance payment', 'Received goods', 'Added invoice']) expect(actions.has(a)).toBe(true);
    expect(rows.find((r) => r.action === 'Received goods')?.area).toBe('Purchasing');
    expect(rows.find((r) => r.action === 'Added invoice')?.document).toBe('INV-05188');
  });
});

describe('uploads: the failure hook for Paper 35', () => {
  it('a file named "fail" behaves like a dropped connection', () => {
    const s = emptyState();
    expect(codeOf(() => addUpload(s, { fileName: 'fail-test.jpg', size: 10, mime: 'image/jpeg', thumbnail: null }))).toBe('UPLOAD_FAILED');
  });
});

describe('every demo scenario', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.key} builds from real engine operations and every file opens as every reading role`, () => {
      const s = sc.build(now);
      for (const who of [sm, acc, dir, bm, sa]) {
        for (const o of s.orders) expect(() => getOrder(s, who, o.id, now)).not.toThrow();
        expect(() => listOrders(s, who, {}, now)).not.toThrow();
        expect(() => auditLog(s, who)).not.toThrow();
      }
      // The statement balance is what we owe less any credit held, for every supplier.
      for (const sup of SUPPLIERS) {
        const st = supplierStatement(s, acc, sup.id, now);
        const o = supplierPurchasing(s, acc, sup.id, now).owing;
        expect(Number.parseFloat(st.closingBalance)).toBeCloseTo(Number.parseFloat(o.owing) - Number.parseFloat(o.creditHeld), 2);
      }
    });
  }

  it('the busy default day gives the Accountant something in every tab, and the Paper cases', () => {
    const s = SCENARIOS.find((x) => x.key === 'default')?.build(now) as State;
    const stage = (st: 'INVOICE' | 'PAY' | 'CLOSED'): number => listOrders(s, acc, { stage: st }, now).total;
    expect(stage('INVOICE')).toBeGreaterThanOrEqual(2);
    expect(stage('PAY')).toBeGreaterThanOrEqual(4);
    expect(stage('CLOSED')).toBeGreaterThanOrEqual(3);
    const pay = listOrders(s, acc, { stage: 'PAY' }, now).orders;
    expect(pay.some((o) => o.dueLabel === 'OVERDUE')).toBe(true);
    expect(pay.some((o) => o.invoice?.disputed)).toBe(true);
    expect(pay.some((o) => Number.parseFloat(o.invoice?.advanceApplied ?? '0') > 0)).toBe(true);
    const closed = listOrders(s, acc, { stage: 'CLOSED' }, now).orders;
    expect(closed.some((o) => o.status === 'CANCELLED')).toBe(true);
    expect(closed.some((o) => o.payments.some((p) => p.method === 'CHEQUE'))).toBe(true);
  });
});
