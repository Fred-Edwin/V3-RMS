import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryReportRepository } from '../repositories/inventory-report-repository';
import { inventoryItemService } from './inventory-item-service';

vi.mock('../repositories/inventory-item-repository', () => ({
  inventoryItemRepository: {
    findAllByOrganization: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-report-repository', () => ({
  inventoryReportRepository: {
    sumQuantityByItemGrouped: vi.fn(),
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const actor = { id: 'u1', role: 'STORE_ATTENDANT' as const, organizationId };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('inventoryItemService.list', () => {
  it('omits onHandQty entirely when no locationId is given (existing callers unaffected)', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue([
      { id: itemId, name: 'Chicken Breast' } as never,
    ]);

    const result = await inventoryItemService.list(actor);

    expect(inventoryReportRepository.sumQuantityByItemGrouped).not.toHaveBeenCalled();
    expect(result[0]).not.toHaveProperty('onHandQty');
  });

  it('attaches ledger-derived onHandQty to every item when locationId is given (Stock on Hand)', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue([
      { id: itemId, name: 'Chicken Breast' } as never,
      { id: 'no-activity-item', name: 'New Item' } as never,
    ]);
    vi.mocked(inventoryReportRepository.sumQuantityByItemGrouped).mockResolvedValue(
      new Map([[itemId, d(48.7)]]),
    );

    const result = await inventoryItemService.list(actor, undefined, locationId);

    expect(inventoryReportRepository.sumQuantityByItemGrouped).toHaveBeenCalledWith(
      organizationId,
      locationId,
    );
    // One grouped query, not a per-item loop (unlike listLowStock's approach).
    expect(inventoryReportRepository.sumQuantityByItemGrouped).toHaveBeenCalledTimes(1);
    expect(result[0]?.onHandQty).toBe('48.7');
    // An item with no ledger activity yet gets zero, not undefined/crash.
    expect(result[1]?.onHandQty).toBe('0');
  });
});
