import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/database';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryReportRepository } from '../repositories/inventory-report-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { inventoryItemService } from './inventory-item-service';

vi.mock('../config/database', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('../repositories/inventory-item-repository', () => ({
  inventoryItemRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    updateCurrentCost: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-report-repository', () => ({
  inventoryReportRepository: {
    sumQuantityByItemGrouped: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-transaction-repository', () => ({
  inventoryTransactionRepository: {
    create: vi.fn(),
    findLatestReceiveUnitCostByItemGrouped: vi.fn(),
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const actor = { id: 'u1', role: 'STORE_ATTENDANT' as const, organizationId };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) =>
    (fn as (tx: unknown) => Promise<unknown>)(prisma),
  );
});

describe('inventoryItemService.list', () => {
  it('omits onHandQty entirely when no locationId is given (existing callers unaffected)', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue([
      { id: itemId, name: 'Chicken Breast' } as never,
    ]);

    const result = await inventoryItemService.list(actor);

    expect(inventoryReportRepository.sumQuantityByItemGrouped).not.toHaveBeenCalled();
    expect(inventoryTransactionRepository.findLatestReceiveUnitCostByItemGrouped).not.toHaveBeenCalled();
    expect(result[0]).not.toHaveProperty('onHandQty');
    expect(result[0]).not.toHaveProperty('lastReceivedUnitCost');
  });

  it('attaches ledger-derived onHandQty to every item when locationId is given (Stock on Hand)', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue([
      { id: itemId, name: 'Chicken Breast' } as never,
      { id: 'no-activity-item', name: 'New Item' } as never,
    ]);
    vi.mocked(inventoryReportRepository.sumQuantityByItemGrouped).mockResolvedValue(
      new Map([[itemId, d(48.7)]]),
    );
    vi.mocked(inventoryTransactionRepository.findLatestReceiveUnitCostByItemGrouped).mockResolvedValue(
      new Map([[itemId, d(0.7)]]),
    );

    const result = await inventoryItemService.list(actor, undefined, locationId);

    expect(inventoryReportRepository.sumQuantityByItemGrouped).toHaveBeenCalledWith(
      organizationId,
      locationId,
    );
    // One grouped query, not a per-item loop (unlike listLowStock's approach).
    expect(inventoryReportRepository.sumQuantityByItemGrouped).toHaveBeenCalledTimes(1);
    expect(result[0]?.onHandQty).toBe('48.7');
    expect(result[0]?.lastReceivedUnitCost).toBe('0.7');
    // An item with no ledger activity yet gets zero on-hand and no last-received price.
    expect(result[1]?.onHandQty).toBe('0');
    expect(result[1]?.lastReceivedUnitCost).toBeUndefined();
  });
});

describe('inventoryItemService.adjustCost', () => {
  it('converts the buy-unit cost to a per-usage-unit currentCost and posts a zero-qty ADJUSTMENT with the reason', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({
      id: itemId,
      conversionFactor: d(500),
    } as never);
    vi.mocked(inventoryItemRepository.updateCurrentCost).mockResolvedValue(undefined);
    vi.mocked(inventoryTransactionRepository.create).mockResolvedValue({} as never);

    await inventoryItemService.adjustCost(actor, itemId, {
      newBuyUnitCost: '350',
      reason: 'Supplier raised price mid-month',
      locationId,
    });

    // 350 / 500 = 0.7 per gram
    expect(inventoryItemRepository.updateCurrentCost).toHaveBeenCalledWith(
      itemId,
      organizationId,
      expect.objectContaining({ }),
      prisma,
    );
    const [, , costArg] = vi.mocked(inventoryItemRepository.updateCurrentCost).mock.calls[0] ?? [];
    expect((costArg as Prisma.Decimal).toString()).toBe(d(0.7).toString());

    expect(inventoryTransactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        locationId,
        inventoryItemId: itemId,
        type: 'ADJUSTMENT',
        reason: 'Cost adjustment: Supplier raised price mid-month',
      }),
      prisma,
    );
    const [txArg] = vi.mocked(inventoryTransactionRepository.create).mock.calls[0] ?? [];
    expect((txArg as { quantity: Prisma.Decimal }).quantity.toString()).toBe(d(0).toString());
  });

  it('throws NotFoundError for an unknown item', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(null);

    await expect(
      inventoryItemService.adjustCost(actor, itemId, { newBuyUnitCost: '350', reason: 'test', locationId }),
    ).rejects.toThrow('Inventory item not found');
    expect(inventoryItemRepository.updateCurrentCost).not.toHaveBeenCalled();
  });
});
