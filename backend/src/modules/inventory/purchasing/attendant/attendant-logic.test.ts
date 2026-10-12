import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  buildLevelRows,
  countMyOrders,
  countNotices,
  defaultBuy,
  deriveNotices,
  dueNoticeAt,
  filterLevelRows,
  filterMyOrders,
  groupByMonth,
  groupNotices,
  monthLabel,
  needOf,
  toMyOrderRow,
  type ItemFacts,
  type LevelItem,
  type NoticeContext,
  type NoticeOrder,
} from './attendant-logic';
import type { HistoryRow } from './attendant.types';
import type { OrderRowView } from '../_shared/purchasing.types';
import type { SupplierLine } from '../needs-restocking/needs-restocking-repository';

const D = (v: number | string) => new Prisma.Decimal(v);

describe('what an order needs from the Store Attendant (Paper 28A, 28F)', () => {
  const TODAY = '2026-10-10';
  it.each([
    ['RETURNED', null, 'RETURNED'],
    ['APPROVED', null, 'SEND'],
    ['APPROVED', '2026-10-01', 'SEND'],
    ['SENT', '2026-10-10', 'RECEIVE'],
    ['SENT', '2026-10-09', 'RECEIVE'],
    ['SENT', '2026-10-11', null],
    ['SENT', null, null],
    ['AWAITING_APPROVAL', null, null],
    ['DRAFT', null, null],
    ['DELIVERED', '2026-10-01', null],
  ] as const)('%s expected %s needs %s', (status, expected, need) => {
    expect(needOf(status, expected, TODAY)).toBe(need);
  });

  const row = (over: Partial<OrderRowView>): OrderRowView => ({ id: 'o', status: 'SENT', expectedDate: null, dueLabel: null, ...over }) as OrderRowView;
  const mine = [
    toMyOrderRow(row({ id: 'a', status: 'APPROVED' }), TODAY),
    toMyOrderRow(row({ id: 'b', status: 'SENT', expectedDate: TODAY, dueLabel: 'DUE_TODAY' }), TODAY),
    toMyOrderRow(row({ id: 'c', status: 'SENT', expectedDate: '2026-10-09', dueLabel: 'OVERDUE' }), TODAY),
    toMyOrderRow(row({ id: 'd', status: 'AWAITING_APPROVAL' }), TODAY),
  ];

  it('groups an order under Needs you or Waiting on others', () => {
    expect(mine.map((r) => [r.id, r.group, r.need])).toEqual([
      ['a', 'NEEDS_YOU', 'SEND'],
      ['b', 'NEEDS_YOU', 'RECEIVE'],
      ['c', 'NEEDS_YOU', 'RECEIVE'],
      ['d', 'WAITING', null],
    ]);
  });

  it('counts the chips like Paper 28F (All 4, Needs me 3, Waiting 1, Overdue 1) and filters by them', () => {
    expect(countMyOrders(mine)).toEqual({ all: 4, needs: 3, waiting: 1, overdue: 1 });
    expect(filterMyOrders(mine, 'all')).toHaveLength(4);
    expect(filterMyOrders(mine, 'needs').map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(filterMyOrders(mine, 'waiting').map((r) => r.id)).toEqual(['d']);
    expect(filterMyOrders(mine, 'overdue').map((r) => r.id)).toEqual(['c']);
  });
});

describe('History by month (Paper 28G)', () => {
  const r = (id: string, closedOn: string): HistoryRow => ({ id, reference: id, supplier: { id: 's', name: 'S' }, itemCount: 1, shortCount: 0, value: '1', valueKind: 'DELIVERED', outcome: 'PAID', cancelReason: null, closedOn });
  it('starts a new group when the month changes and labels it', () => {
    const months = groupByMonth([r('1', '2026-10-10'), r('2', '2026-10-03'), r('3', '2026-09-28'), r('4', '2026-09-21')]);
    expect(months.map((m) => [m.key, m.label, m.rows.map((x) => x.id)])).toEqual([
      ['2026-10', 'October 2026', ['1', '2']],
      ['2026-09', 'September 2026', ['3', '4']],
    ]);
    expect(monthLabel('2026-01')).toBe('January 2026');
    expect(groupByMonth([])).toEqual([]);
  });
});

const item = (over: Partial<ItemFacts> = {}): ItemFacts => ({ id: 'oil', name: 'Salt Cooking Oil 10ltr', usageUnit: 'jerrican', buyUnit: 'jerrican', packSize: null, preferredSupplierId: null, ...over });
const supplier = (id: string, name: string) => ({ id, name, code: `S-${id}`, type: 'REGULAR' as const, defaultPaymentTerms: 'INVOICE_TO_FOLLOW' as const, paymentDays: 14 });
const line = (itemId: string, sup: ReturnType<typeof supplier>, price: number | null, over: Partial<SupplierLine> = {}): SupplierLine => ({
  inventoryItemId: itemId, buyUnit: null, packSize: null, lastPrice: price === null ? null : D(price), lastPriceAt: null, isPreferred: false, supplier: sup, ...over,
});
const samrat = supplier('sam', 'Samrat Supermarket Ltd');
const kagumo = supplier('kag', 'Kagumo Poultry Farm');

describe('the suggested quantity is the reorder level minus what is left (owner, 10 Oct 2026)', () => {
  it('suggests level minus on hand, in whole buy units, from the default supplier', () => {
    expect(defaultBuy(item(), [line('oil', samrat, 2400)], D(0), D(8))).toEqual({ supplier: { id: 'sam', name: 'Samrat Supermarket Ltd' }, suggestedQty: '8' });
    // Kabras Sugar: 12 left, reorder at 40: add 28 (Paper 28B).
    expect(defaultBuy(item({ id: 'sugar', usageUnit: 'kg', buyUnit: 'kg' }), [line('sugar', samrat, 168)], D(12), D(40)).suggestedQty).toBe('28');
  });
  it('rounds a part pack up, suggests nothing when stock is at or above the level, and nothing without a level or a supplier', () => {
    expect(defaultBuy(item({ usageUnit: 'kg', buyUnit: 'bag', packSize: D(25) }), [line('oil', samrat, 100, { buyUnit: 'bag', packSize: D(25) })], D(10), D(100)).suggestedQty).toBe('4');
    expect(defaultBuy(item(), [line('oil', samrat, 2400)], D(8), D(8)).suggestedQty).toBeNull();
    expect(defaultBuy(item(), [line('oil', samrat, 2400)], D(1), null).suggestedQty).toBeNull();
    expect(defaultBuy(item(), [], D(0), D(8))).toEqual({ supplier: null, suggestedQty: null });
  });
  it('takes the preferred supplier over a cheaper one', () => {
    expect(defaultBuy(item({ preferredSupplierId: 'kag' }), [line('oil', samrat, 2300), line('oil', kagumo, 2400)], D(0), D(8)).supplier?.id).toBe('kag');
    expect(defaultBuy(item(), [line('oil', samrat, 2400), line('oil', kagumo, 2300)], D(0), D(8)).supplier?.id).toBe('kag');
  });
});

describe('Restock levels (Paper 28P)', () => {
  const li = (id: string, name: string, onHand: number, level: number, over: Partial<LevelItem> = {}): LevelItem => ({ ...item({ id, name }), onHand: D(onHand), level: D(level), ...over });
  const items = [li('i6', 'Iodised Salt 1kg', 48, 20), li('i3', 'Chicken wings', 1, 3), li('i1', 'Salt Cooking Oil 10ltr', 0, 8), li('i4', 'Kabras Sugar 1kg', 12, 40), li('i5', 'Angel Instant Dry Yeast 500g', 9, 4), li('i2', 'Highlands Water 12x1ltr', 0, 6)];
  const lines = [line('i1', samrat, 2400), line('i2', samrat, 720), line('i3', kagumo, 1900), line('i4', samrat, 168)];
  const rows = buildLevelRows(items, lines);

  it('sorts Out first, then Low, then fine, the emptiest first, and gives each a status and a bar fill', () => {
    expect(rows.map((r) => [r.name, r.status, r.fill])).toEqual([
      ['Highlands Water 12x1ltr', 'OUT', 0],
      ['Salt Cooking Oil 10ltr', 'OUT', 0],
      ['Kabras Sugar 1kg', 'LOW', 0.3],
      ['Chicken wings', 'LOW', 0.33],
      ['Angel Instant Dry Yeast 500g', 'OK', 1],
      ['Iodised Salt 1kg', 'OK', 1],
    ]);
  });

  it('caps the bar at full and never goes below empty', () => {
    expect(rows.find((r) => r.name.startsWith('Iodised'))?.fill).toBe(1);
    expect(buildLevelRows([li('x', 'Neg', -2, 5)], [])[0]?.fill).toBe(0);
  });

  it('names the default supplier of each item, null when nobody sells it', () => {
    expect(rows.find((r) => r.name.startsWith('Chicken'))?.supplier).toEqual({ id: 'kag', name: 'Kagumo Poultry Farm' });
    expect(rows.find((r) => r.name.startsWith('Iodised'))?.supplier).toBeNull();
  });

  it('filters by status, by supplier and by a typed search of the item or the supplier', () => {
    expect(filterLevelRows(rows, { status: 'OUT' })).toHaveLength(2);
    expect(filterLevelRows(rows, { supplierId: 'kag' }).map((r) => r.name)).toEqual(['Chicken wings']);
    expect(filterLevelRows(rows, { q: 'SALT' }).map((r) => r.name).sort()).toEqual(['Iodised Salt 1kg', 'Salt Cooking Oil 10ltr']);
    expect(filterLevelRows(rows, { q: 'kagumo' }).map((r) => r.name)).toEqual(['Chicken wings']);
    expect(filterLevelRows(rows, {})).toHaveLength(6);
  });
});

describe('Notifications derived from the orders (Paper 28N)', () => {
  // Thu 8 Oct 2026, 12:00 Nairobi.
  const NOW = new Date('2026-10-08T09:00:00Z');
  const order = (over: Partial<NoticeOrder>): NoticeOrder => ({
    id: 'o', reference: 'LPO-0001', status: 'APPROVED', expectedDate: null, supplierName: 'Kagumo Poultry Farm', itemCount: 1, total: D(16050), raisedById: 'att',
    approvedAt: null, approver: null, returnedAt: null, returnedNote: null, returner: null, closedAt: null, ...over,
  });
  const joseph = { id: 'sm', name: 'Joseph', role: 'STORE_MANAGER' };
  const ctx = (over: Partial<NoticeContext> = {}): NoticeContext => ({ actorId: 'att', canReceive: true, seesCosts: true, now: NOW, read: new Set(), ...over });

  const returned = order({ id: 'r', reference: 'LPO-0048', status: 'RETURNED', supplierName: 'Nyeri Market Traders', returnedAt: new Date('2026-10-08T07:40:00Z'), returnedNote: 'Lower the carrots to 5 sacks.', returner: joseph });
  const approvedReady = order({ id: 'a', reference: 'LPO-0045', status: 'APPROVED', approvedAt: new Date('2026-10-08T07:12:00Z'), approver: joseph });
  const dueToday = order({ id: 'd', reference: 'LPO-0044', status: 'SENT', expectedDate: '2026-10-08', supplierName: 'Samrat Supermarket Ltd', itemCount: 4 });
  const overdue = order({ id: 'v', reference: 'LPO-0043', status: 'SENT', expectedDate: '2026-10-07' });
  const closed = order({ id: 'c', reference: 'LPO-0040', status: 'CLOSED', closedAt: new Date('2026-10-07T13:20:00Z') });
  const all = [returned, approvedReady, dueToday, overdue, closed];

  it('derives the five notices of Paper 28N, newest first, with the one button each', () => {
    const n = deriveNotices(all, ctx());
    expect(n.map((x) => [x.type, x.reference, x.action])).toEqual([
      ['RETURNED', 'LPO-0048', 'EDIT_AND_RESEND'], // today 10:40
      ['APPROVED', 'LPO-0045', 'PRINT_OR_SHARE'], // today 10:12
      ['DUE_TODAY', 'LPO-0044', 'RECEIVE_DELIVERY'], // today 08:00
      ['OVERDUE', 'LPO-0043', 'CALL_SUPPLIER'], // today 08:00 (the day after it was expected)
      ['CLOSED', 'LPO-0040', null], // yesterday
    ]);
  });

  it('words each one with the person and their role, and no invoice or payment figure', () => {
    const byType = Object.fromEntries(deriveNotices(all, ctx()).map((x) => [x.type, x]));
    expect(byType['RETURNED']).toMatchObject({ title: 'Joseph.Store Manager sent it back', body: '"Lower the carrots to 5 sacks."', supplierName: 'Nyeri Market Traders' });
    expect(byType['APPROVED']).toMatchObject({ title: 'Joseph.Store Manager approved it', body: 'Ready to send · KES 16,050' });
    expect(byType['DUE_TODAY']).toMatchObject({ title: 'Delivery due today', body: 'Samrat Supermarket Ltd is due to deliver', itemCount: 4 });
    expect(byType['OVERDUE']).toMatchObject({ title: '1 day overdue', body: 'Kagumo Poultry Farm has not delivered' });
    expect(byType['CLOSED']).toMatchObject({ title: 'Order closed', body: 'Paid in full' });
    expect(JSON.stringify(Object.values(byType))).not.toMatch(/invoice|payment|balance/i);
  });

  it('shows the days late, and carries the date the notice was first sent so it keeps one key', () => {
    const three = deriveNotices([order({ id: 'v3', status: 'SENT', expectedDate: '2026-10-05' })], ctx());
    expect(three[0]).toMatchObject({ title: '3 days overdue', key: 'OVERDUE:v3', at: '2026-10-06T05:00:00.000Z' });
    expect(dueNoticeAt('2026-10-08').toISOString()).toBe('2026-10-08T05:00:00.000Z');
  });

  it('marks unread what has no read mark, and counts like Paper (5 notices, 3 unread, 4 need me)', () => {
    const read = new Set(['CLOSED:c', 'APPROVED:a']);
    const n = deriveNotices(all, ctx({ read }));
    expect(countNotices(n)).toEqual({ all: 5, unread: 3, needsMe: 4 });
    expect(n.find((x) => x.type === 'CLOSED')?.unread).toBe(false);
  });

  it('keeps a second return of the same order a new notice (its key carries the time)', () => {
    const a = deriveNotices([returned], ctx())[0]?.key;
    const b = deriveNotices([{ ...returned, returnedAt: new Date('2026-10-08T08:00:00Z') }], ctx())[0]?.key;
    expect(a).not.toBe(b);
  });

  it('drops the button once an order has moved on: approved but already sent, returned but resent', () => {
    const sent = deriveNotices([{ ...approvedReady, status: 'SENT', expectedDate: '2026-10-20' }], ctx());
    expect(sent[0]).toMatchObject({ type: 'APPROVED', action: null, body: 'Approved and sent · KES 16,050' });
    expect(deriveNotices([{ ...returned, status: 'AWAITING_APPROVAL' }], ctx())).toEqual([]);
  });

  it('tells only the person who raised the order about its approval, return and closing', () => {
    expect(deriveNotices([returned, approvedReady, closed], ctx({ actorId: 'someone-else' }))).toEqual([]);
    // ...but a delivery due is every Attendant's to receive.
    expect(deriveNotices([dueToday, overdue], ctx({ actorId: 'someone-else' }))).toHaveLength(2);
    expect(deriveNotices([dueToday, overdue], ctx({ actorId: 'someone-else', canReceive: false }))).toEqual([]);
  });

  it('does not tell an approver about their own approval', () => {
    expect(deriveNotices([{ ...approvedReady, approver: { ...joseph, id: 'att' } }], ctx())).toEqual([]);
  });

  it('shows no money to a person who may not see item prices', () => {
    expect(deriveNotices([approvedReady], ctx({ seesCosts: false }))[0]?.body).toBe('Ready to send');
  });

  it('shows "due today" only once 08:00 Nairobi has come, and an order not yet sent is neither due nor overdue', () => {
    const early = new Date('2026-10-08T03:00:00Z'); // 06:00 Nairobi
    expect(deriveNotices([dueToday], ctx({ now: early }))).toEqual([]);
    expect(deriveNotices([order({ status: 'APPROVED', expectedDate: '2026-10-01' })], ctx())).toEqual([]);
  });

  it('forgets events older than 30 days', () => {
    expect(deriveNotices([order({ id: 'old', status: 'CLOSED', closedAt: new Date('2026-09-01T10:00:00Z') })], ctx())).toEqual([]);
  });

  it('groups by Nairobi day with Today, Yesterday, then the weekday and date', () => {
    const n = deriveNotices([...all, order({ id: 'e', status: 'CLOSED', reference: 'LPO-0030', closedAt: new Date('2026-10-05T10:00:00Z') })], ctx());
    const groups = groupNotices(n, NOW);
    expect(groups.map((g) => [g.label, g.notices.length])).toEqual([['Today', 4], ['Yesterday', 1], ['Mon 5 Oct', 1]]);
  });

  it('counts a day boundary in Nairobi time, not UTC (23:30 UTC on the 7th is 02:30 on the 8th)', () => {
    const n = deriveNotices([order({ id: 'late', status: 'CLOSED', closedAt: new Date('2026-10-07T23:30:00Z') })], ctx());
    expect(groupNotices(n, NOW)[0]?.label).toBe('Today');
  });
});
