import type { Request } from 'express';
import { Prisma, type DepartmentTag } from '@prisma/client';
import {
  categoryRepository,
  inventoryItemRepository,
  restockLevelRepository,
  type CategoryWithItemCount,
  type InventoryItemWithRelations,
} from './inventory-repository';
import { supplierItemRepository, supplierRepository } from './supplier-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { prisma } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { mapPrismaError } from '../../utils/prisma-errors';
import type {
  CentralStoreLocation,
  CreateCategoryInput,
  CreateItemInput,
  ItemCatalogListResponse,
  ItemMutationResponse,
  ListItemsQuery,
  ListRestockLevelsQuery,
  Paginated,
  RestockLevelRow,
  SaveRestockLevelsInput,
  UpdateCategoryInput,
  UpdateItemInput,
} from './inventory.types';

type Actor = NonNullable<Request['user']>;

/**
 * D-15: Central Store data is scoped to the hub org, never the actor's own
 * org — a non-hub actor is rejected with 403 rather than silently reading/
 * writing an empty or wrong-tenant slice (plan §5.2, CENTRAL_STORE_SCOPING_
 * DESIGN.md §4). Every catalog/category/supplier/Central-Store-restock entry
 * point resolves through this, never through `actor.organizationId` directly.
 */
const requireHubOrganization = async (): Promise<string> => {
  const hub = await branchRepository.findHub();
  if (!hub) {
    throw new ValidationError('No hub organization is configured');
  }
  return hub.id;
};

const requireHubActor = async (actor: Actor): Promise<string> => {
  const hubOrgId = await requireHubOrganization();
  if (actor.organizationId !== hubOrgId) {
    throw new ForbiddenError('Only the hub organization may access Central Store inventory data');
  }
  return hubOrgId;
};

/**
 * Read-only carve-out for `listItems` only (added Milestone Four Session A,
 * 2026-09-21): a branch-org Department Head needs to browse the hub's item
 * catalog for the requisition "+ Add an item" picker, even though they sit
 * on a branch org, not the hub — D-15 still applies to every write path and
 * every other read (categories, suppliers, central-store restock), which
 * stay on the strict `requireHubActor` above. Always resolves to the hub
 * org id regardless of the actor's own `organizationId`.
 */
const requireHubOrgForCatalogRead = async (actor: Actor): Promise<string> => {
  const hubOrgId = await requireHubOrganization();
  if (actor.organizationId === hubOrgId || actor.isDepartmentHead) {
    return hubOrgId;
  }
  throw new ForbiddenError('Only the hub organization may access Central Store inventory data');
};

const toDecimalString = (value: Prisma.Decimal | null): string | null => (value === null ? null : value.toString());

const serializeCategory = (category: CategoryWithItemCount) => ({
  id: category.id,
  name: category.name,
  itemCount: category.itemCount,
  retiredAt: category.deletedAt?.toISOString() ?? null,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
});

const serializeItem = (item: InventoryItemWithRelations, centralStoreRestockLevel: Prisma.Decimal | null = null) => ({
  id: item.id,
  name: item.name,
  type: item.type,
  categoryId: item.categoryId,
  preferredSupplierId: item.preferredSupplierId,
  buyUnit: item.buyUnit,
  usageUnit: item.usageUnit,
  conversionFactor: toDecimalString(item.conversionFactor),
  packSize: toDecimalString(item.packSize),
  departmentTags: item.departmentTags,
  category: item.category,
  preferredSupplier: item.preferredSupplier,
  currentCost: item.currentCost.toString(),
  centralStoreRestockLevel: toDecimalString(centralStoreRestockLevel),
  retiredAt: item.deletedAt?.toISOString() ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

/**
 * Raw ingredients may never carry department tags — enforced here (service
 * layer) in addition to the Zod refinement and the DB CHECK constraint
 * (plan §3.2, §5.4 rule 1). Checked on every create/update, including a type
 * change *into* RAW_INGREDIENT while tags are still set.
 */
const assertRawIngredientHasNoDepartments = (
  type: 'RAW_INGREDIENT' | 'PREPPED' | 'STOCKED',
  departmentTags: DepartmentTag[],
): void => {
  if (type === 'RAW_INGREDIENT' && departmentTags.length > 0) {
    throw new ValidationError(
      "Raw ingredients can't be scoped to a department — they're only issued via requisition as prepped or stocked items.",
      'VALIDATION_ERROR',
      { field: 'departmentTags' },
    );
  }
};

/**
 * §5.4 rule 2: a type change away from a department-scoped type is blocked
 * while the item holds non-zero on-hand at any BRANCH_DEPARTMENT location.
 * The ledger is empty in practice this milestone (no write paths exist yet),
 * so this rule's teeth arrive with the ledger's own milestone — implemented
 * now, genuinely exercised later.
 */
const assertTypeChangeDoesNotStrandDepartmentStock = async (
  itemId: string,
  organizationId: string,
  currentType: 'RAW_INGREDIENT' | 'PREPPED' | 'STOCKED',
  nextType: 'RAW_INGREDIENT' | 'PREPPED' | 'STOCKED' | undefined,
): Promise<void> => {
  if (!nextType || nextType === currentType) return;
  if (currentType === 'RAW_INGREDIENT') return; // was never department-scoped

  const departmentSums = await prisma.inventoryTransaction.groupBy({
    by: ['locationId'],
    where: {
      organizationId,
      inventoryItemId: itemId,
      location: { type: 'BRANCH_DEPARTMENT' },
    },
    _sum: { quantity: true },
  });
  const hasNonZeroDepartmentStock = departmentSums.some((row) => !(row._sum.quantity ?? new Prisma.Decimal(0)).isZero());
  if (hasNonZeroDepartmentStock) {
    throw new ConflictError(
      'This item holds stock at a department location — change its type only after that stock reaches zero.',
    );
  }
};

/** Resolves categoryId/categoryName into a concrete categoryId, creating inline when a name is given. */
const resolveCategoryId = async (
  organizationId: string,
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
  tx: Prisma.TransactionClient,
): Promise<string | null | undefined> => {
  if (categoryId !== undefined && categoryId !== null) return categoryId;
  if (categoryName) {
    const existing = await categoryRepository.findByLiveName(organizationId, categoryName, tx);
    if (existing) return existing.id;
    const created = await categoryRepository.create(organizationId, categoryName, tx);
    return created.id;
  }
  if (categoryId === null) return null;
  return undefined;
};

/**
 * Joined into the items read path (list + single item) so the Item Form can
 * show an existing item's Central Store restock level on re-open, and the
 * catalog can carry a restock-level column. Empty map when no Central Store
 * is configured — restock levels are then simply omitted (null), matching
 * the item-write paths' own "if (centralStore)" guard.
 */
const getCentralStoreRestockLevelsByItemId = async (
  organizationId: string,
  inventoryItemIds: string[],
): Promise<Map<string, Prisma.Decimal>> => {
  const centralStore = await locationRepository.findCentralStore();
  if (!centralStore) return new Map();
  return restockLevelRepository.findByItemIdsForLocation(organizationId, centralStore.id, inventoryItemIds);
};

export const inventoryService = {
  /**
   * Lets a hub Store Manager discover the Central Store's locationId to pass
   * to `GET/PUT /inventory/restock-levels`. Added post-freeze (2026-09-15,
   * owner-approved): the frozen contract required the client to already know
   * this id but provided no way to look it up (no "list locations" endpoint
   * in Milestone One scope, and it's not carried in the JWT or user
   * profile) — found when the frontend session wired the real backend in.
   * Minimal and read-only; does not touch the restock-levels contract itself.
   */
  getCentralStoreLocation: async (actor: Actor): Promise<CentralStoreLocation> => {
    const organizationId = await requireHubActor(actor);
    const centralStore = await locationRepository.findCentralStore();
    if (!centralStore || centralStore.organizationId !== organizationId) {
      throw new NotFoundError('No Central Store is configured for this organization');
    }
    return { id: centralStore.id };
  },

  // ── Categories ───────────────────────────────────────────────────────────

  listCategories: async (actor: Actor, includeRetired: boolean) => {
    const organizationId = await requireHubActor(actor);
    const categories = await categoryRepository.findAllByOrganization(organizationId, includeRetired);
    return categories.map(serializeCategory);
  },

  createCategory: async (actor: Actor, input: CreateCategoryInput) => {
    const organizationId = await requireHubActor(actor);
    const existing = await categoryRepository.findByLiveName(organizationId, input.name);
    if (existing) {
      throw new ConflictError('A category with this name already exists');
    }
    const category = await categoryRepository.create(organizationId, input.name);
    return serializeCategory({ ...category, itemCount: 0 });
  },

  renameCategory: async (actor: Actor, id: string, input: UpdateCategoryInput) => {
    const organizationId = await requireHubActor(actor);
    const existing = await categoryRepository.findByLiveName(organizationId, input.name);
    if (existing && existing.id !== id) {
      throw new ConflictError('A category with this name already exists');
    }
    const category = await categoryRepository.rename(id, organizationId, input.name);
    if (!category) throw new NotFoundError('Category not found');
    const itemCount = await categoryRepository.countLiveItems(id, organizationId);
    return serializeCategory({ ...category, itemCount });
  },

  retireCategory: async (actor: Actor, id: string) => {
    const organizationId = await requireHubActor(actor);
    const category = await categoryRepository.retire(id, organizationId);
    if (!category) throw new NotFoundError('Category not found');
    return serializeCategory({ ...category, itemCount: 0 });
  },

  restoreCategory: async (actor: Actor, id: string) => {
    const organizationId = await requireHubActor(actor);
    const target = await categoryRepository.findById(id, organizationId);
    if (!target) throw new NotFoundError('Category not found');
    const existing = await categoryRepository.findByLiveName(organizationId, target.name);
    if (existing) {
      throw new ConflictError('A live category already holds this name');
    }
    const category = await categoryRepository.restore(id, organizationId);
    if (!category) throw new NotFoundError('Category not found');
    return serializeCategory({ ...category, itemCount: 0 });
  },

  // ── Items ────────────────────────────────────────────────────────────────

  listItems: async (actor: Actor, query: ListItemsQuery): Promise<ItemCatalogListResponse> => {
    const organizationId = await requireHubOrgForCatalogRead(actor);
    const { items, total } = await inventoryItemRepository.findAllByOrganization(organizationId, {
      search: query.search,
      type: query.type,
      categoryId: query.categoryId,
      departmentTag: query.departmentTag,
      includeRetired: query.includeRetired,
      page: query.page,
      perPage: query.perPage,
    });
    const meta = await inventoryItemRepository.getCatalogMeta(organizationId);
    const restockLevelsByItemId = await getCentralStoreRestockLevelsByItemId(
      organizationId,
      items.map((item) => item.id),
    );

    return {
      data: items.map((item) => serializeItem(item, restockLevelsByItemId.get(item.id) ?? null)),
      pagination: {
        total,
        page: query.page,
        perPage: query.perPage,
        totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      },
      meta,
    };
  },

  getItemById: async (actor: Actor, id: string) => {
    const organizationId = await requireHubActor(actor);
    const item = await inventoryItemRepository.findById(id, organizationId);
    if (!item) throw new NotFoundError('Inventory item not found');
    const restockLevelsByItemId = await getCentralStoreRestockLevelsByItemId(organizationId, [item.id]);
    return serializeItem(item, restockLevelsByItemId.get(item.id) ?? null);
  },

  createItem: async (actor: Actor, input: CreateItemInput): Promise<ItemMutationResponse> => {
    const organizationId = await requireHubActor(actor);
    assertRawIngredientHasNoDepartments(input.type, input.departmentTags);

    if (input.preferredSupplierId) {
      const supplier = await supplierRepository.findById(input.preferredSupplierId, organizationId);
      if (!supplier) {
        throw new ValidationError('preferredSupplierId does not reference a known supplier');
      }
    }

    const duplicate = await inventoryItemRepository.findLiveByName(organizationId, input.name);

    const item = await prisma.$transaction(async (tx) => {
      const categoryId = await resolveCategoryId(organizationId, input.categoryId, input.categoryName, tx);
      const created = await inventoryItemRepository.create(
        organizationId,
        {
          name: input.name,
          type: input.type,
          categoryId: categoryId ?? null,
          preferredSupplierId: input.preferredSupplierId ?? null,
          buyUnit: input.buyUnit,
          usageUnit: input.usageUnit,
          conversionFactor: input.conversionFactor ?? null,
          packSize: input.packSize ?? null,
          departmentTags: input.departmentTags,
        },
        tx,
      );
      // Keep SupplierItem.isPreferred in step with the legacy pointer.
      if (input.preferredSupplierId) {
        await supplierItemRepository.applyPreferred(organizationId, created.id, input.preferredSupplierId, tx);
      }
      return created;
    }).catch((error: unknown) => mapPrismaError(error, { conflict: 'An item with this name already exists' }));

    if (input.centralStoreRestockLevel != null) {
      const centralStore = await locationRepository.findCentralStore();
      if (centralStore) {
        await restockLevelRepository.bulkUpsert(organizationId, centralStore.id, actor.id, [
          { inventoryItemId: item.id, level: input.centralStoreRestockLevel },
        ]);
      }
    }

    const restockLevelsByItemId = await getCentralStoreRestockLevelsByItemId(organizationId, [item.id]);

    return {
      item: serializeItem(item, restockLevelsByItemId.get(item.id) ?? null),
      warnings: duplicate
        ? [{ code: 'DUPLICATE_ITEM_NAME' as const, message: `Another item is already named "${input.name}".` }]
        : [],
    };
  },

  updateItem: async (actor: Actor, id: string, input: UpdateItemInput): Promise<ItemMutationResponse> => {
    const organizationId = await requireHubActor(actor);
    const existing = await inventoryItemRepository.findById(id, organizationId);
    if (!existing) throw new NotFoundError('Inventory item not found');

    const nextType = input.type ?? existing.type;
    const nextDepartmentTags = input.departmentTags ?? existing.departmentTags;
    assertRawIngredientHasNoDepartments(nextType, nextDepartmentTags);
    await assertTypeChangeDoesNotStrandDepartmentStock(id, organizationId, existing.type, input.type);

    if (input.preferredSupplierId) {
      const supplier = await supplierRepository.findById(input.preferredSupplierId, organizationId);
      if (!supplier) {
        throw new ValidationError('preferredSupplierId does not reference a known supplier');
      }
    }

    const duplicate =
      input.name !== undefined
        ? await inventoryItemRepository.findLiveByName(organizationId, input.name, id)
        : null;

    const item = await prisma.$transaction(async (tx) => {
      const categoryId = await resolveCategoryId(organizationId, input.categoryId, input.categoryName, tx);
      const updated = await inventoryItemRepository.update(
        id,
        organizationId,
        {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(input.preferredSupplierId !== undefined ? { preferredSupplierId: input.preferredSupplierId } : {}),
          ...(input.buyUnit !== undefined ? { buyUnit: input.buyUnit } : {}),
          ...(input.usageUnit !== undefined ? { usageUnit: input.usageUnit } : {}),
          ...(input.conversionFactor !== undefined ? { conversionFactor: input.conversionFactor } : {}),
          ...(input.packSize !== undefined ? { packSize: input.packSize } : {}),
          ...(input.departmentTags !== undefined ? { departmentTags: input.departmentTags } : {}),
        },
        tx,
      );
      if (updated && input.preferredSupplierId !== undefined) {
        await supplierItemRepository.applyPreferred(organizationId, id, input.preferredSupplierId ?? null, tx);
      }
      return updated;
    }).catch((error: unknown) => mapPrismaError(error, { conflict: 'An item with this name already exists' }));

    if (!item) throw new NotFoundError('Inventory item not found');

    if (input.centralStoreRestockLevel !== undefined) {
      const centralStore = await locationRepository.findCentralStore();
      if (centralStore) {
        await restockLevelRepository.bulkUpsert(organizationId, centralStore.id, actor.id, [
          { inventoryItemId: item.id, level: input.centralStoreRestockLevel },
        ]);
      }
    }

    const restockLevelsByItemId = await getCentralStoreRestockLevelsByItemId(organizationId, [item.id]);

    return {
      item: serializeItem(item, restockLevelsByItemId.get(item.id) ?? null),
      warnings: duplicate
        ? [{ code: 'DUPLICATE_ITEM_NAME' as const, message: `Another item is already named "${input.name}".` }]
        : [],
    };
  },

  retireItem: async (actor: Actor, id: string) => {
    const organizationId = await requireHubActor(actor);
    const item = await inventoryItemRepository.retire(id, organizationId);
    if (!item) throw new NotFoundError('Inventory item not found');
    return serializeItem(item);
  },

  restoreItem: async (actor: Actor, id: string) => {
    const organizationId = await requireHubActor(actor);
    const item = await inventoryItemRepository.restore(id, organizationId);
    if (!item) throw new NotFoundError('Inventory item not found');
    return serializeItem(item);
  },

  // ── Restock levels ───────────────────────────────────────────────────────

  /**
   * Store Manager passes `locationId` (must be the hub's Central Store);
   * Department Head omits it — resolved to their own department location.
   * D-15 + per-department scoping (plan §5.2, §5.4 rules 5-6).
   */
  listRestockLevels: async (actor: Actor, query: ListRestockLevelsQuery): Promise<RestockLevelRow[]> => {
    const { organizationId, catalogOrganizationId, locationId, departmentTag } = await resolveRestockScope(actor, query.locationId);

    // Items are catalog rows on the hub (D-15); levels + on-hand live on the
    // actor's own org and location (a DH's branch department).
    const items = await restockLevelRepository.findLiveItemsForRestock(catalogOrganizationId, {
      departmentTag,
      search: query.search,
    });
    if (items.length === 0) return [];

    const [levels, onHandByItemId] = await Promise.all([
      restockLevelRepository.findAllByLocation(organizationId, locationId),
      restockLevelRepository.sumOnHandByItemForLocation(organizationId, locationId),
    ]);
    const levelByItemId = new Map(levels.map((l) => [l.inventoryItemId, l]));

    return items.map((item) => {
      const level = levelByItemId.get(item.id) ?? null;
      const onHandQty = onHandByItemId.get(item.id) ?? new Prisma.Decimal(0);
      return {
        inventoryItemId: item.id,
        itemName: item.name,
        usageUnit: item.usageUnit,
        onHandQty: onHandQty.toString(),
        level: level ? level.level.toString() : null,
        isBelowLevel: level ? onHandQty.lessThan(level.level) : false,
      };
    });
  },

  saveRestockLevels: async (actor: Actor, input: SaveRestockLevelsInput): Promise<RestockLevelRow[]> => {
    const { organizationId, catalogOrganizationId, locationId } = await resolveRestockScope(actor, input.locationId);

    const itemIds = input.levels.map((l) => l.inventoryItemId);
    const liveItems = await inventoryItemRepository.findLiveByIds(itemIds, catalogOrganizationId);
    const liveItemIds = new Set(liveItems.map((i) => i.id));
    if (liveItemIds.size !== itemIds.length) {
      throw new NotFoundError('One or more items were not found');
    }

    // §5.4 rule 5/6: a Department Head may only set levels for items scoped
    // to their own department; every item exists at the Central Store, so a
    // Store Manager setting a level there is unreachable but asserted.
    if (actor.isDepartmentHead) {
      const outOfScope = liveItems.filter((item) => !item.departmentTags.includes(actor.departmentTag as DepartmentTag));
      if (outOfScope.length > 0) {
        throw new ForbiddenError('You may only set restock levels for items scoped to your own department');
      }
    }

    await restockLevelRepository.bulkUpsert(
      organizationId,
      locationId,
      actor.id,
      input.levels.map((l) => ({ inventoryItemId: l.inventoryItemId, level: l.level })),
    );

    return inventoryService.listRestockLevels(actor, { locationId: input.locationId });
  },
};

/**
 * Resolves the (organizationId, locationId, departmentTag) triple a restock
 * request runs against, per actor role. A Store Manager must name the
 * Central Store explicitly and be on the hub org (D-15); a Department Head
 * may not pass a locationId at all — their own department is implicit and
 * any other location is rejected.
 *
 * `catalogOrganizationId` is where the items themselves live — always the
 * hub (D-15). Milestone Six S1 fix: the Department Head path used to look
 * items up on their branch org, which has none, so their restock screen
 * was always empty and every save 404'd.
 */
const resolveRestockScope = async (
  actor: Actor,
  requestedLocationId: string | undefined,
): Promise<{ organizationId: string; catalogOrganizationId: string; locationId: string; departmentTag?: DepartmentTag }> => {
  if (actor.isDepartmentHead) {
    if (requestedLocationId) {
      throw new ForbiddenError('Department Heads set restock levels for their own department only');
    }
    if (!actor.organizationId) {
      throw new ValidationError('Branch context missing for this user');
    }
    if (!actor.departmentTag) {
      throw new ValidationError('This user has no department assigned');
    }
    const location = await locationRepository.findByOrganizationTypeDepartment(
      actor.organizationId,
      'BRANCH_DEPARTMENT',
      actor.departmentTag,
    );
    if (!location) {
      throw new NotFoundError('No location found for your department');
    }
    const catalogOrganizationId = await requireHubOrgForCatalogRead(actor);
    return { organizationId: actor.organizationId, catalogOrganizationId, locationId: location.id, departmentTag: actor.departmentTag };
  }

  // STORE_MANAGER
  const organizationId = await requireHubActor(actor);
  if (!requestedLocationId) {
    throw new ValidationError('locationId is required');
  }
  const centralStore = await locationRepository.findCentralStore();
  if (!centralStore || centralStore.id !== requestedLocationId || centralStore.organizationId !== organizationId) {
    throw new ValidationError('locationId must be the Central Store');
  }
  return { organizationId, catalogOrganizationId: organizationId, locationId: centralStore.id };
};
