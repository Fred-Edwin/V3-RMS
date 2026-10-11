import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { ForbiddenError } from '../../../../utils/errors';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { purchasingPin } from '../_shared/pin';
import { purchasingAudit } from '../_shared/purchasing-audit';
import { purchasingNotices } from '../_shared/purchasing-notify';
import { ordersRepository } from './orders-repository';
import ordersRouter from './orders-routes';
import { ordersService } from './orders-service';

vi.mock('./orders-repository', () => ({
  ordersRepository: {
    findOrder: vi.fn(), list: vi.fn(), countByStatus: vi.fn(), findAwaitingApprovalLines: vi.fn(), countDueToReceive: vi.fn(),
    findSupplier: vi.fn(), findOpenOrder: vi.fn(), findItems: vi.fn(), findSupplierLines: vi.fn(), findPreviousPrices: vi.fn(),
    create: vi.fn(), replaceLines: vi.fn(), updateDetails: vi.fn(), transition: vi.fn(), deleteDraft: vi.fn(),
    findActiveCarrier: vi.fn(), findActiveStaff: vi.fn(), listCollectors: vi.fn(), setCollectedBy: vi.fn(), findLastAuditAt: vi.fn(),
  },
}));
vi.mock('../_shared/purchasing-notify', () => ({
  purchasingNotices: { submitted: vi.fn(), approved: vi.fn(), returned: vi.fn(), reminder: vi.fn(), closed: vi.fn() },
}));
vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({}) } }));
vi.mock('../../../../middleware/authenticate', () => ({ authenticate: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../../_shared/reference-counter', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('../_shared/pin', () => ({ purchasingPin: { verifyOwn: vi.fn() } }));
vi.mock('../_shared/purchasing-audit', async (orig) => ({ ...(await orig<object>()), purchasingAudit: { record: vi.fn() } }));
vi.mock('../needs-restocking/needs-restocking-service', () => ({ needsRestockingService: { countNeeds: vi.fn().mockResolvedValue(3) } }));

const HUB = 'hub-1';
const D = (v: number | string) => new Prisma.Decimal(v);
const manager = { id: 'sm', role: 'STORE_MANAGER', siteId: HUB } as never;
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const accountant = { id: 'acc', role: 'ACCOUNTANT', siteId: HUB } as never;
const NOW = new Date('2026-10-06T08:00:00Z');

const user = (id: string, name: string, role: string) => ({ id, name, role });
const supplier = { id: 'sup', name: 'Samrat', code: 'SUPPLIER-0001', address: 'Nyeri', status: 'ACTIVE', deletedAt: null, defaultPaymentTerms: 'INVOICE_TO_FOLLOW', paymentDays: 14, contacts: [{ name: 'Ravi Shah', phone: '0700', whatsapp: '0711' }], payMethods: [] };

const order = (over: Record<string, unknown> = {}) =>
  ({
    id: 'o1', reference: null, supplierId: 'sup', status: 'DRAFT', termsDays: 14, expectedDate: null, supplierNote: null, attendantNote: null,
    raisedById: 'att', submittedAt: null, approvedById: null, approvedAt: null, returnedNote: null, returnedById: null, returnedAt: null,
    sentAt: null, sentVia: null, cancelReason: null, cancelNote: null, cancelledById: null, cancelledAt: null, createdAt: NOW, updatedAt: NOW,
    supplier, raisedBy: user('att', 'Amina', 'STORE_ATTENDANT'), approvedBy: null, returnedBy: null, cancelledBy: null,
    lines: [{ id: 'l1', inventoryItemId: 'sugar', lineOrder: 1, supplierItemName: null, supplierItemCode: null, buyUnit: 'kg', packSize: D(1), orderedQty: D(10), unitPrice: D(168), previousPrice: null, receivedQty: null, deliveredPrice: null, confirmedPrice: null, result: null, inventoryItem: { name: 'Sugar' } }],
    delivery: null, invoices: [], payments: [], documents: [], audit: [],
    ...over,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(ordersRepository.findOrder).mockResolvedValue(order());
  vi.mocked(ordersRepository.transition).mockResolvedValue(true);
  vi.mocked(ordersRepository.findSupplier).mockResolvedValue(supplier as never);
  vi.mocked(ordersRepository.findOpenOrder).mockResolvedValue(null);
  vi.mocked(ordersRepository.findItems).mockResolvedValue([{ id: 'sugar', name: 'Sugar', usageUnit: 'kg', buyUnit: 'kg', packSize: null }]);
  vi.mocked(ordersRepository.findSupplierLines).mockResolvedValue([{ inventoryItemId: 'sugar', supplierItemName: 'SUGAR 1KG', supplierItemCode: 'S1', buyUnit: 'kg', packSize: null, lastPrice: D(168), lastPriceAt: null, isPreferred: true }]);
  vi.mocked(ordersRepository.findPreviousPrices).mockResolvedValue(new Map([['sugar', D(160)]]));
  vi.mocked(ordersRepository.create).mockResolvedValue('o1');
  vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('LPO-0001');
});

const input = { supplierId: 'sup', expectedDate: null, supplierNote: null, attendantNote: null, lines: [{ inventoryItemId: 'sugar', qty: '10', unitPrice: '' }] };

describe('create', () => {
  it('saves a draft at the supplier price with the last order price beside it', async () => {
    await ordersService.create(attendant, input, NOW);
    const data = vi.mocked(ordersRepository.create).mock.calls[0]?.[1];
    expect(data).toMatchObject({ siteId: HUB, supplierId: 'sup', termsDays: 14, raisedById: 'att' });
    expect(data?.lines[0]).toMatchObject({ unitPrice: D(168), previousPrice: D(160), buyUnit: 'kg', supplierItemCode: 'S1' });
    expect(purchasingAudit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'Saved draft order' }), NOW);
  });

  it('refuses a second open order to the same supplier', async () => {
    vi.mocked(ordersRepository.findOpenOrder).mockResolvedValue({ id: 'o0', reference: 'LPO-0009' });
    await expect(ordersService.create(attendant, input, NOW)).rejects.toMatchObject({ code: 'SUPPLIER_ORDER_OPEN', statusCode: 409, details: { openReference: 'LPO-0009' } });
    expect(ordersRepository.create).not.toHaveBeenCalled();
  });

  it('refuses a supplier on hold', async () => {
    vi.mocked(ordersRepository.findSupplier).mockResolvedValue({ ...supplier, status: 'ON_HOLD' } as never);
    await expect(ordersService.create(attendant, input, NOW)).rejects.toMatchObject({ code: 'SUPPLIER_ON_HOLD' });
  });

  it('refuses an item the supplier has no price for when the caller cannot type one', async () => {
    vi.mocked(ordersRepository.findSupplierLines).mockResolvedValue([]);
    await expect(ordersService.create(attendant, { ...input, lines: [{ inventoryItemId: 'sugar', qty: '10', unitPrice: '150' }] }, NOW)).rejects.toMatchObject({ code: 'ITEM_SETUP_INCOMPLETE' });
  });

  it('lets the Store Manager type a price for an item the supplier has no price for', async () => {
    vi.mocked(ordersRepository.findSupplierLines).mockResolvedValue([]);
    await ordersService.create(manager, { ...input, lines: [{ inventoryItemId: 'sugar', qty: '10', unitPrice: '150' }] }, NOW);
    expect(vi.mocked(ordersRepository.create).mock.calls[0]?.[1].lines[0]?.unitPrice).toEqual(D(150));
  });

  it('refuses the same item twice and zero quantities', async () => {
    await expect(ordersService.create(attendant, { ...input, lines: [...input.lines, ...input.lines] }, NOW)).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(ordersService.create(attendant, { ...input, lines: [{ inventoryItemId: 'sugar', qty: '0', unitPrice: '' }] }, NOW)).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('submit, approve, return, send, cancel', () => {
  it('numbers the order at submit and moves it to approval', async () => {
    await ordersService.submit(attendant, 'o1', NOW);
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining({ status: 'AWAITING_APPROVAL', reference: 'LPO-0001', submittedAt: NOW }));
  });

  it('keeps the number when a returned order is sent again', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'RETURNED', reference: 'LPO-0007' }));
    await ordersService.submit(attendant, 'o1', NOW);
    expect(referenceCounterRepository.nextReference).not.toHaveBeenCalled();
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining({ reference: 'LPO-0007' }));
  });

  it("does not let an attendant submit someone else's draft", async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ raisedById: 'someone' }));
    await expect(ordersService.submit(attendant, 'o1', NOW)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('approves with the approver PIN and refuses a wrong one before writing', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0001' }));
    await ordersService.approve(manager, 'o1', '1234', NOW);
    expect(purchasingPin.verifyOwn).toHaveBeenCalledWith(manager, '1234');
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining({ status: 'APPROVED', approvedById: 'sm' }));

    vi.mocked(ordersRepository.transition).mockClear();
    vi.mocked(purchasingPin.verifyOwn).mockRejectedValueOnce(Object.assign(new Error('pin'), { code: 'INVALID_PIN' }));
    await expect(ordersService.approve(manager, 'o1', '0000', NOW)).rejects.toMatchObject({ code: 'INVALID_PIN' });
    expect(ordersRepository.transition).not.toHaveBeenCalled();
  });

  it('numbers an approver’s own draft when approving it straight away', async () => {
    await ordersService.approve(manager, 'o1', '1234', NOW);
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining({ reference: 'LPO-0001', status: 'APPROVED' }));
  });

  it('will not approve an order that is already approved', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'APPROVED', reference: 'LPO-0001' }));
    await expect(ordersService.approve(manager, 'o1', '1234', NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE', statusCode: 409 });
  });

  it('turns a lost race into ORDER_WRONG_STATE', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0001' }));
    vi.mocked(ordersRepository.transition).mockResolvedValue(false);
    await expect(ordersService.approve(manager, 'o1', '1234', NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
  });

  it('needs a note to return an order', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0001' }));
    await expect(ordersService.returnOrder(manager, 'o1', '  ', NOW)).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    await ordersService.returnOrder(manager, 'o1', 'Check the sugar quantity', NOW);
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining({ status: 'RETURNED', returnedNote: 'Check the sugar quantity' }));
  });

  it('sends an approved order once and a second send changes nothing', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'APPROVED', reference: 'LPO-0001' }));
    await ordersService.send(manager, 'o1', 'WHATSAPP', NOW);
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining({ status: 'SENT', sentVia: 'WHATSAPP' }));
    vi.mocked(ordersRepository.transition).mockClear();
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'SENT', reference: 'LPO-0001' }));
    await ordersService.send(manager, 'o1', 'PRINT', NOW);
    expect(ordersRepository.transition).not.toHaveBeenCalled();
  });

  it('cancels with a PIN, and never after delivery', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'SENT', reference: 'LPO-0001' }));
    await ordersService.cancel(manager, 'o1', { reason: 'NO_LONGER_NEEDED', note: null, pin: '1234' }, NOW);
    expect(purchasingPin.verifyOwn).toHaveBeenCalled();
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining({ status: 'CANCELLED', cancelReason: 'NO_LONGER_NEEDED' }));

    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'DELIVERED', reference: 'LPO-0001' }));
    await expect(ordersService.cancel(manager, 'o1', { reason: 'OTHER', note: null, pin: '1234' }, NOW)).rejects.toMatchObject({ code: 'CANNOT_CANCEL_AFTER_DELIVERY' });
  });

  it('discards only a draft', async () => {
    vi.mocked(ordersRepository.deleteDraft).mockResolvedValue(true);
    await ordersService.discard(attendant, 'o1');
    expect(ordersRepository.deleteDraft).toHaveBeenCalledWith(expect.anything(), HUB, 'o1');
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'APPROVED', reference: 'LPO-0001' }));
    await expect(ordersService.discard(attendant, 'o1')).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
  });
});

const CARRIER_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const approved = (over: Record<string, unknown> = {}) => order({ status: 'APPROVED', reference: 'LPO-0045', approvedById: 'sm', approvedAt: NOW, approvedBy: user('sm', 'Joseph', 'STORE_MANAGER'), ...over });

describe('who is getting it (Paper 28D)', () => {
  beforeEach(() => {
    vi.mocked(ordersRepository.findActiveCarrier).mockResolvedValue({ id: CARRIER_ID, name: 'Wendo van KCB 214K' });
    vi.mocked(ordersRepository.findActiveStaff).mockResolvedValue({ id: STAFF_ID, name: 'Peter', role: 'STORE_ATTENDANT' });
    vi.mocked(ordersRepository.setCollectedBy).mockResolvedValue(true);
  });

  it('marks the order sent and stores the carrier in the same tap, with who set it and when', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    await ordersService.send(attendant, 'o1', 'MANUAL', NOW, { kind: 'CARRIER', carrierId: CARRIER_ID });
    expect(ordersRepository.transition).toHaveBeenCalledWith(
      expect.anything(),
      HUB,
      'o1',
      expect.objectContaining({ status: 'SENT', collectedByKind: 'CARRIER', collectedByCarrierId: CARRIER_ID, collectedByUserId: null, collectedByName: null, collectedBySetById: 'att', collectedBySetAt: NOW }),
    );
    expect(purchasingAudit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ detail: expect.stringContaining('collected by Wendo van KCB 214K') }), NOW);
  });

  it.each([
    [{ kind: 'SUPPLIER_DELIVERS' as const }, { collectedByKind: 'SUPPLIER_DELIVERS', collectedByCarrierId: null, collectedByUserId: null, collectedByName: null }, 'supplier delivers'],
    [{ kind: 'STAFF' as const, userId: STAFF_ID }, { collectedByKind: 'STAFF', collectedByCarrierId: null, collectedByUserId: STAFF_ID, collectedByName: null }, 'collected by Peter'],
    [{ kind: 'OTHER' as const, name: 'Kamau the driver' }, { collectedByKind: 'OTHER', collectedByCarrierId: null, collectedByUserId: null, collectedByName: 'Kamau the driver' }, 'collected by Kamau the driver'],
  ])('stores %j as the one kind it names and no other', async (collectedBy, columns, sentence) => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    await ordersService.send(attendant, 'o1', 'MANUAL', NOW, collectedBy);
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining(columns));
    expect(purchasingAudit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ detail: expect.stringContaining(sentence) }), NOW);
  });

  it('refuses a carrier that is retired or not on the Carriers list, and a person who is not on the staff, before writing', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    vi.mocked(ordersRepository.findActiveCarrier).mockResolvedValue(null);
    await expect(ordersService.send(attendant, 'o1', 'MANUAL', NOW, { kind: 'CARRIER', carrierId: CARRIER_ID })).rejects.toMatchObject({ code: 'COLLECTOR_NOT_FOUND', statusCode: 422 });
    vi.mocked(ordersRepository.findActiveStaff).mockResolvedValue(null);
    await expect(ordersService.send(attendant, 'o1', 'MANUAL', NOW, { kind: 'STAFF', userId: STAFF_ID })).rejects.toMatchObject({ code: 'COLLECTOR_NOT_FOUND' });
    expect(ordersRepository.transition).not.toHaveBeenCalled();
  });

  it('looks the carrier and the person up at the hub only', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    await ordersService.send(attendant, 'o1', 'MANUAL', NOW, { kind: 'CARRIER', carrierId: CARRIER_ID });
    expect(ordersRepository.findActiveCarrier).toHaveBeenCalledWith(HUB, CARRIER_ID);
  });

  it('a second send keeps what was stored and ignores a different choice (it changes nothing)', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved({ status: 'SENT' }));
    await ordersService.send(attendant, 'o1', 'MANUAL', NOW, { kind: 'SUPPLIER_DELIVERS' });
    expect(ordersRepository.transition).not.toHaveBeenCalled();
    expect(ordersRepository.findActiveCarrier).not.toHaveBeenCalled();
  });

  it('lets the approver say who is getting it while approving ("Set by Joseph (Store Manager)")', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0045' }));
    await ordersService.approve(manager, 'o1', '1234', NOW, { kind: 'CARRIER', carrierId: CARRIER_ID });
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining({ status: 'APPROVED', collectedByKind: 'CARRIER', collectedBySetById: 'sm' }));
  });

  it('sets, corrects and clears the choice on an approved or sent order, each in the audit log', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    await ordersService.setCollectedBy(attendant, 'o1', { kind: 'STAFF', userId: STAFF_ID }, NOW);
    expect(ordersRepository.setCollectedBy).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining({ collectedByKind: 'STAFF', collectedByUserId: STAFF_ID }));
    expect(purchasingAudit.record).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ action: 'Set who is getting the order', detail: 'collected by Peter' }), NOW);

    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved({ status: 'SENT' }));
    await ordersService.setCollectedBy(attendant, 'o1', null, NOW);
    expect(ordersRepository.setCollectedBy).toHaveBeenLastCalledWith(expect.anything(), HUB, 'o1', null);
    expect(purchasingAudit.record).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ action: 'Cleared who is getting the order' }), NOW);
  });

  it('refuses to change it before approval and after delivery, and a lost race', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0045' }));
    await expect(ordersService.setCollectedBy(attendant, 'o1', { kind: 'SUPPLIER_DELIVERS' }, NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved({ status: 'DELIVERED' }));
    await expect(ordersService.setCollectedBy(attendant, 'o1', { kind: 'SUPPLIER_DELIVERS' }, NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    vi.mocked(ordersRepository.setCollectedBy).mockResolvedValue(false);
    await expect(ordersService.setCollectedBy(attendant, 'o1', { kind: 'SUPPLIER_DELIVERS' }, NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
  });

  it('refuses a person who can neither approve nor request orders', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    await expect(ordersService.setCollectedBy(accountant, 'o1', { kind: 'SUPPLIER_DELIVERS' }, NOW)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('shows the choice on the order: "Sent, collected by ..." and who set it', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(
      approved({ status: 'SENT', collectedByKind: 'CARRIER', collectedByCarrierId: CARRIER_ID, collectedByUserId: null, collectedByCarrier: { id: CARRIER_ID, name: 'Wendo van KCB 214K', kind: 'VEHICLE' }, collectedBySetBy: user('sm', 'Joseph', 'STORE_MANAGER'), collectedBySetAt: NOW }),
    );
    const view = await ordersService.getOne(attendant, 'o1', NOW);
    expect(view.collectedBy).toEqual({ kind: 'CARRIER', label: 'Wendo van KCB 214K', summary: 'collected by Wendo van KCB 214K', carrierId: CARRIER_ID, userId: null, setBy: { id: 'sm', name: 'Joseph', role: 'Store Manager' }, setAt: NOW.toISOString() });
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved({ collectedByKind: 'SUPPLIER_DELIVERS' }));
    expect((await ordersService.getOne(attendant, 'o1', NOW)).collectedBy).toMatchObject({ label: 'Supplier delivers', summary: 'supplier delivers' });
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    expect((await ordersService.getOne(attendant, 'o1', NOW)).collectedBy).toBeNull();
  });

  it('lists the carriers and the hub staff for the picker', async () => {
    vi.mocked(ordersRepository.listCollectors).mockResolvedValue({ carriers: [{ id: CARRIER_ID, name: 'Wendo van KCB 214K', kind: 'VEHICLE' }], staff: [] });
    await expect(ordersService.getCollectors(attendant, 'van')).resolves.toMatchObject({ carriers: [{ name: 'Wendo van KCB 214K' }] });
    expect(ordersRepository.listCollectors).toHaveBeenCalledWith(HUB, 'van');
  });
});

describe('withdraw and remind (Paper 28H, 28K)', () => {
  const waiting = (over: Record<string, unknown> = {}) => order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0047', ...over });

  it('lets the person who raised an order take it back before approval, with no PIN, and records it as withdrawn', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(waiting());
    await ordersService.withdraw(attendant, 'o1', NOW);
    expect(purchasingPin.verifyOwn).not.toHaveBeenCalled();
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', expect.objectContaining({ status: 'CANCELLED', cancelReason: 'WITHDRAWN', cancelledById: 'att', cancelledAt: NOW, from: ['AWAITING_APPROVAL', 'RETURNED'] }));
    expect(purchasingAudit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'Withdrew order' }), NOW);
  });

  it('withdraws a returned order too', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(waiting({ status: 'RETURNED' }));
    await ordersService.withdraw(attendant, 'o1', NOW);
    expect(ordersRepository.transition).toHaveBeenCalled();
  });

  it("refuses someone else's order, an approved order, and a lost race", async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(waiting({ raisedById: 'someone' }));
    await expect(ordersService.withdraw(attendant, 'o1', NOW)).rejects.toBeInstanceOf(ForbiddenError);
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    await expect(ordersService.withdraw(attendant, 'o1', NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(waiting());
    vi.mocked(ordersRepository.transition).mockResolvedValue(false);
    await expect(ordersService.withdraw(attendant, 'o1', NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
  });

  it('reminds the Store Manager with a push and an audit row', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(waiting());
    vi.mocked(ordersRepository.findLastAuditAt).mockResolvedValue(null);
    await ordersService.remind(attendant, 'o1', NOW);
    expect(purchasingAudit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'Reminded the approver' }), NOW);
    expect(purchasingNotices.reminder).toHaveBeenCalledWith(expect.objectContaining({ hubId: HUB, orderId: 'o1', reference: 'LPO-0047', fromLabel: 'Amina (Store Attendant)' }));
  });

  it('will not remind again within four hours, and says when the last reminder was', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(waiting());
    vi.mocked(ordersRepository.findLastAuditAt).mockResolvedValue(new Date(NOW.getTime() - 3 * 3_600_000));
    await expect(ordersService.remind(attendant, 'o1', NOW)).rejects.toMatchObject({ code: 'REMINDER_TOO_SOON', statusCode: 409, details: { lastRemindedAt: '2026-10-06T05:00:00.000Z' } });
    expect(purchasingNotices.reminder).not.toHaveBeenCalled();
    vi.mocked(ordersRepository.findLastAuditAt).mockResolvedValue(new Date(NOW.getTime() - 5 * 3_600_000));
    await ordersService.remind(attendant, 'o1', NOW);
    expect(purchasingNotices.reminder).toHaveBeenCalledTimes(1);
  });

  it("refuses a reminder on someone else's order and on an order that is not waiting", async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(waiting({ raisedById: 'someone' }));
    await expect(ordersService.remind(attendant, 'o1', NOW)).rejects.toBeInstanceOf(ForbiddenError);
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    await expect(ordersService.remind(attendant, 'o1', NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
  });

  it('puts withdraw, remind and the collector choice in the order’s `can` block, for the right person only', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(waiting());
    expect((await ordersService.getOne(attendant, 'o1', NOW)).can).toMatchObject({ withdraw: true, remind: true, setCollectedBy: false });
    expect((await ordersService.getOne(manager, 'o1', NOW)).can).toMatchObject({ withdraw: false, remind: false });
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(approved());
    expect((await ordersService.getOne(attendant, 'o1', NOW)).can).toMatchObject({ withdraw: false, remind: false, setCollectedBy: true });
    expect((await ordersService.getOne(accountant, 'o1', NOW)).can).toMatchObject({ setCollectedBy: false });
  });
});

describe('the notices that follow a write (map rows 21b, 22, 23)', () => {
  it('tells the raiser, with the approver named with their role, and not when they approved their own', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValueOnce(order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0045' })).mockResolvedValue(approved());
    await ordersService.approve(manager, 'o1', '1234', NOW);
    expect(purchasingNotices.approved).toHaveBeenCalledWith(expect.objectContaining({ raisedById: 'att', approverLabel: 'Joseph (Store Manager)', reference: 'LPO-0045' }));

    vi.mocked(purchasingNotices.approved).mockClear();
    vi.mocked(ordersRepository.findOrder).mockResolvedValueOnce(order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0046', raisedById: 'sm' })).mockResolvedValue(approved({ raisedById: 'sm' }));
    await ordersService.approve(manager, 'o1', '1234', NOW);
    expect(purchasingNotices.approved).not.toHaveBeenCalled();
  });

  it('tells the raiser when the order is sent back, with the note', async () => {
    vi.mocked(ordersRepository.findOrder)
      .mockResolvedValueOnce(order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0048' }))
      .mockResolvedValue(order({ status: 'RETURNED', reference: 'LPO-0048', returnedNote: 'Lower the carrots', returnedBy: user('sm', 'Joseph', 'STORE_MANAGER') }));
    await ordersService.returnOrder(manager, 'o1', 'Lower the carrots', NOW);
    expect(purchasingNotices.returned).toHaveBeenCalledWith(expect.objectContaining({ raisedById: 'att', returnerLabel: 'Joseph (Store Manager)', note: 'Lower the carrots' }));
  });

  it('nudges the hub when an order is sent for approval', async () => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValueOnce(order()).mockResolvedValue(order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0001' }));
    await ordersService.submit(attendant, 'o1', NOW);
    expect(purchasingNotices.submitted).toHaveBeenCalledWith({ hubId: HUB, orderId: 'o1', reference: 'LPO-0001', supplierName: 'Samrat' });
  });
});

describe('reads and the blind rule', () => {
  beforeEach(() => {
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'INVOICED', reference: 'LPO-0001', invoices: [{ id: 'i1', number: 'INV-1', invoiceDate: NOW, dueDate: NOW, amount: D(1680), status: 'OPEN', disputed: false, varianceAmount: null, varianceReason: null, settledAmount: null, settledNote: null, settledById: null, settledAt: null, settledBy: null, voidReason: null, voidedById: null, voidedAt: null, voidedBy: null, file: null, enteredBy: user('acc', 'Margaret', 'ACCOUNTANT'), enteredAt: NOW }], payments: [] }));
  });

  it('gives the Accountant the invoice and the money block', async () => {
    const view = await ordersService.getOne(accountant, 'o1', NOW);
    expect(view.invoice).toMatchObject({ number: 'INV-1', balance: '1680.00' });
    expect(view.money).toMatchObject({ ordered: '1680.00', invoiced: '1680.00', stillToPay: '1680.00' });
  });

  it('gives the Attendant item prices and the order total but no invoice, payments or money', async () => {
    const view = await ordersService.getOne(attendant, 'o1', NOW);
    expect(view.orderedTotal).toBe('1680.00');
    expect(view.lines[0]).toMatchObject({ unitPrice: '168.00', lineTotal: '1680.00' });
    expect(view.invoice).toBeNull();
    expect(view.money).toBeNull();
    expect(view.payments).toEqual([]);
  });

  it('shows the invoice due label to the Accountant but never to the Attendant', async () => {
    expect((await ordersService.getOne(accountant, 'o1', NOW)).dueLabel).not.toBeNull();
    const view = await ordersService.getOne(attendant, 'o1', NOW);
    expect(view.dueLabel).toBeNull();
    expect(view.dueInDays).toBeNull();
  });

  it('prints the LPO with no prices, totals or amount in words', async () => {
    const lpo = await ordersService.getLpoPrint(attendant, 'o1', NOW);
    expect(lpo.lines[0]).toEqual({ n: 1, supplierItemName: 'SUGAR', supplierItemCode: null, ourItemName: 'Sugar', qty: '10', unit: 'kg' });
    expect(JSON.stringify(lpo)).not.toMatch(/price|total|168|1680|words/i);
  });

  it('lists every order for the Attendant (read-only) with the stage filter', async () => {
    vi.mocked(ordersRepository.list).mockResolvedValue([order({ status: 'AWAITING_APPROVAL', reference: 'LPO-0001' })]);
    const r = await ordersService.list(attendant, { stage: 'APPROVAL' }, NOW);
    expect(ordersRepository.list).toHaveBeenCalledWith(HUB, expect.objectContaining({ statuses: ['DRAFT', 'AWAITING_APPROVAL', 'RETURNED'] }), 500);
    expect(r).toMatchObject({ total: 1, valueTotal: '1680.00' });
    expect(r.orders[0]?.can).toMatchObject({ approve: false, edit: false });
  });

  it('counts tabs by stage', async () => {
    vi.mocked(ordersRepository.countByStatus).mockResolvedValue([{ status: 'DRAFT', count: 1 }, { status: 'AWAITING_APPROVAL', count: 2 }, { status: 'SENT', count: 4 }, { status: 'CANCELLED', count: 1 }]);
    vi.mocked(ordersRepository.findAwaitingApprovalLines).mockResolvedValue([{ orderedQty: D(2), unitPrice: D(100) }]);
    vi.mocked(ordersRepository.countDueToReceive).mockResolvedValue(1);
    await expect(ordersService.getSummary(manager, NOW)).resolves.toEqual({ counts: { needs: 3, approval: 3, receive: 4, invoice: 0, pay: 0, closed: 1 }, awaitingApprovalValue: '200.00', dueToReceiveCount: 1 });
  });
});

describe('route matrix (capabilities, not role names)', () => {
  const run = async (method: string, path: string, user: unknown): Promise<number> => {
    const layer = (ordersRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...a: unknown[]) => unknown }> } }> }).stack.find((l) => l.route?.path === path && l.route.methods[method]);
    const guard = layer?.route?.stack[0]?.handle as (req: unknown, res: unknown, next: () => void) => void;
    let allowed = false;
    try {
      guard({ user }, {}, () => { allowed = true; });
    } catch {
      allowed = false;
    }
    return allowed ? 200 : 403;
  };

  it.each([
    ['get', '/orders', 'STORE_ATTENDANT', 200],
    ['get', '/orders', 'ACCOUNTANT', 200],
    ['post', '/orders', 'STORE_ATTENDANT', 200],
    ['post', '/orders', 'ACCOUNTANT', 403],
    ['post', '/orders/:id/approve', 'STORE_ATTENDANT', 403],
    ['post', '/orders/:id/approve', 'STORE_MANAGER', 200],
    ['post', '/orders/:id/cancel', 'STORE_ATTENDANT', 403],
    ['post', '/orders/:id/cancel', 'STORE_MANAGER', 200],
    ['get', '/orders/:id/whatsapp', 'ACCOUNTANT', 403],
    ['get', '/collectors', 'STORE_ATTENDANT', 200],
    ['get', '/collectors', 'ACCOUNTANT', 403],
    ['put', '/orders/:id/collected-by', 'STORE_ATTENDANT', 200],
    ['put', '/orders/:id/collected-by', 'STORE_MANAGER', 200],
    ['put', '/orders/:id/collected-by', 'ACCOUNTANT', 403],
    ['post', '/orders/:id/withdraw', 'STORE_ATTENDANT', 200],
    ['post', '/orders/:id/withdraw', 'ACCOUNTANT', 403],
    ['post', '/orders/:id/remind', 'STORE_ATTENDANT', 200],
    ['post', '/orders/:id/remind', 'DIRECTOR', 403],
  ])('%s %s as %s -> %i', async (method, path, role, expected) => {
    expect(await run(method, path, { id: 'u', role, siteId: HUB })).toBe(expected);
  });
});
