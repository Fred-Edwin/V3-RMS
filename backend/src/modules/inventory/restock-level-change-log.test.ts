/** B10 — every restock-level change is logged, in the same transaction as the write (API_CONTRACT.md §29.2). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { restockLevelRepository } from './inventory-repository';

const tx = {
  restockLevel: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  restockLevelChange: { createMany: vi.fn() },
};

vi.mock('../../config/database', () => ({
  prisma: { $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) },
}));

const org = 'org-1';
const location = 'loc-1';
const d = (v: string) => new Prisma.Decimal(v);

beforeEach(() => {
  vi.clearAllMocks();
  tx.restockLevel.findMany.mockResolvedValue([]);
});

describe('restockLevelRepository.bulkUpsert — change log', () => {
  it('logs a first-time level as null → new, with who, for which location, and why', async () => {
    await restockLevelRepository.bulkUpsert(org, location, 'sm1', [{ inventoryItemId: 'i1', level: '30' }], 'New wing');

    expect(tx.restockLevelChange.createMany).toHaveBeenCalledWith({
      data: [
        { organizationId: org, locationId: location, inventoryItemId: 'i1', oldLevel: null, newLevel: d('30'), changedById: 'sm1', reason: 'New wing' },
      ],
    });
  });

  it('logs old → new for a change, and skips a save that changes nothing', async () => {
    tx.restockLevel.findMany.mockResolvedValue([
      { inventoryItemId: 'i1', level: d('10') },
      { inventoryItemId: 'i2', level: d('5') },
    ]);

    await restockLevelRepository.bulkUpsert(org, location, 'sm1', [
      { inventoryItemId: 'i1', level: '12.5' },
      { inventoryItemId: 'i2', level: '5.0' }, // same number, different spelling
    ]);

    const data = tx.restockLevelChange.createMany.mock.calls[0]![0].data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ inventoryItemId: 'i1', oldLevel: d('10'), newLevel: d('12.5'), changedById: 'sm1' });
    expect(tx.restockLevel.upsert).toHaveBeenCalledTimes(2); // the write itself is unchanged
  });

  it('logs a cleared level as old → null, and nothing for clearing a level that was never set', async () => {
    tx.restockLevel.findMany.mockResolvedValue([{ inventoryItemId: 'i1', level: d('10') }]);

    await restockLevelRepository.bulkUpsert(org, location, 'dh1', [
      { inventoryItemId: 'i1', level: null },
      { inventoryItemId: 'i9', level: null },
    ]);

    expect(tx.restockLevel.deleteMany).toHaveBeenCalledWith({ where: { organizationId: org, locationId: location, inventoryItemId: { in: ['i1', 'i9'] } } });
    const data = tx.restockLevelChange.createMany.mock.calls[0]![0].data;
    expect(data).toEqual([
      { organizationId: org, locationId: location, inventoryItemId: 'i1', oldLevel: d('10'), newLevel: null, changedById: 'dh1', reason: undefined },
    ]);
  });

  it('writes no log rows when nothing changed', async () => {
    tx.restockLevel.findMany.mockResolvedValue([{ inventoryItemId: 'i1', level: d('10') }]);
    await restockLevelRepository.bulkUpsert(org, location, 'sm1', [{ inventoryItemId: 'i1', level: '10' }]);
    expect(tx.restockLevelChange.createMany).not.toHaveBeenCalled();
  });

  it('reads the previous levels scoped to the org and location', async () => {
    await restockLevelRepository.bulkUpsert(org, location, 'sm1', [{ inventoryItemId: 'i1', level: '1' }]);
    expect(tx.restockLevel.findMany).toHaveBeenCalledWith({
      where: { organizationId: org, locationId: location, inventoryItemId: { in: ['i1'] } },
      select: { inventoryItemId: true, level: true },
    });
  });
});
