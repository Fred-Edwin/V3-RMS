import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { locationRepository } from '../../../../repositories/location-repository';
import { itemIdsInSection, lastCountedByItem, sectionNamesByItem } from '../../counting/_shared/count-reads';
import { ledgerListSchema, stockCardSchema } from '../_shared/stock-contract';
import { historyRepository, type CardEntryRow, type LedgerSummaryRow } from './history-repository';
import { EXPORT_MAX_ROWS, historyService, resolveRange } from './history-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../repositories/location-repository', () => ({ locationRepository: { findCentralStore: vi.fn() } }));
vi.mock('../../counting/_shared/count-reads', () => ({ lastCountedByItem: vi.fn(), sectionNamesByItem: vi.fn(), itemIdsInSection: vi.fn() }));
vi.mock('./history-repository', () => ({
  historyRepository: {
    findSummaryPage: vi.fn(),
    findSummaryAll: vi.fn(),
    chipCounts: vi.fn(),
    totals: vi.fn(),
    findItem: vi.fn(),
    positionBefore: vi.fn(),
    restockLevel: vi.fn(),
    findCardEntries: vi.fn(),
  },
}));

const D = (v: string | number) => new Prisma.Decimal(v);
const HUB = '11111111-1111-4111-8111-111111111111';
const STORE = '55555555-5555-4555-8555-555555555555';
const ITEM = '10000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-10-13T13:30:00Z'); // 16:30 Nairobi, 13 Oct

const manager = { id: 'u-sam', role: 'STORE_MANAGER' as const, siteId: HUB, name: 'Sam' };
const director = { id: 'u-dir', role: 'DIRECTOR' as const, siteId: '22222222-2222-4222-8222-222222222222', name: 'Isabel' };

const summary: LedgerSummaryRow = {
  itemId: ITEM, name: 'Sugar, white', unit: 'kg', type: 'RAW_INGREDIENT',
  opening: D(160), in: D(50), sentOut: D(-20), prepUse: D(-12), waste: D(0), adjusted: D(-14), closing: D(164), closingValue: D('30012'), madeInPrep: false,
};
const query = { chip: 'all' as const, page: 1, pageSize: 50 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue({ id: STORE, siteId: HUB, name: 'Central Store' } as never);
  vi.mocked(historyRepository.findSummaryPage).mockResolvedValue([summary]);
  vi.mocked(historyRepository.chipCounts).mockResolvedValue({ all: 142, adjustments: 14, waste: 19, negative: 2 });
  vi.mocked(historyRepository.totals).mockResolvedValue({ openingValue: D(510200), inValue: D(214600), outValue: D(-239000), adjustedValue: D(-3400), closingValue: D(482400), openingItems: 142 });
});

describe('resolveRange', () => {
  it('defaults to the last 30 days ending today', () => {
    expect(resolveRange({}, NOW)).toEqual({ from: '2026-09-14', to: '2026-10-13' });
  });

  it('fixes the other end when only one is given', () => {
    expect(resolveRange({ from: '2026-10-01' }, NOW)).toEqual({ from: '2026-10-01', to: '2026-10-13' });
    expect(resolveRange({ to: '2026-10-05' }, NOW)).toEqual({ from: '2026-09-06', to: '2026-10-05' });
  });

  it('refuses a future date and a backwards range', () => {
    expect(() => resolveRange({ to: '2026-10-14' }, NOW)).toThrowError(expect.objectContaining({ statusCode: 400, code: 'DATE_IN_FUTURE' }));
    expect(() => resolveRange({ from: '2026-10-14', to: '2026-10-14' }, NOW)).toThrowError(expect.objectContaining({ code: 'DATE_IN_FUTURE' }));
    expect(() => resolveRange({ from: '2026-10-10', to: '2026-10-05' }, NOW)).toThrowError(expect.objectContaining({ statusCode: 400, code: 'RANGE_INVALID' }));
  });

  it('reads today as a Nairobi day: 22:30 UTC on 13 Oct is already 14 Oct', () => {
    expect(resolveRange({ to: '2026-10-14' }, new Date('2026-10-13T22:30:00Z')).to).toBe('2026-10-14');
  });
});

describe('historyService.list (S3)', () => {
  it('builds the contract shape with the period cut at Nairobi midnights', async () => {
    const list = await historyService.list(manager, query, NOW);
    expect(() => ledgerListSchema.parse(list)).not.toThrow();
    expect(list).toMatchObject({ from: '2026-09-14', to: '2026-10-13', periodText: 'Last 30 days, as of 13 Oct, 16:30', chips: { all: 142, adjustments: 14, waste: 19, negative: 2 }, page: { page: 1, pageSize: 50, total: 142 } });
    const filter = vi.mocked(historyRepository.findSummaryPage).mock.calls[0]![0];
    expect(filter).toMatchObject({ siteId: HUB, locationId: STORE });
    expect(filter.start.toISOString()).toBe('2026-09-13T21:00:00.000Z');
    expect(filter.end.toISOString()).toBe('2026-10-13T21:00:00.000Z');
  });

  it('every row adds up: opening + in + sentOut + prepUse + waste + adjusted = closing', async () => {
    const list = await historyService.list(manager, query, NOW);
    for (const row of list.rows) {
      const sum = [row.opening, row.in, row.sentOut, row.prepUse, row.waste, row.adjusted].reduce((total, v) => total.plus(v), D(0));
      expect(sum.toString()).toBe(row.closing);
    }
  });

  it('takes the page total from the chip chosen', async () => {
    const list = await historyService.list(manager, { ...query, chip: 'negative' }, NOW);
    expect(list.page.total).toBe(2);
    expect(vi.mocked(historyRepository.findSummaryPage).mock.calls[0]![1]).toBe('negative');
  });

  it('passes search and section on to the filter', async () => {
    vi.mocked(itemIdsInSection).mockResolvedValue([ITEM]);
    await historyService.list(manager, { ...query, search: 'ADJ-3402', sectionId: '5e000000-0000-4000-8000-000000000001' }, NOW);
    expect(itemIdsInSection).toHaveBeenCalledWith(HUB, '5e000000-0000-4000-8000-000000000001');
    expect(vi.mocked(historyRepository.findSummaryPage).mock.calls[0]![0]).toMatchObject({ search: 'ADJ-3402', sectionItemIds: [ITEM] });
  });

  it('lets the Director read from outside the hub', async () => {
    await expect(historyService.list(director, query, NOW)).resolves.toBeDefined();
  });

  it('notes "made in Prep" for a prepped item produced in the period', async () => {
    vi.mocked(historyRepository.findSummaryPage).mockResolvedValue([{ ...summary, madeInPrep: true }]);
    expect((await historyService.list(manager, query, NOW)).rows[0]!.note).toBe('made in Prep');
  });

  it('refuses a range that is in the future before reading anything', async () => {
    await expect(historyService.list(manager, { ...query, to: '2026-10-20' }, NOW)).rejects.toMatchObject({ code: 'DATE_IN_FUTURE' });
    expect(historyRepository.findSummaryPage).not.toHaveBeenCalled();
  });
});

describe('historyService.exportCsv (S4)', () => {
  it('returns the CSV of every row with a dated file name', async () => {
    vi.mocked(historyRepository.findSummaryAll).mockResolvedValue([summary]);
    const out = await historyService.exportCsv(manager, query, NOW);
    expect(out.filename).toBe('stock-ledger-2026-09-14-to-2026-10-13.csv');
    expect(out.csv.split('\r\n')).toHaveLength(3);
    expect(vi.mocked(historyRepository.findSummaryAll).mock.calls[0]![2]).toBe(EXPORT_MAX_ROWS + 1);
  });

  it('refuses more than 10,000 rows with 413 EXPORT_TOO_LARGE', async () => {
    vi.mocked(historyRepository.findSummaryAll).mockResolvedValue(Array.from({ length: EXPORT_MAX_ROWS + 1 }, () => summary));
    await expect(historyService.exportCsv(manager, query, NOW)).rejects.toMatchObject({ statusCode: 413, code: 'EXPORT_TOO_LARGE' });
  });

  it('accepts exactly 10,000 rows', async () => {
    vi.mocked(historyRepository.findSummaryAll).mockResolvedValue(Array.from({ length: EXPORT_MAX_ROWS }, () => summary));
    await expect(historyService.exportCsv(manager, query, NOW)).resolves.toBeDefined();
  });
});

describe('historyService.card (S5)', () => {
  const entry = (n: number, type: CardEntryRow['type'], quantity: number, at: string, over: Partial<CardEntryRow> = {}): CardEntryRow => ({
    id: `e${n}`, createdAt: new Date(at), type, quantity: D(quantity), unitCost: D(183),
    adjustmentReference: null, countReference: null, deliveryReference: null, prepReference: null, dispatchLabel: null,
    isReversal: false, originalReference: null, reversed: false, ...over,
  });
  // 8 days of movement: 6, 7, 8, 9, 10, 11, 12 Oct and the count adjustment on 13 Oct.
  const entries = [
    ...[6, 7, 8, 9, 10, 11, 12].map((d, i) => entry(i + 1, 'RECEIVE', 10, `2026-10-${String(d).padStart(2, '0')}T06:00:00Z`, { deliveryReference: `GRN-04${d}` })),
    entry(8, 'ADJUSTMENT', -16, '2026-10-13T05:00:00Z', { adjustmentReference: 'ADJ-3402', countReference: 'CNT-2026-1013' }),
  ];

  beforeEach(() => {
    vi.mocked(historyRepository.findItem).mockResolvedValue({ id: ITEM, name: 'Sugar, white', usageUnit: 'kg', currentCost: D(183), type: 'RAW_INGREDIENT' });
    vi.mocked(historyRepository.positionBefore).mockImplementation(async (_s, _l, _i, instant) => (instant ? { quantity: D(110), value: D(11000) } : { quantity: D(164), value: D(30000) }));
    vi.mocked(historyRepository.restockLevel).mockResolvedValue(D(180));
    vi.mocked(historyRepository.findCardEntries).mockResolvedValue(entries);
    vi.mocked(lastCountedByItem).mockResolvedValue(new Map([[ITEM, { at: new Date('2026-10-13T06:05:00Z'), reference: 'CNT-2026-1013' }]]));
    vi.mocked(sectionNamesByItem).mockResolvedValue(new Map([[ITEM, 'Samrat']]));
  });

  it('builds the contract shape: where the item stands, the strip, five days and one earlier period', async () => {
    const card = await historyService.card(manager, ITEM, { show: 'byDay', chip: 'daysWithMovement' }, NOW);
    expect(() => stockCardSchema.parse(card)).not.toThrow();
    expect(card).toMatchObject({
      item: { name: 'Sugar, white', sectionName: 'Samrat', locationName: 'Central Store' },
      onHand: '164',
      status: 'LOW',
      statusText: 'Low · restock level 180 kg',
      valueKes: '30012.00',
      unitCostText: 'at KES 183 per kg',
      lastCounted: { reference: 'CNT-2026-1013', text: 'Today · CNT-2026-1013 · 09:05' },
      periodText: 'Last 30 days · as of 13 Oct, 16:30',
    });
    expect(card.days).toHaveLength(6);
    expect(card.days.slice(0, 5).map((d) => d.day)).toEqual(['2026-10-13', '2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09']);
    expect(card.days[5]).toMatchObject({ collapsed: true, dayText: '6 Oct – 8 Oct', referenceText: '3 movements, In' });
    expect(card.footerText).toBe('5 days and 1 earlier period · 8 movements · open a day for its entries · each row adds up: opening + in − out + adjusted = closing');
  });

  it('the strip is the period totals and adds up to the last day’s closing', async () => {
    const card = await historyService.card(manager, ITEM, { show: 'byDay', chip: 'daysWithMovement' }, NOW);
    expect(card.strip).toEqual({ opening: '110', in: '70', sentOut: '0', prepUse: '0', waste: '0', adjusted: '-16', closing: '164' });
  });

  it('every shown day, the folded row included, adds up', async () => {
    const card = await historyService.card(manager, ITEM, { show: 'byDay', chip: 'daysWithMovement' }, NOW);
    for (const day of card.days) {
      const sum = [day.opening, day.in, day.sentOut, day.prepUse, day.waste, day.adjusted].reduce((total, v) => total.plus(v), D(0));
      expect(sum.toString()).toBe(day.closing);
    }
  });

  it('show=entries lists every entry of every day, newest first, with the adjustment’s count as its note', async () => {
    const card = await historyService.card(manager, ITEM, { show: 'entries', chip: 'daysWithMovement' }, NOW);
    expect(card.days).toHaveLength(8);
    expect(card.days.every((d) => !d.collapsed && d.entries)).toBe(true);
    expect(card.days[0]!.entries![0]).toMatchObject({ type: 'ADJUSTMENT', reference: 'ADJ-3402', quantity: '-16', reversed: false, note: 'From CNT-2026-1013' });
    expect(card.footerText).toBe('8 days · 8 movements · each row adds up: opening + in − out + adjusted = closing');
  });

  it('adjustmentsOnly keeps only the days with an adjustment', async () => {
    const card = await historyService.card(manager, ITEM, { show: 'byDay', chip: 'adjustmentsOnly' }, NOW);
    expect(card.days.map((d) => d.day)).toEqual(['2026-10-13']);
  });

  it('flags a reversed entry and its reversal', async () => {
    vi.mocked(historyRepository.findCardEntries).mockResolvedValue([
      entry(1, 'WASTE', -3, '2026-10-13T05:00:00Z', { reversed: true }),
      entry(2, 'WASTE', 3, '2026-10-13T05:10:00Z', { isReversal: true }),
    ]);
    const card = await historyService.card(manager, ITEM, { show: 'entries', chip: 'daysWithMovement' }, NOW);
    expect(card.days[0]!.waste).toBe('0');
    expect(card.days[0]!.entries!.map((e) => [e.quantity, e.reversed, e.note])).toEqual([['3', false, 'Reversal of a waste entry'], ['-3', true, null]]);
  });

  it('is 404 ITEM_NOT_FOUND for an item that is not in the catalog, with no last count when it was never counted', async () => {
    vi.mocked(historyRepository.findItem).mockResolvedValue(null);
    await expect(historyService.card(manager, ITEM, { show: 'byDay', chip: 'daysWithMovement' }, NOW)).rejects.toMatchObject({ statusCode: 404, code: 'ITEM_NOT_FOUND' });
    vi.mocked(historyRepository.findItem).mockResolvedValue({ id: ITEM, name: 'Sugar', usageUnit: 'kg', currentCost: D(183), type: 'RAW_INGREDIENT' });
    vi.mocked(lastCountedByItem).mockResolvedValue(new Map());
    expect((await historyService.card(manager, ITEM, { show: 'byDay', chip: 'daysWithMovement' }, NOW)).lastCounted).toBeNull();
  });

  it('reads counting only through count-reads', async () => {
    await historyService.card(manager, ITEM, { show: 'byDay', chip: 'daysWithMovement' }, NOW);
    expect(lastCountedByItem).toHaveBeenCalledWith(HUB, [ITEM]);
    expect(sectionNamesByItem).toHaveBeenCalledWith(HUB, [ITEM]);
  });

  it('refuses a caller outside the hub who holds no cross-site read', async () => {
    const outsider = { id: 'u-x', role: 'WAITER' as const, siteId: '33333333-3333-4333-8333-333333333333', name: 'X' };
    await expect(historyService.card(outsider, ITEM, { show: 'byDay', chip: 'daysWithMovement' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
  });
});
