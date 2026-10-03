/**
 * Contract drift guard (plan §5.1, §6.2): asserts the service's actual
 * serialized output satisfies the response schemas declared in
 * inventory-validators.ts. A shape mismatch here fails CI instead of
 * surfacing as a runtime bug against the hand-mirrored frontend types.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { inventoryService } from './inventory-service';
import { categoryRepository, inventoryItemRepository, restockLevelRepository } from './inventory-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import {
  CategorySchema,
  CentralStoreLocationSchema,
  InventoryItemSchema,
  ItemMutationResponseSchema,
  RestockLevelRowSchema,
} from './inventory-validators';

vi.mock('./inventory-repository', () => ({
  categoryRepository: {
    findAllByOrganization: vi.fn(),
    findByLiveName: vi.fn(),
    create: vi.fn(),
  },
  inventoryItemRepository: {
    findLiveByName: vi.fn(),
    create: vi.fn(),
  },
  restockLevelRepository: {
    findLiveItemsForRestock: vi.fn(),
    findByItemIdsForLocation: vi.fn(),
    findAllByLocation: vi.fn(),
    sumOnHandByItemForLocation: vi.fn(),
    findUseByItemForLocation: vi.fn(),
  },
}));

vi.mock('../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn() },
}));

vi.mock('../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn() },
}));

vi.mock('../../config/database', () => ({
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const centralStoreId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const categoryId = '44444444-4444-4444-8444-444444444444';
const supplierId = '55555555-5555-4555-8555-555555555555';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId, isHub: true, isActive: true } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue({
    id: centralStoreId,
    organizationId: hubOrgId,
    type: 'CENTRAL_STORE',
  } as never);
  vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(new Map());
});

describe('Inventory contract drift guard', () => {
  it('CentralStoreLocationSchema accepts getCentralStoreLocation output', async () => {
    const location = await inventoryService.getCentralStoreLocation(storeManager);
    expect(() => CentralStoreLocationSchema.parse(location)).not.toThrow();
  });

  it('CategorySchema accepts listCategories output', async () => {
    vi.mocked(categoryRepository.findAllByOrganization).mockResolvedValue([
      {
        id: categoryId,
        organizationId: hubOrgId,
        name: 'Dry items',
        itemCount: 5,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    const [category] = await inventoryService.listCategories(storeManager, false);
    expect(() => CategorySchema.parse(category)).not.toThrow();
  });

  it('ItemMutationResponseSchema accepts createItem output, warnings included', async () => {
    vi.mocked(inventoryItemRepository.findLiveByName).mockResolvedValue({ id: 'dup-id' } as never);
    vi.mocked(inventoryItemRepository.create).mockResolvedValue({
      id: itemId,
      organizationId: hubOrgId,
      name: 'Kabras Sugar 1kg',
      type: 'RAW_INGREDIENT',
      categoryId,
      preferredSupplierId: null,
      buyUnit: 'kg',
      usageUnit: 'kg',
      conversionFactor: new Prisma.Decimal('1'),
      packSize: null,
      departmentTags: [],
      currentCost: new Prisma.Decimal('155'),
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: { id: categoryId, name: 'Dry items' },
      preferredSupplier: null,
    } as never);

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

    expect(() => ItemMutationResponseSchema.parse(result)).not.toThrow();
    expect(() => InventoryItemSchema.parse(result.item)).not.toThrow();
  });

  it('RestockLevelRowSchema accepts listRestockLevels output, including a null level', async () => {
    vi.mocked(restockLevelRepository.findLiveItemsForRestock).mockResolvedValue([
      {
        id: itemId,
        organizationId: hubOrgId,
        name: 'Kabras Sugar 1kg',
        usageUnit: 'kg',
        type: 'RAW_INGREDIENT',
        categoryId: null,
        preferredSupplierId: null,
        buyUnit: 'kg',
        conversionFactor: null,
        packSize: null,
        departmentTags: [],
        currentCost: new Prisma.Decimal('0'),
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);
    vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([]);
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map());
    vi.mocked(restockLevelRepository.findUseByItemForLocation).mockResolvedValue(new Map());

    const rows = await inventoryService.listRestockLevels(storeManager, { locationId: centralStoreId });
    expect(() => RestockLevelRowSchema.parse(rows[0])).not.toThrow();
    expect(rows[0]!.level).toBeNull();
  });
});
