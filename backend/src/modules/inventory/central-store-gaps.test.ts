/**
 * Session 4b (API_CONTRACT.md §30): list filters and counts, usual price, item history with reasons, the item
 * page's on-hand, restock level history and put back. Mocked repositories; DB evidence is in the session log.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { inventoryService } from './inventory-service';
import { inventoryItemRepository, restockChangeRepository, restockLevelRepository } from './inventory-repository';
import { itemChangeRepository } from './item-history-repository';
import { supplierItemRepository, supplierRepository } from './supplier-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import {
  InventoryItemListRowSchema,
  ItemCatalogMetaSchema,
  ItemHistoryEntrySchema,
  RestockHistoryEntrySchema,
  RestoreItemSchema,
  RetireItemQuerySchema,
  UpdateItemSchema,
} from './inventory-validators';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';

vi.mock('./inventory-repository', () => ({
  categoryRepository: {},
  inventoryItemRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    findLiveByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    retire: vi.fn(),
    restore: vi.fn(),
    getCatalogMeta: vi.fn(),
    findSearchMatches: vi.fn(),
    findNeedsSetupIds: vi.fn(),
    countCreatedSince: vi.fn(),
    countLiveByType: vi.fn(),
    countSuppliersByItem: vi.fn(),
  },
  itemChangeReviewRepository: { counts: vi.fn() },
  restockLevelRepository: {
    findAllByLocation: vi.fn(),
    findByItemIdsForLocation: vi.fn(),
    findLiveItemIds: vi.fn(),
    sumOnHandByItemForLocation: vi.fn(),
    bulkUpsert: vi.fn(),
  },
  restockChangeRepository: { list: vi.fn(), findById: vi.fn(), findLatest: vi.fn() },
}));
vi.mock('./item-history-repository', () => ({
  itemChangeRepository: { record: vi.fn(), list: vi.fn(), countAttendantCreatedSince: vi.fn() },
}));
vi.mock('./supplier-repository', () => ({
  supplierRepository: { findById: vi.fn() },
  supplierItemRepository: { applyPreferred: vi.fn(), listForItem: vi.fn() },
  supplierAuditRepository: { create: vi.fn() },
}));
vi.mock('../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn(), findById: vi.fn() } }));
vi.mock('../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn(), findByOrganizationTypeDepartment: vi.fn() },
}));
const tx = { marker: 'tx' };
vi.mock('../../config/database', () => ({
  prisma: { $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)), inventoryTransaction: { groupBy: vi.fn() } },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const townOrgId = '22222222-2222-4222-8222-222222222222';
const centralStoreId = '33333333-3333-4333-8333-333333333333';
const townKitchenId = '77777777-7777-4777-8777-777777777778';
const townPastryId = '77777777-7777-4777-8777-777777777779';
const itemId = '44444444-4444-4444-8444-444444444444';
const itemB = '44444444-4444-4444-8444-444444444445';
const itemC = '44444444-4444-4444-8444-444444444446';
const changeId = '88888888-8888-4888-8888-888888888888';
const userId = '99999999-9999-4999-8999-999999999991';
const catId = '55555555-5555-4555-8555-555555555555';
const newEntryId = '88888888-8888-4888-8888-888888888889';

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };
const attendant = { id: 'att1', role: 'STORE_ATTENDANT' as const, organizationId: hubOrgId };
const kitchenHead = { id: 'dh1', role: 'CHEF' as const, organizationId: townOrgId, isDepartmentHead: true, departmentTag: 'KITCHEN' as const };

const hubOrg = { id: hubOrgId, name: 'Wendo Central Kitchen', isHub: true, isActive: true };
const townOrg = { id: townOrgId, name: 'Nyeri Town', isHub: false, isActive: true };
const centralStore = { id: centralStoreId, organizationId: hubOrgId, type: 'CENTRAL_STORE' as const };
const townKitchen = { id: townKitchenId, organizationId: townOrgId, type: 'BRANCH_DEPARTMENT' as const, departmentTag: 'KITCHEN' as const };

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: itemId,
  organizationId: hubOrgId,
  name: 'Brown sugar',
  type: 'STOCKED' as const,
  categoryId: catId,
  preferredSupplierId: null,
  buyUnit: 'bag',
  usageUnit: 'kg',
  conversionFactor: new Prisma.Decimal('50'),
  packSize: new Prisma.Decimal('50'),
  departmentTags: ['KITCHEN'] as string[],
  currentCost: new Prisma.Decimal('178'),
  deletedAt: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  category: { id: catId, name: 'Dry goods' },
  preferredSupplier: null,
  ...overrides,
});

const listQuery = { page: 1, perPage: 20, includeRetired: false, needsSetup: false, lowOrOut: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue(hubOrg as never);
  vi.mocked(branchRepository.findById).mockImplementation(async (id: string) => (id === townOrgId ? (townOrg as never) : id === hubOrgId ? (hubOrg as never) : null));
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
  vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockImplementation(async (org: string, _t: unknown, tag: string) =>
    org === townOrgId && tag === 'KITCHEN' ? (townKitchen as never) : org === townOrgId && tag === 'PASTRY' ? ({ ...townKitchen, id: townPastryId, departmentTag: 'PASTRY' } as never) : null,
  );
  vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [], total: 0 } as never);
  vi.mocked(inventoryItemRepository.findNeedsSetupIds).mockResolvedValue([]);
  vi.mocked(inventoryItemRepository.countCreatedSince).mockResolvedValue(0);
  vi.mocked(inventoryItemRepository.countLiveByType).mockResolvedValue({ STOCKED: 0, RAW_INGREDIENT: 0, PREPPED: 0 });
  vi.mocked(inventoryItemRepository.countSuppliersByItem).mockResolvedValue(new Map());
  vi.mocked(inventoryItemRepository.findLiveByName).mockResolvedValue(null);
  vi.mocked(inventoryItemRepository.getCatalogMeta).mockResolvedValue({
    itemsTracked: 3, typesRepresented: 1, categoryCount: 0, retiredCategoryCount: 0, departmentCount: 1, supplierCount: 0,
  });
  vi.mocked(itemChangeRepository.countAttendantCreatedSince).mockResolvedValue(0);
  vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([]);
  vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(new Map());
  vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map());
  vi.mocked(restockLevelRepository.findLiveItemIds).mockResolvedValue([itemId, itemB, itemC]);
  vi.mocked(supplierItemRepository.listForItem).mockResolvedValue([]);
});

/** Level 10 at the Central Store for A (on hand 0: out) and B (on hand 20: ok), none for C. */
const lowAndOutSetup = () => {
  vi.mocked(restockLevelRepository.findAllByLocation).mockResolvedValue([
    { inventoryItemId: itemId, level: new Prisma.Decimal('10') },
    { inventoryItemId: itemB, level: new Prisma.Decimal('10') },
  ] as never);
  vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(
    new Map([[itemId, new Prisma.Decimal('0')], [itemB, new Prisma.Decimal('20')]]),
  );
};

describe('catalog list: filters, sort and counts (§30.1)', () => {
  it('lowOrOut=true lists only the Central Store items below their level', async () => {
    lowAndOutSetup();
    await inventoryService.listItems(storeManager, { ...listQuery, lowOrOut: true });
    expect(vi.mocked(inventoryItemRepository.findAllByOrganization).mock.calls[0]![1]).toMatchObject({ onlyIds: [itemId] });
  });

  it('lowOrOut with needsSetup lists items in both, and none when they do not overlap', async () => {
    lowAndOutSetup();
    vi.mocked(inventoryItemRepository.findNeedsSetupIds).mockResolvedValue([itemId, itemC]);
    await inventoryService.listItems(storeManager, { ...listQuery, lowOrOut: true, needsSetup: true });
    expect(vi.mocked(inventoryItemRepository.findAllByOrganization).mock.calls[0]![1]).toMatchObject({ onlyIds: [itemId] });

    vi.mocked(inventoryItemRepository.findNeedsSetupIds).mockResolvedValue([itemC]);
    await inventoryService.listItems(storeManager, { ...listQuery, lowOrOut: true, needsSetup: true });
    expect(vi.mocked(inventoryItemRepository.findAllByOrganization).mock.calls[1]![1]).toMatchObject({ onlyIds: [] });
  });

  it('only the Store Manager may filter by restock level', async () => {
    await expect(inventoryService.listItems(attendant, { ...listQuery, lowOrOut: true })).rejects.toThrow(ForbiddenError);
    expect(inventoryItemRepository.findAllByOrganization).not.toHaveBeenCalled();
  });

  it('passes the sort through, and leaves it unset when none was asked for', async () => {
    await inventoryService.listItems(storeManager, { ...listQuery, sort: 'newest' });
    await inventoryService.listItems(storeManager, listQuery);
    expect(vi.mocked(inventoryItemRepository.findAllByOrganization).mock.calls[0]![1]).toMatchObject({ sort: 'newest' });
    expect(vi.mocked(inventoryItemRepository.findAllByOrganization).mock.calls[1]![1].sort).toBeUndefined();
  });

  it('rows carry their supplier count, and meta carries the type counts and the attendant count', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [buildItem(), buildItem({ id: itemB, name: 'Flour' })], total: 2 } as never);
    vi.mocked(inventoryItemRepository.countSuppliersByItem).mockResolvedValue(new Map([[itemId, 2]]));
    vi.mocked(inventoryItemRepository.countLiveByType).mockResolvedValue({ STOCKED: 61, RAW_INGREDIENT: 54, PREPPED: 33 });
    vi.mocked(itemChangeRepository.countAttendantCreatedSince).mockResolvedValue(1);

    const { data, meta } = await inventoryService.listItems(storeManager, listQuery);
    expect(data.map((row) => row.supplierCount)).toEqual([2, 0]);
    expect(meta).toMatchObject({ typeCounts: { STOCKED: 61, RAW_INGREDIENT: 54, PREPPED: 33 }, addedByAttendant: 1 });
    expect(() => ItemCatalogMetaSchema.parse(meta)).not.toThrow();
    expect(() => InventoryItemListRowSchema.parse(data[0])).not.toThrow();
  });

  it('the attendant sees the supplier count and the type counts, but still no money', async () => {
    vi.mocked(inventoryItemRepository.findAllByOrganization).mockResolvedValue({ items: [buildItem()], total: 1 } as never);
    vi.mocked(inventoryItemRepository.countSuppliersByItem).mockResolvedValue(new Map([[itemId, 3]]));
    const { data, meta } = await inventoryService.listItems(attendant, listQuery);
    expect(data[0]).toMatchObject({ supplierCount: 3 });
    expect(data[0]).not.toHaveProperty('currentCost');
    expect(meta.lowOrOut).toBeNull();
    expect(meta.typeCounts).toBeDefined();
  });
});

describe('item page: Central Store on hand and who set a price (§30.1)', () => {
  const line = (overrides: Record<string, unknown> = {}) => ({
    id: 'line1',
    supplier: { id: 'sup1', code: 'SUPPLIER-0001', name: 'Samrat Supermarket Ltd' },
    supplierItemName: 'Sugar Brown 50KG',
    supplierItemCode: '190021',
    buyUnit: 'bag',
    packSize: new Prisma.Decimal('50'),
    lastPrice: new Prisma.Decimal('8900'),
    lastPriceAt: new Date('2026-10-12T09:58:00Z'),
    lastPriceSetBy: { id: userId, name: 'Isabel Njoki' },
    isPreferred: true,
    preferredNeedsConfirm: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem() as never);
    vi.mocked(supplierItemRepository.listForItem).mockResolvedValue([line()] as never);
  });

  it('the Store Manager gets the Central Store on hand (only that location) and who set each price', async () => {
    vi.mocked(restockLevelRepository.sumOnHandByItemForLocation).mockResolvedValue(new Map([[itemId, new Prisma.Decimal('42')]]));
    const result = await inventoryService.getItemById(storeManager, itemId);
    expect(restockLevelRepository.sumOnHandByItemForLocation).toHaveBeenCalledWith(hubOrgId, centralStoreId, [itemId]);
    expect(result).toMatchObject({ centralStoreOnHand: '42' });
    expect((result as { suppliers: Array<{ lastPriceSetBy: unknown }> }).suppliers[0]!.lastPriceSetBy).toEqual({ id: userId, name: 'Isabel Njoki' });
  });

  it('is "0" when nothing is on hand, and null set-by when the price came from a receipt', async () => {
    vi.mocked(supplierItemRepository.listForItem).mockResolvedValue([line({ lastPriceSetBy: null })] as never);
    const result = await inventoryService.getItemById(storeManager, itemId);
    expect(result).toMatchObject({ centralStoreOnHand: '0' });
    expect((result as { suppliers: Array<{ lastPriceSetBy: unknown }> }).suppliers[0]!.lastPriceSetBy).toBeNull();
  });

  it('the attendant gets neither on hand nor any price field', async () => {
    const result = (await inventoryService.getItemById(attendant, itemId)) as unknown as Record<string, unknown> & { suppliers: Array<Record<string, unknown>> };
    expect(result).not.toHaveProperty('centralStoreOnHand');
    expect(result.suppliers[0]).not.toHaveProperty('lastPrice');
    expect(result.suppliers[0]).not.toHaveProperty('lastPriceSetBy');
    expect(restockLevelRepository.sumOnHandByItemForLocation).not.toHaveBeenCalled();
  });
});

describe('usual price on create (§30.2)', () => {
  const create = {
    name: 'Brown sugar', type: 'STOCKED' as const, buyUnit: 'bag', usageUnit: 'kg', conversionFactor: '50', packSize: '50',
    departmentTags: ['KITCHEN' as const], usualPrice: '8900',
  };

  beforeEach(() => {
    vi.mocked(inventoryItemRepository.create).mockResolvedValue(buildItem() as never);
  });

  it('stores the cost per usage unit: KES 8,900 a 50 kg bag is KES 178 a kg, and creates no supplier line', async () => {
    await inventoryService.createItem(storeManager, create as never);
    const data = vi.mocked(inventoryItemRepository.create).mock.calls[0]![1];
    expect((data.currentCost as Prisma.Decimal).toString()).toBe('178');
    expect(supplierItemRepository.applyPreferred).not.toHaveBeenCalled();
  });

  it('with no conversion the price is already per usage unit; with no price the cost is left to the default', async () => {
    await inventoryService.createItem(storeManager, { ...create, conversionFactor: null, packSize: null, usualPrice: '480' } as never);
    expect((vi.mocked(inventoryItemRepository.create).mock.calls[0]![1].currentCost as Prisma.Decimal).toString()).toBe('480');

    await inventoryService.createItem(storeManager, { ...create, usualPrice: undefined } as never);
    expect(vi.mocked(inventoryItemRepository.create).mock.calls[1]![1].currentCost).toBeUndefined();
  });

  it('rounds to four decimals', async () => {
    await inventoryService.createItem(storeManager, { ...create, conversionFactor: '3', usualPrice: '100' } as never);
    expect((vi.mocked(inventoryItemRepository.create).mock.calls[0]![1].currentCost as Prisma.Decimal).toString()).toBe('33.3333');
  });

  it('an attendant may not send a price', async () => {
    await expect(
      inventoryService.createItem(attendant, { ...create, departmentTags: [] } as never),
    ).rejects.toThrow(ForbiddenError);
    expect(inventoryItemRepository.create).not.toHaveBeenCalled();
  });

  it('writes a CREATED history row in the same transaction, with the usual price in it', async () => {
    await inventoryService.createItem(storeManager, create as never);
    expect(itemChangeRepository.record).toHaveBeenCalledTimes(1);
    const [client, row] = vi.mocked(itemChangeRepository.record).mock.calls[0]!;
    expect(client).toBe(tx);
    expect(row).toMatchObject({ kind: 'CREATED', summary: 'created the item', inventoryItemId: itemId, changedById: 'sm1', organizationId: hubOrgId });
    expect(row.after).toMatchObject({ name: 'Brown sugar', usualPrice: '8900' });
  });

  it('an attendant-created item is recorded with the attendant as the creator', async () => {
    await inventoryService.createItem(attendant, { name: 'Tomato paste', type: 'RAW_INGREDIENT', buyUnit: 'tin', usageUnit: 'g', conversionFactor: '400', packSize: '400', departmentTags: [] } as never);
    expect(vi.mocked(itemChangeRepository.record).mock.calls[0]![1]).toMatchObject({ kind: 'CREATED', changedById: 'att1' });
  });
});

describe('item history on edit, retire and restore (§30.4)', () => {
  beforeEach(() => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem({ conversionFactor: new Prisma.Decimal('25'), packSize: new Prisma.Decimal('25') }) as never);
  });

  it('an edit writes one UPDATED row with a sentence, the changed fields and the reason', async () => {
    vi.mocked(inventoryItemRepository.update).mockResolvedValue(buildItem({ conversionFactor: new Prisma.Decimal('24'), packSize: new Prisma.Decimal('24') }) as never);
    await inventoryService.updateItem(storeManager, itemId, { conversionFactor: '24', packSize: '24', reason: 'Supplier changed the pack' });

    expect(itemChangeRepository.record).toHaveBeenCalledTimes(1);
    expect(vi.mocked(itemChangeRepository.record).mock.calls[0]![1]).toMatchObject({
      kind: 'UPDATED',
      summary: 'changed the pack from 1 bag = 25 kg to 1 bag = 24 kg',
      reason: 'Supplier changed the pack',
      before: { conversionFactor: '25' },
      after: { conversionFactor: '24' },
      changedById: 'sm1',
    });
  });

  it('the reason is optional: an edit without one stores none', async () => {
    vi.mocked(inventoryItemRepository.update).mockResolvedValue(buildItem({ name: 'Brown sugar 2' }) as never);
    await inventoryService.updateItem(storeManager, itemId, { name: 'Brown sugar 2' });
    expect(vi.mocked(itemChangeRepository.record).mock.calls[0]![1].reason).toBeUndefined();
  });

  it('an edit that changes nothing the history tracks (a restock level only) writes no row', async () => {
    vi.mocked(inventoryItemRepository.update).mockResolvedValue(buildItem({ conversionFactor: new Prisma.Decimal('25'), packSize: new Prisma.Decimal('25') }) as never);
    await inventoryService.updateItem(storeManager, itemId, { centralStoreRestockLevel: '100' });
    expect(itemChangeRepository.record).not.toHaveBeenCalled();
  });

  it('a reason on its own is not an edit (the schema), but it rides along with a real change', () => {
    expect(UpdateItemSchema.safeParse({ reason: 'x' }).success).toBe(false);
    expect(UpdateItemSchema.safeParse({ name: 'x', reason: 'y' }).success).toBe(true);
    expect(UpdateItemSchema.safeParse({ name: 'x', reason: 'y'.repeat(201) }).success).toBe(false);
    expect(RetireItemQuerySchema.parse({ reason: ' Added twice ' })).toEqual({ reason: 'Added twice' });
    expect(RestoreItemSchema.parse(undefined)).toEqual({});
  });

  it('retiring and restoring each write a row with the reason; a miss writes nothing', async () => {
    vi.mocked(inventoryItemRepository.retire).mockResolvedValue(buildItem({ deletedAt: new Date() }) as never);
    await inventoryService.retireItem(storeManager, itemId, 'Added twice');
    expect(inventoryItemRepository.retire).toHaveBeenCalledWith(itemId, hubOrgId, tx);
    expect(vi.mocked(itemChangeRepository.record).mock.calls[0]![1]).toMatchObject({ kind: 'RETIRED', summary: 'retired the item', reason: 'Added twice' });

    vi.mocked(inventoryItemRepository.restore).mockResolvedValue(buildItem() as never);
    await inventoryService.restoreItem(storeManager, itemId);
    expect(vi.mocked(itemChangeRepository.record).mock.calls[1]![1]).toMatchObject({ kind: 'RESTORED', summary: 'restored the item' });

    vi.mocked(itemChangeRepository.record).mockClear();
    vi.mocked(inventoryItemRepository.retire).mockResolvedValue(null);
    await expect(inventoryService.retireItem(storeManager, itemId)).rejects.toThrow(NotFoundError);
    expect(itemChangeRepository.record).not.toHaveBeenCalled();
  });
});

describe('GET /items/:id/history (§30.4)', () => {
  it('lists newest first with who and what, satisfying the contract', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(buildItem() as never);
    vi.mocked(itemChangeRepository.list).mockResolvedValue([
      { id: changeId, kind: 'UPDATED', summary: 'renamed it from A to B', reason: null, before: { name: 'A' }, after: { name: 'B' }, changedBy: { id: userId, name: 'Isabel Njoki' }, createdAt: new Date('2026-10-12T09:58:00Z') },
    ] as never);
    const entries = await inventoryService.getItemHistory(storeManager, itemId, 50);
    expect(itemChangeRepository.list).toHaveBeenCalledWith(itemId, hubOrgId, 50);
    expect(entries).toHaveLength(1);
    expect(() => ItemHistoryEntrySchema.parse(entries[0])).not.toThrow();
    expect(entries[0]).toMatchObject({ summary: 'renamed it from A to B', changedBy: { name: 'Isabel Njoki' } });
  });

  it('404s for an item that is not in the org', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue(null);
    await expect(inventoryService.getItemHistory(storeManager, itemId, 50)).rejects.toThrow(NotFoundError);
  });
});

describe('restock level history and put back (§30.5)', () => {
  const changeRow = (overrides: Record<string, unknown> = {}) => ({
    id: changeId,
    organizationId: hubOrgId,
    locationId: centralStoreId,
    inventoryItemId: itemId,
    oldLevel: new Prisma.Decimal('150'),
    newLevel: new Prisma.Decimal('180'),
    reason: 'Used the suggestion',
    createdAt: new Date('2026-10-12T10:20:00Z'),
    changedBy: { id: userId, name: 'Isabel Njoki' },
    inventoryItem: { id: itemId, name: 'Sugar, white', usageUnit: 'kg', deletedAt: null },
    location: { id: centralStoreId, type: 'CENTRAL_STORE', organizationId: hubOrgId },
    ...overrides,
  });

  describe('history', () => {
    it('lists one item at the Central Store, newest first, in the contract shape', async () => {
      vi.mocked(restockChangeRepository.list).mockResolvedValue([changeRow()] as never);
      const entries = await inventoryService.listRestockHistory(storeManager, { scope: 'CENTRAL_STORE', inventoryItemId: itemId, limit: 50 });
      expect(restockChangeRepository.list).toHaveBeenCalledWith(hubOrgId, centralStoreId, { inventoryItemId: itemId, limit: 50 });
      expect(entries[0]).toMatchObject({ itemName: 'Sugar, white', usageUnit: 'kg', oldLevel: '150', newLevel: '180', reason: 'Used the suggestion' });
      expect(() => RestockHistoryEntrySchema.parse(entries[0])).not.toThrow();
    });

    it('a Store Manager can read a branch department by naming the branch', async () => {
      vi.mocked(restockChangeRepository.list).mockResolvedValue([]);
      await inventoryService.listRestockHistory(storeManager, { scope: 'KITCHEN', branchId: townOrgId, limit: 20 });
      expect(restockChangeRepository.list).toHaveBeenCalledWith(townOrgId, townKitchenId, { inventoryItemId: undefined, limit: 20 });
    });

    it('a department head gets their own department, and cannot name another', async () => {
      vi.mocked(restockChangeRepository.list).mockResolvedValue([]);
      await inventoryService.listRestockHistory(kitchenHead, { limit: 20 });
      expect(restockChangeRepository.list).toHaveBeenCalledWith(townOrgId, townKitchenId, { inventoryItemId: undefined, limit: 20 });
      await expect(inventoryService.listRestockHistory(kitchenHead, { scope: 'PASTRY', branchId: townOrgId, limit: 20 })).rejects.toThrow(ForbiddenError);
    });

    it('a cleared level reads as newLevel null', async () => {
      vi.mocked(restockChangeRepository.list).mockResolvedValue([changeRow({ newLevel: null })] as never);
      const [entry] = await inventoryService.listRestockHistory(storeManager, { scope: 'CENTRAL_STORE', limit: 50 });
      expect(entry!.newLevel).toBeNull();
    });
  });

  describe('put back', () => {
    beforeEach(() => {
      vi.mocked(restockChangeRepository.findById).mockResolvedValue(changeRow() as never);
      vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(new Map([[itemId, new Prisma.Decimal('180')]]));
      vi.mocked(restockChangeRepository.findLatest).mockResolvedValue(
        changeRow({ id: newEntryId, oldLevel: new Prisma.Decimal('180'), newLevel: new Prisma.Decimal('150'), reason: 'Put back' }) as never,
      );
    });

    it('restores the level the change replaced through the normal save path, and returns the new entry', async () => {
      const entry = await inventoryService.putBackRestockLevel(storeManager, changeId, {});
      expect(restockLevelRepository.bulkUpsert).toHaveBeenCalledTimes(1);
      const [org, location, actorId, levels, reason] = vi.mocked(restockLevelRepository.bulkUpsert).mock.calls[0]!;
      expect([org, location, actorId, reason]).toEqual([hubOrgId, centralStoreId, 'sm1', 'Put back']);
      expect(levels).toEqual([{ inventoryItemId: itemId, level: new Prisma.Decimal('150') }]);
      expect(entry).toMatchObject({ id: newEntryId, oldLevel: '180', newLevel: '150' });
      expect(() => RestockHistoryEntrySchema.parse(entry)).not.toThrow();
    });

    it('takes a reason of its own when one is given', async () => {
      await inventoryService.putBackRestockLevel(storeManager, changeId, { reason: 'Typed the wrong number' });
      expect(vi.mocked(restockLevelRepository.bulkUpsert).mock.calls[0]![4]).toBe('Typed the wrong number');
    });

    it('400s when the change was the first level (nothing earlier to put back)', async () => {
      vi.mocked(restockChangeRepository.findById).mockResolvedValue(changeRow({ oldLevel: null }) as never);
      await expect(inventoryService.putBackRestockLevel(storeManager, changeId, {})).rejects.toThrow(ValidationError);
      expect(restockLevelRepository.bulkUpsert).not.toHaveBeenCalled();
    });

    it('409s when the level is already at that value', async () => {
      vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(new Map([[itemId, new Prisma.Decimal('150')]]));
      await expect(inventoryService.putBackRestockLevel(storeManager, changeId, {})).rejects.toThrow(ConflictError);
      expect(restockLevelRepository.bulkUpsert).not.toHaveBeenCalled();
    });

    it('puts back a level that has since been cleared', async () => {
      vi.mocked(restockLevelRepository.findByItemIdsForLocation).mockResolvedValue(new Map());
      await inventoryService.putBackRestockLevel(storeManager, changeId, {});
      expect(restockLevelRepository.bulkUpsert).toHaveBeenCalledTimes(1);
    });

    it('404s for an unknown change and for a retired item', async () => {
      vi.mocked(restockChangeRepository.findById).mockResolvedValue(null);
      await expect(inventoryService.putBackRestockLevel(storeManager, changeId, {})).rejects.toThrow(NotFoundError);
      vi.mocked(restockChangeRepository.findById).mockResolvedValue(changeRow({ inventoryItem: { id: itemId, name: 'x', usageUnit: 'kg', deletedAt: new Date() } }) as never);
      await expect(inventoryService.putBackRestockLevel(storeManager, changeId, {})).rejects.toThrow(NotFoundError);
    });

    it('a department head may put back only their own department, an attendant-style actor not at all', async () => {
      // A change at the Central Store is not the Kitchen head's.
      await expect(inventoryService.putBackRestockLevel(kitchenHead, changeId, {})).rejects.toThrow(ForbiddenError);

      // Their own department's change works, at their branch org.
      vi.mocked(restockChangeRepository.findById).mockResolvedValue(
        changeRow({ organizationId: townOrgId, locationId: townKitchenId, location: { id: townKitchenId, type: 'BRANCH_DEPARTMENT', organizationId: townOrgId } }) as never,
      );
      await inventoryService.putBackRestockLevel(kitchenHead, changeId, {});
      expect(vi.mocked(restockLevelRepository.bulkUpsert).mock.calls[0]!.slice(0, 3)).toEqual([townOrgId, townKitchenId, 'dh1']);

      await expect(inventoryService.putBackRestockLevel(attendant, changeId, {})).rejects.toThrow(ForbiddenError);
    });

    it('a Store Manager may put back at a branch department', async () => {
      vi.mocked(restockChangeRepository.findById).mockResolvedValue(
        changeRow({ organizationId: townOrgId, locationId: townKitchenId, location: { id: townKitchenId, type: 'BRANCH_DEPARTMENT', organizationId: townOrgId } }) as never,
      );
      await inventoryService.putBackRestockLevel(storeManager, changeId, {});
      expect(vi.mocked(restockLevelRepository.bulkUpsert).mock.calls[0]!.slice(0, 3)).toEqual([townOrgId, townKitchenId, 'sm1']);
    });
  });
});

describe('supplier repository mock is untouched by these paths', () => {
  it('createItem without a preferred supplier never looks one up', async () => {
    vi.mocked(inventoryItemRepository.create).mockResolvedValue(buildItem() as never);
    await inventoryService.createItem(storeManager, { name: 'x', type: 'STOCKED', buyUnit: 'kg', usageUnit: 'kg', departmentTags: [] } as never);
    expect(supplierRepository.findById).not.toHaveBeenCalled();
  });
});
