import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { locationRepository } from '../../../../repositories/location-repository';
import { longestWithoutCount, todaysCounts } from '../../counting/_shared/count-reads';
import { stockOverviewSchema } from '../_shared/stock-contract';
import { stockRepository } from '../_shared/stock-repository';
import { overviewService } from './overview-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../repositories/location-repository', () => ({ locationRepository: { findCentralStore: vi.fn() } }));
vi.mock('../../counting/_shared/count-reads', () => ({ todaysCounts: vi.fn(), longestWithoutCount: vi.fn(), sectionNamesByItem: vi.fn() }));
vi.mock('../_shared/stock-repository', () => ({ stockRepository: { storeTotals: vi.fn(), liveItemIds: vi.fn() } }));

const HUB = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-13T13:30:00Z');
const at = (iso: string) => new Date(iso);
const manager = { id: 'u-sam', role: 'STORE_MANAGER' as const, siteId: HUB, name: 'Sam' };
const director = { id: 'u-dir', role: 'DIRECTOR' as const, siteId: '22222222-2222-4222-8222-222222222222', name: 'Isabel' };

const count = (n: number, status: 'OPEN' | 'SUBMITTED' | 'APPROVED', over = {}) => ({
  id: `c0000000-0000-4000-8000-00000000000${n}`, reference: `CNT-2026-100${n}`, sectionsText: 'Others', counterName: 'Isabel Njoki',
  startedAt: at('2026-10-13T08:02:00Z'), signedAt: status === 'OPEN' ? null : at('2026-10-13T08:41:00Z'), status, selfSigned: false, ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue({ id: 'store', siteId: HUB } as never);
  vi.mocked(stockRepository.storeTotals).mockResolvedValue({ tracked: 142, lowOrOut: 9, negative: 2, value: new Prisma.Decimal(1) });
  vi.mocked(stockRepository.liveItemIds).mockResolvedValue([]);
  vi.mocked(todaysCounts).mockResolvedValue([count(5, 'OPEN'), count(3, 'SUBMITTED'), count(1, 'APPROVED', { selfSigned: true })]);
  vi.mocked(longestWithoutCount).mockResolvedValue([
    { kind: 'SECTION', refId: '5e000000-0000-4000-8000-000000000004', name: 'Packaging', itemCount: 36, sectionName: null, lastCountedAt: at('2026-10-01T05:00:00Z') },
    { kind: 'ITEM', refId: '10000000-0000-4000-8000-000000000020', name: 'Cornflour 2 kg', itemCount: null, sectionName: 'Others', lastCountedAt: null },
  ]);
});

describe('overviewService.get (S1)', () => {
  it('builds the contract shape', async () => {
    const overview = await overviewService.get(manager, NOW);
    expect(() => stockOverviewSchema.parse(overview)).not.toThrow();
    expect(overview.kpis.map((k) => k.key)).toEqual(['tracked', 'low', 'negative', 'countsToday']);
    expect(longestWithoutCount).toHaveBeenCalledWith(HUB, NOW, 3);
  });

  it('maps today’s counts: open is in progress, submitted to review, approved signed', async () => {
    const { todaysCounts: rows, kpis } = await overviewService.get(manager, NOW);
    expect(rows.map((r) => [r.status, r.statusText])).toEqual([['IN_PROGRESS', 'In progress'], ['TO_REVIEW', 'To review'], ['SIGNED', 'Signed']]);
    expect(rows[0]!.byText).toBe('Isabel Njoki · started 11:02');
    expect(rows[1]!.byText).toBe('Isabel Njoki · 11:02 to 11:41');
    expect(kpis[3]).toMatchObject({ value: '3', caption: '1 signed · 1 to review · 1 in progress' });
  });

  it('says "None yet" before the first count', async () => {
    vi.mocked(todaysCounts).mockResolvedValue([]);
    expect((await overviewService.get(manager, NOW)).kpis[3]).toMatchObject({ value: '0', caption: 'None yet' });
  });

  it('words the longest-without-a-count rows', async () => {
    const { longestWithoutCount: rows } = await overviewService.get(manager, NOW);
    expect(rows[0]).toMatchObject({ detail: 'Section · 36 items', lastCountedText: '12 days ago' });
    expect(rows[1]).toMatchObject({ detail: 'Item · Others', lastCountedAt: null, lastCountedText: 'Never counted' });
  });

  it('lets the Store Manager start a count and not the Director', async () => {
    expect((await overviewService.get(manager, NOW)).can.startCount).toBe(true);
    expect((await overviewService.get(director, NOW)).can.startCount).toBe(false);
  });
});
