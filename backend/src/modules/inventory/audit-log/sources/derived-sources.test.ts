import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scope } from '../audit-log-repository';
import { stockAdjustmentsRepository } from './stock-adjustments-repository';
import { stockAdjustmentsSource } from './stock-adjustments-source';
import { stockCountsRepository } from './stock-counts-repository';
import { stockCountsSource } from './stock-counts-source';
import { wasteAuditRepository } from './waste-repository';
import { wasteSource } from './waste-source';

vi.mock('./stock-counts-repository', () => ({ stockCountsRepository: { entries: vi.fn(), count: vi.fn(), adjustmentsOf: vi.fn(), actorIds: vi.fn() } }));
vi.mock('./waste-repository', () => ({ wasteAuditRepository: { entries: vi.fn(), count: vi.fn(), actorIds: vi.fn() } }));
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
