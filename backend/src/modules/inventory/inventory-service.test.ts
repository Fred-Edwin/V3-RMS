import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { inventoryService } from './inventory-service';
import { categoryRepository, inventoryItemRepository, restockLevelRepository } from './inventory-repository';
import { supplierAuditRepository, supplierItemRepository, supplierRepository } from './supplier-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { prisma } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';

vi.mock('./inventory-repository', () => ({
  categoryRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    findByLiveName: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    retire: vi.fn(),
    restore: vi.fn(),
    countLiveItems: vi.fn(),
  },
  inventoryItemRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    findLiveByIds: vi.fn(),
    findLiveByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    retire: vi.fn(),
    restore: vi.fn(),
    getCatalogMeta: vi.fn(),
    findSearchMatches: vi.fn(),
    findNeedsSetupIds: vi.fn(),
    countCreatedSince: vi.fn(),
  },
  itemChangeReviewRepository: { counts: vi.fn() },
  restockLevelRepository: {
    findLiveItemIds: vi.fn(),
    findUseByItemForLocation: vi.fn(),
    findAllByLocation: vi.fn(),
    findByItemIdsForLocation: vi.fn(),
    findLiveItemsForRestock: vi.fn(),
    bulkUpsert: vi.fn(),
    sumOnHandByItemForLocation: vi.fn(),
  },
}));

vi.mock('./supplier-repository', () => ({
  supplierRepository: { findById: vi.fn() },
  supplierItemRepository: { applyPreferred: vi.fn(), listForItem: vi.fn() },
  supplierAuditRepository: { create: vi.fn() },
}));

vi.mock('../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn() },
}));

vi.mock('../../repositories/location-repository', () => ({
  locationRepository: {
    findCentralStore: vi.fn(),
    findByOrganizationTypeDepartment: vi.fn(),
  },
}));

vi.mock('../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
    inventoryTransaction: { groupBy: vi.fn() },
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const branchOrgId = '22222222-2222-4222-8222-222222222222';
const centralStoreId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';
const categoryId = '55555555-5555-4555-8555-555555555555';
const supplierId = '66666666-6666-4666-8666-666666666666';
const departmentLocationId = '77777777-7777-4777-8777-777777777777';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
const nonHubStoreManager = { id: 'sm2', role: 'STORE_MANAGER' as const, organizationId: branchOrgId };
const departmentHead = {
  id: 'dh1',
  role: 'CHEF' as const,
  organizationId: branchOrgId,
  isDepartmentHead: true,
  departmentTag: 'KITCHEN' as const,
};

const hubOrg = { id: hubOrgId, name: 'Central Store', isHub: true, isActive: true };
const centralStore = { id: centralStoreId, organizationId: hubOrgId, type: 'CENTRAL_STORE' as const };

const buildCategory = (overrides: Record<string, unknown> = {}) => ({
  id: categoryId,
  organizationId: hubOrgId,
  name: 'Dry items',
  itemCount: 0,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: itemId,
  organizationId: hubOrgId,
  name: 'Kabras Sugar 1kg',
  type: 'RAW_INGREDIENT' as const,
  categoryId,
  preferredSupplierId: null,
  buyUnit: 'kg',
  usageUnit: 'kg',
  conversionFactor: new Prisma.Decimal('1'),
  packSize: null,
  departmentTags: [] as string[],
  currentCost: new Prisma.Decimal('155'),
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { id: categoryId, name: 'Dry items' },
  preferredSupplier: null,
  ...overrides,
});

const buildSupplier = (overrides: Record<string, unknown> = {}) => ({
  id: supplierId,
  organizationId: hubOrgId,
  name: 'Samrat Supermarket Ltd',
  contactName: 'Dattu',
  categoryId,
  phone: '+254722160400',
  email: 'samratnyeri@gmail.com',
  location: 'Nyeri town',
  defaultPaymentTerms: 'INVOICE_TO_FOLLOW' as const,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { id: categoryId, name: 'Dry items' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue(hubOrg as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
  vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(new Map());
  vi.mocked(supplierItemRepository.applyPreferred).mockResolvedValue({ lineId: 'line1', wasPreferred: false, wasNeedsConfirm: false });
  vi.mocked(supplierItemRepository.listForItem).mockResolvedValue([]);
  vi.mocked(inventoryItemRepository.findSearchMatches).mockResolvedValue([]);
  vi.mocked(inventoryItemRepository.findNeedsSetupIds).mockResolvedValue([]);
  vi.mocked(inventoryItemRepository.countCreatedSince).mockResolvedValue(0);
  vi.mocked(restockLevelRepository.findUseByItemForLocation).mockResolvedValue(new Map());
  vi.mocked(restockLevelRepository.findLiveItemIds).mockResolvedValue([]);
  vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([]);
  vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map());
});

describe('inventoryService — D-15 hub scoping', () => {
  it('rejects a non-hub Store Manager with a ForbiddenError', async () => {
    await expect(inventoryService.listCategories(nonHubStoreManager, false)).rejects.toThrow(ForbiddenError);
  });

  it('rejects when no hub organization is configured', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue(null);
    await expect(inventoryService.listCategories(storeManager, false)).rejects.toThrow(ValidationError);
  });

  it('resolves catalog writes against the hub org, not actor.organizationId', async () => {
    vi.mocked(categoryRepository.findByLiveName).mockResolvedValue(null);
    vi.mocked(categoryRepository.create).mockResolvedValue(buildCategory() as never);

    await inventoryService.createCategory(storeManager, { name: 'Dry items' });

    expect(categoryRepository.create).toHaveBeenCalledWith(hubOrgId, 'Dry items');
  });
});

describe('inventoryService — listItems Department Head catalog-read carve-out (Milestone Four Session A)', () => {
  it('resolves to the hub org for a branch-org Department Head (does not throw)', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [], total: 0 } as never);
    vi.mocked(inventoryItemRepository.getCatalogMeta).mockResolvedValue({ categories: [], types: [] } as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(null);

    await expect(
      inventoryService.listItems(departmentHead, { page: 1, perPage: 20, includeRetired: false, needsSetup: false }),
    ).resolves.toBeDefined();
    expect(inventoryItemRepository.findAllByOrganization).toHaveBeenCalledWith(hubOrgId, expect.anything());
  });

  it('still rejects a non-hub, non-department-head actor (e.g. a plain branch Store Manager)', async () => {
    await expect(
      inventoryService.listItems(nonHubStoreManager, { page: 1, perPage: 20, includeRetired: false, needsSetup: false }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe('inventoryService — category CRUD unaffected by the additive parentCategoryId column (Milestone Four regression)', () => {
  it('list/create/rename still work when a category carries a null parentCategoryId', async () => {
    vi.mocked(categoryRepository.findAllByOrganization).mockResolvedValue([
      buildCategory({ parentCategoryId: null }),
    ] as never);
    const list = await inventoryService.listCategories(storeManager, false);
    expect(list).toHaveLength(1);

    vi.mocked(categoryRepository.findByLiveName).mockResolvedValue(null);
    vi.mocked(categoryRepository.create).mockResolvedValue(buildCategory({ parentCategoryId: null }) as never);
    await expect(inventoryService.createCategory(storeManager, { name: 'Dry items' })).resolves.toBeDefined();

    vi.mocked(categoryRepository.findById).mockResolvedValue(buildCategory({ parentCategoryId: null }) as never);
    vi.mocked(categoryRepository.rename).mockResolvedValue(buildCategory({ name: 'Renamed', parentCategoryId: null }) as never);
    await expect(
      inventoryService.renameCategory(storeManager, categoryId, { name: 'Renamed' }),
    ).resolves.toBeDefined();
  });
});

describe('inventoryService — raw ingredient / department tag rejection', () => {
  it('rejects creating a RAW_INGREDIENT item with department tags (Zod-equivalent service guard)', async () => {
    await expect(
      inventoryService.createItem(storeManager, {
        name: 'Fresh Milk',
        type: 'RAW_INGREDIENT',
        buyUnit: 'L',
        usageUnit: 'L',
        conversionFactor: null,
        packSize: null,
        departmentTags: ['KITCHEN'],
        categoryId: null,
        categoryName: null,
        preferredSupplierId: null,
        centralStoreRestockLevel: null,
      } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a type change INTO RAW_INGREDIENT while department tags remain set', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(
      buildItem({ type: 'STOCKED', departmentTags: ['KITCHEN'] }) as never,
    );

    await expect(
      inventoryService.updateItem(storeManager, itemId, { type: 'RAW_INGREDIENT' } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('allows a STOCKED item to carry department tags', async () => {
    vi.mocked(inventoryItemRepository.findLiveByName).mockResolvedValue(null);
    vi.mocked(inventoryItemRepository.create).mockResolvedValue(
      buildItem({ type: 'STOCKED', departmentTags: ['HOUSEKEEPING'] }) as never,
    );

    const result = await inventoryService.createItem(storeManager, {
      name: 'Meta Soap',
      type: 'STOCKED',
      buyUnit: 'kg',
      usageUnit: 'kg',
      conversionFactor: null,
      packSize: null,
      departmentTags: ['HOUSEKEEPING'],
      categoryId: null,
      categoryName: null,
      preferredSupplierId: null,
      centralStoreRestockLevel: null,
    } as never);

    expect(result.item.departmentTags).toEqual(['HOUSEKEEPING']);
  });
});

describe('inventoryService — type-change blocking', () => {
  it('blocks a type change away from a department-scoped type while department stock is non-zero', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(
      buildItem({ type: 'STOCKED', departmentTags: ['KITCHEN'] }) as never,
    );
    vi.mocked(prisma.inventoryTransaction.groupBy).mockResolvedValue([
      { locationId: departmentLocationId, _sum: { quantity: new Prisma.Decimal('5') } },
    ] as never);

    await expect(
      inventoryService.updateItem(storeManager, itemId, { type: 'RAW_INGREDIENT', departmentTags: [] } as never),
    ).rejects.toThrow(ConflictError);
  });

  it('allows a type change away from a department-scoped type when department stock is zero', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(
      buildItem({ type: 'STOCKED', departmentTags: ['KITCHEN'] }) as never,
    );
    vi.mocked(prisma.inventoryTransaction.groupBy).mockResolvedValue([] as never);
    vi.mocked(inventoryItemRepository.findLiveByName).mockResolvedValue(null);
    vi.mocked(inventoryItemRepository.update).mockResolvedValue(
      buildItem({ type: 'RAW_INGREDIENT', departmentTags: [] }) as never,
    );

    const result = await inventoryService.updateItem(storeManager, itemId, {
      type: 'RAW_INGREDIENT',
      departmentTags: [],
    } as never);

    expect(result.item.type).toBe('RAW_INGREDIENT');
  });
});

describe('inventoryService — duplicate item name warns, does not fail', () => {
  it('creates the item and returns a warning when the name duplicates a live item', async () => {
    vi.mocked(inventoryItemRepository.findLiveByName).mockResolvedValue(buildItem() as never);
    vi.mocked(inventoryItemRepository.create).mockResolvedValue(buildItem() as never);

    const result = await inventoryService.createItem(storeManager, {
      name: 'Kabras Sugar 1kg',
      type: 'RAW_INGREDIENT',
      buyUnit: 'kg',
      usageUnit: 'kg',
      conversionFactor: '1',
      packSize: null,
      departmentTags: [],
      categoryId: null,
      categoryName: null,
      preferredSupplierId: null,
      centralStoreRestockLevel: null,
    } as never);

    expect(result.warnings).toEqual([{ code: 'DUPLICATE_ITEM_NAME', message: expect.stringContaining('Kabras Sugar 1kg') }]);
    expect(inventoryItemRepository.create).toHaveBeenCalled();
  });

  it('creates the item with no warning when the name is unique', async () => {
    vi.mocked(inventoryItemRepository.findLiveByName).mockResolvedValue(null);
    vi.mocked(inventoryItemRepository.create).mockResolvedValue(buildItem() as never);

    const result = await inventoryService.createItem(storeManager, {
      name: 'Unique Item',
      type: 'RAW_INGREDIENT',
      buyUnit: 'kg',
      usageUnit: 'kg',
      conversionFactor: '1',
      packSize: null,
      departmentTags: [],
      categoryId: null,
      categoryName: null,
      preferredSupplierId: null,
      centralStoreRestockLevel: null,
    } as never);

    expect(result.warnings).toEqual([]);
  });
});

describe('inventoryService — category rename propagates by reference', () => {
  it('renames the category row without touching item rows', async () => {
    vi.mocked(categoryRepository.findByLiveName).mockResolvedValue(null);
    vi.mocked(categoryRepository.rename).mockResolvedValue(buildCategory({ name: 'Fresh produce' }) as never);
    vi.mocked(categoryRepository.countLiveItems).mockResolvedValue(12);

    const result = await inventoryService.renameCategory(storeManager, categoryId, { name: 'Fresh produce' });

    expect(categoryRepository.rename).toHaveBeenCalledWith(categoryId, hubOrgId, 'Fresh produce');
    expect(result.name).toBe('Fresh produce');
    expect(result.itemCount).toBe(12);
  });
});

describe('inventoryService — retire/restore round-trips', () => {
  it('retires and restores a category', async () => {
    vi.mocked(categoryRepository.retire).mockResolvedValue(buildCategory({ deletedAt: new Date() }) as never);
    const retired = await inventoryService.retireCategory(storeManager, categoryId);
    expect(retired.retiredAt).not.toBeNull();

    vi.mocked(categoryRepository.findById).mockResolvedValue(buildCategory({ deletedAt: new Date() }) as never);
    vi.mocked(categoryRepository.findByLiveName).mockResolvedValue(null);
    vi.mocked(categoryRepository.restore).mockResolvedValue(buildCategory({ deletedAt: null }) as never);
    const restored = await inventoryService.restoreCategory(storeManager, categoryId);
    expect(restored.retiredAt).toBeNull();
  });

  it('retires and restores an item', async () => {
    vi.mocked(inventoryItemRepository.retire).mockResolvedValue(buildItem({ deletedAt: new Date() }) as never);
    const retired = await inventoryService.retireItem(storeManager, itemId);
    expect(retired.retiredAt).not.toBeNull();

    vi.mocked(inventoryItemRepository.restore).mockResolvedValue(buildItem({ deletedAt: null }) as never);
    const restored = await inventoryService.restoreItem(storeManager, itemId);
    expect(restored.retiredAt).toBeNull();
  });
});

describe('inventoryService — live-name uniqueness ignores retired rows', () => {
  it('allows restoring a category whose name is not currently live', async () => {
    vi.mocked(categoryRepository.findById).mockResolvedValue(buildCategory({ deletedAt: new Date() }) as never);
    vi.mocked(categoryRepository.findByLiveName).mockResolvedValue(null);
    vi.mocked(categoryRepository.restore).mockResolvedValue(buildCategory({ deletedAt: null }) as never);

    await expect(inventoryService.restoreCategory(storeManager, categoryId)).resolves.toBeDefined();
  });

  it('blocks restoring a category whose name a live category already holds', async () => {
    vi.mocked(categoryRepository.findById).mockResolvedValue(buildCategory({ deletedAt: new Date() }) as never);
    vi.mocked(categoryRepository.findByLiveName).mockResolvedValue(buildCategory({ id: 'other-id' }) as never);

    await expect(inventoryService.restoreCategory(storeManager, categoryId)).rejects.toThrow(ConflictError);
  });
});

describe('inventoryService — preferred supplier stays in sync with SupplierItem.isPreferred', () => {
  const base = {
    name: 'Milk', type: 'STOCKED', buyUnit: 'crate', usageUnit: 'unit', conversionFactor: null, packSize: null,
    departmentTags: [], categoryId: null, categoryName: null, centralStoreRestockLevel: null,
  };

  it('creating an item with a preferred supplier marks the catalog row', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue({ id: supplierId } as never);
    vi.mocked(inventoryItemRepository.findLiveByName).mockResolvedValue(null);
    vi.mocked(inventoryItemRepository.create).mockResolvedValue(buildItem({ preferredSupplierId: supplierId }) as never);

    await inventoryService.createItem(storeManager, { ...base, preferredSupplierId: supplierId } as never);
    expect(supplierItemRepository.applyPreferred).toHaveBeenCalledWith(hubOrgId, itemId, supplierId, expect.anything());
  });

  it('clearing the preferred supplier on update clears the catalog mark', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem({ preferredSupplierId: supplierId }) as never);
    vi.mocked(inventoryItemRepository.update).mockResolvedValue(buildItem({ preferredSupplierId: null }) as never);

    await inventoryService.updateItem(storeManager, itemId, { preferredSupplierId: null } as never);
    expect(supplierItemRepository.applyPreferred).toHaveBeenCalledWith(hubOrgId, itemId, null, expect.anything());
  });

  it('logs PREFERRED_SET when an item-level change makes a supplier line preferred (B8)', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem() as never);
    vi.mocked(inventoryItemRepository.update).mockResolvedValue(buildItem({ preferredSupplierId: supplierId }) as never);
    vi.mocked(supplierRepository.findById).mockResolvedValue({ id: supplierId } as never);

    await inventoryService.updateItem(storeManager, itemId, { preferredSupplierId: supplierId } as never);
    expect(supplierAuditRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, 'sm1', 'PREFERRED_SET', 'line1',
      expect.objectContaining({ inventoryItemId: itemId }), expect.objectContaining({ isPreferred: true }), expect.anything(),
    );
  });

  it('confirms (and logs) a seeded "Preferred · confirm" line when the item re-selects that supplier (B8)', async () => {
    vi.mocked(supplierItemRepository.applyPreferred).mockResolvedValue({ lineId: 'line1', wasPreferred: true, wasNeedsConfirm: true });
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem({ preferredSupplierId: supplierId }) as never);
    vi.mocked(inventoryItemRepository.update).mockResolvedValue(buildItem({ preferredSupplierId: supplierId }) as never);
    vi.mocked(supplierRepository.findById).mockResolvedValue({ id: supplierId } as never);

    await inventoryService.updateItem(storeManager, itemId, { preferredSupplierId: supplierId } as never);
    expect(supplierAuditRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, 'sm1', 'PREFERRED_CONFIRMED', 'line1', expect.anything(), expect.anything(), expect.anything(),
    );
  });

  it('logs nothing when clearing the preferred supplier or when nothing changed', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem({ preferredSupplierId: supplierId }) as never);
    vi.mocked(inventoryItemRepository.update).mockResolvedValue(buildItem() as never);
    await inventoryService.updateItem(storeManager, itemId, { preferredSupplierId: null } as never);
    expect(supplierAuditRepository.create).not.toHaveBeenCalled();
  });

  it('does not touch the catalog when preferredSupplierId is not part of the update', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem() as never);
    vi.mocked(inventoryItemRepository.update).mockResolvedValue(buildItem({ name: 'Renamed' }) as never);

    await inventoryService.updateItem(storeManager, itemId, { name: 'Renamed' } as never);
    expect(supplierItemRepository.applyPreferred).not.toHaveBeenCalled();
  });
});

describe('inventoryService — bulk restock upsert atomicity and level:null clearing', () => {
  it('passes the whole batch to one bulkUpsert call, including a null-clearing row', async () => {
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([
      buildItem({ id: itemId }) as never,
      buildItem({ id: 'item-2' }) as never,
    ]);
    vi.mocked(restockLevelRepository.bulkUpsert).mockResolvedValue(undefined);
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([]);
    vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([]);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map());

    await inventoryService.saveRestockLevels(storeManager, {
      locationId: centralStoreId,
      levels: [
        { inventoryItemId: itemId, level: '50' },
        { inventoryItemId: 'item-2', level: null },
      ],
    });

    expect(restockLevelRepository.bulkUpsert).toHaveBeenCalledTimes(1);
    expect(restockLevelRepository.bulkUpsert).toHaveBeenCalledWith(hubOrgId, centralStoreId, storeManager.id, [
      { inventoryItemId: itemId, level: '50' },
      { inventoryItemId: 'item-2', level: null },
    ], undefined);
  });

  it('rejects when the locationId does not resolve to the Central Store', async () => {
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);

    await expect(
      inventoryService.saveRestockLevels(storeManager, {
        locationId: 'not-the-central-store',
        levels: [{ inventoryItemId: itemId, level: '10' }],
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('inventoryService — department head scope rejection', () => {
  it('rejects a Department Head setting a level for an item outside their department', async () => {
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({
      id: departmentLocationId,
      organizationId: branchOrgId,
      type: 'BRANCH_DEPARTMENT',
      departmentTag: 'KITCHEN',
    } as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([
      buildItem({ id: itemId, departmentTags: ['BARISTA'] }) as never,
    ]);

    await expect(
      inventoryService.saveRestockLevels(departmentHead, {
        levels: [{ inventoryItemId: itemId, level: '10' }],
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects a Department Head passing an explicit locationId', async () => {
    await expect(
      inventoryService.saveRestockLevels(departmentHead, {
        locationId: centralStoreId,
        levels: [{ inventoryItemId: itemId, level: '10' }],
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('allows a Department Head to set a level for an item scoped to their own department', async () => {
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({
      id: departmentLocationId,
      organizationId: branchOrgId,
      type: 'BRANCH_DEPARTMENT',
      departmentTag: 'KITCHEN',
    } as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([
      buildItem({ id: itemId, departmentTags: ['KITCHEN'] }) as never,
    ]);
    vi.mocked(restockLevelRepository.bulkUpsert).mockResolvedValue(undefined);
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([]);
    vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([]);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map());

    await inventoryService.saveRestockLevels(departmentHead, {
      levels: [{ inventoryItemId: itemId, level: '10' }],
    });

    expect(restockLevelRepository.bulkUpsert).toHaveBeenCalledWith(
      branchOrgId,
      departmentLocationId,
      departmentHead.id,
      [{ inventoryItemId: itemId, level: '10' }],
      undefined,
    );
  });
});

describe('inventoryService — Department Head restock scope (Milestone Six S1 fix)', () => {
  it('reads items from the hub catalog but levels and on-hand from the branch department', async () => {
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({
      id: departmentLocationId,
      organizationId: branchOrgId,
      type: 'BRANCH_DEPARTMENT',
      departmentTag: 'KITCHEN',
    } as never);
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([
      buildItem({ id: itemId, departmentTags: ['KITCHEN'] }) as never,
    ]);
    vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([]);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(
      new Map([[itemId, new Prisma.Decimal('9')]]),
    );

    const rows = await inventoryService.listRestockLevels(departmentHead, {});

    // Items are catalog rows on the hub (D-15) — the branch org has none.
    expect(restockLevelRepository.findLiveItemsForRestock).toHaveBeenCalledWith(hubOrgId, { departmentTag: 'KITCHEN', search: undefined });
    expect(restockLevelRepository.findAllByLocation).toHaveBeenCalledWith(branchOrgId, departmentLocationId);
    expect(restockLevelRepository.sumOnHandByItemForLocation).toHaveBeenCalledWith(branchOrgId, departmentLocationId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.onHandQty).toBe('9');
  });

  it('validates a Department Head save against the hub catalog', async () => {
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({
      id: departmentLocationId,
      organizationId: branchOrgId,
      type: 'BRANCH_DEPARTMENT',
      departmentTag: 'KITCHEN',
    } as never);
    vi.mocked(inventoryItemRepository.findLiveByIds).mockResolvedValue([
      buildItem({ id: itemId, departmentTags: ['KITCHEN'] }) as never,
    ]);
    vi.mocked(restockLevelRepository.bulkUpsert).mockResolvedValue(undefined);
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([]);
    vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([]);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map());

    await inventoryService.saveRestockLevels(departmentHead, { levels: [{ inventoryItemId: itemId, level: '10' }] });

    expect(inventoryItemRepository.findLiveByIds).toHaveBeenCalledWith([itemId], hubOrgId);
  });
});

describe('inventoryService — onHandQty and isBelowLevel derivation', () => {
  it('derives isBelowLevel from live ledger sum vs the stored level', async () => {
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([buildItem() as never]);
    vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([
      {
        id: 'rl1',
        organizationId: hubOrgId,
        locationId: centralStoreId,
        inventoryItemId: itemId,
        level: new Prisma.Decimal('100'),
        setById: storeManager.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    ]);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(
      new Map([[itemId, new Prisma.Decimal('40')]]),
    );

    const rows = await inventoryService.listRestockLevels(storeManager, { locationId: centralStoreId });

    expect(rows[0]!.onHandQty).toBe('40');
    expect(rows[0]!.level).toBe('100');
    expect(rows[0]!.isBelowLevel).toBe(true);
  });
});

describe('inventoryService — catalog search by supplier code or name (B6)', () => {
  const sugar = buildItem({ id: 'item-sugar', name: 'Sugar white 50kg' });
  const milk = buildItem({ id: 'item-milk', name: 'Milk 500ml' });
  const samrat = { id: supplierId, name: 'Samrat Supermarket Ltd' };
  const listQuery = (search?: string) => ({ page: 1, perPage: 20, includeRetired: false, needsSetup: false, ...(search ? { search } : {}) });

  beforeEach(() => {
    vi.mocked(inventoryItemRepository.getCatalogMeta).mockResolvedValue({} as never);
  });

  it('passes the search to the repository and asks which supplier lines matched, for the hub', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [sugar], total: 1 } as never);
    await inventoryService.listItems(storeManager, listQuery('190035'));
    expect(inventoryItemRepository.findAllByOrganization).toHaveBeenCalledWith(hubOrgId, expect.objectContaining({ search: '190035' }));
    expect(inventoryItemRepository.findSearchMatches).toHaveBeenCalledWith(hubOrgId, ['item-sugar'], '190035');
  });

  it('matchedOn names the supplier, field and value when their code matched', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [sugar], total: 1 } as never);
    vi.mocked(inventoryItemRepository.findSearchMatches).mockResolvedValue([
      { inventoryItemId: 'item-sugar', supplierItemName: 'Kabras sugar 50kg', supplierItemCode: '190035', supplier: samrat },
    ] as never);

    const { data } = await inventoryService.listItems(storeManager, listQuery('190035'));
    expect(data[0]!.matchedOn).toEqual({ supplier: samrat, field: 'supplierItemCode', value: '190035' });
  });

  it('matchedOn reports their item name (partial, any case) when only the name matched', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [sugar], total: 1 } as never);
    vi.mocked(inventoryItemRepository.findSearchMatches).mockResolvedValue([
      { inventoryItemId: 'item-sugar', supplierItemName: 'Kabras sugar 50kg', supplierItemCode: '190035', supplier: samrat },
    ] as never);

    const { data } = await inventoryService.listItems(storeManager, listQuery('KABRAS'));
    expect(data[0]!.matchedOn).toEqual({ supplier: samrat, field: 'supplierItemName', value: 'Kabras sugar 50kg' });
  });

  it('prefers the exact code over a name hit when both match', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [sugar], total: 1 } as never);
    vi.mocked(inventoryItemRepository.findSearchMatches).mockResolvedValue([
      { inventoryItemId: 'item-sugar', supplierItemName: 'Code 77 sugar', supplierItemCode: 'X1', supplier: samrat },
      { inventoryItemId: 'item-sugar', supplierItemName: 'Other', supplierItemCode: '77', supplier: { id: 's2', name: 'Other Ltd' } },
    ] as never);

    const { data } = await inventoryService.listItems(storeManager, listQuery('77'));
    expect(data[0]!.matchedOn).toMatchObject({ field: 'supplierItemCode', value: '77', supplier: { id: 's2' } });
  });

  it('matchedOn is null when our own item name matched, even if a supplier line matched too', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [sugar], total: 1 } as never);
    vi.mocked(inventoryItemRepository.findSearchMatches).mockResolvedValue([
      { inventoryItemId: 'item-sugar', supplierItemName: 'Sugar 50kg', supplierItemCode: '1', supplier: samrat },
    ] as never);

    const { data } = await inventoryService.listItems(storeManager, listQuery('sugar'));
    expect(data[0]!.matchedOn).toBeNull();
  });

  it('matchedOn is only set on the rows a supplier line explains, and is null with no search', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [sugar, milk], total: 2 } as never);
    vi.mocked(inventoryItemRepository.findSearchMatches).mockResolvedValue([
      { inventoryItemId: 'item-sugar', supplierItemName: null, supplierItemCode: '190035', supplier: samrat },
    ] as never);
    const hit = await inventoryService.listItems(storeManager, listQuery('190035'));
    expect(hit.data.map((r) => r.matchedOn?.field ?? null)).toEqual(['supplierItemCode', null]);

    vi.mocked(inventoryItemRepository.findSearchMatches).mockClear();
    const none = await inventoryService.listItems(storeManager, listQuery());
    expect(none.data.every((r) => r.matchedOn === null)).toBe(true);
    expect(inventoryItemRepository.findSearchMatches).not.toHaveBeenCalled();
  });

  it('rows validate against the list-row contract', async () => {
    const { InventoryItemListRowSchema } = await import('./inventory-validators');
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [buildItem({ name: 'Sugar white 50kg' })], total: 1 } as never);
    vi.mocked(inventoryItemRepository.findSearchMatches).mockResolvedValue([
      { inventoryItemId: itemId, supplierItemName: null, supplierItemCode: '190035', supplier: { id: supplierId, name: 'Samrat' } },
    ] as never);
    const { data } = await inventoryService.listItems(storeManager, listQuery('190035'));
    expect(data[0]!.matchedOn).not.toBeNull();
    expect(() => InventoryItemListRowSchema.parse(data[0])).not.toThrow();
  });
});

describe('inventoryService — item page lists who sells it, with their names (B5)', () => {
  it('returns every supplier pack line with their name and code, ours stays the item name', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem({ name: 'Sugar white' }) as never);
    vi.mocked(supplierItemRepository.listForItem).mockResolvedValue([
      {
        id: 'line1', supplierId, inventoryItemId: itemId, supplierItemName: 'Kabras sugar 50kg', supplierItemCode: '190035',
        buyUnit: 'bag', packSize: new Prisma.Decimal('50'), lastPrice: new Prisma.Decimal('5000'), lastPriceAt: new Date('2026-10-01T09:00:00.000Z'),
        isPreferred: true, preferredNeedsConfirm: true, supplier: { id: supplierId, code: 'SUPPLIER-0003', name: 'Samrat' },
      },
      {
        id: 'line2', supplierId, inventoryItemId: itemId, supplierItemName: null, supplierItemCode: null,
        buyUnit: 'packet', packSize: new Prisma.Decimal('2'), lastPrice: null, lastPriceAt: null,
        isPreferred: false, preferredNeedsConfirm: false, supplier: { id: supplierId, code: 'SUPPLIER-0003', name: 'Samrat' },
      },
    ] as never);

    const item = await inventoryService.getItemById(storeManager, itemId);
    expect(supplierItemRepository.listForItem).toHaveBeenCalledWith(itemId, hubOrgId);
    expect(item.name).toBe('Sugar white');
    expect(item.suppliers).toHaveLength(2);
    expect(item.suppliers[0]).toEqual({
      lineId: 'line1', supplierId, supplierCode: 'SUPPLIER-0003', supplierName: 'Samrat',
      supplierItemName: 'Kabras sugar 50kg', supplierItemCode: '190035', buyUnit: 'bag', packSize: '50',
      lastPrice: '5000', lastPriceAt: '2026-10-01T09:00:00.000Z', isPreferred: true, preferredNeedsConfirm: true,
    });
    expect(item.suppliers[1]).toMatchObject({ supplierItemName: null, packSize: '2', lastPrice: null });
  });

  it('is empty when nobody sells it yet', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem() as never);
    expect((await inventoryService.getItemById(storeManager, itemId)).suppliers).toEqual([]);
  });
});
