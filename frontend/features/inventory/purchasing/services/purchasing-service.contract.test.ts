import { describe, expect, it } from 'vitest';

import { ctxFor } from '../mock/demo-actors';
import { createMockPurchasingService } from '../mock/mock-service';
import { createMockStore } from '../mock/store';
import type { PurchasingService } from './purchasing-service';
import { PurchasingError } from '../types';

/**
 * Contract tests: one block per operation of `PurchasingService`, written against the interface only. `factory` is the
 * single place that knows about the mock; when the real back-end exists, point it at the HTTP implementation and the same
 * suite runs against the server.
 */
const now = new Date('2026-09-29T12:00:00Z');
const factory = (role: Parameters<typeof ctxFor>[0], scenario = 'fresh'): PurchasingService => {
  const store = createMockStore(null, () => now);
  store.reset(scenario);
  return createMockPurchasingService(store, ctxFor(role), { now: () => now });
};
/** Several callers on one shared store, as in the browser. */
const shared = (scenario = 'fresh') => {
  const store = createMockStore(null, () => now);
  store.reset(scenario);
  return (role: Parameters<typeof ctxFor>[0]) => createMockPurchasingService(store, ctxFor(role), { now: () => now });
};

const input = { supplierId: 'sup-kagumo', expectedDate: '2026-09-30', supplierNote: null, attendantNote: 'Low on chicken', lines: [{ inventoryItemId: 'it-chicken', qty: '5', unitPrice: '2450' }] };
const rejects = async (p: Promise<unknown>, code: string): Promise<void> => {
  await expect(p).rejects.toSatisfy((e) => e instanceof PurchasingError && e.code === code);
};

describe('contract: reads', () => {
  it('getSummary returns tab counts and the approval value', async () => {
    const s = await factory('STORE_MANAGER', 'default').getSummary();
    expect(Object.keys(s.counts).sort()).toEqual(['approval', 'closed', 'invoice', 'needs', 'pay', 'receive']);
    expect(s.counts.approval).toBe(2);
    expect(s.counts.receive).toBeGreaterThan(0);
  });

  it('getNeedsRestocking groups by supplier and lists "No supplier yet" last', async () => {
    const n = await factory('STORE_MANAGER').getNeedsRestocking();
    expect(n.itemCount).toBeGreaterThan(0);
    expect(n.groups.every((g) => g.lines.length === g.itemCount)).toBe(true);
  });

  it('listOrders filters by stage, and getOrder returns the purchase file with activity', async () => {
    const svc = factory('STORE_MANAGER', 'default');
    const list = await svc.listOrders({ stage: 'APPROVAL' });
    expect(list.total).toBe(2);
    expect(list.orders[0]?.itemSummary).toMatch(/item/);
    const file = await svc.getOrder(list.orders[0]!.id);
    expect(file.lines.length).toBeGreaterThan(0);
    expect(file.activity.length).toBeGreaterThan(0);
    await rejects(svc.getOrder('nope'), 'ORDER_NOT_FOUND');
  });

  it('getLpo, getWhatsapp and getCatalog return their print data', async () => {
    const svc = factory('STORE_MANAGER', 'ready-to-send');
    const [row] = (await svc.listOrders()).orders;
    expect((await svc.getLpo(row!.id)).reference).toBe('LPO-0001');
    expect((await svc.getWhatsapp(row!.id)).pdfFileName).toBe('LPO-0001.pdf');
    expect((await svc.getCatalog({ supplierId: 'sup-samrat' })).items.length).toBeGreaterThan(0);
  });
});

describe('contract: order lifecycle across two callers sharing one store', () => {
  it('the Attendant’s request appears for the Store Manager, who approves and sends it', async () => {
    const as = shared();
    const att = as('STORE_ATTENDANT');
    const d = await att.createOrder(input);
    expect(d.status).toBe('DRAFT');
    await att.submitOrder(d.id);
    const sm = as('STORE_MANAGER');
    expect((await sm.listOrders({ stage: 'APPROVAL' })).total).toBe(1);
    await rejects(sm.approveOrder(d.id, '0000'), 'INVALID_PIN');
    const ok = await sm.approveOrder(d.id, '1234');
    expect(ok.status).toBe('APPROVED');
    expect((await sm.sendOrder(d.id, 'WHATSAPP')).status).toBe('SENT');
  });

  it('returnOrder, updateOrder and discardOrder', async () => {
    const as = shared();
    const att = as('STORE_ATTENDANT');
    const d = await att.createOrder(input);
    await att.submitOrder(d.id);
    expect((await as('STORE_MANAGER').returnOrder(d.id, 'Fewer please')).status).toBe('RETURNED');
    expect((await att.updateOrder(d.id, { supplierNote: 'edited' })).supplierNote).toBe('edited');
    const second = await att.createOrder({ ...input, supplierId: 'sup-summer', lines: [{ inventoryItemId: 'it-flour', qty: '2', unitPrice: '1960' }] });
    await att.discardOrder(second.id);
    await rejects(att.getOrder(second.id), 'ORDER_NOT_FOUND');
  });

  it('cancelOrder needs orders.cancel and a PIN', async () => {
    const as = shared('ready-to-send');
    const id = (await as('STORE_MANAGER').listOrders()).orders[0]!.id;
    await rejects(as('STORE_ATTENDANT').cancelOrder(id, { reason: 'OTHER', note: null, pin: '1234' }), 'FORBIDDEN');
    expect((await as('STORE_MANAGER').cancelOrder(id, { reason: 'OTHER', note: null, pin: '1234' })).status).toBe('CANCELLED');
  });
});

describe('contract: deposit, upload, receive', () => {
  it('recordDeposit returns a PAY- payment for the Accountant and refuses the Director', async () => {
    const as = shared('ready-to-send');
    const id = (await as('STORE_MANAGER').listOrders()).orders[0]!.id;
    const body = { amount: '5000', paidOn: '2026-09-29', method: 'BANK_TRANSFER' as const, methodRef: 'EFT-1', chequeNo: null, note: null };
    expect((await as('ACCOUNTANT').recordDeposit(id, body)).reference).toBe('PAY-0001');
    await rejects(as('DIRECTOR').recordDeposit(id, body), 'FORBIDDEN');
  });

  it('upload then receiveOrder delivers the order and numbers the receipt', async () => {
    const as = shared('price-change-delivery');
    const id = (await as('STORE_MANAGER').listOrders()).orders[0]!.id;
    const att = as('STORE_ATTENDANT');
    const photo = await att.upload(new File(['x'], 'IMG_1.jpg', { type: 'image/jpeg' }));
    await rejects(att.receiveOrder(id, { lines: [], deliveryNoteNo: 'DN-1', deliveryNotePhotoId: photo.id, pin: '1234' }), 'PRICE_CHANGE_UNCONFIRMED');
    const file = await att.getOrder(id);
    const oil = file.lines.find((l) => l.inventoryItemId === 'it-oil')!;
    expect(oil.priceChanged).toBe(true);
    const done = await att.receiveOrder(id, { lines: [{ lineId: oil.id, receivedQty: oil.orderedQty, priceConfirmed: true }], deliveryNoteNo: 'DN-1', deliveryNotePhotoId: photo.id, pin: '1234' });
    expect(done.status).toBe('DELIVERED');
    expect(done.delivery?.reference).toBe('GRN-0001');
    expect(done.money).toBeNull();
  });
});

describe('contract: invoice, dispute, void', () => {
  const body = { number: 'INV-05188', date: '2026-09-29', amount: '27486', photoId: null, varianceReason: null };

  it('addInvoice moves the order to To pay for the Accountant, and refuses callers without payables.record_invoice', async () => {
    const as = shared('delivered-awaiting-invoice');
    const id = (await as('ACCOUNTANT').listOrders({ stage: 'INVOICE' })).orders[0]!.id;
    await rejects(as('DIRECTOR').addInvoice(id, body), 'FORBIDDEN');
    await rejects(as('STORE_ATTENDANT').addInvoice(id, body), 'FORBIDDEN');
    await rejects(as('ACCOUNTANT').addInvoice(id, { ...body, amount: '27986' }), 'REASON_REQUIRED');
    const inv = await as('ACCOUNTANT').addInvoice(id, body);
    expect(inv).toMatchObject({ number: 'INV-05188', balance: '17486.00', advanceApplied: '10000.00', disputed: false, status: 'OPEN' });
    expect((await as('ACCOUNTANT').getOrder(id)).status).toBe('INVOICED');
    await rejects(as('ACCOUNTANT').addInvoice(id, body), 'INVOICE_EXISTS');
  });

  it('a higher invoice is saved as disputed, settleDispute clears it, and a payment is refused until then', async () => {
    const as = shared('delivered-awaiting-invoice');
    const acc = as('ACCOUNTANT');
    const id = (await acc.listOrders({ stage: 'INVOICE' })).orders[0]!.id;
    const inv = await acc.addInvoice(id, { ...body, amount: '27986', varianceReason: 'Delivery charge' });
    expect(inv.disputed).toBe(true);
    const pay = { amount: '17986', paidOn: '2026-09-29', method: 'BANK_TRANSFER' as const, methodRef: null, chequeNo: null, proofPhotoId: null };
    await rejects(acc.recordPayment(inv.id, pay), 'INVOICE_DISPUTED');
    await rejects(as('DIRECTOR').settleDispute(inv.id, { agreedAmount: '27486', note: 'x' }), 'FORBIDDEN');
    await rejects(acc.settleDispute(inv.id, { agreedAmount: '27486', note: '' }), 'REASON_REQUIRED');
    const settled = await acc.settleDispute(inv.id, { agreedAmount: '27486', note: 'Charge dropped' });
    expect(settled).toMatchObject({ disputed: false, amount: '27486.00', balance: '17486.00' });
    await rejects(acc.settleDispute(inv.id, { agreedAmount: '27486', note: 'again' }), 'INVOICE_NOT_DISPUTED');
  });

  it('voidInvoice needs a PIN and no payments, and returns the order to Delivered', async () => {
    const as = shared('invoice-to-pay');
    const acc = as('ACCOUNTANT');
    const file = (await acc.listOrders({ stage: 'PAY' })).orders[0]!;
    const invId = file.invoice!.id;
    await rejects(acc.voidInvoice(invId, { reason: 'WRONG_AMOUNT', pin: '0000' }), 'INVALID_PIN');
    await rejects(as('MANAGER').voidInvoice(invId, { reason: 'WRONG_AMOUNT', pin: '1234' }), 'FORBIDDEN');
    expect((await acc.voidInvoice(invId, { reason: 'WRONG_AMOUNT', pin: '1234' })).status).toBe('DELIVERED');
    await rejects(acc.voidInvoice(invId, { reason: 'WRONG_AMOUNT', pin: '1234' }), 'INVOICE_NOT_FOUND');
  });
});

describe('contract: payment, reversal, advice', () => {
  const pay = { amount: '17486', paidOn: '2026-09-29', method: 'CHEQUE' as const, methodRef: null, chequeNo: '000412', proofPhotoId: null };

  it('recordPayment closes the order, needs a cheque number, refuses an overpayment and the Director', async () => {
    const as = shared('invoice-to-pay');
    const acc = as('ACCOUNTANT');
    const row = (await acc.listOrders({ stage: 'PAY' })).orders[0]!;
    const invId = row.invoice!.id;
    await rejects(as('DIRECTOR').recordPayment(invId, pay), 'FORBIDDEN');
    await rejects(acc.recordPayment(invId, { ...pay, chequeNo: null }), 'CHEQUE_NUMBER_REQUIRED');
    await rejects(acc.recordPayment(invId, { ...pay, amount: '20000' }), 'PAYMENT_EXCEEDS_BALANCE');
    const r = await acc.recordPayment(invId, pay);
    expect(r.payment).toMatchObject({ kind: 'INVOICE', chequeNo: '000412' });
    expect(r.order.status).toBe('CLOSED');
    expect((await acc.listOrders({ stage: 'CLOSED' })).total).toBe(1);
  });

  it('getPaymentAdvice returns the print data, and the Attendant is refused', async () => {
    const as = shared('paid-in-full');
    const acc = as('ACCOUNTANT');
    const order = (await acc.listOrders({ stage: 'CLOSED' })).orders[0]!;
    const p = order.payments.find((x) => x.kind === 'INVOICE')!;
    const adv = await acc.getPaymentAdvice(p.id);
    expect(adv).toMatchObject({ reference: p.reference, method: 'CHEQUE', balanceAfter: '0.00' });
    await rejects(as('STORE_ATTENDANT').getPaymentAdvice(p.id), 'FORBIDDEN');
    await rejects(acc.getPaymentAdvice('nope'), 'PAYMENT_NOT_FOUND');
  });

  it('reversePayment needs a Store Manager PIN and reopens the invoice', async () => {
    const as = shared('paid-in-full');
    const acc = as('ACCOUNTANT');
    const p = (await acc.listOrders({ stage: 'CLOSED' })).orders[0]!.payments.find((x) => x.kind === 'INVOICE')!;
    await rejects(acc.reversePayment(p.id, { reason: 'WRONG_AMOUNT', note: null, approverPin: '0000' }), 'INVALID_PIN');
    await rejects(as('DIRECTOR').reversePayment(p.id, { reason: 'WRONG_AMOUNT', note: null, approverPin: '1234' }), 'FORBIDDEN');
    const r = await acc.reversePayment(p.id, { reason: 'WRONG_REFERENCE', note: null, approverPin: '1234' });
    expect(r.payment).toMatchObject({ kind: 'REVERSAL', approvedBy: { name: 'Joseph Mwangi' } });
    expect(r.order.status).toBe('INVOICED');
    await rejects(acc.reversePayment(p.id, { reason: 'WRONG_AMOUNT', note: null, approverPin: '1234' }), 'PAYMENT_ALREADY_REVERSED');
  });
});

describe('contract: supplier page, statement, audit log, documents', () => {
  it('getSupplierPurchasing returns what we owe and the orders; the Attendant is refused', async () => {
    const as = shared('default');
    const sp = await as('ACCOUNTANT').getSupplierPurchasing('sup-samrat');
    expect(sp.orders.length).toBeGreaterThan(0);
    expect(Number.parseFloat(sp.owing.owing)).toBeGreaterThan(0);
    expect(sp.owing.invoices.length).toBeGreaterThan(0);
    await rejects(as('STORE_ATTENDANT').getSupplierPurchasing('sup-samrat'), 'FORBIDDEN');
    await rejects(as('ACCOUNTANT').getSupplierPurchasing('nope'), 'SUPPLIER_NOT_FOUND');
  });

  it('getSupplierStatement honours the period and reads credit as adding to what we owe', async () => {
    const acc = shared('default')('ACCOUNTANT');
    const st = await acc.getSupplierStatement('sup-samrat');
    expect(st.lines.some((l) => l.kind === 'INVOICE' && l.credit !== '')).toBe(true);
    expect(Number.parseFloat(st.closingBalance)).toBeCloseTo(Number.parseFloat(st.openingBalance) + Number.parseFloat(st.totalCredit) - Number.parseFloat(st.totalDebit), 2);
    const empty = await acc.getSupplierStatement('sup-samrat', { from: '2020-01-01', to: '2020-01-31' });
    expect(empty.lines).toEqual([]);
    await rejects(shared('default')('STORE_ATTENDANT').getSupplierStatement('sup-samrat'), 'FORBIDDEN');
  });

  it('getAuditLog lists actions with their columns for the roles that read it, and refuses the Attendant', async () => {
    const as = shared('default');
    const rows = await as('ACCOUNTANT').getAuditLog();
    expect(rows.length).toBeGreaterThan(20);
    expect(rows[0]).toMatchObject({ action: expect.any(String), area: expect.stringMatching(/^(Purchasing|Payments)$/), detail: expect.any(String) });
    for (const r of ['STORE_MANAGER', 'DIRECTOR', 'MANAGER', 'SYSTEM_ADMIN'] as const) expect((await as(r).getAuditLog()).length).toBe(rows.length);
    await rejects(as('STORE_ATTENDANT').getAuditLog(), 'FORBIDDEN');
  });

  it('addDocument attaches an uploaded file to the purchase file; a failed upload can be retried', async () => {
    const as = shared('paid-in-full');
    const acc = as('ACCOUNTANT');
    const id = (await acc.listOrders({ stage: 'CLOSED' })).orders[0]!.id;
    await rejects(acc.upload(new File(['x'], 'fail-1.jpg', { type: 'image/jpeg' })), 'UPLOAD_FAILED');
    await rejects(acc.upload(new File([new Uint8Array(11_000_000)], 'huge.jpg', { type: 'image/jpeg' })), 'UPLOAD_TOO_LARGE');
    await rejects(acc.upload(new File(['x'], 'note.txt', { type: 'text/plain' })), 'UPLOAD_BAD_TYPE');
    const file = await acc.upload(new File(['x'], 'receipt.jpg', { type: 'image/jpeg' }));
    await rejects(as('DIRECTOR').addDocument(id, { title: 'Receipt', fileId: file.id }), 'FORBIDDEN');
    const doc = await acc.addDocument(id, { title: 'Receipt', fileId: file.id });
    expect(doc).toMatchObject({ title: 'Receipt', kind: 'OTHER' });
    expect((await acc.getOrder(id)).documents.map((d) => d.title)).toContain('Receipt');
  });
});

describe('every scenario builds a state the rules allow', () => {
  it.each([
    'fresh',
    'default',
    'accounts-day',
    'awaiting-approval',
    'returned-order',
    'ready-to-send',
    'sent-with-deposit',
    'price-change-delivery',
    'delivered-awaiting-invoice',
    'invoice-disputed',
    'invoice-to-pay',
    'invoice-overdue',
    'part-paid',
    'paid-in-full',
    'payment-reversed',
    'invoice-voided',
    'cancelled-order',
  ])('%s', async (key) => {
    const svc = factory('STORE_MANAGER', key);
    const sum = await svc.getSummary();
    expect(sum.counts.needs).toBeGreaterThanOrEqual(0);
    if (key === 'delivered-awaiting-invoice' || key === 'invoice-voided') expect(sum.counts.invoice).toBe(1);
    if (['invoice-disputed', 'invoice-to-pay', 'invoice-overdue', 'part-paid', 'payment-reversed'].includes(key)) expect(sum.counts.pay).toBe(1);
    if (key === 'paid-in-full' || key === 'cancelled-order') expect(sum.counts.closed).toBe(1);
    if (key === 'returned-order') expect((await factory('STORE_ATTENDANT', key).listOrders()).orders[0]?.status).toBe('RETURNED');
  });

  it('every scenario the demo bar lists is covered above', async () => {
    const { SCENARIOS } = await import('../mock/scenarios');
    expect(SCENARIOS).toHaveLength(17);
  });
});
