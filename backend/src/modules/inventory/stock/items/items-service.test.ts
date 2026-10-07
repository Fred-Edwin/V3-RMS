import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { locationRepository } from '../../../../repositories/location-repository';
import { lastCountedByItem, sectionNamesByItem } from '../../counting/_shared/count-reads';
import { stockItemsListSchema } from '../_shared/stock-contract';
import { stockRepository } from '../_shared/stock-repository';
import { itemsRepository } from './items-repository';
import { itemsService } from './items-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../repositories/location-repository', () => ({ locationRepository: { findCentralStore: vi.fn() } }));
vi.mock('../../counting/_shared/count-reads', () => ({ lastCountedByItem: vi.fn(), sectionNamesByItem: vi.fn() }));
vi.mock('../_shared/stock-repository', () => ({ stockRepository: { storeTotals: vi.fn(), liveItemIds: vi.fn() } }));
vi.mock('./items-repository', () => ({ itemsRepository: { findPage: vi.fn(), chipCounts: vi.fn() } }));

const D = (v: string | number) => new Prisma.Decimal(v);
const HUB = '11111111-1111-4111-8111-111111111111';
const A = '10000000-0000-4000-8000-000000000003';
const B = '10000000-0000-4000-8000-000000000050';
const manager = { id: 'u-sam', role: 'STORE_MANAGER' as const, siteId: HUB, name: 'Sam' };
const query = { status: 'all' as const, page: 1, pageSize: 50 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue({ id: 'store', siteId: HUB } as never);
  vi.mocked(itemsRepository.findPage).mockResolvedValue([
    { itemId: A, name: 'Brown sugar', unit: 'kg', onHand: D(100), restockLevel: D(100), currentCost: D('178') },
    { itemId: B, name: 'Tomatoes', unit: 'kg', onHand: D(-4), restockLevel: D(30), currentCost: D(90) },
  ]);
  vi.mocked(itemsRepository.chipCounts).mockResolvedValue({ all: 142, low: 9, negative: 2 });
  vi.mocked(stockRepository.storeTotals).mockResolvedValue({ tracked: 142, lowOrOut: 9, negative: 2, value: D(482400) });
  vi.mocked(stockRepository.liveItemIds).mockResolvedValue([A, B]);
  vi.mocked(sectionNamesByItem).mockResolvedValue(new Map([[A, 'Samrat'], [B, 'Others']]));
  vi.mocked(lastCountedByItem).mockResolvedValue(new Map([[A, { at: new Date('2026-10-13T05:00:00Z'), reference: 'CNT-2026-1013' }]]));
});

describe('itemsService.list (S2)', () => {
  it('builds the contract shape: status, value at the current cost, section and last count', async () => {
    const list = await itemsService.list(manager, query);
    expect(() => stockItemsListSchema.parse(list)).not.toThrow();
    expect(list.rows[0]).toEqual({
      itemId: A, name: 'Brown sugar', sectionName: 'Samrat', unit: 'kg', onHand: '100', restockLevel: '100', valueKes: '17800.00',
      lastCountedAt: '2026-10-13T05:00:00.000Z', lastCountedText: 'Tue 13 Oct', status: 'OK',
    });
    expect(list.rows[1]).toMatchObject({ onHand: '-4', valueKes: '-360.00', status: 'NEGATIVE', lastCountedAt: null, lastCountedText: 'Never counted' });
  });

  it('shows the whole store in the strip and the filtered counts in the chips', async () => {
    const list = await itemsService.list(manager, { ...query, search: 'sug' });
    expect(list.kpis.map((k) => [k.key, k.value])).toEqual([['tracked', '142'], ['low', '9'], ['negative', '2'], ['value', 'KES 482K']]);
    expect(list.kpis[0]!.caption).toBe('2 sections');
    expect(list.chips).toEqual({ all: 142, low: 9, negative: 2 });
    expect(vi.mocked(itemsRepository.chipCounts).mock.calls[0]![0]).toMatchObject({ search: 'sug' });
  });

  it('takes the pager total from the status chip chosen, and passes the chip to the page query', async () => {
    const list = await itemsService.list(manager, { ...query, status: 'low' });
    expect(list.page.total).toBe(9);
    expect(vi.mocked(itemsRepository.findPage).mock.calls[0]![1]).toBe('low');
  });

  it('passes category, type, department and section on, and refuses unknown type or department', async () => {
    await itemsService.list(manager, { ...query, categoryId: A, type: 'PREPPED', departmentTag: 'BARISTA', sectionId: B });
    expect(vi.mocked(itemsRepository.findPage).mock.calls[0]![0]).toMatchObject({ siteId: HUB, categoryId: A, type: 'PREPPED', departmentTag: 'BARISTA', sectionId: B });
    await expect(itemsService.list(manager, { ...query, type: 'NOPE' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(itemsService.list(manager, { ...query, departmentTag: 'NOPE' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('reads counting only through count-reads', async () => {
    await itemsService.list(manager, query);
    expect(lastCountedByItem).toHaveBeenCalledWith(HUB, [A, B]);
  });

  it('skips the counting reads for an empty page', async () => {
    vi.mocked(itemsRepository.findPage).mockResolvedValue([]);
    await itemsService.list(manager, query);
    expect(lastCountedByItem).not.toHaveBeenCalled();
  });
});
