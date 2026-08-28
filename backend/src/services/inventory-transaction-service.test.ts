import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/database';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import {
  inventoryTransactionService,
  weightedAverageCost,
} from './inventory-transaction-service';

vi.mock('../config/database', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('../repositories/inventory-transaction-repository', () => ({
  inventoryTransactionRepository: {
    create: vi.fn(),
    createMany: vi.fn(),
    findByItemAndLocation: vi.fn(),
    sumQuantityByItemAndLocation: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-item-repository', () => ({
  inventoryItemRepository: {
    findById: vi.fn(),
    updateCurrentCost: vi.fn(),
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const buildItem = (overrides: Partial<{
  id: string;
  conversionFactor: Prisma.Decimal;
  currentCost: Prisma.Decimal;
}> = {}) => ({
  id: itemId,
  organizationId,
  name: 'Chicken Breast',
  type: 'RAW' as const,
  buyUnit: 'kg',
  usageUnit: 'g',
  conversionFactor: d(1000),
  reorderLevel: d(10),
  departmentTags: [],
  category: null,
  currentCost: d(0),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Wires prisma.$transaction to just invoke the callback with a stub tx client,
// matching the mocking pattern used across the existing service test suite.
// supplierItem/purchaseOrderLine stubs back recordReceive's lastPrice
// auto-update (no existing SupplierItem assignment by default, so that path
// is a no-op unless a test explicitly wires findMany to return one).
const stubTx = {
  supplierItem: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
  purchaseOrderLine: { findUnique: vi.fn().mockResolvedValue(null) },
} as never;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) =>
    (fn as (tx: unknown) => Promise<unknown>)(stubTx),
  );
  (stubTx as { supplierItem: { findMany: ReturnType<typeof vi.fn> } }).supplierItem.findMany.mockResolvedValue([]);
  (stubTx as { purchaseOrderLine: { findUnique: ReturnType<typeof vi.fn> } }).purchaseOrderLine.findUnique.mockResolvedValue(null);
});

describe('weightedAverageCost', () => {
  it('returns the incoming unit cost when there is no prior stock', () => {
    const result = weightedAverageCost(0, 0, 10, 100);
    expect(result.toString()).toBe('100');
  });

  it('returns the incoming unit cost when prior on-hand is negative', () => {
    const result = weightedAverageCost(-5, 50, 10, 100);
    expect(result.toString()).toBe('100');
  });

  it('computes the blended average across two receives', () => {
    // 10 units @ 100 on hand, receive 10 more @ 200 -> avg 150
    const result = weightedAverageCost(10, 100, 10, 200);
    expect(result.toString()).toBe('150');
  });

  it('weights larger incoming batches proportionally more', () => {
    // 5 units @ 100 on hand, receive 15 more @ 200 -> (500 + 3000) / 20 = 175
    const result = weightedAverageCost(5, 100, 15, 200);
    expect(result.toString()).toBe('175');
  });

  it('keeps full Decimal precision for fractional averages', () => {
    // 3 units @ 10 on hand, receive 7 more @ 20 -> (30 + 140) / 10 = 17
    const result = weightedAverageCost(3, 10, 7, 20);
    expect(result.toString()).toBe('17');

    // A case that does not divide evenly.
    const uneven = weightedAverageCost(1, 10, 1, 11);
    expect(uneven.toString()).toBe('10.5');
  });
});

describe('inventoryTransactionService.recordReceive', () => {
  it('recomputes currentCost as a weighted average across multiple receives', async () => {
    // First receive: 0 on hand -> new cost = this receipt's usage-unit cost.
    vi.mocked(inventoryItemRepository.findById).mockResolvedValueOnce(buildItem({ currentCost: d(0) }));
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValueOnce(d(0));
    vi.mocked(inventoryTransactionRepository.create).mockResolvedValueOnce({ id: 'tx-1' } as never);

    await inventoryTransactionService.recordReceive({
      organizationId,
      locationId,
      userId,
      inventoryItemId: itemId,
      buyQty: '2', // 2kg
      unitPrice: '650', // KES 650/kg
    });

    // 2kg * 1000 g/kg = 2000g usage qty; 650/1000 = 0.65/g usage cost.
    expect(inventoryTransactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: expect.objectContaining({ }), unitCost: expect.anything() }),
      stubTx,
    );
    const firstCallArgs = vi.mocked(inventoryTransactionRepository.create).mock.calls[0]![0];
    expect((firstCallArgs.quantity as Prisma.Decimal).toString()).toBe('2000');
    expect((firstCallArgs.unitCost as Prisma.Decimal).toString()).toBe('0.65');
    expect(inventoryItemRepository.updateCurrentCost).toHaveBeenCalledWith(
      itemId,
      organizationId,
      expect.objectContaining({}),
      stubTx,
    );
    const newCost = vi.mocked(inventoryItemRepository.updateCurrentCost).mock.calls[0]![2] as Prisma.Decimal;
    expect(newCost.toString()).toBe('0.65');

    // Second receive: 2000g on hand @ 0.65/g, receive 1000g more @ different price.
    vi.mocked(inventoryItemRepository.findById).mockResolvedValueOnce(buildItem({ currentCost: d('0.65') }));
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValueOnce(d(2000));
    vi.mocked(inventoryTransactionRepository.create).mockResolvedValueOnce({ id: 'tx-2' } as never);

    await inventoryTransactionService.recordReceive({
      organizationId,
      locationId,
      userId,
      inventoryItemId: itemId,
      buyQty: '1', // 1kg = 1000g
      unitPrice: '950', // KES 950/kg = 0.95/g
    });

    // Weighted avg: (2000*0.65 + 1000*0.95) / 3000 = (1300 + 950) / 3000 = 0.75
    const secondNewCost = vi.mocked(inventoryItemRepository.updateCurrentCost).mock.calls[1]![2] as Prisma.Decimal;
    expect(secondNewCost.toString()).toBe('0.75');
  });

  it('converts buy-unit quantity and price into usage-unit quantity and cost', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValueOnce(
      buildItem({ conversionFactor: d(1000), currentCost: d(0) }),
    );
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValueOnce(d(0));
    vi.mocked(inventoryTransactionRepository.create).mockResolvedValueOnce({ id: 'tx-1' } as never);

    await inventoryTransactionService.recordReceive({
      organizationId,
      locationId,
      userId,
      inventoryItemId: itemId,
      buyQty: '2.5', // 2.5 kg
      unitPrice: '400', // KES 400/kg
    });

    const args = vi.mocked(inventoryTransactionRepository.create).mock.calls[0]![0];
    expect((args.quantity as Prisma.Decimal).toString()).toBe('2500'); // grams
    expect((args.unitCost as Prisma.Decimal).toString()).toBe('0.4'); // KES/gram
  });

  it('rejects a zero or negative received quantity', async () => {
    await expect(
      inventoryTransactionService.recordReceive({
        organizationId,
        locationId,
        userId,
        inventoryItemId: itemId,
        buyQty: '0',
        unitPrice: '100',
      }),
    ).rejects.toThrow('Received quantity must be greater than zero');
  });

  it('rejects a negative unit price', async () => {
    await expect(
      inventoryTransactionService.recordReceive({
        organizationId,
        locationId,
        userId,
        inventoryItemId: itemId,
        buyQty: '1',
        unitPrice: '-5',
      }),
    ).rejects.toThrow('Unit price cannot be negative');
  });

  it('throws NotFoundError when the inventory item does not exist', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValueOnce(null);

    await expect(
      inventoryTransactionService.recordReceive({
        organizationId,
        locationId,
        userId,
        inventoryItemId: itemId,
        buyQty: '1',
        unitPrice: '100',
      }),
    ).rejects.toThrow('Inventory item not found');
  });

  it('updates SupplierItem.lastPrice for the PO line\'s own supplier when purchaseOrderLineId is given', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValueOnce(buildItem({ currentCost: d(0) }));
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValueOnce(d(0));
    vi.mocked(inventoryTransactionRepository.create).mockResolvedValueOnce({ id: 'tx-1' } as never);
    const tx = stubTx as unknown as {
      purchaseOrderLine: { findUnique: ReturnType<typeof vi.fn> };
      supplierItem: { upsert: ReturnType<typeof vi.fn> };
    };
    tx.purchaseOrderLine.findUnique.mockResolvedValueOnce({ purchaseOrder: { supplierId: 'sup-1' } });

    await inventoryTransactionService.recordReceive({
      organizationId,
      locationId,
      userId,
      inventoryItemId: itemId,
      buyQty: '2',
      unitPrice: '650',
      purchaseOrderLineId: 'line-1',
    });

    expect(tx.supplierItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplierId_inventoryItemId: { supplierId: 'sup-1', inventoryItemId: itemId } },
        update: { lastPrice: expect.objectContaining({}) },
      }),
    );
  });

  it('updates SupplierItem.lastPrice for an ad-hoc receive (no PO line) only when the item has exactly one supplier assignment', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValueOnce(buildItem({ currentCost: d(0) }));
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValueOnce(d(0));
    vi.mocked(inventoryTransactionRepository.create).mockResolvedValueOnce({ id: 'tx-1' } as never);
    const tx = stubTx as unknown as {
      supplierItem: { findMany: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
    };
    tx.supplierItem.findMany.mockResolvedValueOnce([{ supplierId: 'sup-1' }]);

    await inventoryTransactionService.recordReceive({
      organizationId,
      locationId,
      userId,
      inventoryItemId: itemId,
      buyQty: '2',
      unitPrice: '650',
    });

    expect(tx.supplierItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplierId_inventoryItemId: { supplierId: 'sup-1', inventoryItemId: itemId } },
      }),
    );
  });

  it('does not guess a supplier for an ad-hoc receive when the item has zero or multiple supplier assignments', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValueOnce(buildItem({ currentCost: d(0) }));
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValueOnce(d(0));
    vi.mocked(inventoryTransactionRepository.create).mockResolvedValueOnce({ id: 'tx-1' } as never);
    const tx = stubTx as unknown as {
      supplierItem: { findMany: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
    };
    tx.supplierItem.findMany.mockResolvedValueOnce([{ supplierId: 'sup-1' }, { supplierId: 'sup-2' }]);

    await inventoryTransactionService.recordReceive({
      organizationId,
      locationId,
      userId,
      inventoryItemId: itemId,
      buyQty: '2',
      unitPrice: '650',
    });

    expect(tx.supplierItem.upsert).not.toHaveBeenCalled();
  });
});

describe('inventoryTransactionService.recordPrep', () => {
  const outputItemId = '55555555-5555-4555-8555-555555555555';
  const inputAId = '66666666-6666-4666-8666-666666666666';
  const inputBId = '77777777-7777-4777-8777-777777777777';

  it('computes unitCost = totalInputCost / actualYield and writes prep_consume + prep_produce atomically', async () => {
    vi.mocked(inventoryItemRepository.findById).mockImplementation(async (id) => {
      if (id === outputItemId) return buildItem({ id: outputItemId, currentCost: d(800) }) as never;
      if (id === inputAId) return buildItem({ id: inputAId, currentCost: d('0.65') }) as never; // KES/g
      if (id === inputBId) return buildItem({ id: inputBId, currentCost: d('0.1') }) as never; // KES/ml
      return null;
    });
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValueOnce(d(0));

    const created = { id: 'prep-1' };
    vi.mocked(prisma.$transaction).mockImplementation((fn) =>
      (fn as (tx: unknown) => Promise<unknown>)({
        prepRecord: { create: vi.fn().mockResolvedValue(created) },
      }),
    );

    const result = await inventoryTransactionService.recordPrep({
      organizationId,
      locationId,
      outputItemId,
      actualYield: '950', // grams
      inputs: [
        { inventoryItemId: inputAId, quantity: '1100' }, // 1.1kg in grams @ 0.65/g = 715
        { inventoryItemId: inputBId, quantity: '1000' }, // 1000ml @ 0.1/ml = 100
      ],
      recordedById: userId,
    });

    expect(result).toBe(created);

    // totalInputCost = 715 + 100 = 815; unitCost = 815 / 950
    const prepConsumeArgs = vi.mocked(inventoryTransactionRepository.createMany).mock.calls[0]![0];
    expect(prepConsumeArgs).toHaveLength(2);
    expect(prepConsumeArgs[0]!.type).toBe('PREP_CONSUME');
    expect((prepConsumeArgs[0]!.quantity as Prisma.Decimal).toString()).toBe('-1100');
    expect((prepConsumeArgs[1]!.quantity as Prisma.Decimal).toString()).toBe('-1000');

    const prepProduceArgs = vi.mocked(inventoryTransactionRepository.create).mock.calls[0]![0];
    expect(prepProduceArgs.type).toBe('PREP_PRODUCE');
    expect((prepProduceArgs.quantity as Prisma.Decimal).toString()).toBe('950');
    const unitCost = prepProduceArgs.unitCost as Prisma.Decimal;
    expect(unitCost.toString()).toBe(d(815).div(950).toString());
  });

  it('rolls the output item cost into a weighted average against prior on-hand stock', async () => {
    vi.mocked(inventoryItemRepository.findById).mockImplementation(async (id) => {
      if (id === outputItemId) return buildItem({ id: outputItemId, currentCost: d(800) }) as never;
      if (id === inputAId) return buildItem({ id: inputAId, currentCost: d(1) }) as never;
      return null;
    });
    // Prior on-hand of the output item: 100 units @ currentCost 800.
    vi.mocked(inventoryTransactionRepository.sumQuantityByItemAndLocation).mockResolvedValueOnce(d(100));
    vi.mocked(prisma.$transaction).mockImplementation((fn) =>
      (fn as (tx: unknown) => Promise<unknown>)({
        prepRecord: { create: vi.fn().mockResolvedValue({ id: 'prep-2' }) },
      }),
    );

    await inventoryTransactionService.recordPrep({
      organizationId,
      locationId,
      outputItemId,
      actualYield: '50', // this run's yield
      inputs: [{ inventoryItemId: inputAId, quantity: '100' }], // totalInputCost = 100, unitCost = 100/50 = 2
      recordedById: userId,
    });

    // weighted avg: (100*800 + 50*2) / 150 = (80000 + 100) / 150 = 534.0000...
    const expected = d(100).mul(800).add(d(50).mul(2)).div(150);
    const newCost = vi.mocked(inventoryItemRepository.updateCurrentCost).mock.calls[0]![2] as Prisma.Decimal;
    expect(newCost.toString()).toBe(expected.toString());
  });

  it('rejects an actual yield of zero', async () => {
    await expect(
      inventoryTransactionService.recordPrep({
        organizationId,
        locationId,
        outputItemId,
        actualYield: '0',
        inputs: [{ inventoryItemId: inputAId, quantity: '10' }],
        recordedById: userId,
      }),
    ).rejects.toThrow('Actual yield must be greater than zero');
  });

  it('rejects an empty inputs list', async () => {
    await expect(
      inventoryTransactionService.recordPrep({
        organizationId,
        locationId,
        outputItemId,
        actualYield: '10',
        inputs: [],
        recordedById: userId,
      }),
    ).rejects.toThrow('At least one input line is required');
  });

  it('rejects a zero-quantity input line', async () => {
    vi.mocked(inventoryItemRepository.findById).mockImplementation(async (id) => {
      if (id === outputItemId) return buildItem({ id: outputItemId }) as never;
      return null;
    });

    await expect(
      inventoryTransactionService.recordPrep({
        organizationId,
        locationId,
        outputItemId,
        actualYield: '10',
        inputs: [{ inventoryItemId: inputAId, quantity: '0' }],
        recordedById: userId,
      }),
    ).rejects.toThrow('Prep input quantity must be greater than zero');
  });

  it('throws NotFoundError when an input item does not exist', async () => {
    vi.mocked(inventoryItemRepository.findById).mockImplementation(async (id) => {
      if (id === outputItemId) return buildItem({ id: outputItemId }) as never;
      return null;
    });

    await expect(
      inventoryTransactionService.recordPrep({
        organizationId,
        locationId,
        outputItemId,
        actualYield: '10',
        inputs: [{ inventoryItemId: inputAId, quantity: '5' }],
        recordedById: userId,
      }),
    ).rejects.toThrow(`Input inventory item not found: ${inputAId}`);
  });
});

describe('inventoryTransactionService.getRollingAverageForOutputItem', () => {
  it('averages the last N PrepRecords for the given output item', async () => {
    const outputItemId = '55555555-5555-4555-8555-555555555555';
    vi.mocked(prisma as unknown as { prepRecord: { findMany: ReturnType<typeof vi.fn> } });
    (prisma as unknown as { prepRecord: { findMany: ReturnType<typeof vi.fn> } }).prepRecord = {
      findMany: vi.fn().mockResolvedValue([
        { actualYield: d(950), lines: [{ quantity: d(1100) }, { quantity: d(1000) }] },
        { actualYield: d(900), lines: [{ quantity: d(1000) }, { quantity: d(950) }] },
      ]),
    };

    const result = await inventoryTransactionService.getRollingAverageForOutputItem(
      organizationId,
      outputItemId,
      5,
    );

    expect(result.sampleCount).toBe(2);
    expect(result.avgActualYield?.toString()).toBe('925');
    // (2100 + 1950) / 2 = 2025
    expect(result.avgTotalInputQty?.toString()).toBe('2025');
  });

  it('returns nulls when there are no prior PrepRecords', async () => {
    const outputItemId = '55555555-5555-4555-8555-555555555555';
    (prisma as unknown as { prepRecord: { findMany: ReturnType<typeof vi.fn> } }).prepRecord = {
      findMany: vi.fn().mockResolvedValue([]),
    };

    const result = await inventoryTransactionService.getRollingAverageForOutputItem(
      organizationId,
      outputItemId,
    );

    expect(result.sampleCount).toBe(0);
    expect(result.avgActualYield).toBeNull();
    expect(result.avgTotalInputQty).toBeNull();
  });
});
