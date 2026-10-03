/**
 * Waste rules (Milestone Six, Session 1 — plan §1.3, §2.1, §4.5):
 * one negative WASTE ledger row per entry, negative stock allowed and
 * flagged, department unit cost falls back correctly, and the location is
 * always resolved from the actor, never from the request.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { wasteService, resolveWasteUnitCost } from './waste-service';
import { wasteRepository } from './waste-repository';
import { stockRepository } from '../stock/stock-repository';
import { inventoryItemRepository } from '../catalog/inventory-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { CreateWasteSchema } from './waste-validators';

const txInventoryCreate = vi.fn();

vi.mock('./waste-repository', () => ({
  wasteRepository: {
    create: vi.fn(),
    findRecentForLocation: vi.fn(),
    latestDispatchInCost: vi.fn(),
    findItemOptions: vi.fn(),
  },
}));

vi.mock('../stock/stock-repository', () => ({
  stockRepository: { onHandForItem: vi.fn() },
}));

vi.mock('../catalog/inventory-repository', () => ({
  inventoryItemRepository: { findById: vi.fn() },
}));

vi.mock('../../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn(), findById: vi.fn() },
}));

vi.mock('../../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn(), findBySiteTypeDepartment: vi.fn(), findById: vi.fn() },
}));

vi.mock('../../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ inventoryTransaction: { create: txInventoryCreate } })),
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const branchOrgId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const centralStoreId = '55555555-5555-4555-8555-555555555555';
const kitchenLocationId = '66666666-6666-4666-8666-666666666666';
const wasteLogId = '77777777-7777-4777-8777-777777777777';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, siteId: hubOrgId };
const attendant = { id: 'sa1', role: 'STORE_ATTENDANT' as const, siteId: hubOrgId };
const kitchenHead = {
  id: 'dh1',
  role: 'CHEF' as const,
  siteId: branchOrgId,
  isDepartmentHead: true,
  departmentTag: 'KITCHEN' as const,
};

const centralStore = { id: centralStoreId, siteId: hubOrgId, type: 'CENTRAL_STORE', departmentTag: null, name: 'Central Store' };
const kitchen = {
  id: kitchenLocationId,
  siteId: branchOrgId,
  type: 'BRANCH_DEPARTMENT',
  departmentTag: 'KITCHEN',
  name: 'Nyeri Town — Kitchen',
};

const item = {
  id: itemId,
  name: 'Tomatoes',
  usageUnit: 'kg',
  currentCost: new Prisma.Decimal(90),
  departmentTags: ['KITCHEN'],
  deletedAt: null,
};

const buildLog = (overrides: Record<string, unknown> = {}) => ({
  id: wasteLogId,
  siteId: hubOrgId,
  locationId: centralStoreId,
  inventoryItemId: itemId,
  quantity: new Prisma.Decimal(3),
  reason: 'SPOILAGE',
  note: null,
  unitCost: new Prisma.Decimal(90),
  loggedById: storeManager.id,
  createdAt: new Date('2026-09-25T08:00:00Z'),
  inventoryItem: { id: itemId, name: 'Tomatoes', usageUnit: 'kg' },
  loggedBy: { id: storeManager.id, name: 'Joseph Mwangi' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
  vi.mocked(branchRepository.findById).mockResolvedValue({ id: branchOrgId, name: 'Nyeri Town' } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
  vi.mocked(locationRepository.findBySiteTypeDepartment).mockResolvedValue(kitchen as never);
  vi.mocked(inventoryItemRepository.findById).mockResolvedValue(item as never);
  vi.mocked(wasteRepository.create).mockImplementation(async (input) => buildLog(input as never) as never);
  vi.mocked(stockRepository.onHandForItem).mockResolvedValue(new Prisma.Decimal(10));
});

describe('wasteService.createWaste', () => {
  it('writes one WasteLog and exactly one negative WASTE ledger row linked to it', async () => {
    await wasteService.createWaste(storeManager, { inventoryItemId: itemId, quantity: '3', reason: 'SPOILAGE' });

    expect(wasteRepository.create).toHaveBeenCalledTimes(1);
    expect(txInventoryCreate).toHaveBeenCalledTimes(1);
    const { data } = txInventoryCreate.mock.calls[0]![0];
    expect(data.type).toBe('WASTE');
    expect(data.quantity.toString()).toBe('-3');
    expect(data.wasteLogId).toBe(wasteLogId);
    expect(data.locationId).toBe(centralStoreId);
    expect(data.siteId).toBe(hubOrgId);
  });

  it('allows the entry to take stock negative and flags it', async () => {
    vi.mocked(stockRepository.onHandForItem).mockResolvedValue(new Prisma.Decimal(-4));

    const result = await wasteService.createWaste(storeManager, {
      inventoryItemId: itemId,
      quantity: '3',
      reason: 'SPOILAGE',
    });

    expect(result).toMatchObject({ onHandAfter: '-4', wentNegative: true });
  });

  it('values a Central Store entry at the item’s current cost', async () => {
    await wasteService.createWaste(storeManager, { inventoryItemId: itemId, quantity: '3', reason: 'EXPIRY' });

    expect(wasteRepository.latestDispatchInCost).not.toHaveBeenCalled();
    expect(vi.mocked(wasteRepository.create).mock.calls[0]![0].unitCost.toString()).toBe('90');
  });

  it('values a department entry at the latest carried-in (DISPATCH_IN) cost', async () => {
    vi.mocked(wasteRepository.latestDispatchInCost).mockResolvedValue(new Prisma.Decimal(85));

    await wasteService.createWaste(kitchenHead, { inventoryItemId: itemId, quantity: '2', reason: 'PREP_ERROR' });

    const input = vi.mocked(wasteRepository.create).mock.calls[0]![0];
    expect(input.unitCost.toString()).toBe('85');
    expect(input.locationId).toBe(kitchenLocationId);
    expect(input.siteId).toBe(branchOrgId);
  });

  it('falls back to the item’s current cost when a department never received it', async () => {
    vi.mocked(wasteRepository.latestDispatchInCost).mockResolvedValue(null);

    await wasteService.createWaste(kitchenHead, { inventoryItemId: itemId, quantity: '2', reason: 'PREP_ERROR' });

    expect(vi.mocked(wasteRepository.create).mock.calls[0]![0].unitCost.toString()).toBe('90');
  });

  it('resolves the location from the actor — the attendant always writes to the Central Store', async () => {
    await wasteService.createWaste(attendant, { inventoryItemId: itemId, quantity: '1', reason: 'EXPIRY' });

    expect(vi.mocked(wasteRepository.create).mock.calls[0]![0].locationId).toBe(centralStoreId);
    expect(txInventoryCreate.mock.calls[0]![0].data.locationId).toBe(centralStoreId);
  });

  it('rejects a client-supplied location at the schema (strict body)', () => {
    const result = CreateWasteSchema.safeParse({
      inventoryItemId: itemId,
      quantity: '1',
      reason: 'EXPIRY',
      locationId: kitchenLocationId,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero and negative quantities', () => {
    for (const quantity of ['0', '-2']) {
      expect(CreateWasteSchema.safeParse({ inventoryItemId: itemId, quantity, reason: 'EXPIRY' }).success).toBe(false);
    }
  });

  it('forbids a department head from logging an item not used in their department', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({ ...item, departmentTags: ['BARISTA'] } as never);

    await expect(
      wasteService.createWaste(kitchenHead, { inventoryItemId: itemId, quantity: '1', reason: 'SPOILAGE' }),
    ).rejects.toThrow(/your department/);
    expect(txInventoryCreate).not.toHaveBeenCalled();
  });

  it('rejects a retired item', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({ ...item, deletedAt: new Date() } as never);

    await expect(
      wasteService.createWaste(storeManager, { inventoryItemId: itemId, quantity: '1', reason: 'SPOILAGE' }),
    ).rejects.toThrow(/retired/);
  });

  it('forbids roles that do not log waste (Branch Manager)', async () => {
    const manager = { id: 'm1', role: 'MANAGER' as const, siteId: branchOrgId };
    await expect(
      wasteService.createWaste(manager, { inventoryItemId: itemId, quantity: '1', reason: 'SPOILAGE' }),
    ).rejects.toThrow(/may not log waste/);
  });

  it('forbids a store role on a non-hub org (D-15)', async () => {
    await expect(
      wasteService.createWaste(
        { ...storeManager, siteId: branchOrgId },
        { inventoryItemId: itemId, quantity: '1', reason: 'SPOILAGE' },
      ),
    ).rejects.toThrow(/hub organization/);
  });
});

describe('wasteService.listWaste', () => {
  it('sums the entries’ value over the window, scoped to the actor’s location', async () => {
    vi.mocked(wasteRepository.findRecentForLocation).mockResolvedValue([
      buildLog({ quantity: new Prisma.Decimal(6), unitCost: new Prisma.Decimal(65) }),
      buildLog({ id: '88888888-8888-4888-8888-888888888888', quantity: new Prisma.Decimal(3), unitCost: new Prisma.Decimal(90) }),
    ] as never);

    const list = await wasteService.listWaste(kitchenHead, { days: 7 });

    expect(list.totalValue).toBe('660');
    expect(vi.mocked(wasteRepository.findRecentForLocation).mock.calls[0]!.slice(0, 2)).toEqual([
      branchOrgId,
      kitchenLocationId,
    ]);
  });
});

describe('resolveWasteUnitCost', () => {
  it('ignores a carried-in cost at the Central Store', () => {
    expect(resolveWasteUnitCost({}, new Prisma.Decimal(90), new Prisma.Decimal(70)).toString()).toBe('90');
  });
});
