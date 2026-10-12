import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scope } from '../audit-log-repository';
import { stockAdjustmentsRepository } from './stock-adjustments-repository';
import { stockAdjustmentsSource } from './stock-adjustments-source';
import { stockCountsRepository } from './stock-counts-repository';
import { stockCountsSource } from './stock-counts-source';
import { wasteAuditRepository } from './waste-repository';
import { wasteSource } from './waste-source';
import { branchWasteAuditRepository } from './branch-waste-repository';
import { branchWasteSource } from './branch-waste-source';
import { branchDayAuditRepository } from './branch-day-repository';
import { branchDaySource } from './branch-day-source';

vi.mock('./branch-day-repository', () => ({ branchDayAuditRepository: { openings: vi.fn(), counts: vi.fn(), closes: vi.fn(), corrections: vi.fn(), count: vi.fn(), actorIds: vi.fn() } }));
vi.mock('./stock-counts-repository', () => ({ stockCountsRepository: { entries: vi.fn(), count: vi.fn(), adjustmentsOf: vi.fn(), actorIds: vi.fn() } }));
vi.mock('./waste-repository', () => ({ wasteAuditRepository: { entries: vi.fn(), count: vi.fn(), actorIds: vi.fn() } }));
vi.mock('./branch-waste-repository', () => ({ branchWasteAuditRepository: { entries: vi.fn(), count: vi.fn(), actorIds: vi.fn() } }));
vi.mock('./stock-adjustments-repository', () => ({ stockAdjustmentsRepository: { entries: vi.fn(), count: vi.fn(), actorIds: vi.fn() } }));

const scope: Scope = { hubId: 'hub', restockOrgIds: ['hub'], peopleOrgIds: ['hub'] };
const filter = {};
const D = (n: string | number) => new Prisma.Decimal(n);
const peter = { id: 'u-peter', name: 'Peter Kariuki' };
const isabel = { id: 'u-isabel', name: 'Isabel Njoki' };

beforeEach(() => vi.resetAllMocks());

describe('Stock counts source', () => {
  const count = (over: Record<string, unknown> = {}) => ({
    id: 'c1',
    reference: 'CNT-2026-1013',
    selfSigned: false,
    signedAt: new Date('2026-10-08T04:42:00Z'),
    approvedAt: new Date('2026-10-08T11:00:00Z'),
    counter: peter,
    approver: isabel,
    scopeSections: [{ sectionName: 'Samrat' }],
    lines: [{ countedQty: D(3), inventoryItem: { name: 'Sugar' } }, { countedQty: D(1), inventoryItem: { name: 'Salt' } }, { countedQty: null, inventoryItem: { name: 'Flour' } }],
    ...over,
  });

  it('tells a count signed by its counter, and a count approved by the Manager with what it posted', async () => {
    vi.mocked(stockCountsRepository.entries).mockImplementation((async (_s: unknown, _f: unknown, kind: string) => [count({ id: kind === 'SIGNED' ? 'c1' : 'c2', reference: kind === 'SIGNED' ? 'CNT-2026-1013' : 'CNT-2026-1012' })]) as never);
    vi.mocked(stockCountsRepository.adjustmentsOf).mockResolvedValue(new Map([['c2', { adjustments: 38, netKes: -5681 }]]));
    const entries = await stockCountsSource.entries(scope, filter, 50);
    expect(entries).toEqual([
      { id: 'count:signed:c1', at: '2026-10-08T04:42:00.000Z', actor: peter, area: 'STOCK_COUNTS', what: 'Signed the count · Samrat · 2 items · signed with PIN', reason: null, record: { kind: 'COUNT', id: 'c1', label: 'CNT-2026-1013' } },
      { id: 'count:approved:c2', at: '2026-10-08T11:00:00.000Z', actor: isabel, area: 'STOCK_COUNTS', what: 'Approved the count · 38 adjustments, net −KES 5,681 · signed with PIN', reason: null, record: { kind: 'COUNT', id: 'c2', label: 'CNT-2026-1012' } },
    ]);
  });

  it('says "no adjustments" when approving posted nothing', async () => {
    vi.mocked(stockCountsRepository.entries).mockImplementation((async (_s: unknown, _f: unknown, kind: string) => (kind === 'APPROVED' ? [count()] : [])) as never);
    vi.mocked(stockCountsRepository.adjustmentsOf).mockResolvedValue(new Map());
    expect((await stockCountsSource.entries(scope, filter, 50))[0]?.what).toBe('Approved the count · no adjustments · signed with PIN');
  });

  it('a count the Manager signed themselves is one "Signed and applied" entry', async () => {
    vi.mocked(stockCountsRepository.entries).mockImplementation((async (_s: unknown, _f: unknown, kind: string) => (kind === 'APPROVED' ? [count({ selfSigned: true, counter: isabel })] : [])) as never);
    vi.mocked(stockCountsRepository.adjustmentsOf).mockResolvedValue(new Map([['c1', { adjustments: 1, netKes: 120 }]]));
    const entries = await stockCountsSource.entries(scope, filter, 50);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.what).toBe('Signed and applied the count · Samrat · 2 items · 1 adjustment, net KES 120 · signed with PIN');
  });

  it('names the first items when the count was of single items (a recount has no section)', async () => {
    vi.mocked(stockCountsRepository.entries).mockImplementation((async (_s: unknown, _f: unknown, kind: string) => (kind === 'SIGNED' ? [count({ scopeSections: [] })] : [])) as never);
    vi.mocked(stockCountsRepository.adjustmentsOf).mockResolvedValue(new Map());
    expect((await stockCountsSource.entries(scope, filter, 50))[0]?.what).toBe('Signed the count · Sugar, Salt, Flour · 2 items · signed with PIN');
  });

  it('counts both kinds', async () => {
    vi.mocked(stockCountsRepository.count).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    expect(await stockCountsSource.count(scope, filter)).toBe(5);
  });
});

describe('Waste source', () => {
  const log = (over: Record<string, unknown> = {}) => ({
    id: 'w1',
    quantity: D('3.0000'),
    unitCost: D(420),
    reason: 'EXPIRY',
    createdAt: new Date('2026-10-08T11:05:00Z'),
    reversedAt: null,
    reversalReason: null,
    reversalNote: null,
    inventoryItem: { id: 'item-1', name: 'Marinated chicken', usageUnit: 'kg' },
    loggedBy: peter,
    reversedBy: null,
    ...over,
  });

  it('tells an entry logged, with its value, and a link to the item’s stock card on that day', async () => {
    vi.mocked(wasteAuditRepository.entries).mockImplementation((async (_s: unknown, _f: unknown, kind: string) => (kind === 'LOGGED' ? [log()] : [])) as never);
    expect(await wasteSource.entries(scope, filter, 50)).toEqual([
      {
        id: 'waste:logged:w1',
        at: '2026-10-08T11:05:00.000Z',
        actor: peter,
        area: 'WASTE',
        what: 'Logged waste · Marinated chicken 3 kg · Expired · KES 1,260',
        reason: null,
        record: { kind: 'STOCK_CARD', id: 'item-1', label: 'Stock ledger entry', day: '2026-10-08' },
      },
    ]);
  });

  it('tells an entry reversed, with the reason in the sentence and the day it was reversed', async () => {
    vi.mocked(wasteAuditRepository.entries).mockImplementation((async (_s: unknown, _f: unknown, kind: string) =>
      kind === 'REVERSED' ? [log({ quantity: D(6), inventoryItem: { id: 'item-2', name: 'Milk', usageUnit: 'L' }, reversedAt: new Date('2026-10-08T21:30:00Z'), reversedBy: isabel, reversalReason: 'WRONG_ITEM' })] : []) as never);
    const [entry] = await wasteSource.entries(scope, filter, 50);
    expect(entry).toMatchObject({ id: 'waste:reversed:w1', actor: isabel, what: 'Reversed waste entry · Milk 6 L · reason: logged the wrong item' });
    // 21:30 UTC is 00:30 the next day in Nairobi.
    expect(entry?.record).toEqual({ kind: 'STOCK_CARD', id: 'item-2', label: 'Stock ledger entry', day: '2026-10-09' });
  });

  it('uses the typed note when the reversal reason is Other', async () => {
    vi.mocked(wasteAuditRepository.entries).mockImplementation((async (_s: unknown, _f: unknown, kind: string) =>
      kind === 'REVERSED' ? [log({ reversedAt: new Date('2026-10-08T12:00:00Z'), reversedBy: isabel, reversalReason: 'OTHER', reversalNote: 'Counted in the wrong bin' })] : []) as never);
    expect((await wasteSource.entries(scope, filter, 50))[0]?.what).toBe('Reversed waste entry · Marinated chicken 3 kg · reason: Counted in the wrong bin');
  });
});

describe('Branch waste source', () => {
  const log = (over: Record<string, unknown> = {}) => ({
    id: 'bw1',
    quantity: D('2.0000'),
    reason: 'EXPIRY',
    createdAt: new Date('2026-10-08T11:05:00Z'),
    reversedAt: null,
    reversalReason: null,
    reversalNote: null,
    inventoryItem: { id: 'item-9', name: 'Beef stew', usageUnit: 'kg' },
    loggedBy: peter,
    reversedBy: null,
    ...over,
  });

  it('tells an entry logged with no money in the sentence, and links to the item’s stock card on that day', async () => {
    vi.mocked(branchWasteAuditRepository.entries).mockImplementation((async (_s: unknown, _f: unknown, kind: string) => (kind === 'LOGGED' ? [log()] : [])) as never);
    expect(await branchWasteSource.entries(scope, filter, 50)).toEqual([
      {
        id: 'branch-waste:logged:bw1',
        at: '2026-10-08T11:05:00.000Z',
        actor: peter,
        area: 'BRANCH_WASTE',
        what: 'Logged waste · Beef stew 2 kg · Expired',
        reason: null,
        record: { kind: 'STOCK_CARD', id: 'item-9', label: 'Stock ledger entry', day: '2026-10-08' },
      },
    ]);
  });

  it('tells an entry reversed, with the reason in the sentence and the Nairobi day it was reversed', async () => {
    vi.mocked(branchWasteAuditRepository.entries).mockImplementation((async (_s: unknown, _f: unknown, kind: string) =>
      kind === 'REVERSED' ? [log({ reversedAt: new Date('2026-10-08T21:30:00Z'), reversedBy: isabel, reversalReason: 'WRONG_QUANTITY' })] : []) as never);
    const [entry] = await branchWasteSource.entries(scope, filter, 50);
    expect(entry).toMatchObject({ id: 'branch-waste:reversed:bw1', actor: isabel, what: 'Reversed waste entry · Beef stew 2 kg · reason: wrong quantity' });
    expect(entry?.record?.day).toBe('2026-10-09');
  });

  it('counts both kinds and lists the people who logged or reversed', async () => {
    vi.mocked(branchWasteAuditRepository.count).mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    expect(await branchWasteSource.count(scope, filter)).toBe(5);
    vi.mocked(branchWasteAuditRepository.actorIds).mockResolvedValue(['u-peter']);
    expect(await branchWasteSource.actorIds(scope, {})).toEqual(['u-peter']);
  });
});

describe('Branch day source', () => {
  const day = { id: 'day-1', reference: 'DAY-NYR-0044', businessDate: new Date('2026-10-08T00:00:00Z') };
  const line = (name: string, prefilled: number, accepted: number) => ({ prefilledQty: D(prefilled), acceptedQty: D(accepted), overnightVariance: D(accepted - prefilled), inventoryItem: { name } });
  const none = () => {
    vi.mocked(branchDayAuditRepository.openings).mockResolvedValue([]);
    vi.mocked(branchDayAuditRepository.counts).mockResolvedValue([]);
    vi.mocked(branchDayAuditRepository.closes).mockResolvedValue([]);
    vi.mocked(branchDayAuditRepository.corrections).mockResolvedValue([]);
  };

  it('tells an opening checked, and an opening recorded with its differences; the link is the day number', async () => {
    none();
    vi.mocked(branchDayAuditRepository.openings).mockResolvedValue([
      { id: 'o1', kind: 'ACCEPTED', acceptedAt: new Date('2026-10-08T04:30:00Z'), onBehalf: false, acceptedBy: peter, department: { name: 'Barista' }, branchDay: day, lines: [line('Milk 1L', 8, 8)] },
      { id: 'o2', kind: 'RECOUNTED', acceptedAt: new Date('2026-10-08T04:40:00Z'), onBehalf: false, acceptedBy: isabel, department: { name: 'Kitchen' }, branchDay: day, lines: [line('Milk 1L', 8, 7), line('Oil', 3, 3)] },
      { id: 'o3', kind: 'RECOUNTED', acceptedAt: new Date('2026-10-08T04:20:00Z'), onBehalf: false, acceptedBy: isabel, department: { name: 'Pastry' }, branchDay: day, lines: [line('Flour', 5, 4), line('Eggs', 30, 28), line('Sugar', 2, 3)] },
    ] as never);
    const entries = await branchDaySource.entries(scope, filter, 50);
    expect(entries.map((e) => [e.id, e.what])).toEqual([
      ['branch-day:opening:o2', 'Recorded the opening: Milk 1L, 1 less than last night (8 → 7)'],
      ['branch-day:opening:o1', 'Checked the opening: Barista, same as last night'],
      ['branch-day:opening:o3', 'Recorded the opening: Pastry, 3 differences'],
    ]);
    expect(entries[0]).toMatchObject({ area: 'BRANCH_DAY', actor: isabel, reason: null, record: { kind: 'DAY', id: 'day-1', label: 'DAY-NYR-0044', day: '2026-10-08' } });
  });

  it('tells a count signed, on behalf of the department when the Branch Manager signed it', async () => {
    none();
    vi.mocked(branchDayAuditRepository.counts).mockResolvedValue([
      { id: 'c1', countedAt: new Date('2026-10-08T16:20:00Z'), onBehalf: false, countedBy: peter, department: { name: 'Housekeeping' }, branchDay: day, _count: { lines: 6 } },
      { id: 'c2', countedAt: new Date('2026-10-08T16:10:00Z'), onBehalf: true, countedBy: isabel, department: { name: 'Pastry' }, branchDay: day, _count: { lines: 1 } },
    ] as never);
    expect((await branchDaySource.entries(scope, filter, 50)).map((e) => e.what)).toEqual([
      'Counted and signed: Housekeeping, 6 items',
      'Counted and signed on behalf of Pastry: 1 item',
    ]);
  });

  it('tells the day closed with NO money and NO PIN in the words', async () => {
    none();
    vi.mocked(branchDayAuditRepository.closes).mockResolvedValue([{ id: 'day-1', reference: 'DAY-NYR-0044', businessDate: day.businessDate, closedAt: new Date('2026-10-08T17:00:00Z'), closedBy: isabel }] as never);
    const [entry] = await branchDaySource.entries(scope, filter, 50);
    expect(entry).toMatchObject({ id: 'branch-day:close:day-1', what: 'Closed the day', actor: isabel, record: { kind: 'DAY', id: 'day-1' } });
    expect(JSON.stringify(entry)).not.toMatch(/KES|pin|\d{3},\d{3}/i);
  });

  it('tells a count corrected: the reason and note in `reason`, the ledger searched for the day number as the record, no PIN', async () => {
    none();
    vi.mocked(branchDayAuditRepository.corrections).mockResolvedValue([
      {
        id: 'x1',
        correctedAt: new Date('2026-10-09T06:14:00Z'),
        fromClosingQty: D(1),
        toClosingQty: D(2),
        reason: 'COUNTED_WRONGLY',
        note: 'Wrong shelf',
        correctedBy: isabel,
        branchDay: day,
        branchDayLine: { inventoryItem: { name: 'Flour 25kg' }, department: { department: { name: 'Pastry' } } },
      },
      {
        id: 'x2',
        correctedAt: new Date('2026-10-09T06:00:00Z'),
        fromClosingQty: D('2.5'),
        toClosingQty: D(3),
        reason: 'ITEM_WAS_MISSED',
        note: null,
        correctedBy: isabel,
        branchDay: day,
        branchDayLine: { inventoryItem: { name: 'Oil' }, department: { department: { name: 'Kitchen' } } },
      },
    ] as never);
    const entries = await branchDaySource.entries(scope, filter, 50);
    expect(entries[0]).toEqual({
      id: 'branch-day:correction:x1',
      at: '2026-10-09T06:14:00.000Z',
      actor: isabel,
      area: 'BRANCH_DAY',
      what: 'Corrected a count: Flour 25kg (Pastry), closing stock 1 → 2',
      reason: 'Counted wrongly · Wrong shelf',
      record: { kind: 'LEDGER_SEARCH', id: 'DAY-NYR-0044', label: 'DAY-NYR-0044', day: '2026-10-09' },
    });
    expect(entries[1]).toMatchObject({ what: 'Corrected a count: Oil (Kitchen), closing stock 2.5 → 3', reason: 'Item was missed' });
    expect(JSON.stringify(entries)).not.toMatch(/pin/i);
  });

  it('merges every kind newest first, cuts to the page asked for, and never carries money', async () => {
    none();
    vi.mocked(branchDayAuditRepository.closes).mockResolvedValue([{ id: 'day-1', reference: 'DAY-NYR-0044', businessDate: day.businessDate, closedAt: new Date('2026-10-08T17:00:00Z'), closedBy: isabel }] as never);
    vi.mocked(branchDayAuditRepository.counts).mockResolvedValue([
      { id: 'c1', countedAt: new Date('2026-10-08T16:20:00Z'), onBehalf: false, countedBy: peter, department: { name: 'Housekeeping' }, branchDay: day, _count: { lines: 6 } },
      { id: 'c2', countedAt: new Date('2026-10-08T16:10:00Z'), onBehalf: false, countedBy: peter, department: { name: 'Pastry' }, branchDay: day, _count: { lines: 2 } },
    ] as never);
    const entries = await branchDaySource.entries(scope, filter, 2);
    expect(entries.map((e) => e.id)).toEqual(['branch-day:close:day-1', 'branch-day:count:c1']);
    expect(JSON.stringify(entries)).not.toMatch(/KES/);
  });

  it('counts every kind and lists every actor through the repository', async () => {
    vi.mocked(branchDayAuditRepository.count).mockResolvedValue(9);
    vi.mocked(branchDayAuditRepository.actorIds).mockResolvedValue(['u1', 'u2']);
    expect(await branchDaySource.count(scope, filter)).toBe(9);
    expect(await branchDaySource.actorIds(scope, {})).toEqual(['u1', 'u2']);
    expect(branchDaySource.area).toBe('BRANCH_DAY');
  });
});

describe('Stock adjustments source', () => {
  it('words a posted movement and a reversal, each with its ADJ number as the record', async () => {
    vi.mocked(stockAdjustmentsRepository.entries).mockResolvedValue([
      { id: 'a1', quantity: D('-2.0000'), reason: 'Spoilage', reference: 'ADJ-0042', createdAt: new Date('2026-10-08T08:00:00Z'), inventoryItem: { name: 'Eggs', usageUnit: 'trays' }, user: isabel, reverses: null },
      { id: 'a2', quantity: D('2.0000'), reason: null, reference: 'ADJ-0043', createdAt: new Date('2026-10-08T09:00:00Z'), inventoryItem: { name: 'Eggs', usageUnit: 'trays' }, user: isabel, reverses: { reference: 'ADJ-0042' } },
    ] as never);
    const entries = await stockAdjustmentsSource.entries(scope, filter, 50);
    expect(entries.map((e) => e.what)).toEqual(['Posted a movement · Eggs −2 trays · reason Spoilage', 'Reversed movement ADJ-0042 · Eggs +2 trays']);
    expect(entries[0]).toMatchObject({ id: 'adjustment:a1', area: 'STOCK_ADJUSTMENTS', record: { kind: 'LEDGER_SEARCH', id: 'ADJ-0042', label: 'ADJ-0042', day: '2026-10-08' } });
  });
});
