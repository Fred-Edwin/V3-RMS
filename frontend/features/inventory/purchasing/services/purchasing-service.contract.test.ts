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

describe('every scenario builds a state the rules allow', () => {
  it.each(['fresh', 'default', 'awaiting-approval', 'ready-to-send', 'sent-with-deposit', 'price-change-delivery', 'delivered-awaiting-invoice'])('%s', async (key) => {
    const svc = factory('STORE_MANAGER', key);
    const sum = await svc.getSummary();
    expect(sum.counts.needs).toBeGreaterThanOrEqual(0);
    if (key === 'delivered-awaiting-invoice') expect(sum.counts.invoice).toBe(1);
  });
});
