import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { AppError, ForbiddenError } from '../../../../utils/errors';
import { purchasingError } from '../_shared/purchasing-errors';
import { attendantRepository } from '../attendant/attendant-repository';
import type { ItemFacts } from '../attendant/attendant-logic';
import { needsRestockingRepository, type SupplierLine } from '../needs-restocking/needs-restocking-repository';
import { ordersRepository } from '../orders/orders-repository';
import { ordersService } from '../orders/orders-service';
import { chooseSupplier, groupBySupplier } from './restock-list-logic';
import { restockListRepository } from './restock-list-repository';
import restockListRouter from './restock-list-routes';
import { restockListService } from './restock-list-service';
import { RestockLinesSchema, RestockSendSchema } from './restock-list-validators';

vi.mock('../attendant/attendant-repository', () => ({ attendantRepository: { findApprover: vi.fn() } }));
vi.mock('./restock-list-repository', () => ({ restockListRepository: { findItems: vi.fn() } }));
vi.mock('../needs-restocking/needs-restocking-repository', () => ({ needsRestockingRepository: { findSupplierLines: vi.fn() } }));
vi.mock('../orders/orders-repository', () => ({ ordersRepository: { findOpenOrder: vi.fn() } }));
vi.mock('../orders/orders-service', () => ({ ordersService: { create: vi.fn(), submit: vi.fn() } }));
vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));
vi.mock('../../../../middleware/authenticate', () => ({ authenticate: (_req: unknown, _res: unknown, next: () => void) => next() }));

const HUB = 'hub-1';
const D = (v: number | string) => new Prisma.Decimal(v);
const NOW = new Date('2026-10-08T09:00:00Z');
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const accountant = { id: 'acc', role: 'ACCOUNTANT', siteId: HUB } as never;
const branchAttendant = { id: 'ba', role: 'STORE_ATTENDANT', siteId: 'branch-9' } as never;

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OIL = U(1);
const WATER = U(2);
const WINGS = U(3);
const GHOST = U(9);
const item = (id: string, name: string, over: Partial<ItemFacts> = {}): ItemFacts => ({ id, name, usageUnit: 'unit', buyUnit: 'unit', packSize: null, preferredSupplierId: null, ...over });
const sup = (id: string, name: string) => ({ id, name, code: `S-${id}`, type: 'REGULAR' as const, defaultPaymentTerms: 'INVOICE_TO_FOLLOW' as const, paymentDays: 14 });
const samrat = sup('sam', 'Samrat Supermarket Ltd');
const summer = sup('sum', 'Summer Limited');
const kagumo = sup('kag', 'Kagumo Poultry Farm');
const line = (itemId: string, s: ReturnType<typeof sup>, price: number | null, over: Partial<SupplierLine> = {}): SupplierLine => ({
  inventoryItemId: itemId, buyUnit: null, packSize: null, lastPrice: price === null ? null : D(price), lastPriceAt: null, isPreferred: false, supplier: s, ...over,
});

describe('which supplier an item is bought from', () => {
  it('takes the preferred one, else the cheapest, and nothing when nobody sells it', () => {
    expect(chooseSupplier(item(OIL, 'Oil'), [line(OIL, samrat, 2400), line(OIL, kagumo, 2300)], undefined)).toMatchObject({ kind: 'chosen', line: { supplier: { id: 'kag' } } });
    expect(chooseSupplier(item(OIL, 'Oil', { preferredSupplierId: 'sam' }), [line(OIL, samrat, 2400), line(OIL, kagumo, 2300)], undefined)).toMatchObject({ line: { supplier: { id: 'sam' } } });
    expect(chooseSupplier(item(OIL, 'Oil'), [], undefined)).toEqual({ kind: 'none' });
  });
  it('honours a supplier asked for, but only one that sells the item', () => {
    expect(chooseSupplier(item(OIL, 'Oil'), [line(OIL, samrat, 2400), line(OIL, kagumo, 2300)], 'sam')).toMatchObject({ kind: 'chosen', line: { supplier: { id: 'sam' } } });
    expect(chooseSupplier(item(OIL, 'Oil'), [line(OIL, samrat, 2400)], 'kag')).toEqual({ kind: 'not_sold' });
  });
});

describe('the review groups the list by supplier, one order each (Paper 28C)', () => {
  const oil = { item: item(OIL, 'Salt Cooking Oil 10ltr', { buyUnit: 'jerrican' }), qty: D(8), line: line(OIL, samrat, 2400, { buyUnit: 'jerrican' }) };
  const water = { item: item(WATER, 'Highlands Water 12x1ltr'), qty: D(6), line: line(WATER, summer, 720, { buyUnit: 'carton' }) };
  const wings = { item: item(WINGS, 'Chicken wings'), qty: D(2), line: line(WINGS, kagumo, 1900, { buyUnit: 'tray' }) };

  it('makes one group per supplier in the order they first appear, numbered, with a line and group total', () => {
    const groups = groupBySupplier([oil, water, wings], new Map(), true);
    expect(groups.map((g) => [g.orderNumber, g.supplier.name, g.itemCount, g.estimatedTotal, g.problem])).toEqual([
      [1, 'Samrat Supermarket Ltd', 1, '19200.00', null],
      [2, 'Summer Limited', 1, '4320.00', null],
      [3, 'Kagumo Poultry Farm', 1, '3800.00', null],
    ]);
    expect(groups[0]?.lines[0]).toEqual({ inventoryItemId: OIL, itemName: 'Salt Cooking Oil 10ltr', qty: '8', buyUnit: 'jerrican', unitPrice: '2400.00', lineTotal: '19200.00' });
  });

  it('puts two items of one supplier in the same group', () => {
    const groups = groupBySupplier([oil, { ...water, line: line(WATER, samrat, 720) }], new Map(), true);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ itemCount: 2, estimatedTotal: '23520.00' });
  });

  it('flags a supplier whose slot is taken, and an item that was never priced', () => {
    expect(groupBySupplier([oil], new Map([['sam', { id: 'o9', reference: 'LPO-0009' }]]), true)[0]).toMatchObject({ problem: 'SUPPLIER_ORDER_OPEN', openOrder: { reference: 'LPO-0009' } });
    expect(groupBySupplier([{ ...oil, line: line(OIL, samrat, null) }], new Map(), true)[0]).toMatchObject({ problem: 'ITEM_SETUP_INCOMPLETE', estimatedTotal: '0.00' });
    expect(groupBySupplier([{ ...oil, line: line(OIL, samrat, null) }], new Map(), true)[0]?.lines[0]).toMatchObject({ unitPrice: null, lineTotal: null });
  });

  it('leaves the money out for a caller blind to item prices', () => {
    const g = groupBySupplier([oil], new Map(), false)[0];
    expect(g?.estimatedTotal).toBe('');
    expect(g?.lines[0]).toMatchObject({ unitPrice: '', lineTotal: '' });
  });
});

describe('restock list validators', () => {
  it('needs at least one line with a real quantity', () => {
    expect(RestockLinesSchema.safeParse({ lines: [] }).success).toBe(false);
    expect(RestockLinesSchema.safeParse({ lines: [{ inventoryItemId: OIL, qty: 'eight' }] }).success).toBe(false);
    expect(RestockLinesSchema.safeParse({ lines: [{ inventoryItemId: 'not-a-uuid', qty: '8' }] }).success).toBe(false);
    expect(RestockLinesSchema.safeParse({ lines: [{ inventoryItemId: OIL, qty: '8' }] }).success).toBe(true);
    expect(RestockSendSchema.parse({ lines: [{ inventoryItemId: OIL, qty: '8' }] }).note).toBeNull();
    expect(RestockSendSchema.safeParse({ lines: [{ inventoryItemId: OIL, qty: '8' }], note: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('review and send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
    vi.mocked(attendantRepository.findApprover).mockResolvedValue({ id: 'sm', name: 'Joseph', role: 'STORE_MANAGER' });
    vi.mocked(restockListRepository.findItems).mockResolvedValue([item(OIL, 'Salt Cooking Oil 10ltr'), item(WATER, 'Highlands Water'), item(WINGS, 'Chicken wings')]);
    vi.mocked(needsRestockingRepository.findSupplierLines).mockResolvedValue([line(OIL, samrat, 2400), line(WATER, summer, 720), line(WINGS, kagumo, 1900)]);
    vi.mocked(ordersRepository.findOpenOrder).mockResolvedValue(null);
    let n = 0;
    vi.mocked(ordersService.create).mockImplementation(async (_a, input) => ({ id: `draft-${(n += 1)}`, supplier: { id: input.supplierId } }) as never);
    vi.mocked(ordersService.submit).mockImplementation(async (_a, id) => ({ id, status: 'AWAITING_APPROVAL' }) as never);
  });

  const lines = [
    { inventoryItemId: OIL, qty: '8' },
    { inventoryItemId: WATER, qty: '6' },
    { inventoryItemId: WINGS, qty: '2' },
  ];

  it('reviews three suppliers as three orders with the approver and the estimated total', async () => {
    const r = await restockListService.review(attendant, { lines });
    expect(r.orderCount).toBe(3);
    expect(r.estimatedTotal).toBe('27320.00');
    expect(r.approver).toEqual({ id: 'sm', name: 'Joseph', role: 'Store Manager' });
    expect(r.unsupplied).toEqual([]);
    expect(needsRestockingRepository.findSupplierLines).toHaveBeenCalledWith(HUB, [OIL, WATER, WINGS]);
    expect(restockListRepository.findItems).toHaveBeenCalledWith(HUB, [OIL, WATER, WINGS]);
  });

  it('lists the items nobody sells us, and does not order them', async () => {
    vi.mocked(needsRestockingRepository.findSupplierLines).mockResolvedValue([line(OIL, samrat, 2400)]);
    const r = await restockListService.review(attendant, { lines });
    expect(r.orderCount).toBe(1);
    expect(r.unsupplied.map((u) => u.itemName)).toEqual(['Highlands Water', 'Chicken wings']);
  });

  it('refuses the same item twice, an unknown item, a zero quantity and a supplier that does not sell the item', async () => {
    await expect(restockListService.review(attendant, { lines: [lines[0] as never, lines[0] as never] })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(restockListService.review(attendant, { lines: [{ inventoryItemId: GHOST, qty: '1' }] })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(restockListService.review(attendant, { lines: [{ inventoryItemId: OIL, qty: '0' }] })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(restockListService.review(attendant, { lines: [{ inventoryItemId: OIL, qty: '1', supplierId: 'kag' }] })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('shows no money to a caller blind to item prices', async () => {
    // The service itself applies the blind rule (the route's capability check comes first in production): a role without `catalog.see_costs` gets quantities only.
    const r = await restockListService.review({ id: 'w', role: 'WAITER', siteId: HUB } as never, { lines });
    expect(r.estimatedTotal).toBe('');
    expect(r.groups.map((g) => g.estimatedTotal)).toEqual(['', '', '']);
    expect(r.groups[0]?.lines[0]).toMatchObject({ qty: '8', unitPrice: '', lineTotal: '' });
  });

  it('refuses a caller outside the hub', async () => {
    await expect(restockListService.review(branchAttendant, { lines })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(restockListService.send(branchAttendant, { lines, note: null }, NOW)).rejects.toBeInstanceOf(ForbiddenError);
    expect(ordersService.create).not.toHaveBeenCalled();
  });

  it('sends one order per supplier with the note, at the supplier price, for approval', async () => {
    const result = await restockListService.send(attendant, { lines, note: 'Wings for the Saturday special' }, NOW);
    expect(result.sent.map((s) => s.supplier.id)).toEqual(['sam', 'sum', 'kag']);
    expect(result.failed).toEqual([]);
    expect(ordersService.create).toHaveBeenCalledTimes(3);
    expect(ordersService.create).toHaveBeenNthCalledWith(1, attendant, { supplierId: 'sam', expectedDate: null, supplierNote: null, attendantNote: 'Wings for the Saturday special', lines: [{ inventoryItemId: OIL, qty: '8', unitPrice: '' }] }, NOW);
    expect(ordersService.submit).toHaveBeenCalledTimes(3);
  });

  it('reports a supplier that cannot be ordered from and still sends the others', async () => {
    vi.mocked(ordersService.create).mockImplementationOnce(async () => {
      throw purchasingError('SUPPLIER_ORDER_OPEN', 'LPO-0009 to Samrat is still open.');
    });
    const result = await restockListService.send(attendant, { lines, note: null }, NOW);
    expect(result.sent.map((s) => s.supplier.id)).toEqual(['sum', 'kag']);
    expect(result.failed).toEqual([{ supplier: { id: 'sam', name: 'Samrat Supermarket Ltd' }, code: 'SUPPLIER_ORDER_OPEN', message: 'LPO-0009 to Samrat is still open.', orderId: null }]);
  });

  it('keeps the draft id when a draft was saved but could not be sent', async () => {
    vi.mocked(ordersService.submit).mockImplementationOnce(async () => {
      throw purchasingError('SUPPLIER_ON_HOLD', 'Samrat is on hold.');
    });
    const result = await restockListService.send(attendant, { lines, note: null }, NOW);
    expect(result.failed[0]).toMatchObject({ code: 'SUPPLIER_ON_HOLD', orderId: 'draft-1' });
    expect(result.sent).toHaveLength(2);
  });

  it('lets an error that is not ours through (a database failure is not a supplier problem)', async () => {
    vi.mocked(ordersService.create).mockRejectedValueOnce(new Error('connection lost'));
    await expect(restockListService.send(attendant, { lines, note: null }, NOW)).rejects.toThrow('connection lost');
  });

  it('is an AppError the screens can read', () => {
    expect(purchasingError('SUPPLIER_ORDER_OPEN', 'x')).toBeInstanceOf(AppError);
  });
});

describe('route matrix (capabilities, not role names)', () => {
  const run = (method: string, path: string, role: string): number => {
    const layer = (restockListRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...a: unknown[]) => unknown }> } }> }).stack.find((l) => l.route?.path === path && l.route.methods[method]);
    const guard = layer?.route?.stack[0]?.handle as (req: unknown, res: unknown, next: () => void) => void;
    let allowed = false;
    try {
      guard({ user: { id: 'u', role, siteId: HUB } }, {}, () => { allowed = true; });
    } catch {
      allowed = false;
    }
    return allowed ? 200 : 403;
  };

  it.each([
    ['post', '/restock-list/review', 'STORE_ATTENDANT', 200],
    ['post', '/restock-list/send', 'STORE_MANAGER', 200],
    ['post', '/restock-list/review', 'ACCOUNTANT', 403],
    ['post', '/restock-list/send', 'DIRECTOR', 403],
  ])('%s %s as %s -> %i', (method, path, role, expected) => {
    expect(run(method, path, role)).toBe(expected);
    void accountant;
  });
});
