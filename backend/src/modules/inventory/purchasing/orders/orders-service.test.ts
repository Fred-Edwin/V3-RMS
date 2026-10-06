import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { ForbiddenError } from '../../../../utils/errors';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { purchasingPin } from '../_shared/pin';
import { purchasingAudit } from '../_shared/purchasing-audit';
import { ordersRepository } from './orders-repository';
import ordersRouter from './orders-routes';
import { ordersService } from './orders-service';

vi.mock('./orders-repository', () => ({
  ordersRepository: {
    findOrder: vi.fn(), list: vi.fn(), countByStatus: vi.fn(), findAwaitingApprovalLines: vi.fn(), countDueToReceive: vi.fn(),
    findSupplier: vi.fn(), findOpenOrder: vi.fn(), findItems: vi.fn(), findSupplierLines: vi.fn(), findPreviousPrices: vi.fn(),
    create: vi.fn(), replaceLines: vi.fn(), updateDetails: vi.fn(), transition: vi.fn(), deleteDraft: vi.fn(),
  },
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
  ])('%s %s as %s -> %i', async (method, path, role, expected) => {
    expect(await run(method, path, { id: 'u', role, siteId: HUB })).toBe(expected);
  });
});
