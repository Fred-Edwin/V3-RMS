import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { locationRepository } from '../../../../repositories/location-repository';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { stockRepository } from '../../stock/_shared/stock-repository';
import { logRepository } from './log-repository';
import { logService } from './log-service';
import { logWasteResultSchema, wasteItemsSchema } from '../_shared/waste-contract';

vi.mock('../../../../config/database', () => ({ prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) } }));
vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../repositories/location-repository', () => ({ locationRepository: { findCentralStore: vi.fn() } }));
vi.mock('../../stock/ledger/ledger-door', () => ({ postStockMovement: vi.fn() }));
vi.mock('../../stock/_shared/stock-repository', () => ({ stockRepository: { onHandForItem: vi.fn() } }));
vi.mock('./log-repository', () => ({
  logRepository: {
    findBatch: vi.fn(),
    createBatch: vi.fn(),
    createLog: vi.fn(),
    findItems: vi.fn(),
    oftenItemIds: vi.fn(),
    liveItemsByIds: vi.fn(),
    searchLiveItems: vi.fn(),
  },
}));

const HUB = '11111111-1111-4111-8111-111111111111';
const STORE = '55555555-5555-4555-8555-555555555555';
const CHICKEN = '10000000-0000-4000-8000-000000000060';
const KACHUMBARI = '10000000-0000-4000-8000-000000000061';
const NOW = new Date('2026-10-13T11:20:00Z');

const attendant = { id: 'u-peter', role: 'STORE_ATTENDANT' as const, siteId: HUB, name: 'Peter Kariuki' };
const manager = { id: 'u-sam', role: 'STORE_MANAGER' as const, siteId: HUB, name: 'Sam' };
const branchManager = { id: 'u-bm', role: 'MANAGER' as const, siteId: '22222222-2222-4222-8222-222222222222', name: 'Bea' };

const item = (id: string, name: string, cost: string, deletedAt: Date | null = null) => ({ id, name, usageUnit: 'kg', currentCost: new Prisma.Decimal(cost), deletedAt });

const buildLog = (data: { inventoryItemId: string; quantity: Prisma.Decimal; unitCost: Prisma.Decimal; reason: string; note: string | null }, n: number) =>
  ({
    id: `d0000000-0000-4000-8000-00000000000${n}`,
    siteId: HUB,
    locationId: STORE,
    batchId: 'b1',
    ...data,
    loggedById: attendant.id,
    createdAt: NOW,
    reversedAt: null,
    reversedById: null,
    reversalReason: null,
    reversalNote: null,
    inventoryItem: { id: data.inventoryItemId, name: data.inventoryItemId === CHICKEN ? 'Marinated chicken' : 'Kachumbari mix', usageUnit: 'kg' },
    loggedBy: { id: attendant.id, name: 'Peter Kariuki', role: 'STORE_ATTENDANT' },
    reversedBy: null,
  }) as never;

const input = {
  entries: [
    { inventoryItemId: CHICKEN, quantity: '3', reason: 'EXPIRY' as const },
    { inventoryItemId: KACHUMBARI, quantity: '2', reason: 'SPOILAGE' as const },
  ],
  note: 'Fridge 2 was off overnight',
  idempotencyKey: '3c4d5e6f-7a8b-4c9d-8e0f',
};

let n = 0;
beforeEach(() => {
  vi.resetAllMocks();
  n = 0;
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue({ id: STORE, siteId: HUB } as never);
  vi.mocked(logRepository.findBatch).mockResolvedValue(null);
  vi.mocked(logRepository.createBatch).mockResolvedValue({ id: 'b1' });
  vi.mocked(logRepository.createLog).mockImplementation(async (_tx, data) => buildLog(data, ++n));
  vi.mocked(logRepository.findItems).mockResolvedValue([item(CHICKEN, 'Marinated chicken', '420'), item(KACHUMBARI, 'Kachumbari mix', '180')]);
  vi.mocked(stockRepository.onHandForItem).mockResolvedValue(new Prisma.Decimal(10));
});

describe('logService.log (W2)', () => {
  it('writes one log and one WASTE ledger row per entry, in one batch, valued at the cost now', async () => {
    const { result, replayed } = await logService.log(attendant, input, NOW);
    expect(replayed).toBe(false);
    expect(logRepository.createBatch).toHaveBeenCalledTimes(1);
    expect(logRepository.createLog).toHaveBeenCalledTimes(2);
    expect(vi.mocked(logRepository.createLog).mock.calls[0]![1]).toMatchObject({ batchId: 'b1', unitCost: new Prisma.Decimal(420), note: 'Fridge 2 was off overnight', locationId: STORE });
    expect(postStockMovement).toHaveBeenCalledTimes(2);
    expect(vi.mocked(postStockMovement).mock.calls[0]![1]).toMatchObject({
      type: 'WASTE',
      locationId: STORE,
      inventoryItemId: CHICKEN,
      quantity: new Prisma.Decimal(3),
      links: { wasteLogId: 'd0000000-0000-4000-8000-000000000001' },
    });
    expect(() => logWasteResultSchema.parse(result)).not.toThrow();
    expect(result.totalValueKes).toBe('1620.00');
  });

  it('flags negative stock to a caller who may see stock, and never blocks it', async () => {
    vi.mocked(stockRepository.onHandForItem).mockResolvedValue(new Prisma.Decimal(-4));
    const { result } = await logService.log(manager, input, NOW);
    expect(result.wentNegative).toBe(true);
    expect(postStockMovement).toHaveBeenCalledTimes(2);
  });

  it('leaves out wentNegative for the Attendant, who holds no stock figure', async () => {
    vi.mocked(stockRepository.onHandForItem).mockResolvedValue(new Prisma.Decimal(-4));
    const { result } = await logService.log(attendant, input, NOW);
    expect(result).not.toHaveProperty('wentNegative');
    expect(result.totalValueKes).toBe('1620.00');
  });

  it('returns the same entries with replayed:true for a repeated key and writes nothing', async () => {
    const logs = [buildLog({ inventoryItemId: CHICKEN, quantity: new Prisma.Decimal(3), unitCost: new Prisma.Decimal(420), reason: 'EXPIRY', note: null }, 1)];
    vi.mocked(logRepository.findBatch).mockResolvedValue({ id: 'b1', logs } as never);
    const { result, replayed } = await logService.log(attendant, input, NOW);
    expect(replayed).toBe(true);
    expect(result.replayed).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(logRepository.createBatch).not.toHaveBeenCalled();
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('answers a lost race on the unique index with the winner’s batch', async () => {
    const race = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x', meta: { target: ['organization_id', 'user_id', 'idempotency_key'] } });
    vi.mocked(logRepository.createBatch).mockRejectedValue(race);
    vi.mocked(logRepository.findBatch).mockResolvedValueOnce(null).mockResolvedValue({
      id: 'b1',
      logs: [buildLog({ inventoryItemId: CHICKEN, quantity: new Prisma.Decimal(3), unitCost: new Prisma.Decimal(420), reason: 'EXPIRY', note: null }, 1)],
    } as never);
    const { replayed } = await logService.log(attendant, input, NOW);
    expect(replayed).toBe(true);
  });

  it('refuses a retired item with ITEM_RETIRED and writes nothing', async () => {
    vi.mocked(logRepository.findItems).mockResolvedValue([item(CHICKEN, 'Marinated chicken', '420', new Date()), item(KACHUMBARI, 'Kachumbari mix', '180')]);
    await expect(logService.log(attendant, input, NOW)).rejects.toMatchObject({ statusCode: 409, code: 'ITEM_RETIRED' });
    expect(logRepository.createBatch).not.toHaveBeenCalled();
  });

  it('refuses an item that is not in the catalog', async () => {
    vi.mocked(logRepository.findItems).mockResolvedValue([item(CHICKEN, 'Marinated chicken', '420')]);
    await expect(logService.log(attendant, input, NOW)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses a caller outside the hub', async () => {
    await expect(logService.log(branchManager, input, NOW)).rejects.toMatchObject({ statusCode: 403 });
    expect(logRepository.createBatch).not.toHaveBeenCalled();
  });

  it('keeps the shared note off the entries when it is empty', async () => {
    await logService.log(attendant, { ...input, note: undefined }, NOW);
    expect(vi.mocked(logRepository.createLog).mock.calls[0]![1].note).toBeNull();
  });
});

describe('logService.listItems (W1)', () => {
  const row = (id: string, name: string, cost: string, onHand: string) => ({ id, name, usageUnit: 'kg', currentCost: new Prisma.Decimal(cost), onHand: new Prisma.Decimal(onHand) });

  beforeEach(() => {
    vi.mocked(logRepository.oftenItemIds).mockResolvedValue([CHICKEN]);
    vi.mocked(logRepository.liveItemsByIds).mockResolvedValue([row(CHICKEN, 'Marinated chicken', '420', '-4')]);
    vi.mocked(logRepository.searchLiveItems).mockResolvedValue([row(KACHUMBARI, 'Kachumbari mix', '180', '6')]);
  });

  it('looks 60 days back for this caller and asks for at most six', async () => {
    await logService.listItems(attendant, { limit: 20 }, NOW);
    expect(logRepository.oftenItemIds).toHaveBeenCalledWith(HUB, attendant.id, new Date('2026-08-13T21:00:00Z'), 6);
  });

  it('gives the Attendant cost but no on-hand', async () => {
    const view = await logService.listItems(attendant, { limit: 20 }, NOW);
    expect(() => wasteItemsSchema.parse(view)).not.toThrow();
    expect(view.often[0]).toEqual({ itemId: CHICKEN, name: 'Marinated chicken', unit: 'kg', unitCost: '420.00' });
    expect(JSON.stringify(view)).not.toMatch(/onHand/);
  });

  it('gives the Manager cost and on-hand', async () => {
    const view = await logService.listItems(manager, { limit: 20 }, NOW);
    expect(view.often[0]).toMatchObject({ unitCost: '420.00', onHand: '-4' });
  });

  it('passes the search on to live items only', async () => {
    await logService.listItems(manager, { search: 'kach', limit: 5 }, NOW);
    expect(logRepository.searchLiveItems).toHaveBeenCalledWith(HUB, STORE, 'kach', 5);
  });
});
