import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { locationRepository } from '../../../../repositories/location-repository';
import { ForbiddenError } from '../../../../utils/errors';
import { needsRestockingRepository } from '../needs-restocking/needs-restocking-repository';
import { needsRestockingService } from '../needs-restocking/needs-restocking-service';
import { ordersRepository } from '../orders/orders-repository';
import { attendantRepository } from './attendant-repository';
import attendantRouter from './attendant-routes';
import { attendantService } from './attendant-service';

vi.mock('./attendant-repository', () => ({
  attendantRepository: {
    findApprover: vi.fn(), findLevelItems: vi.fn(), searchItems: vi.fn(), countItems: vi.fn(), findOpenOrderLines: vi.fn(), searchSuppliers: vi.fn(), searchOrders: vi.fn(),
    findSupplierPage: vi.fn(), findSupplierLinesWithItems: vi.fn(), listClosedIds: vi.fn(), countClosed: vi.fn(), findHistoryRecords: vi.fn(),
    findNoticeOrders: vi.fn(), findReadKeys: vi.fn(), markRead: vi.fn(), findSentDueOn: vi.fn(),
  },
}));
vi.mock('../orders/orders-repository', () => ({ ordersRepository: { list: vi.fn(), countByStatus: vi.fn() } }));
vi.mock('../needs-restocking/needs-restocking-repository', () => ({ needsRestockingRepository: { findStockForItems: vi.fn(), findSupplierLines: vi.fn() } }));
vi.mock('../needs-restocking/needs-restocking-service', () => ({ needsRestockingService: { getNeeds: vi.fn(), countNeeds: vi.fn() } }));
vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../repositories/location-repository', () => ({ locationRepository: { findCentralStore: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));
vi.mock('../../../../middleware/authenticate', () => ({ authenticate: (_req: unknown, _res: unknown, next: () => void) => next() }));

const HUB = 'hub-1';
const D = (v: number | string) => new Prisma.Decimal(v);
// Thu 8 Oct 2026, 12:00 Nairobi.
const NOW = new Date('2026-10-08T09:00:00Z');
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const accountant = { id: 'acc', role: 'ACCOUNTANT', siteId: HUB } as never;
const noStock = { id: 'w1', role: 'WAITER', siteId: HUB } as never; // a hub role holding no stock capability
const branchAttendant = { id: 'ba', role: 'STORE_ATTENDANT', siteId: 'branch-9' } as never;

const user = (id: string, name: string, role: string) => ({ id, name, role });
const supplier = { id: 'sup', name: 'Kagumo Poultry Farm', code: 'S-1', address: 'Nyeri', defaultPaymentTerms: 'INVOICE_TO_FOLLOW', paymentDays: 14, kraPin: null, contacts: [{ name: 'Ravi', phone: '0700', whatsapp: '0711' }], payMethods: [] };
const order = (over: Record<string, unknown> = {}) =>
  ({
    id: 'o1', reference: 'LPO-0045', supplierId: 'sup', status: 'APPROVED', termsDays: 14, expectedDate: null, supplierNote: null, attendantNote: null,
    raisedById: 'att', submittedAt: NOW, approvedById: 'sm', approvedAt: NOW, returnedNote: null, returnedById: null, returnedAt: null, sentAt: null, sentVia: null,
    cancelReason: null, cancelNote: null, cancelledById: null, cancelledAt: null, closedAt: null, createdAt: NOW, updatedAt: NOW,
    collectedByKind: null, collectedByCarrierId: null, collectedByUserId: null, collectedByName: null, collectedBySetAt: null, collectedByCarrier: null, collectedByUser: null, collectedBySetBy: null,
    supplier, raisedBy: user('att', 'Amina', 'STORE_ATTENDANT'), approvedBy: user('sm', 'Joseph', 'STORE_MANAGER'), returnedBy: null, cancelledBy: null,
    lines: [{ id: 'l1', inventoryItemId: 'wings', lineOrder: 1, supplierItemName: null, supplierItemCode: null, buyUnit: 'tray', packSize: D(1), orderedQty: D(2), unitPrice: D(1900), previousPrice: null, receivedQty: null, deliveredPrice: null, confirmedPrice: null, result: null, inventoryItem: { name: 'Chicken wings' } }],
    delivery: null, invoices: [], payments: [], documents: [], audit: [], ...over,
  }) as never;

const needsLine = (status: 'OUT' | 'LOW') => ({ inventoryItemId: status, itemName: status, subLabel: '', status, usageUnit: 'kg', supplierOptions: [], chosenSupplierId: null, suggestedQty: '1', buyUnit: 'kg', lastPrice: null, estimatedTotal: null });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue({ id: 'loc-1', siteId: HUB } as never);
  vi.mocked(attendantRepository.findApprover).mockResolvedValue({ id: 'sm', name: 'Joseph', role: 'STORE_MANAGER' });
  vi.mocked(attendantRepository.findNoticeOrders).mockResolvedValue([]);
  vi.mocked(attendantRepository.findReadKeys).mockResolvedValue(new Set());
  vi.mocked(ordersRepository.list).mockResolvedValue([]);
  vi.mocked(ordersRepository.countByStatus).mockResolvedValue([]);
  vi.mocked(needsRestockingService.getNeeds).mockResolvedValue({ itemCount: 0, supplierCount: 0, groups: [], suppliers: [] });
  vi.mocked(needsRestockingService.countNeeds).mockResolvedValue(0);
  vi.mocked(needsRestockingRepository.findSupplierLines).mockResolvedValue([]);
  vi.mocked(needsRestockingRepository.findStockForItems).mockResolvedValue([]);
  vi.mocked(attendantRepository.findOpenOrderLines).mockResolvedValue(new Map());
});

describe('home (28A)', () => {
  it('counts the restock card, lists what needs the caller, and carries the badges and the approver', async () => {
    vi.mocked(needsRestockingService.getNeeds).mockResolvedValue({
      itemCount: 8, supplierCount: 3, suppliers: [],
      groups: [{ supplier: null, termsLabel: null, itemCount: 8, estimatedTotal: '0', lines: [...Array(3).fill(needsLine('OUT')), ...Array(5).fill(needsLine('LOW'))] }],
    });
    vi.mocked(ordersRepository.list).mockImplementation(async (_s, f) =>
      f.raisedById
        ? [order({ id: 'ready', status: 'APPROVED' }), order({ id: 'wait', reference: 'LPO-0047', status: 'AWAITING_APPROVAL', approvedAt: null, approvedBy: null, approvedById: null })]
        : [order({ id: 'due', reference: 'LPO-0044', status: 'SENT', raisedById: 'other-att', expectedDate: new Date('2026-10-08T00:00:00Z') }), order({ id: 'future', status: 'SENT', raisedById: 'other-att', expectedDate: new Date('2026-10-20T00:00:00Z') })],
    );
    vi.mocked(ordersRepository.countByStatus).mockResolvedValue([{ status: 'SENT', count: 2 }, { status: 'APPROVED', count: 1 }, { status: 'AWAITING_APPROVAL', count: 4 }]);
    const home = await attendantService.getHome(attendant, NOW);
    expect(home.restock).toEqual({ total: 8, out: 3, low: 5 });
    // Ready to send (mine) and the delivery due today (someone else's): receiving is everyone's job. Not the future one, not the waiting one.
    expect(home.needsYou.map((r) => [r.id, r.need])).toEqual([['ready', 'SEND'], ['due', 'RECEIVE']]);
    expect(home.myOrders).toMatchObject({ total: 2, needYou: 1 });
    expect(home.myOrders.rows.map((r) => r.id)).toEqual(['ready', 'wait']);
    expect(home.approver).toEqual({ id: 'sm', name: 'Joseph', role: 'Store Manager' });
    expect(home.badges).toEqual({ receiving: 3, restock: 8, myOrders: 1, unreadNotices: 0 });
    expect(home.today).toBe('2026-10-08');
    expect(ordersRepository.list).toHaveBeenCalledWith(HUB, expect.objectContaining({ raisedById: 'att', statuses: ['AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'] }), 200);
  });

  it('does not offer a delivery to receive to a person who may not receive', async () => {
    vi.mocked(ordersRepository.list).mockImplementation(async (_s, f) => (f.raisedById ? [] : [order({ id: 'due', status: 'SENT', raisedById: 'other', expectedDate: new Date('2026-10-08T00:00:00Z') })]));
    expect((await attendantService.getHome(accountant, NOW)).needsYou).toEqual([]);
  });

  it('shows the Attendant no invoice or payment figure on any row', async () => {
    vi.mocked(ordersRepository.list).mockResolvedValue([order({ status: 'SENT', expectedDate: new Date('2026-10-08T00:00:00Z'), invoices: [], payments: [] })]);
    const home = await attendantService.getHome(attendant, NOW);
    expect(home.myOrders.rows[0]).toMatchObject({ invoice: null, money: null, payments: [] });
  });

  it('refuses an Attendant who sits outside the hub (D-15)', async () => {
    await expect(attendantService.getHome(branchAttendant, NOW)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('badges', () => {
  it('counts the Receiving, Restock list and My orders links and the bell', async () => {
    vi.mocked(needsRestockingService.countNeeds).mockResolvedValue(8);
    vi.mocked(ordersRepository.countByStatus).mockResolvedValue([{ status: 'SENT', count: 3 }]);
    vi.mocked(ordersRepository.list).mockResolvedValue([order({ status: 'RETURNED', returnedAt: NOW, returnedNote: 'Fix', returnedBy: user('sm', 'Joseph', 'STORE_MANAGER') })]);
    vi.mocked(attendantRepository.findNoticeOrders).mockResolvedValue([
      { id: 'o1', reference: 'LPO-0048', status: 'RETURNED', expectedDate: null, raisedById: 'att', approvedAt: null, approvedBy: null, returnedAt: NOW, returnedNote: 'Fix', returnedBy: { name: 'Joseph', role: 'STORE_MANAGER' }, closedAt: null, supplier: { name: 'Nyeri' }, lines: [{ orderedQty: D(1), unitPrice: D(10) }] },
    ]);
    await expect(attendantService.getBadges(attendant, NOW)).resolves.toEqual({ receiving: 3, restock: 8, myOrders: 1, unreadNotices: 1 });
  });
});

describe('My orders (28F)', () => {
  const rows = [
    order({ id: 'a', status: 'APPROVED' }),
    order({ id: 'b', status: 'SENT', expectedDate: new Date('2026-10-07T00:00:00Z') }),
    order({ id: 'c', status: 'AWAITING_APPROVAL' }),
  ];
  it('splits Needs you from Waiting on others, counts the chips and keeps the counts when a chip is chosen', async () => {
    vi.mocked(ordersRepository.list).mockResolvedValue(rows);
    const all = await attendantService.getMyOrders(attendant, { filter: 'all' }, NOW);
    expect(all.counts).toEqual({ all: 3, needs: 2, waiting: 1, overdue: 1 });
    expect(all.needsYou.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(all.waitingOnOthers.map((r) => r.id)).toEqual(['c']);
    const overdue = await attendantService.getMyOrders(attendant, { filter: 'overdue' }, NOW);
    expect(overdue.counts).toEqual(all.counts);
    expect(overdue.needsYou.map((r) => r.id)).toEqual(['b']);
    expect(overdue.waitingOnOthers).toEqual([]);
  });

  it('passes the search to the list and shows only the caller’s own orders', async () => {
    await attendantService.getMyOrders(attendant, { filter: 'all', q: 'wings' }, NOW);
    expect(ordersRepository.list).toHaveBeenCalledWith(HUB, expect.objectContaining({ raisedById: 'att', q: 'wings' }), 200);
  });
});

describe('History (28G)', () => {
  const rec = (over: Record<string, unknown> = {}) => ({
    id: 'h1', reference: 'LPO-0044', status: 'CLOSED', closedAt: new Date('2026-10-10T08:00:00Z'), cancelledAt: null, cancelReason: null, supplier: { id: 'sup', name: 'Samrat' },
    lines: [{ result: 'AS_ORDERED', orderedQty: D(10), unitPrice: D(100) }, { result: 'SHORT', orderedQty: D(2), unitPrice: D(50) }], delivery: { deliveredTotal: D(27486) }, ...over,
  });
  beforeEach(() => {
    vi.mocked(attendantRepository.listClosedIds).mockResolvedValue({ ids: ['h1'], total: 1 });
    vi.mocked(attendantRepository.countClosed).mockResolvedValue({ allTime: 46, inRange: 12 });
    vi.mocked(attendantRepository.findHistoryRecords).mockResolvedValue([rec() as never]);
  });

  it('defaults to the last 30 days in Nairobi days and passes whole-day bounds to the query', async () => {
    const h = await attendantService.getHistory(attendant, { status: 'all', page: 1, pageSize: 20 }, NOW);
    expect(h.range).toEqual({ from: '2026-09-09', to: '2026-10-08' });
    const filter = vi.mocked(attendantRepository.listClosedIds).mock.calls[0]?.[1];
    expect(filter?.from.toISOString()).toBe('2026-09-08T21:00:00.000Z'); // 00:00 Nairobi on the 9th
    expect(filter?.toExclusive.toISOString()).toBe('2026-10-08T21:00:00.000Z'); // 00:00 Nairobi on the 9th of October
    expect(h.summary).toEqual({ allTime: 46, inRange: 12 });
  });

  it('takes any from and to, and turns a missing `to` into today', async () => {
    const h = await attendantService.getHistory(attendant, { from: '2026-10-01', status: 'paid', page: 3, pageSize: 20, q: 'samrat' }, NOW);
    expect(h.range).toEqual({ from: '2026-10-01', to: '2026-10-08' });
    expect(attendantRepository.listClosedIds).toHaveBeenCalledWith(HUB, expect.objectContaining({ status: 'paid', q: 'samrat' }), 40, 20);
    expect(h.page).toBe(3);
  });

  it('shows the delivered value, the short lines and the day it closed, and never an invoice or payment figure', async () => {
    const h = await attendantService.getHistory(attendant, { status: 'all', page: 1, pageSize: 20 }, NOW);
    expect(h.months).toEqual([
      { key: '2026-10', label: 'October 2026', rows: [{ id: 'h1', reference: 'LPO-0044', supplier: { id: 'sup', name: 'Samrat' }, itemCount: 2, shortCount: 1, value: '27486.00', valueKind: 'DELIVERED', outcome: 'PAID', cancelReason: null, closedOn: '2026-10-10' }] },
    ]);
    expect(JSON.stringify(h)).not.toMatch(/invoice|payment|balance|money/i);
  });

  it('shows a cancelled order at its ordered value, with the reason, on the Nairobi day it was cancelled', async () => {
    vi.mocked(attendantRepository.findHistoryRecords).mockResolvedValue([rec({ id: 'x', status: 'CANCELLED', closedAt: null, cancelledAt: new Date('2026-10-02T22:30:00Z'), cancelReason: 'WITHDRAWN', delivery: null }) as never]);
    const row = (await attendantService.getHistory(attendant, { status: 'all', page: 1, pageSize: 20 }, NOW)).months[0]?.rows[0];
    expect(row).toMatchObject({ outcome: 'CANCELLED', cancelReason: 'WITHDRAWN', value: '1100.00', valueKind: 'ORDERED', closedOn: '2026-10-03' });
  });

  it('hides the value from a role that may not see item prices', async () => {
    expect((await attendantService.getHistory(noStock, { status: 'all', page: 1, pageSize: 20 }, NOW)).months[0]?.rows[0]?.value).toBe('');
  });

  it('refuses a start after the end, and a date that has not come', async () => {
    await expect(attendantService.getHistory(attendant, { from: '2026-10-05', to: '2026-10-01', status: 'all', page: 1, pageSize: 20 }, NOW)).rejects.toMatchObject({ code: 'DATE_RANGE_INVALID', statusCode: 422 });
    await expect(attendantService.getHistory(attendant, { to: '2026-10-09', status: 'all', page: 1, pageSize: 20 }, NOW)).rejects.toMatchObject({ code: 'DATE_RANGE_INVALID' });
    expect(attendantRepository.listClosedIds).not.toHaveBeenCalled();
  });

  it('returns an empty list with the counts when nothing matches', async () => {
    vi.mocked(attendantRepository.listClosedIds).mockResolvedValue({ ids: [], total: 0 });
    vi.mocked(attendantRepository.findHistoryRecords).mockResolvedValue([]);
    await expect(attendantService.getHistory(attendant, { status: 'all', page: 1, pageSize: 20 }, NOW)).resolves.toMatchObject({ total: 0, months: [], summary: { allTime: 46 } });
  });
});

describe('Search (28E)', () => {
  const found = { id: 'oil', name: 'Salt Cooking Oil 10ltr', usageUnit: 'jerrican', buyUnit: 'jerrican', packSize: null, preferredSupplierId: null, onHand: D(0), level: D(8) };
  beforeEach(() => {
    vi.mocked(attendantRepository.searchItems).mockResolvedValue([found, { ...found, id: 'salt', name: 'Iodised Salt 1kg', onHand: D(48), level: D(20) }, { ...found, id: 'rock', name: 'Rock salt', onHand: D(2), level: null }]);
    vi.mocked(attendantRepository.countItems).mockResolvedValue(3);
    vi.mocked(attendantRepository.searchSuppliers).mockResolvedValue({ total: 1, rows: [{ id: 'sam', name: 'Samrat Supermarket Ltd', openOrderCount: 1, itemCount: 6 }] });
    vi.mocked(attendantRepository.searchOrders).mockResolvedValue({
      total: 2,
      rows: [
        { id: 'o44', reference: 'LPO-0044', status: 'SENT', expectedDate: new Date('2026-10-08T00:00:00Z'), closedAt: null, cancelledAt: null, supplier: { id: 'sam', name: 'Samrat' }, lineCount: 4 },
        { id: 'o31', reference: 'LPO-0031', status: 'CLOSED', expectedDate: null, closedAt: new Date('2026-09-28T10:00:00Z'), cancelledAt: null, supplier: { id: 'sam', name: 'Samrat' }, lineCount: 3 },
      ],
    });
    vi.mocked(needsRestockingRepository.findSupplierLines).mockResolvedValue([
      { inventoryItemId: 'oil', buyUnit: null, packSize: null, lastPrice: D(2400), lastPriceAt: null, isPreferred: true, supplier: { id: 'sam', name: 'Samrat Supermarket Ltd', code: 'S', type: 'REGULAR', defaultPaymentTerms: 'INVOICE_TO_FOLLOW', paymentDays: 14 } },
    ]);
    vi.mocked(attendantRepository.findOpenOrderLines).mockResolvedValue(new Map([['oil', { orderId: 'o45', reference: 'LPO-0045' }]]));
  });

  it('answers items, suppliers and orders together with their counts', async () => {
    const s = await attendantService.search(attendant, 'sal', NOW);
    expect(s.counts).toEqual({ items: 3, suppliers: 1, orders: 2 });
    expect(s.items[0]).toMatchObject({ name: 'Salt Cooking Oil 10ltr', status: 'OUT', onHand: '0', level: '8', suggestedQty: '8', supplier: { name: 'Samrat Supermarket Ltd' }, onOpenOrder: { reference: 'LPO-0045' } });
    expect(s.items[1]).toMatchObject({ status: 'OK', onHand: '48', suggestedQty: null, onOpenOrder: null });
    expect(s.items[2]).toMatchObject({ status: 'NO_LEVEL', onHand: '2' });
    expect(s.items[2]).not.toHaveProperty('level');
    expect(s.suppliers).toEqual([{ id: 'sam', name: 'Samrat Supermarket Ltd', openOrderCount: 1, itemCount: 6 }]);
  });

  it('words an order by its stage: due today for a sent order, the day it closed for a closed one', async () => {
    const { orders } = await attendantService.search(attendant, 'sal', NOW);
    expect(orders[0]).toMatchObject({ reference: 'LPO-0044', stage: 'RECEIVE', dueLabel: 'DUE_TODAY', itemCount: 4, closedOn: null });
    expect(orders[1]).toMatchObject({ reference: 'LPO-0031', stage: 'CLOSED', dueLabel: null, closedOn: '2026-09-28' });
  });

  it('keeps the stock figures from a role that may not see them', async () => {
    const s = await attendantService.search(noStock, 'sal', NOW);
    expect(s.items[0]).toMatchObject({ status: 'OUT', suggestedQty: '8' });
    expect(JSON.stringify(s.items)).not.toMatch(/"onHand"|"level"/);
  });

  it('searches the hub only', async () => {
    await attendantService.search(attendant, 'sal', NOW);
    expect(attendantRepository.searchItems).toHaveBeenCalledWith({ siteId: HUB, locationId: 'loc-1' }, 'sal', 20);
    expect(attendantRepository.searchSuppliers).toHaveBeenCalledWith(HUB, 'sal', 10);
    expect(attendantRepository.searchOrders).toHaveBeenCalledWith(HUB, 'sal', 20);
  });
});

describe('Supplier page (28M)', () => {
  const row = { id: 'sam', name: 'Samrat Supermarket Ltd', code: 'S-1', status: 'ACTIVE' as const, category: 'Dry goods', contact: { name: 'Ravi', phone: '0722', whatsapp: null } };
  const itemOf = (id: string, name: string) => ({ inventoryItemId: id, buyUnit: null, packSize: null, lastPrice: D(168), item: { id, name, usageUnit: 'kg', buyUnit: 'kg', packSize: null, preferredSupplierId: null } });
  beforeEach(() => {
    vi.mocked(attendantRepository.findSupplierPage).mockResolvedValue(row);
    vi.mocked(attendantRepository.findSupplierLinesWithItems).mockResolvedValue([itemOf('sugar', 'Kabras Sugar 1kg'), itemOf('oil', 'Salt Cooking Oil 10ltr'), itemOf('yeast', 'Yeast'), itemOf('flour', 'Flour')]);
    vi.mocked(needsRestockingRepository.findStockForItems).mockResolvedValue([
      { inventoryItemId: 'sugar', onHand: D(12), level: D(40) }, { inventoryItemId: 'oil', onHand: D(0), level: D(8) }, { inventoryItemId: 'yeast', onHand: D(9), level: D(4) }, { inventoryItemId: 'flour', onHand: D(1), level: D(10) },
    ]);
    vi.mocked(attendantRepository.findOpenOrderLines).mockResolvedValue(new Map([['flour', { orderId: 'o9', reference: 'LPO-0009' }]]));
    vi.mocked(ordersRepository.list).mockResolvedValue([order({ id: 'o44', reference: 'LPO-0044', status: 'SENT' })]);
  });

  it('gives the contact, the open order and what we buy with how it is stocked', async () => {
    const s = await attendantService.getSupplier(attendant, 'sam', NOW);
    expect(s.supplier).toMatchObject({ name: 'Samrat Supermarket Ltd', category: 'Dry goods', contactName: 'Ravi', phone: '0722', whatsapp: '0722' });
    expect(s.openOrder).toMatchObject({ id: 'o44' });
    expect(s.items.map((i) => [i.name, i.status, i.price, i.suggestedQty])).toEqual([
      ['Kabras Sugar 1kg', 'LOW', '168.00', '28'],
      ['Salt Cooking Oil 10ltr', 'OUT', '168.00', '8'],
      ['Yeast', 'OK', '168.00', null],
      ['Flour', 'LOW', '168.00', '9'],
    ]);
    expect(ordersRepository.list).toHaveBeenCalledWith(HUB, { statuses: ['AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'], supplierId: 'sam' }, 1);
  });

  it('counts the low items not already on an order: what "Add 2 low items to my list" adds (flour is on an order)', async () => {
    expect((await attendantService.getSupplier(attendant, 'sam', NOW)).lowCount).toBe(2);
  });

  it('shows no stock figure to a role that may not see them, and no price to one blind to item prices', async () => {
    const s = await attendantService.getSupplier(noStock, 'sam', NOW);
    expect(s.items[0]).toMatchObject({ status: 'LOW', price: '' });
    expect(JSON.stringify(s.items)).not.toMatch(/"onHand"|"level"/);
  });

  it('says there is no open order when there is none, and refuses an unknown supplier', async () => {
    vi.mocked(ordersRepository.list).mockResolvedValue([]);
    expect((await attendantService.getSupplier(attendant, 'sam', NOW)).openOrder).toBeNull();
    vi.mocked(attendantRepository.findSupplierPage).mockResolvedValue(null);
    await expect(attendantService.getSupplier(attendant, 'nope', NOW)).rejects.toMatchObject({ code: 'SUPPLIER_NOT_FOUND', statusCode: 404 });
  });
});

describe('Restock levels (28P)', () => {
  const li = (id: string, name: string, onHand: number, level: number) => ({ id, name, usageUnit: 'kg', buyUnit: 'kg', packSize: null, preferredSupplierId: null, onHand: D(onHand), level: D(level) });
  beforeEach(() => {
    vi.mocked(attendantRepository.findLevelItems).mockResolvedValue([li('a', 'Alpha', 0, 8), li('b', 'Bravo', 1, 3), li('c', 'Charlie', 12, 40), li('d', 'Delta', 9, 4), li('e', 'Echo', 48, 20)]);
    vi.mocked(needsRestockingRepository.findSupplierLines).mockResolvedValue([
      { inventoryItemId: 'a', buyUnit: null, packSize: null, lastPrice: D(1), lastPriceAt: null, isPreferred: false, supplier: { id: 'sam', name: 'Samrat', code: 'S', type: 'REGULAR', defaultPaymentTerms: 'INVOICE_TO_FOLLOW', paymentDays: 14 } },
    ]);
  });

  it('counts out, low and fine, and pages the rows like Paper ("Showing 1 to 2 of 5")', async () => {
    const r = await attendantService.getRestockLevels(attendant, { page: 1, pageSize: 2 });
    expect(r.counts).toEqual({ all: 5, out: 1, low: 2, ok: 2 });
    expect(r).toMatchObject({ page: 1, pageSize: 2, total: 5, setBy: { name: 'Joseph', role: 'Store Manager' } });
    expect(r.rows.map((x) => x.name)).toEqual(['Alpha', 'Charlie']);
    expect((await attendantService.getRestockLevels(attendant, { page: 3, pageSize: 2 })).rows.map((x) => x.name)).toEqual(['Echo']);
  });

  it('filters by status and supplier and lists only the suppliers that appear', async () => {
    const out = await attendantService.getRestockLevels(attendant, { status: 'OUT', page: 1, pageSize: 20 });
    expect(out.total).toBe(1);
    expect(out.suppliers).toEqual([{ id: 'sam', name: 'Samrat' }]);
    expect((await attendantService.getRestockLevels(attendant, { supplierId: 'sam', page: 1, pageSize: 20 })).rows.map((x) => x.name)).toEqual(['Alpha']);
    expect((await attendantService.getRestockLevels(attendant, { q: 'zzz', page: 1, pageSize: 20 })).rows).toEqual([]);
  });

  it('reads the Central Store at the hub', async () => {
    await attendantService.getRestockLevels(attendant, { page: 1, pageSize: 20 });
    expect(attendantRepository.findLevelItems).toHaveBeenCalledWith({ siteId: HUB, locationId: 'loc-1' });
  });
});

describe('Notifications (28N)', () => {
  const rec = (over: Record<string, unknown> = {}) => ({
    id: 'o1', reference: 'LPO-0048', status: 'RETURNED', expectedDate: null, raisedById: 'att', approvedAt: null, approvedBy: null, returnedAt: new Date('2026-10-08T07:40:00Z'),
    returnedNote: 'Fix it', returnedBy: { name: 'Joseph', role: 'STORE_MANAGER' }, closedAt: null, supplier: { name: 'Nyeri Market Traders' }, lines: [{ orderedQty: D(1), unitPrice: D(10) }], ...over,
  });
  beforeEach(() => {
    vi.mocked(attendantRepository.findNoticeOrders).mockResolvedValue([
      rec() as never,
      rec({ id: 'o2', reference: 'LPO-0040', status: 'CLOSED', returnedAt: null, returnedNote: null, returnedBy: null, closedAt: new Date('2026-10-07T13:20:00Z') }) as never,
    ]);
  });

  it('lists the caller’s notices in day groups with the counts, filtered by a chip', async () => {
    const all = await attendantService.getNotices(attendant, { filter: 'all' }, NOW);
    expect(all.counts).toEqual({ all: 2, unread: 2, needsMe: 1 });
    expect(all.groups.map((g) => [g.label, g.notices.map((n) => n.type)])).toEqual([['Today', ['RETURNED']], ['Yesterday', ['CLOSED']]]);
    const needs = await attendantService.getNotices(attendant, { filter: 'needs' }, NOW);
    expect(needs.groups.flatMap((g) => g.notices).map((n) => n.type)).toEqual(['RETURNED']);
    expect(needs.counts).toEqual(all.counts);
  });

  it('asks for the caller’s own orders, and for deliveries due only when they may receive', async () => {
    await attendantService.getNotices(attendant, { filter: 'all' }, NOW);
    expect(attendantRepository.findNoticeOrders).toHaveBeenLastCalledWith(HUB, 'att', expect.any(Date), new Date('2026-10-08T00:00:00Z'), true);
    await attendantService.getNotices(accountant, { filter: 'all' }, NOW);
    expect(attendantRepository.findNoticeOrders).toHaveBeenLastCalledWith(HUB, 'acc', expect.any(Date), new Date('2026-10-08T00:00:00Z'), false);
  });

  it('hides what was opened under Unread', async () => {
    vi.mocked(attendantRepository.findReadKeys).mockResolvedValue(new Set([`RETURNED:o1:${new Date('2026-10-08T07:40:00Z').getTime()}`]));
    const unread = await attendantService.getNotices(attendant, { filter: 'unread' }, NOW);
    expect(unread.counts.unread).toBe(1);
    expect(unread.groups.flatMap((g) => g.notices).map((n) => n.type)).toEqual(['CLOSED']);
  });

  it('marks the keys given as read for the caller', async () => {
    await attendantService.markNoticesRead(attendant, ['CLOSED:o2'], NOW);
    expect(attendantRepository.markRead).toHaveBeenCalledWith('att', ['CLOSED:o2'], NOW);
  });

  it('marks everything unread as read and says how many', async () => {
    await expect(attendantService.markAllNoticesRead(attendant, NOW)).resolves.toBe(2);
    expect(attendantRepository.markRead).toHaveBeenCalledWith('att', [`RETURNED:o1:${new Date('2026-10-08T07:40:00Z').getTime()}`, 'CLOSED:o2'], NOW);
  });

  it('refuses a caller outside the hub', async () => {
    await expect(attendantService.markNoticesRead(branchAttendant, ['x'], NOW)).rejects.toBeInstanceOf(ForbiddenError);
    expect(attendantRepository.markRead).not.toHaveBeenCalled();
  });
});

describe('route matrix (capabilities, not role names)', () => {
  const run = async (method: string, path: string, user: unknown): Promise<number> => {
    const layer = (attendantRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...a: unknown[]) => unknown }> } }> }).stack.find((l) => l.route?.path === path && l.route.methods[method]);
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
    ['get', '/attendant/home', 'STORE_ATTENDANT', 200],
    ['get', '/attendant/home', 'ACCOUNTANT', 200],
    ['get', '/attendant/home', 'WAITER', 403],
    ['get', '/attendant/history', 'STORE_ATTENDANT', 200],
    ['get', '/attendant/search', 'STORE_ATTENDANT', 200],
    ['get', '/attendant/suppliers/:id', 'STORE_ATTENDANT', 200],
    ['get', '/attendant/restock-levels', 'STORE_ATTENDANT', 200],
    ['get', '/attendant/restock-levels', 'DIRECTOR', 200],
    ['get', '/attendant/restock-levels', 'WAITER', 403],
    ['get', '/attendant/notifications', 'STORE_ATTENDANT', 200],
    ['post', '/attendant/notifications/read', 'STORE_ATTENDANT', 200],
    ['post', '/attendant/notifications/read-all', 'STORE_ATTENDANT', 200],
    ['post', '/attendant/notifications/read-all', 'WAITER', 403],
  ])('%s %s as %s -> %i', async (method, path, role, expected) => {
    expect(await run(method, path, { id: 'u', role, siteId: HUB })).toBe(expected);
  });
});
