import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { locationRepository } from '../../../../repositories/location-repository';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { supplierItemRepository } from '../../suppliers/supplier-repository';
import { purchasingPin } from '../_shared/pin';
import { purchasingAudit } from '../_shared/purchasing-audit';
import { ordersRepository } from '../orders/orders-repository';
import { receivingRepository } from './receiving-repository';
import receivingRouter from './receiving-routes';
import { receivingService } from './receiving-service';

vi.mock('../orders/orders-repository', () => ({ ordersRepository: { findOrder: vi.fn(), transition: vi.fn() } }));
vi.mock('./receiving-repository', () => ({ receivingRepository: { createDelivery: vi.fn(), recordLineReceipt: vi.fn(), setItemCost: vi.fn() } }));
vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../repositories/location-repository', () => ({ locationRepository: { findCentralStore: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({}) } }));
vi.mock('../../../../middleware/authenticate', () => ({ authenticate: (_r: unknown, _s: unknown, next: () => void) => next() }));
vi.mock('../../_shared/reference-counter', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('../../stock/ledger/ledger-door', () => ({ postStockMovement: vi.fn() }));
vi.mock('../../suppliers/supplier-repository', () => ({ supplierItemRepository: { listBySupplierItems: vi.fn(), setLinePrice: vi.fn(), createLine: vi.fn() } }));
vi.mock('../_shared/pin', () => ({ purchasingPin: { verifyOwn: vi.fn() } }));
vi.mock('../_shared/purchasing-audit', async (orig) => ({ ...(await orig<object>()), purchasingAudit: { record: vi.fn() } }));
vi.mock('../files/files-service', () => ({ purchaseFileService: { resolve: vi.fn() } }));

const HUB = 'hub-1';
const D = (v: number | string) => new Prisma.Decimal(v);
const NOW = new Date('2026-10-06T08:00:00Z');
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const accountant = { id: 'acc', role: 'ACCOUNTANT', siteId: HUB } as never;
const PHOTO = '11111111-1111-1111-1111-111111111111';

const line = (id: string, item: string, qty: number, price: number, pack: number | null) => ({
  id, inventoryItemId: item, lineOrder: 1, supplierItemName: null, supplierItemCode: null, buyUnit: 'bag', packSize: pack ? D(pack) : null,
  orderedQty: D(qty), unitPrice: D(price), previousPrice: null, receivedQty: null, deliveredPrice: null, confirmedPrice: null, result: null, inventoryItem: { name: item },
});
const person = { id: 'u', name: 'Amina', role: 'STORE_ATTENDANT' };
const sent = () =>
  ({
    id: 'o1', reference: 'LPO-0001', supplierId: 'sup', status: 'SENT', termsDays: 14, expectedDate: null, supplierNote: null, attendantNote: null, raisedById: 'att',
    submittedAt: NOW, approvedById: null, approvedAt: null, returnedNote: null, returnedById: null, returnedAt: null, sentAt: NOW, sentVia: 'WHATSAPP',
    cancelReason: null, cancelNote: null, cancelledById: null, cancelledAt: null, createdAt: NOW, updatedAt: NOW,
    supplier: { id: 'sup', name: 'Samrat', code: 'S1', address: 'x', defaultPaymentTerms: 'INVOICE_TO_FOLLOW', paymentDays: 14, contacts: [], payMethods: [] },
    raisedBy: person, approvedBy: null, returnedBy: null, cancelledBy: null,
    lines: [line('l1', 'sugar', 10, 1000, 25), line('l2', 'oil', 4, 2340, null)],
    delivery: null, invoices: [], payments: [], documents: [], audit: [],
  }) as never;

const base = { deliveryNoteNo: 'DN-77', deliveryNotePhotoId: PHOTO, pin: '1234' };
const ids = { l1: '22222222-2222-2222-2222-222222222221', l2: '22222222-2222-2222-2222-222222222222' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue({ id: 'loc-1', siteId: HUB } as never);
  const order = sent() as unknown as { lines: Array<{ id: string }> };
  order.lines[0]!.id = ids.l1;
  order.lines[1]!.id = ids.l2;
  vi.mocked(ordersRepository.findOrder).mockResolvedValue(order as never);
  vi.mocked(ordersRepository.transition).mockResolvedValue(true);
  vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('GRN-0001');
  vi.mocked(purchasingPin.verifyOwn).mockResolvedValue({ id: 'att', name: 'Amina', role: 'STORE_ATTENDANT', pinHash: 'h' });
  vi.mocked(receivingRepository.createDelivery).mockResolvedValue({ id: 'd1', lineIds: new Map([[ids.l1, 'dl1'], [ids.l2, 'dl2']]) });
  vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([{ id: 'si1', buyUnit: 'bag', packSize: D(25) }] as never);
  vi.mocked(postStockMovement).mockResolvedValue({} as never);
});

const full = [
  { lineId: ids.l1, receivedQty: '10', deliveredPrice: null, priceConfirmed: false },
  { lineId: ids.l2, receivedQty: '4', deliveredPrice: null, priceConfirmed: false },
];

describe('receive', () => {
  it('posts one RECEIVE per line through the ledger door, in usage units at a per-usage-unit cost', async () => {
    await receivingService.receive(attendant, 'o1', { ...base, lines: full }, NOW);
    expect(postStockMovement).toHaveBeenCalledTimes(2);
    expect(vi.mocked(postStockMovement).mock.calls[0]?.[1]).toMatchObject({ type: 'RECEIVE', locationId: 'loc-1', inventoryItemId: 'sugar', userId: 'att', links: { purchaseDeliveryLineId: 'dl1' } });
    expect(vi.mocked(postStockMovement).mock.calls[0]?.[1].quantity).toEqual(D(250)); // 10 bags x 25
    expect(vi.mocked(postStockMovement).mock.calls[0]?.[1].unitCost).toEqual(D(40)); // 1000 / 25
    expect(vi.mocked(postStockMovement).mock.calls[1]?.[1].quantity).toEqual(D(4)); // no pack: already usage units
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', { from: ['APPROVED', 'SENT'], status: 'DELIVERED' });
    expect(receivingRepository.createDelivery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reference: 'GRN-0001', deliveredTotal: D(19360), notSuppliedTotal: D(0), deliveryNoteNo: 'DN-77' }));
    expect(purchasingAudit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'Received goods', actorId: 'att' }), NOW);
  });

  it('drops the missing quantity from a short delivery and values what arrived', async () => {
    await receivingService.receive(attendant, 'o1', { ...base, lines: [{ ...full[0]!, receivedQty: '6' }, { ...full[1]!, receivedQty: '0' }] }, NOW);
    expect(postStockMovement).toHaveBeenCalledTimes(1);
    expect(receivingRepository.createDelivery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ deliveredTotal: D(6000), notSuppliedTotal: D(4000 + 9360) }));
    expect(receivingRepository.recordLineReceipt).toHaveBeenCalledWith(expect.anything(), 'o1', ids.l1, expect.objectContaining({ result: 'SHORT' }));
    expect(receivingRepository.recordLineReceipt).toHaveBeenCalledWith(expect.anything(), 'o1', ids.l2, expect.objectContaining({ result: 'NOT_SUPPLIED' }));
  });

  it('needs a typed price that differs to be confirmed, then uses it for value, cost and the supplier price', async () => {
    const changed = [{ ...full[0]!, deliveredPrice: '1100' }, full[1]!];
    await expect(receivingService.receive(attendant, 'o1', { ...base, lines: changed }, NOW)).rejects.toMatchObject({ code: 'PRICE_CHANGE_UNCONFIRMED', statusCode: 422, details: { lineIds: [ids.l1] } });
    expect(postStockMovement).not.toHaveBeenCalled();
    expect(purchasingPin.verifyOwn).not.toHaveBeenCalled();

    await receivingService.receive(attendant, 'o1', { ...base, lines: [{ ...changed[0]!, priceConfirmed: true }, full[1]!] }, NOW);
    expect(vi.mocked(postStockMovement).mock.calls[0]?.[1].unitCost).toEqual(D(44));
    expect(receivingRepository.recordLineReceipt).toHaveBeenCalledWith(expect.anything(), 'o1', ids.l1, expect.objectContaining({ result: 'PRICE_CHANGED', confirmedPrice: D(1100), deliveredPrice: D(1100) }));
    expect(supplierItemRepository.setLinePrice).toHaveBeenCalledWith('si1', HUB, D(1100), NOW, expect.anything());
    expect(receivingRepository.setItemCost).toHaveBeenCalledWith(expect.anything(), HUB, 'sugar', D(44));
  });

  it('treats a typed price equal to the order price as no change', async () => {
    await receivingService.receive(attendant, 'o1', { ...base, lines: [{ ...full[0]!, deliveredPrice: '1000' }, full[1]!] }, NOW);
    expect(receivingRepository.recordLineReceipt).toHaveBeenCalledWith(expect.anything(), 'o1', ids.l1, expect.objectContaining({ result: 'AS_ORDERED', deliveredPrice: null }));
  });

  it('refuses more than ordered, a missing delivery note and an empty delivery', async () => {
    await expect(receivingService.receive(attendant, 'o1', { ...base, lines: [{ ...full[0]!, receivedQty: '11' }, full[1]!] }, NOW)).rejects.toMatchObject({ code: 'RECEIVED_EXCEEDS_ORDERED' });
    await expect(receivingService.receive(attendant, 'o1', { ...base, deliveryNotePhotoId: null, lines: full }, NOW)).rejects.toMatchObject({ code: 'DELIVERY_NOTE_REQUIRED' });
    await expect(receivingService.receive(attendant, 'o1', { ...base, deliveryNoteNo: '  ', lines: full }, NOW)).rejects.toMatchObject({ code: 'DELIVERY_NOTE_REQUIRED' });
    await expect(receivingService.receive(attendant, 'o1', { ...base, lines: full.map((l) => ({ ...l, receivedQty: '0' })) }, NOW)).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('refuses a wrong PIN before any stock moves and an order that is not awaiting delivery', async () => {
    vi.mocked(purchasingPin.verifyOwn).mockRejectedValueOnce(Object.assign(new Error('pin'), { code: 'INVALID_PIN' }));
    await expect(receivingService.receive(attendant, 'o1', { ...base, lines: full }, NOW)).rejects.toMatchObject({ code: 'INVALID_PIN' });
    expect(ordersRepository.transition).not.toHaveBeenCalled();

    const delivered = sent() as unknown as { status: string };
    delivered.status = 'DELIVERED';
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(delivered as never);
    await expect(receivingService.receive(attendant, 'o1', { ...base, lines: full }, NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
  });

  it('creates a supplier line for an item the supplier never sold us', async () => {
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([]);
    await receivingService.receive(attendant, 'o1', { ...base, lines: full }, NOW);
    expect(supplierItemRepository.createLine).toHaveBeenCalledTimes(2);
  });
});

describe('route', () => {
  const guardFor = (role: string): boolean => {
    const layer = (receivingRouter as unknown as { stack: Array<{ route?: { path: string; stack: Array<{ handle: (...a: unknown[]) => void }> } }> }).stack.find((l) => l.route?.path === '/orders/:id/receive');
    let ok = false;
    try {
      layer?.route?.stack[0]?.handle({ user: { id: 'u', role, siteId: HUB } }, {}, () => { ok = true; });
    } catch {
      ok = false;
    }
    return ok;
  };

  it('is open to those who receive and closed to the Accountant', () => {
    expect(guardFor('STORE_ATTENDANT')).toBe(true);
    expect(guardFor('STORE_MANAGER')).toBe(true);
    expect(guardFor('ACCOUNTANT')).toBe(false);
    void accountant;
  });
});
