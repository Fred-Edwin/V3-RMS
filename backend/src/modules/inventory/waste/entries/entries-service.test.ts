import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { wasteListSchema } from '../_shared/waste-contract';
import type { WasteLogRow } from '../_shared/waste-row';
import { entriesRepository } from './entries-repository';
import { bannerFor, entriesService } from './entries-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('./entries-repository', () => ({
  entriesRepository: { findPage: vi.fn(), chipCounts: vi.fn(), findLast7: vi.fn(), findReversedLast7: vi.fn(), latestBatchToday: vi.fn() },
}));

const HUB = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-13T11:20:00Z'); // 14:20 Nairobi on 13 Oct
const query = { period: 'today' as const, scope: 'all' as const, page: 1, pageSize: 50 };

const attendant = { id: 'u-peter', role: 'STORE_ATTENDANT' as const, siteId: HUB, name: 'Peter' };
const manager = { id: 'u-sam', role: 'STORE_MANAGER' as const, siteId: HUB, name: 'Sam' };
const director = { id: 'u-dir', role: 'DIRECTOR' as const, siteId: '22222222-2222-4222-8222-222222222222', name: 'Isabel' };

const log = (over: Record<string, unknown> = {}) =>
  ({
    id: 'd0000000-0000-4000-8000-000000000001',
    siteId: HUB,
    locationId: 'store',
    inventoryItemId: '10000000-0000-4000-8000-000000000060',
    quantity: new Prisma.Decimal(3),
    reason: 'EXPIRY',
    note: null,
    unitCost: new Prisma.Decimal(420),
    loggedById: 'u-peter',
    createdAt: new Date('2026-10-13T08:00:00Z'),
    batchId: 'b1',
    reversedAt: null,
    reversedById: null,
    reversalReason: null,
    reversalNote: null,
    inventoryItem: { id: '10000000-0000-4000-8000-000000000060', name: 'Marinated chicken', usageUnit: 'kg' },
    loggedBy: { id: 'u-peter', name: 'Peter Kariuki', role: 'STORE_ATTENDANT' },
    reversedBy: null,
    ...over,
  }) as unknown as WasteLogRow;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(entriesRepository.findPage).mockResolvedValue({ rows: [log()], total: 1 });
  vi.mocked(entriesRepository.chipCounts).mockResolvedValue({ today: 1, last7: 1, reversed: 0 });
  vi.mocked(entriesRepository.findLast7).mockResolvedValue([log()]);
  vi.mocked(entriesRepository.findReversedLast7).mockResolvedValue([]);
  vi.mocked(entriesRepository.latestBatchToday).mockResolvedValue({ at: new Date('2026-10-13T11:20:00Z'), count: 2 });
});

describe('entriesService.list (W3)', () => {
  it('cuts the periods at the Nairobi day: today from 21:00 UTC the evening before, the 7 days from six days earlier', async () => {
    await entriesService.list(manager, query, NOW);
    const window = vi.mocked(entriesRepository.findPage).mock.calls[0]![2];
    expect(window.todayStart.toISOString()).toBe('2026-10-12T21:00:00.000Z');
    expect(window.last7Start.toISOString()).toBe('2026-10-06T21:00:00.000Z');
  });

  it('gives the Attendant their own entries only, whatever scope says', async () => {
    await entriesService.list(attendant, { ...query, scope: 'all' }, NOW);
    expect(vi.mocked(entriesRepository.findPage).mock.calls[0]![0]).toMatchObject({ siteId: HUB, loggedById: 'u-peter' });
    expect(vi.mocked(entriesRepository.chipCounts).mock.calls[0]![0]).toMatchObject({ loggedById: 'u-peter' });
  });

  it('gives the Manager every entry, or only their own with scope=mine', async () => {
    await entriesService.list(manager, query, NOW);
    expect(vi.mocked(entriesRepository.findPage).mock.calls[0]![0]).not.toHaveProperty('loggedById');
    await entriesService.list(manager, { ...query, scope: 'mine' }, NOW);
    expect(vi.mocked(entriesRepository.findPage).mock.calls[1]![0]).toMatchObject({ loggedById: 'u-sam' });
  });

  it('lets the Director read from outside the hub', async () => {
    await expect(entriesService.list(director, query, NOW)).resolves.toBeDefined();
    expect(vi.mocked(entriesRepository.findPage).mock.calls[0]![0].siteId).toBe(HUB);
  });

  it('passes the search to the rows and chips but not to the KPI strip', async () => {
    await entriesService.list(manager, { ...query, search: 'milk' }, NOW);
    expect(vi.mocked(entriesRepository.findPage).mock.calls[0]![0]).toMatchObject({ search: 'milk' });
    expect(vi.mocked(entriesRepository.chipCounts).mock.calls[0]![0]).toMatchObject({ search: 'milk' });
    expect(vi.mocked(entriesRepository.findLast7).mock.calls[0]![0]).not.toHaveProperty('search');
  });

  it('builds the KPI strip for the Manager and no banner', async () => {
    const list = await entriesService.list(manager, query, NOW);
    expect(() => wasteListSchema.parse(list)).not.toThrow();
    expect(list.kpis?.map((k) => k.key)).toEqual(['today', 'last7', 'most', 'reversed']);
    expect(list).not.toHaveProperty('bannerText');
    expect(entriesRepository.latestBatchToday).not.toHaveBeenCalled();
  });

  it('gives the Attendant a banner and no KPI strip, and nothing that is a stock figure', async () => {
    const list = await entriesService.list(attendant, query, NOW);
    expect(() => wasteListSchema.parse(list)).not.toThrow();
    expect(list).not.toHaveProperty('kpis');
    expect(list.bannerText).toBe('2 items logged at 14:20. You can reverse your own entries today.');
    expect(entriesRepository.findLast7).not.toHaveBeenCalled();
    expect(JSON.stringify(list)).not.toMatch(/onHand|wentNegative|expected|difference|restock/i);
  });

  it('says banner null when the Attendant has logged nothing today', async () => {
    vi.mocked(entriesRepository.latestBatchToday).mockResolvedValue(null);
    expect((await entriesService.list(attendant, query, NOW)).bannerText).toBeNull();
  });

  it('carries the chip counts and the pager', async () => {
    vi.mocked(entriesRepository.findPage).mockResolvedValue({ rows: [], total: 142 });
    const list = await entriesService.list(manager, { ...query, page: 3, pageSize: 25 }, NOW);
    expect(list.chips).toEqual({ today: 1, last7: 1, reversed: 0 });
    expect(list.page).toEqual({ page: 3, pageSize: 25, total: 142 });
  });
});

describe('bannerFor', () => {
  it('reads "1 item" for one and "2 items" for two', () => {
    expect(bannerFor({ at: NOW, count: 1 })).toBe('1 item logged at 14:20. You can reverse your own entries today.');
    expect(bannerFor({ at: NOW, count: 2 })).toBe('2 items logged at 14:20. You can reverse your own entries today.');
  });
});
