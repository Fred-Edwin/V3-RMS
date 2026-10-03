/**
 * Session 3 (Part B, B9–B13): Housekeeping, Store Manager restock scope, catalog + restock strips,
 * attendant item creation, review-a-change counts. Mocked repositories; DB evidence is in the session log.
 */
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { inventoryService } from '../catalog/inventory-service';
import { inventoryItemRepository, itemChangeReviewRepository, restockLevelRepository } from '../catalog/inventory-repository';
import { itemChangeRepository } from '../catalog/item-history-repository';
import { supplierItemRepository, supplierRepository } from '../suppliers/supplier-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import inventoryRouter from '../catalog/inventory-routes';
import {
  AttendantInventoryItemSchema,
  AttendantItemMutationResponseSchema,
  CreateItemSchema,
  ItemCatalogMetaSchema,
  ItemChangeReviewSchema,
  ListItemsQuerySchema,
  ListRestockLevelsQuerySchema,
  RestockLevelRowSchema,
  RestockLevelsSummarySchema,
  SaveRestockLevelsSchema,
} from '../catalog/inventory-validators';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';

vi.mock('../catalog/item-history-repository', () => ({
  itemChangeRepository: { record: vi.fn(), list: vi.fn(), countAttendantCreatedSince: vi.fn() },
}));
vi.mock('../catalog/inventory-repository', () => ({
  categoryRepository: {},
  inventoryItemRepository: {
    countLiveByType: vi.fn(),
    countSuppliersByItem: vi.fn(),
    retire: vi.fn(),
    restore: vi.fn(),
    findAllBySite: vi.fn(),
    findById: vi.fn(),
    findLiveByIds: vi.fn(),
    findLiveByName: vi.fn(),
    create: vi.fn(),
    getCatalogMeta: vi.fn(),
    findSearchMatches: vi.fn(),
    findNeedsSetupIds: vi.fn(),
    countCreatedSince: vi.fn(),
  },
  itemChangeReviewRepository: { counts: vi.fn() },
  restockLevelRepository: {
    findAllByLocation: vi.fn(),
    findByItemIdsForLocation: vi.fn(),
    findLiveItemsForRestock: vi.fn(),
    findLiveItemIds: vi.fn(),
    findUseByItemForLocation: vi.fn(),
    bulkUpsert: vi.fn(),
    sumOnHandByItemForLocation: vi.fn(),
  },
}));
vi.mock('../suppliers/supplier-repository', () => ({
  supplierRepository: { findById: vi.fn() },
  supplierItemRepository: { applyPreferred: vi.fn(), listForItem: vi.fn() },
  supplierAuditRepository: { create: vi.fn() },
}));
vi.mock('../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn(), findById: vi.fn() } }));
vi.mock('../../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn(), findBySiteTypeDepartment: vi.fn() },
}));
vi.mock('../../../config/database', () => ({
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})), inventoryTransaction: { groupBy: vi.fn() } },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const townOrgId = '22222222-2222-4222-8222-222222222222';
const highwayOrgId = '22222222-2222-4222-8222-222222222223';
const centralStoreId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';
const item2Id = '44444444-4444-4444-8444-444444444445';
const townHousekeepingId = '77777777-7777-4777-8777-777777777777';
const townKitchenId = '77777777-7777-4777-8777-777777777778';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, siteId: hubOrgId };
const attendant = { id: 'att1', role: 'STORE_ATTENDANT' as const, siteId: hubOrgId };
const nonHubManager = { id: 'sm2', role: 'STORE_MANAGER' as const, siteId: townOrgId };
const kitchenHead = { id: 'dh1', role: 'CHEF' as const, siteId: townOrgId, isDepartmentHead: true, departmentTag: 'KITCHEN' as const };
const housekeepingHead = {
  id: 'dh2',
  role: 'HOUSEKEEPING' as const,
  siteId: townOrgId,
  isDepartmentHead: true,
  departmentTag: 'HOUSEKEEPING' as const,
};

const hubOrg = { id: hubOrgId, name: 'Wendo Central Kitchen', isHub: true, isActive: true };
const centralStore = { id: centralStoreId, siteId: hubOrgId, type: 'CENTRAL_STORE' as const };
const townOrg = { id: townOrgId, name: 'Nyeri Town', isHub: false, isActive: true };
const townHousekeeping = { id: townHousekeepingId, siteId: townOrgId, type: 'BRANCH_DEPARTMENT' as const, departmentTag: 'HOUSEKEEPING' as const };
const townKitchen = { id: townKitchenId, siteId: townOrgId, type: 'BRANCH_DEPARTMENT' as const, departmentTag: 'KITCHEN' as const };

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: itemId,
  siteId: hubOrgId,
  name: 'Toilex White Tissue',
  type: 'STOCKED' as const,
  categoryId: null,
  preferredSupplierId: null,
  buyUnit: 'ctn',
  usageUnit: 'pack',
  conversionFactor: new Prisma.Decimal('10'),
  packSize: new Prisma.Decimal('10'),
  departmentTags: ['HOUSEKEEPING'] as string[],
  currentCost: new Prisma.Decimal('95'),
  deletedAt: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  category: null,
  preferredSupplier: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryItemRepository.countLiveByType).mockResolvedValue({ STOCKED: 0, RAW_INGREDIENT: 0, PREPPED: 0 });
  vi.mocked(inventoryItemRepository.countSuppliersByItem).mockResolvedValue(new Map());
  vi.mocked(itemChangeRepository.countAttendantCreatedSince).mockResolvedValue(0);
  vi.mocked(branchRepository.findHub).mockResolvedValue(hubOrg as never);
  vi.mocked(branchRepository.findById).mockImplementation(async (id: string) => (id === townOrgId ? (townOrg as never) : id === hubOrgId ? (hubOrg as never) : null));
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
  vi.mocked(locationRepository.findBySiteTypeDepartment).mockImplementation(async (org: string, _t: unknown, tag: string) =>
    org === townOrgId && tag === 'HOUSEKEEPING' ? (townHousekeeping as never) : org === townOrgId && tag === 'KITCHEN' ? (townKitchen as never) : null,
  );
  vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(new Map());
  vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([]);
  vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map());
  vi.mocked(restockLevelRepository.findUseByItemForLocation).mockResolvedValue(new Map());
  vi.mocked(restockLevelRepository.findLiveItemIds).mockResolvedValue([itemId, item2Id]);
  vi.mocked(inventoryItemRepository.findNeedsSetupIds).mockResolvedValue([]);
  vi.mocked(inventoryItemRepository.countCreatedSince).mockResolvedValue(0);
  vi.mocked(inventoryItemRepository.getCatalogMeta).mockResolvedValue({
    itemsTracked: 2, typesRepresented: 1, categoryCount: 0, retiredCategoryCount: 0, departmentCount: 1, supplierCount: 0,
  });
  vi.mocked(inventoryItemRepository.findSearchMatches).mockResolvedValue([]);
  vi.mocked(supplierItemRepository.listForItem).mockResolvedValue([]);
  vi.mocked(supplierItemRepository.applyPreferred).mockResolvedValue({ lineId: null, wasPreferred: false, wasNeedsConfirm: false });
  vi.mocked(inventoryItemRepository.findLiveByName).mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// B9 — Housekeeping
// ---------------------------------------------------------------------------

describe('B9 Housekeeping is accepted everywhere the other departments are', () => {
  it('as an item used-by tag, a list filter and a restock scope', () => {
    expect(
      CreateItemSchema.safeParse({ name: 'Toilex', type: 'STOCKED', buyUnit: 'ctn', usageUnit: 'pack', departmentTags: ['HOUSEKEEPING'] }).success,
    ).toBe(true);
    expect(ListItemsQuerySchema.parse({ departmentTag: 'HOUSEKEEPING' }).departmentTag).toBe('HOUSEKEEPING');
    expect(ListRestockLevelsQuerySchema.safeParse({ scope: 'HOUSEKEEPING', branchId: townOrgId }).success).toBe(true);
  });

  it('a Housekeeping head lists only their department’s items, at their own branch location', async () => {
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([buildItem()] as never);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map([[itemId, new Prisma.Decimal('3')]]));
    vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([
      { inventoryItemId: itemId, level: new Prisma.Decimal('10') },
    ] as never);

    const rows = await inventoryService.listRestockLevels(housekeepingHead, {});

    expect(restockLevelRepository.findLiveItemsForRestock).toHaveBeenCalledWith(hubOrgId, { departmentTag: 'HOUSEKEEPING', search: undefined });
    expect(restockLevelRepository.findAllByLocation).toHaveBeenCalledWith(townOrgId, townHousekeepingId);
    expect(rows[0]).toMatchObject({ itemName: 'Toilex White Tissue', status: 'LOW', isBelowLevel: true });
  });

  it('a Housekeeping head can save a level for a Housekeeping item but not for a Kitchen-only one', async () => {
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([]);
    await inventoryService.saveRestockLevels(housekeepingHead, { levels: [{ inventoryItemId: itemId, level: '12' }] });
    expect(restockLevelRepository.bulkUpsert).toHaveBeenCalledWith(townOrgId, townHousekeepingId, 'dh2', [{ inventoryItemId: itemId, level: '12' }], undefined);

    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem({ departmentTags: ['KITCHEN'] })] as never);
    await expect(
      inventoryService.saveRestockLevels(housekeepingHead, { levels: [{ inventoryItemId: itemId, level: '12' }] }),
    ).rejects.toThrow(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// B10 — Store Manager sets any department's levels
// ---------------------------------------------------------------------------

describe('B10 restock scope', () => {
  const save = { levels: [{ inventoryItemId: itemId, level: '30' }] };

  it('schema: scope and locationId are exclusive; a department scope needs branchId; Central Store refuses one', () => {
    expect(SaveRestockLevelsSchema.safeParse({ ...save, locationId: centralStoreId, scope: 'CENTRAL_STORE' }).success).toBe(false);
    expect(SaveRestockLevelsSchema.safeParse({ ...save, scope: 'KITCHEN' }).success).toBe(false);
    expect(SaveRestockLevelsSchema.safeParse({ ...save, scope: 'CENTRAL_STORE', branchId: townOrgId }).success).toBe(false);
    expect(SaveRestockLevelsSchema.safeParse({ ...save, branchId: townOrgId }).success).toBe(false);
    expect(SaveRestockLevelsSchema.safeParse({ ...save, scope: 'KITCHEN', branchId: townOrgId, reason: 'Busy season' }).success).toBe(true);
    expect(SaveRestockLevelsSchema.safeParse({ ...save, scope: 'CENTRAL_STORE' }).success).toBe(true);
    expect(SaveRestockLevelsSchema.safeParse({ ...save, scope: 'GARDEN', branchId: townOrgId }).success).toBe(false);
  });

  it('the Store Manager saves a branch department’s level at that branch location, with the reason', async () => {
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([]);

    await inventoryService.saveRestockLevels(storeManager, { ...save, scope: 'HOUSEKEEPING', branchId: townOrgId, reason: 'Opening the new wing' });

    expect(inventoryItemRepository.findLiveByIds).toHaveBeenCalledWith([itemId], hubOrgId);
    expect(restockLevelRepository.bulkUpsert).toHaveBeenCalledWith(
      townOrgId,
      townHousekeepingId,
      'sm1',
      [{ inventoryItemId: itemId, level: '30' }],
      'Opening the new wing',
    );
  });

  it('refuses items that are not scoped to that department', async () => {
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem({ departmentTags: ['KITCHEN'] })] as never);
    await expect(
      inventoryService.saveRestockLevels(storeManager, { ...save, scope: 'HOUSEKEEPING', branchId: townOrgId }),
    ).rejects.toThrow(ForbiddenError);
    expect(restockLevelRepository.bulkUpsert).not.toHaveBeenCalled();
  });

  it('scope CENTRAL_STORE works without a locationId, and the legacy locationId still works', async () => {
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([]);

    await inventoryService.saveRestockLevels(storeManager, { ...save, scope: 'CENTRAL_STORE' });
    await inventoryService.saveRestockLevels(storeManager, { ...save, locationId: centralStoreId });

    expect(restockLevelRepository.bulkUpsert).toHaveBeenNthCalledWith(1, hubOrgId, centralStoreId, 'sm1', expect.anything(), undefined);
    expect(restockLevelRepository.bulkUpsert).toHaveBeenNthCalledWith(2, hubOrgId, centralStoreId, 'sm1', expect.anything(), undefined);
  });

  it('rejects the hub as a branch, an unknown branch, a branch without that department, and a wrong locationId', async () => {
    await expect(inventoryService.listRestockLevels(storeManager, { scope: 'KITCHEN', branchId: hubOrgId })).rejects.toThrow(ValidationError);
    await expect(inventoryService.listRestockLevels(storeManager, { scope: 'KITCHEN', branchId: highwayOrgId })).rejects.toThrow(ValidationError);
    vi.mocked(branchRepository.findById).mockResolvedValue({ ...townOrg, id: highwayOrgId } as never);
    await expect(inventoryService.listRestockLevels(storeManager, { scope: 'KITCHEN', branchId: highwayOrgId })).rejects.toThrow(NotFoundError);
    await expect(inventoryService.listRestockLevels(storeManager, { locationId: townHousekeepingId })).rejects.toThrow(ValidationError);
    await expect(inventoryService.listRestockLevels(storeManager, {})).rejects.toThrow(ValidationError);
  });

  it('a Branch Manager on a branch org can READ the Central Store levels but never change them (D-15 read-only exception)', async () => {
    const branchManager = { id: 'bm1', role: 'MANAGER' as const, siteId: townOrgId };
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([]);
    await expect(inventoryService.listRestockLevels(branchManager, { scope: 'CENTRAL_STORE' })).resolves.toEqual([]);
    await expect(inventoryService.saveRestockLevels(branchManager, { ...save, scope: 'CENTRAL_STORE' })).rejects.toThrow(ForbiddenError);
    expect(restockLevelRepository.bulkUpsert).not.toHaveBeenCalled();
  });

  it('the System Admin has no organization and still reads and writes the Central Store levels', async () => {
    const admin = { id: 'adm1', role: 'SYSTEM_ADMIN' as const, siteId: null };
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([buildItem()] as never);
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([]);
    await expect(inventoryService.listRestockLevels(admin as never, { scope: 'CENTRAL_STORE' })).resolves.toEqual([]);
    await inventoryService.saveRestockLevels(admin as never, { ...save, scope: 'CENTRAL_STORE' });
    expect(restockLevelRepository.bulkUpsert).toHaveBeenCalledWith(hubOrgId, centralStoreId, 'adm1', expect.anything(), undefined);
  });

  it('a department head stays limited to their own department: any scope, branch or location is 403', async () => {
    await expect(inventoryService.listRestockLevels(kitchenHead, { scope: 'KITCHEN', branchId: townOrgId })).rejects.toThrow(ForbiddenError);
    await expect(inventoryService.listRestockLevels(kitchenHead, { scope: 'CENTRAL_STORE' })).rejects.toThrow(ForbiddenError);
    await expect(inventoryService.listRestockLevels(kitchenHead, { locationId: centralStoreId })).rejects.toThrow(ForbiddenError);
    await expect(
      inventoryService.saveRestockLevels(kitchenHead, { ...save, scope: 'HOUSEKEEPING', branchId: townOrgId }),
    ).rejects.toThrow(ForbiddenError);
    expect(restockLevelRepository.bulkUpsert).not.toHaveBeenCalled();
  });

  it('D-15: a Store Manager on a branch org gets 403 for every scope', async () => {
    await expect(inventoryService.listRestockLevels(nonHubManager, { scope: 'CENTRAL_STORE' })).rejects.toThrow(ForbiddenError);
    await expect(inventoryService.listRestockLevels(nonHubManager, { scope: 'KITCHEN', branchId: townOrgId })).rejects.toThrow(ForbiddenError);
    await expect(inventoryService.saveRestockLevels(nonHubManager, { ...save, scope: 'CENTRAL_STORE' })).rejects.toThrow(ForbiddenError);
  });

  it('the attendant has no route to restock levels', () => {
    expect(allowedRoles('get', '/inventory/restock-levels')).not.toContain('STORE_ATTENDANT');
    expect(allowedRoles('put', '/inventory/restock-levels')).not.toContain('STORE_ATTENDANT');
    expect(allowedRoles('get', '/inventory/restock-levels/summary')).not.toContain('STORE_ATTENDANT');
  });
});

// ---------------------------------------------------------------------------
// B11 — strips
// ---------------------------------------------------------------------------

describe('B11 catalog strip', () => {
  const emptyList = { items: [], total: 0 };

  it('adds needsSetup, lowOrOut and addedThisWeek to meta and keeps the contract shape', async () => {
    vi.mocked(inventoryItemRepository.findAllBySite).mockResolvedValue(emptyList as never);
    vi.mocked(inventoryItemRepository.findNeedsSetupIds).mockResolvedValue([itemId, item2Id, 'x3']);
    vi.mocked(inventoryItemRepository.countCreatedSince).mockResolvedValue(5);
    vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([
      { inventoryItemId: itemId, level: new Prisma.Decimal('10') }, // out (no stock)
      { inventoryItemId: item2Id, level: new Prisma.Decimal('10') }, // low (4)
      { inventoryItemId: 'retired', level: new Prisma.Decimal('10') }, // retired item: not counted
    ] as never);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map([[item2Id, new Prisma.Decimal('4')]]));

    const result = await inventoryService.listItems(storeManager, { page: 1, perPage: 20, includeRetired: false, needsSetup: false, lowOrOut: false });

    expect(result.meta).toMatchObject({ itemsTracked: 2, needsSetup: 3, lowOrOut: 2, addedThisWeek: 5 });
    expect(() => ItemCatalogMetaSchema.parse(result.meta)).not.toThrow();
    const since = vi.mocked(inventoryItemRepository.countCreatedSince).mock.calls[0]![1];
    expect(Date.now() - since.getTime()).toBeGreaterThan(6.99 * 86_400_000);
    expect(Date.now() - since.getTime()).toBeLessThan(7.01 * 86_400_000);
  });

  it('needsSetup=true restricts the list to those ids (the repository sorts them oldest first)', async () => {
    vi.mocked(inventoryItemRepository.findAllBySite).mockResolvedValue(emptyList as never);
    vi.mocked(inventoryItemRepository.findNeedsSetupIds).mockResolvedValue([itemId]);

    await inventoryService.listItems(storeManager, { page: 1, perPage: 20, includeRetired: false, needsSetup: true, lowOrOut: false });
    expect(inventoryItemRepository.findAllBySite).toHaveBeenCalledWith(hubOrgId, expect.objectContaining({ onlyIds: [itemId] }));

    await inventoryService.listItems(storeManager, { page: 1, perPage: 20, includeRetired: false, needsSetup: false, lowOrOut: false });
    expect(vi.mocked(inventoryItemRepository.findAllBySite).mock.calls[1]![1].onlyIds).toBeUndefined();
  });

  it('lowOrOut is null for the attendant and a department head (restock levels are not theirs)', async () => {
    vi.mocked(inventoryItemRepository.findAllBySite).mockResolvedValue(emptyList as never);
    const q = { page: 1, perPage: 20, includeRetired: false, needsSetup: false, lowOrOut: false };
    expect((await inventoryService.listItems(attendant, q)).meta.lowOrOut).toBeNull();
    expect((await inventoryService.listItems(kitchenHead, q)).meta.lowOrOut).toBeNull();
    expect(restockLevelRepository.findAllByLocation).not.toHaveBeenCalled();
  });
});

describe('B11 restock strip', () => {
  it('counts statuses and the suggestions that differ; the four statuses add up to the rows', async () => {
    const item3 = '44444444-4444-4444-8444-444444444446';
    const item4 = '44444444-4444-4444-8444-444444444447';
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue(
      [itemId, item2Id, item3, item4].map((id, i) => buildItem({ id, name: `Item ${i}` })) as never,
    );
    vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([
      { inventoryItemId: itemId, level: new Prisma.Decimal('10') }, // out
      { inventoryItemId: item2Id, level: new Prisma.Decimal('10') }, // low
      { inventoryItemId: item3, level: new Prisma.Decimal('150') }, // ok
    ] as never);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(
      new Map([[item2Id, new Prisma.Decimal('4')], [item3, new Prisma.Decimal('200')]]),
    );
    // item3: 360 used over 30 days → suggests 180; level 150 is 20 % off (not more) → does not differ.
    // item2: 600 used → 300 suggested vs level 10 → differs.
    const longAgo = new Date(Date.now() - 90 * 86_400_000);
    vi.mocked(restockLevelRepository.findUseByItemForLocation).mockResolvedValue(
      new Map([
        [item3, { useInWindow: new Prisma.Decimal('360'), firstUseAt: longAgo }],
        [item2Id, { useInWindow: new Prisma.Decimal('600'), firstUseAt: longAgo }],
        [item4, { useInWindow: new Prisma.Decimal('50'), firstUseAt: longAgo }], // no level: never "differs"
      ]),
    );

    const result = await inventoryService.getRestockLevelsSummary(storeManager, { scope: 'CENTRAL_STORE' });

    expect(result).toEqual({ total: 4, out: 1, low: 1, ok: 1, noLevel: 1, suggestionsDiffer: 1 });
    expect(() => RestockLevelsSummarySchema.parse(result)).not.toThrow();
    expect(result.out + result.low + result.ok + result.noLevel).toBe(result.total);
  });

  it('rows report the days of cover the suggestion used: the item own, or the default 15', async () => {
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([
      buildItem(),
      buildItem({ id: item2Id, daysOfCover: new Prisma.Decimal('1.5') }),
    ] as never);
    vi.mocked(restockLevelRepository.findUseByItemForLocation).mockResolvedValue(
      new Map([
        [itemId, { useInWindow: new Prisma.Decimal('360'), firstUseAt: new Date(Date.now() - 90 * 86_400_000) }],
        [item2Id, { useInWindow: new Prisma.Decimal('360'), firstUseAt: new Date(Date.now() - 90 * 86_400_000) }],
      ]),
    );
    const rows = await inventoryService.listRestockLevels(storeManager, { scope: 'CENTRAL_STORE' });
    expect(rows[0]).toMatchObject({ daysOfCover: '15', suggestedLevel: '180.00' });
    expect(rows[1]).toMatchObject({ daysOfCover: '1.5', suggestedLevel: '18.00' });
    rows.forEach((r) => expect(() => RestockLevelRowSchema.parse(r)).not.toThrow());
  });

  it('rows carry status and the suggestion, validated against the row schema', async () => {
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([buildItem(), buildItem({ id: item2Id })] as never);
    vi.mocked(restockLevelRepository.findUseByItemForLocation).mockResolvedValue(
      new Map([[item2Id, { useInWindow: new Prisma.Decimal('9'), firstUseAt: new Date(Date.now() - 5 * 86_400_000) }]]),
    );
    const rows = await inventoryService.listRestockLevels(storeManager, { scope: 'CENTRAL_STORE' });
    rows.forEach((r) => expect(() => RestockLevelRowSchema.parse(r)).not.toThrow());
    expect(rows[0]).toMatchObject({ status: 'NO_LEVEL', suggestedLevel: null, suggestionNote: null });
    rows.forEach((r) => expect(['RAW_INGREDIENT', 'PREPPED', 'STOCKED']).toContain(r.itemType));
    expect(rows[1]).toMatchObject({ suggestedLevel: null, suggestionNote: 'NEEDS_HISTORY' });
  });

  it('the summary is also 403 for a branch-org Store Manager', async () => {
    await expect(inventoryService.getRestockLevelsSummary(nonHubManager, { scope: 'CENTRAL_STORE' })).rejects.toThrow(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// B12 — attendant item creation
// ---------------------------------------------------------------------------

const MONEY_KEYS = ['currentCost', 'centralStoreRestockLevel', 'preferredSupplier', 'preferredSupplierId'];

describe('B12 attendant item creation', () => {
  const base = { name: 'Tin of tomatoes', buyUnit: 'tin', usageUnit: 'g', conversionFactor: '400', packSize: null, departmentTags: [] as never[] };

  it('the route is open to the Store Manager, the System Admin and the attendant only', () => {
    expect(allowedRoles('post', '/inventory/items')).toEqual(['STORE_ATTENDANT', 'STORE_MANAGER', 'SYSTEM_ADMIN']);
  });

  it.each(['RAW_INGREDIENT', 'STOCKED'] as const)('lets the attendant create a %s item and returns a money-blind response', async (type) => {
    vi.mocked(inventoryItemRepository.create).mockResolvedValue(buildItem({ type, name: base.name, departmentTags: [] }) as never);

    const result = await inventoryService.createItem(attendant, { ...base, type });

    expect(inventoryItemRepository.create).toHaveBeenCalledWith(hubOrgId, expect.objectContaining({ type, name: base.name }), expect.anything());
    expect(() => AttendantItemMutationResponseSchema.parse(result)).not.toThrow();
    expect(() => AttendantInventoryItemSchema.parse(result.item)).not.toThrow();
    const json = JSON.stringify(result);
    for (const key of MONEY_KEYS) expect(json, `leaked ${key}`).not.toContain(`"${key}"`);
    expect(restockLevelRepository.bulkUpsert).not.toHaveBeenCalled();
  });

  it('refuses PREPPED with 403 and writes nothing', async () => {
    await expect(inventoryService.createItem(attendant, { ...base, type: 'PREPPED' })).rejects.toThrow(ForbiddenError);
    expect(inventoryItemRepository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['category id', { categoryId: '55555555-5555-4555-8555-555555555555' }],
    ['category name', { categoryName: 'Tinned' }],
    ['preferred supplier', { preferredSupplierId: '66666666-6666-4666-8666-666666666666' }],
    ['used-by departments', { departmentTags: ['KITCHEN'] }],
    ['restock level', { centralStoreRestockLevel: '5' }],
    ['days of cover', { daysOfCover: '5' }],
  ])('refuses an attendant request that sets %s', async (_label, extra) => {
    await expect(
      inventoryService.createItem(attendant, { ...base, type: 'STOCKED', ...extra } as never),
    ).rejects.toThrow(ForbiddenError);
    expect(inventoryItemRepository.create).not.toHaveBeenCalled();
  });

  it('the Store Manager still creates PREPPED items and sees the money fields', async () => {
    vi.mocked(inventoryItemRepository.create).mockResolvedValue(buildItem({ type: 'PREPPED' }) as never);
    const result = (await inventoryService.createItem(storeManager, { ...base, type: 'PREPPED', departmentTags: ['KITCHEN'] })) as {
      item: Record<string, unknown>;
    };
    expect(result.item).toHaveProperty('currentCost');
    expect(result.item).toHaveProperty('centralStoreRestockLevel');
  });

  it('D-15: an attendant on a branch org cannot create at all', async () => {
    await expect(
      inventoryService.createItem({ ...attendant, siteId: townOrgId }, { ...base, type: 'STOCKED' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('attendant reads (list and by id) carry no money keys; the supplier lines carry no prices', async () => {
    vi.mocked(inventoryItemRepository.findAllBySite).mockResolvedValue({ items: [buildItem()], total: 1 } as never);
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem() as never);
    vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(new Map([[itemId, new Prisma.Decimal('9')]]));
    vi.mocked(supplierItemRepository.listForItem).mockResolvedValue([
      {
        id: 'l1', supplierItemName: 'Toilex', supplierItemCode: '190035', buyUnit: 'ctn', packSize: new Prisma.Decimal('10'),
        lastPrice: new Prisma.Decimal('950'), lastPriceAt: new Date(), isPreferred: true, preferredNeedsConfirm: false,
        supplier: { id: 's1', code: 'SUPPLIER-0001', name: 'Summer Limited' },
      },
    ] as never);

    const list = await inventoryService.listItems(attendant, { page: 1, perPage: 20, includeRetired: false, needsSetup: false, lowOrOut: false });
    const one = await inventoryService.getItemById(attendant, itemId);

    for (const json of [JSON.stringify(list.data), JSON.stringify(one)]) {
      for (const key of [...MONEY_KEYS, 'lastPrice', 'lastPriceAt', 'isPreferred']) expect(json, `leaked ${key}`).not.toContain(`"${key}"`);
    }
    expect(one.suppliers[0]).toMatchObject({ supplierItemCode: '190035', supplierName: 'Summer Limited' });
    expect(restockLevelRepository.findByItemIdsForLocation).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// B13 — review a change
// ---------------------------------------------------------------------------

describe('B13 review-a-change counts', () => {
  it('an item with no history returns zeros — never null — and hasHistory false', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem() as never);
    vi.mocked(itemChangeReviewRepository.counts).mockResolvedValue({
      onHandQty: new Prisma.Decimal(0), locationsHoldingStock: 0, stockEntries: 0, receipts: 0, receiptLines: 0, openOrders: 0,
    });

    const result = await inventoryService.getItemChangeReview(storeManager, itemId);

    expect(result).toEqual({
      inventoryItemId: itemId, itemName: 'Toilex White Tissue', onHandQty: '0', locationsHoldingStock: 0,
      stockEntries: 0, receipts: 0, receiptLines: 0, openOrders: 0, hasHistory: false,
    });
    expect(() => ItemChangeReviewSchema.parse(result)).not.toThrow();
    for (const value of Object.values(result)) expect(value).not.toBeNull();
  });

  it.each([
    ['stock entries', { stockEntries: 3 }],
    ['receipt lines', { receiptLines: 1, receipts: 1 }],
    ['an open order', { openOrders: 2 }],
  ])('hasHistory is true when there are %s', async (_label, over) => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem() as never);
    vi.mocked(itemChangeReviewRepository.counts).mockResolvedValue({
      onHandQty: new Prisma.Decimal(12), locationsHoldingStock: 1, stockEntries: 0, receipts: 0, receiptLines: 0, openOrders: 0, ...over,
    });
    const result = await inventoryService.getItemChangeReview(storeManager, itemId);
    expect(result.hasHistory).toBe(true);
    expect(result.onHandQty).toBe('12');
  });

  it('404 for an unknown item (counted against the hub org only), 403 for a branch-org actor', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(null);
    await expect(inventoryService.getItemChangeReview(storeManager, itemId)).rejects.toThrow(NotFoundError);
    expect(inventoryItemRepository.findById).toHaveBeenCalledWith(itemId, hubOrgId);
    await expect(inventoryService.getItemChangeReview(nonHubManager, itemId)).rejects.toThrow(ForbiddenError);
    expect(itemChangeReviewRepository.counts).not.toHaveBeenCalled();
  });

  it('the route is for whoever can change the catalog', () => {
    expect(allowedRoles('get', '/inventory/items/:id/change-review')).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN']);
  });
});

// ---------------------------------------------------------------------------
// Route role matrix for the new reads
// ---------------------------------------------------------------------------

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } };

const ALL_ROLES = [
  'SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER', 'MANAGER', 'ACCOUNTANT', 'WAITER', 'CHEF', 'BARISTA',
  'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT', 'DEPARTMENT_HEAD',
];

function allowedRoles(method: string, path: string): string[] {
  const layer = (inventoryRouter.stack as unknown as Layer[]).find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`route not found: ${method} ${path}`);
  const guards = layer.route.stack.slice(0, -1);
  return ALL_ROLES.filter((role) =>
    guards.every((g) => {
      const next = vi.fn() as unknown as NextFunction;
      try {
        g.handle({ user: { id: 'u', role, siteId: hubOrgId } } as Request, {} as Response, next);
      } catch {
        return false;
      }
      return vi.mocked(next).mock.calls.length === 1;
    }),
  ).sort();
}

describe('route role matrix', () => {
  it('new supplier strips are for every desktop role; the attendant is out', () => {
    expect(allowedRoles('get', '/inventory/suppliers/summary')).toEqual(['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_MANAGER', 'SYSTEM_ADMIN']);
    expect(allowedRoles('get', '/inventory/suppliers/:id/catalog-summary')).toEqual(['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_MANAGER', 'SYSTEM_ADMIN']);
  });

  it('item history and restock history are for every desktop role; put back is for who can change levels (a department head passes through allowDepartmentHead)', () => {
    // Item history names prices, so the attendant is out of it.
    expect(allowedRoles('get', '/inventory/items/:id/history')).toEqual(['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_MANAGER', 'SYSTEM_ADMIN']);
    expect(allowedRoles('get', '/inventory/restock-levels/history')).toEqual(['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_MANAGER', 'SYSTEM_ADMIN']);
    expect(allowedRoles('post', '/inventory/restock-levels/changes/:id/put-back')).toEqual(['STORE_MANAGER', 'SYSTEM_ADMIN']);
  });

  it('"summary" is registered before "/:id" so it is never read as a supplier id', () => {
    const paths = (inventoryRouter.stack as unknown as Layer[]).filter((l) => l.route?.methods.get).map((l) => l.route!.path);
    expect(paths.indexOf('/inventory/suppliers/summary')).toBeLessThan(paths.indexOf('/inventory/suppliers/:id'));
  });
});
