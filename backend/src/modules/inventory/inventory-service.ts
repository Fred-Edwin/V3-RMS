import type { Request } from 'express';
import { Prisma, type DepartmentTag } from '@prisma/client';
import {
  categoryRepository,
  inventoryItemRepository,
  itemChangeReviewRepository,
  restockChangeRepository,
  restockLevelRepository,
  type CategoryWithItemCount,
  type InventoryItemWithRelations,
  type RestockChangeRow,
} from './inventory-repository';
import {
  supplierAuditRepository,
  supplierItemRepository,
  supplierRepository,
} from './supplier-repository';
import { serializeItemSupplierLine } from './supplier-serializers';
import { describeItemUpdate, type ItemFields } from './item-history';
import { itemChangeRepository } from './item-history-repository';
import {
  SUGGESTION_WINDOW_DAYS,
  computeSuggestion,
  restockStatus,
  suggestionDiffers,
} from './restock-suggestion';
import { branchRepository } from '../../repositories/branch-repository';
import { locationRepository } from '../../repositories/location-repository';
import { prisma } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { mapPrismaError } from '../../utils/prisma-errors';
import type {
  AttendantItemMutationResponse,
  CentralStoreLocation,
  CreateCategoryInput,
  CreateItemInput,
  ItemCatalogListResponse,
  ItemChangeReview,
  ItemHistoryEntry,
  ItemMutationResponse,
  ListItemsQuery,
  ListRestockLevelsQuery,
  Paginated,
  PutBackRestockLevelInput,
  RestockHistoryEntry,
  RestockHistoryQuery,
  RestockLevelRow,
  RestockLevelsSummary,
  RestockLevelsSummaryQuery,
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

/** Writes PREFERRED_SET / PREFERRED_CONFIRMED when an item-level preferred-supplier change moved a line. */
const logPreferredChange = async (
  organizationId: string,
  actorId: string,
  supplierId: string,
  inventoryItemId: string,
  result: { lineId: string | null; wasPreferred: boolean; wasNeedsConfirm: boolean },
  tx: Prisma.TransactionClient,
): Promise<void> => {
  if (!result.lineId || (result.wasPreferred && !result.wasNeedsConfirm)) return;
  await supplierAuditRepository.create(
    organizationId,
    supplierId,
    actorId,
    result.wasNeedsConfirm ? 'PREFERRED_CONFIRMED' : 'PREFERRED_SET',
    result.lineId,
    { inventoryItemId, lineId: result.lineId, isPreferred: result.wasPreferred, preferredNeedsConfirm: result.wasNeedsConfirm },
    { inventoryItemId, lineId: result.lineId, isPreferred: true, preferredNeedsConfirm: false },
    tx,
  );
};

/** A search hit on the supplier's code or name rather than ours: say which supplier and what matched. */
const buildMatchedOn = (
  itemName: string,
  search: string,
  lines: { supplierItemName: string | null; supplierItemCode: string | null; supplier: { id: string; name: string } }[],
) => {
  if (itemName.toLowerCase().includes(search.toLowerCase())) return null;
  const needle = search.toLowerCase();
  const byCode = lines.find((l) => l.supplierItemCode !== null && l.supplierItemCode.toLowerCase() === needle);
  if (byCode?.supplierItemCode) {
    return { supplier: byCode.supplier, field: 'supplierItemCode' as const, value: byCode.supplierItemCode, supplierItemName: byCode.supplierItemName };
  }
  const byName = lines.find((l) => l.supplierItemName !== null && l.supplierItemName.toLowerCase().includes(needle));
  if (byName?.supplierItemName) {
    return { supplier: byName.supplier, field: 'supplierItemName' as const, value: byName.supplierItemName, supplierItemName: byName.supplierItemName };
  }
  return null;
};

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

/** The fields the item history compares (§30.4). */
const toItemFields = (item: InventoryItemWithRelations): ItemFields => ({
  name: item.name,
  type: item.type,
  buyUnit: item.buyUnit,
  usageUnit: item.usageUnit,
  conversionFactor: toDecimalString(item.conversionFactor),
  packSize: toDecimalString(item.packSize),
  categoryName: item.category?.name ?? null,
  departmentTags: item.departmentTags,
});

/** A Store Attendant (not a department head) is blind to money: prices, levels, preferred supplier (§29.4). */
const isAttendant = (actor: Actor): boolean => actor.role === 'STORE_ATTENDANT' && !actor.isDepartmentHead;

const serializeAttendantItem = (item: InventoryItemWithRelations) => ({
  id: item.id,
  name: item.name,
  type: item.type,
  categoryId: item.categoryId,
  buyUnit: item.buyUnit,
  usageUnit: item.usageUnit,
  conversionFactor: toDecimalString(item.conversionFactor),
  packSize: toDecimalString(item.packSize),
  departmentTags: item.departmentTags,
  category: item.category,
  retiredAt: item.deletedAt?.toISOString() ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

/** Item types a Store Attendant may create (§29.4); a prepped item needs a recipe and a manager. */
const ATTENDANT_CREATABLE_TYPES: readonly string[] = ['STOCKED', 'RAW_INGREDIENT'];

const assertAttendantMayCreate = (input: CreateItemInput): void => {
  if (!ATTENDANT_CREATABLE_TYPES.includes(input.type)) {
    throw new ForbiddenError('Store Attendants can add stocked and raw-ingredient items only');
  }
  const managerOnly: string[] = [];
  if (input.categoryId || input.categoryName) managerOnly.push('category');
  if (input.preferredSupplierId) managerOnly.push('preferred supplier');
  if (input.departmentTags.length > 0) managerOnly.push('used-by departments');
  if (input.centralStoreRestockLevel != null) managerOnly.push('restock level');
  if (input.usualPrice != null) managerOnly.push('price');
  if (managerOnly.length > 0) {
    throw new ForbiddenError(`The Store Manager sets ${managerOnly.join(', ')} — leave it blank and it shows under Needs setup`);
  }
};

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
    const attendant = isAttendant(actor);
    // "Needs setup" is a column-to-column comparison, so the ids come from one raw query (§29.3).
    const needsSetupIds = await inventoryItemRepository.findNeedsSetupIds(organizationId);
    const isManager = actor.role === 'STORE_MANAGER' && !actor.isDepartmentHead;
    // Restock levels are the Store Manager's: nobody else may filter by them (§30.1).
    if (query.lowOrOut && !isManager) throw new ForbiddenError('Only the Store Manager can filter by restock level');
    const lowOrOutIds = isManager ? await findCentralStoreLowOrOutIds(organizationId) : [];
    // needsSetup and lowOrOut together mean items in both.
    let onlyIds: string[] | undefined;
    if (query.needsSetup) onlyIds = needsSetupIds;
    if (query.lowOrOut) {
      const low = new Set(lowOrOutIds);
      onlyIds = onlyIds ? onlyIds.filter((id) => low.has(id)) : lowOrOutIds;
    }
    const { items, total } = await inventoryItemRepository.findAllByOrganization(organizationId, {
      search: query.search,
      type: query.type,
      categoryId: query.categoryId,
      departmentTag: query.departmentTag,
      includeRetired: query.includeRetired,
      onlyIds,
      sort: query.sort,
      page: query.page,
      perPage: query.perPage,
    });
    const catalogMeta = await inventoryItemRepository.getCatalogMeta(organizationId);
    const addedThisWeek = await inventoryItemRepository.countCreatedSince(
      organizationId,
      new Date(Date.now() - 7 * 86_400_000),
    );
    const lowOrOut = isManager ? lowOrOutIds.length : null;
    const [typeCounts, addedByAttendant, supplierCounts] = await Promise.all([
      inventoryItemRepository.countLiveByType(organizationId),
      itemChangeRepository.countAttendantCreatedSince(organizationId, new Date(Date.now() - 7 * 86_400_000)),
      inventoryItemRepository.countSuppliersByItem(
        organizationId,
        items.map((item) => item.id),
      ),
    ]);
    const meta = { ...catalogMeta, needsSetup: needsSetupIds.length, lowOrOut, addedThisWeek, typeCounts, addedByAttendant };

    const restockLevelsByItemId = attendant
      ? new Map<string, Prisma.Decimal>()
      : await getCentralStoreRestockLevelsByItemId(
          organizationId,
          items.map((item) => item.id),
        );
    const search = query.search?.trim();
    const matches =
      search && items.length > 0
        ? await inventoryItemRepository.findSearchMatches(organizationId, items.map((i) => i.id), search)
        : [];

    return {
      data: items.map((item) => {
        const matchedOn = search
          ? buildMatchedOn(item.name, search, matches.filter((m) => m.inventoryItemId === item.id))
          : null;
        const supplierCount = supplierCounts.get(item.id) ?? 0;
        return attendant
          ? { ...serializeAttendantItem(item), supplierCount, matchedOn }
          : { ...serializeItem(item, restockLevelsByItemId.get(item.id) ?? null), supplierCount, matchedOn };
      }),
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
    const suppliers = (await supplierItemRepository.listForItem(item.id, organizationId)).map(serializeItemSupplierLine);
    if (isAttendant(actor)) {
      // No prices and no preferred flags: who sells it and under what name, nothing about money.
      return {
        ...serializeAttendantItem(item),
        suppliers: suppliers.map(
          ({ lastPrice: _lastPrice, lastPriceAt: _lastPriceAt, lastPriceSetBy: _setBy, isPreferred: _p, preferredNeedsConfirm: _c, ...rest }) => rest,
        ),
      };
    }
    const restockLevelsByItemId = await getCentralStoreRestockLevelsByItemId(organizationId, [item.id]);
    const centralStore = await locationRepository.findCentralStore();
    const onHand = centralStore
      ? (await restockLevelRepository.sumOnHandByItemForLocation(organizationId, centralStore.id, [item.id])).get(item.id)
      : undefined;
    return {
      ...serializeItem(item, restockLevelsByItemId.get(item.id) ?? null),
      centralStoreOnHand: (onHand ?? new Prisma.Decimal(0)).toString(),
      suppliers,
    };
  },

  /** What happened to the item, newest first (§30.4). Store Manager only. */
  getItemHistory: async (actor: Actor, id: string, limit: number): Promise<ItemHistoryEntry[]> => {
    const organizationId = await requireHubActor(actor);
    const item = await inventoryItemRepository.findById(id, organizationId);
    if (!item) throw new NotFoundError('Inventory item not found');
    const rows = await itemChangeRepository.list(id, organizationId, limit);
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      summary: row.summary,
      reason: row.reason,
      before: (row.before as Record<string, unknown> | null) ?? null,
      after: (row.after as Record<string, unknown> | null) ?? null,
      changedBy: row.changedBy,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  /**
   * The "Review change" summary for a unit / pack / type / retire edit (B13, §29.6). Plain counts, so an
   * item with no history yields zeros and `hasHistory: false` — never null — and the screen can say
   * "No stock has been counted yet, so no figures change".
   */
  getItemChangeReview: async (actor: Actor, id: string): Promise<ItemChangeReview> => {
    const organizationId = await requireHubActor(actor);
    const item = await inventoryItemRepository.findById(id, organizationId);
    if (!item) throw new NotFoundError('Inventory item not found');
    const counts = await itemChangeReviewRepository.counts(id, organizationId);
    return {
      inventoryItemId: item.id,
      itemName: item.name,
      onHandQty: counts.onHandQty.toString(),
      locationsHoldingStock: counts.locationsHoldingStock,
      stockEntries: counts.stockEntries,
      receipts: counts.receipts,
      receiptLines: counts.receiptLines,
      openOrders: counts.openOrders,
      hasHistory: counts.stockEntries > 0 || counts.receiptLines > 0 || counts.openOrders > 0,
    };
  },

  createItem: async (actor: Actor, input: CreateItemInput): Promise<ItemMutationResponse | AttendantItemMutationResponse> => {
    const organizationId = await requireHubActor(actor);
    const attendant = isAttendant(actor);
    if (attendant) assertAttendantMayCreate(input);
    assertRawIngredientHasNoDepartments(input.type, input.departmentTags);

    if (input.preferredSupplierId) {
      const supplier = await supplierRepository.findById(input.preferredSupplierId, organizationId);
      if (!supplier) {
        throw new ValidationError('preferredSupplierId does not reference a known supplier');
      }
    }

    const duplicate = await inventoryItemRepository.findLiveByName(organizationId, input.name);
    // The usual price is per buy unit; the item's cost is kept per usage unit (§30.2).
    const currentCost =
      input.usualPrice != null
        ? new Prisma.Decimal(input.usualPrice).dividedBy(input.conversionFactor ?? 1).toDecimalPlaces(4)
        : undefined;

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
          ...(currentCost !== undefined ? { currentCost } : {}),
        },
        tx,
      );
      await itemChangeRepository.record(tx, {
        organizationId,
        inventoryItemId: created.id,
        kind: 'CREATED',
        summary: 'created the item',
        after: { ...toItemFields(created), ...(input.usualPrice != null ? { usualPrice: input.usualPrice } : {}) },
        changedById: actor.id,
      });
      // Keep SupplierItem.isPreferred in step with the legacy pointer.
      if (input.preferredSupplierId) {
        const preferred = await supplierItemRepository.applyPreferred(organizationId, created.id, input.preferredSupplierId, tx);
        await logPreferredChange(organizationId, actor.id, input.preferredSupplierId, created.id, preferred, tx);
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

    const warnings = duplicate
      ? [{ code: 'DUPLICATE_ITEM_NAME' as const, message: `Another item is already named "${input.name}".` }]
      : [];
    if (attendant) return { item: serializeAttendantItem(item), warnings };

    const restockLevelsByItemId = await getCentralStoreRestockLevelsByItemId(organizationId, [item.id]);
    return { item: serializeItem(item, restockLevelsByItemId.get(item.id) ?? null), warnings };
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
        const preferred = await supplierItemRepository.applyPreferred(organizationId, id, input.preferredSupplierId ?? null, tx);
        if (input.preferredSupplierId) {
          await logPreferredChange(organizationId, actor.id, input.preferredSupplierId, id, preferred, tx);
        }
      }
      if (updated) {
        const change = describeItemUpdate(toItemFields(existing), toItemFields(updated));
        if (change) {
          await itemChangeRepository.record(tx, {
            organizationId,
            inventoryItemId: id,
            kind: 'UPDATED',
            summary: change.summary,
            before: change.before,
            after: change.after,
            reason: input.reason,
            changedById: actor.id,
          });
        }
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

  retireItem: async (actor: Actor, id: string, reason?: string) => {
    const organizationId = await requireHubActor(actor);
    const item = await prisma.$transaction(async (tx) => {
      const retired = await inventoryItemRepository.retire(id, organizationId, tx);
      if (retired) {
        await itemChangeRepository.record(tx, {
          organizationId,
          inventoryItemId: id,
          kind: 'RETIRED',
          summary: 'retired the item',
          reason,
          changedById: actor.id,
        });
      }
      return retired;
    });
    if (!item) throw new NotFoundError('Inventory item not found');
    return serializeItem(item);
  },

  restoreItem: async (actor: Actor, id: string, reason?: string) => {
    const organizationId = await requireHubActor(actor);
    const item = await prisma.$transaction(async (tx) => {
      const restored = await inventoryItemRepository.restore(id, organizationId, tx);
      if (restored) {
        await itemChangeRepository.record(tx, {
          organizationId,
          inventoryItemId: id,
          kind: 'RESTORED',
          summary: 'restored the item',
          reason,
          changedById: actor.id,
        });
      }
      return restored;
    });
    if (!item) throw new NotFoundError('Inventory item not found');
    return serializeItem(item);
  },

  // ── Restock levels ───────────────────────────────────────────────────────

  /**
   * Store Manager names whose levels: the Central Store (`locationId`, or `scope: CENTRAL_STORE`) or a
   * branch department (`scope` + `branchId`, B10). Department Head omits both — resolved to their own
   * department. D-15 + per-department scoping (plan §5.2, §5.4 rules 5-6).
   */
  listRestockLevels: async (actor: Actor, query: ListRestockLevelsQuery): Promise<RestockLevelRow[]> => {
    return (await loadRestockRows(actor, query)).rows;
  },

  /** The strip above the restock page (§29.3): the same rows, counted. */
  getRestockLevelsSummary: async (actor: Actor, query: RestockLevelsSummaryQuery): Promise<RestockLevelsSummary> => {
    const { rows, differs } = await loadRestockRows(actor, query);
    const count = (status: RestockLevelRow['status']): number => rows.filter((r) => r.status === status).length;
    return {
      total: rows.length,
      out: count('OUT'),
      low: count('LOW'),
      ok: count('OK'),
      noLevel: count('NO_LEVEL'),
      suggestionsDiffer: differs,
    };
  },

  saveRestockLevels: async (actor: Actor, input: SaveRestockLevelsInput): Promise<RestockLevelRow[]> => {
    const { organizationId, catalogOrganizationId, locationId, departmentTag } = await resolveRestockScope(actor, input);

    const itemIds = input.levels.map((l) => l.inventoryItemId);
    const liveItems = await inventoryItemRepository.findLiveByIds(itemIds, catalogOrganizationId);
    const liveItemIds = new Set(liveItems.map((i) => i.id));
    if (liveItemIds.size !== itemIds.length) {
      throw new NotFoundError('One or more items were not found');
    }

    // §5.4 rule 5/6: a department's levels (a head's own, or the Store Manager's for a branch
    // department) may only cover items scoped to that department; every item exists at the Central Store.
    if (departmentTag) {
      const outOfScope = liveItems.filter((item) => !item.departmentTags.includes(departmentTag));
      if (outOfScope.length > 0) {
        throw new ForbiddenError(
          actor.isDepartmentHead
            ? 'You may only set restock levels for items scoped to your own department'
            : `Some of these items are not scoped to ${departmentTag.toLowerCase()}`,
        );
      }
    }

    await restockLevelRepository.bulkUpsert(
      organizationId,
      locationId,
      actor.id,
      input.levels.map((l) => ({ inventoryItemId: l.inventoryItemId, level: l.level })),
      input.reason,
    );

    return (await loadRestockRows(actor, input)).rows;
  },

  /**
   * Who changed which level, newest first (§30.5): one item's history, or the location's recent changes.
   * Same "whose levels" rules as the list; a Department Head sees only their own department.
   */
  listRestockHistory: async (actor: Actor, query: RestockHistoryQuery): Promise<RestockHistoryEntry[]> => {
    const { organizationId, locationId } = await resolveRestockScope(actor, query);
    const rows = await restockChangeRepository.list(organizationId, locationId, {
      inventoryItemId: query.inventoryItemId,
      limit: query.limit,
    });
    return rows.map(serializeRestockChange);
  },

  /**
   * Puts a level back to what a change replaced (§30.5). The old entry stays; a new one is added by the same
   * save path every level change uses, so it shows in the history like any other.
   */
  putBackRestockLevel: async (actor: Actor, changeId: string, input: PutBackRestockLevelInput): Promise<RestockHistoryEntry> => {
    // The route already limits this to a Store Manager or a department head; a put back names only a change id,
    // so the service does not lean on the route alone.
    if (!actor.isDepartmentHead && actor.role !== 'STORE_MANAGER') {
      throw new ForbiddenError('Only the Store Manager or a department head can put a level back');
    }
    const change = await restockChangeRepository.findById(changeId);
    if (!change) throw new NotFoundError('Restock level change not found');

    if (actor.isDepartmentHead) {
      const own = await resolveRestockScope(actor, {});
      if (own.locationId !== change.locationId) {
        throw new ForbiddenError("You can only put back changes to your own department's levels");
      }
    } else {
      await requireHubActor(actor);
      // A Store Manager reaches the Central Store and branch departments; nothing else holds restock levels.
      if (change.location.type !== 'CENTRAL_STORE' && change.location.type !== 'BRANCH_DEPARTMENT') {
        throw new NotFoundError('Restock level change not found');
      }
    }
    if (change.inventoryItem.deletedAt) throw new NotFoundError('Restock level change not found');
    if (change.oldLevel === null) throw new ValidationError('Nothing to put back: this was the first level set for the item');

    const current = (await restockLevelRepository.findByItemIdsForLocation(change.organizationId, change.locationId, [change.inventoryItemId])).get(
      change.inventoryItemId,
    );
    if (current && current.equals(change.oldLevel)) {
      throw new ConflictError(`The level is already ${current.toString()} ${change.inventoryItem.usageUnit}`);
    }

    await restockLevelRepository.bulkUpsert(
      change.organizationId,
      change.locationId,
      actor.id,
      [{ inventoryItemId: change.inventoryItemId, level: change.oldLevel }],
      input.reason ?? 'Put back',
    );
    const latest = await restockChangeRepository.findLatest(change.organizationId, change.locationId, change.inventoryItemId);
    if (!latest) throw new NotFoundError('Restock level change not found');
    return serializeRestockChange(latest);
  },
};

const serializeRestockChange = (row: RestockChangeRow): RestockHistoryEntry => ({
  id: row.id,
  inventoryItemId: row.inventoryItemId,
  itemName: row.inventoryItem.name,
  usageUnit: row.inventoryItem.usageUnit,
  oldLevel: toDecimalString(row.oldLevel),
  newLevel: toDecimalString(row.newLevel),
  reason: row.reason,
  changedBy: row.changedBy,
  createdAt: row.createdAt.toISOString(),
});

type RestockScopeQuery = { locationId?: string; scope?: 'CENTRAL_STORE' | DepartmentTag; branchId?: string };

/** Rows for one location plus how many of their suggestions differ from the level set (§29.2, §29.5). */
const loadRestockRows = async (
  actor: Actor,
  query: RestockScopeQuery & { search?: string },
): Promise<{ rows: RestockLevelRow[]; differs: number }> => {
  const { organizationId, catalogOrganizationId, locationId, departmentTag } = await resolveRestockScope(actor, query);

  // Items are catalog rows on the hub (D-15); levels + on-hand live on the
  // location's own org (a branch department's, or the hub's Central Store).
  const items = await restockLevelRepository.findLiveItemsForRestock(catalogOrganizationId, {
    departmentTag,
    search: query.search,
  });
  if (items.length === 0) return { rows: [], differs: 0 };

  const now = new Date();
  const [levels, onHandByItemId, useByItemId] = await Promise.all([
    restockLevelRepository.findAllByLocation(organizationId, locationId),
    restockLevelRepository.sumOnHandByItemForLocation(organizationId, locationId),
    restockLevelRepository.findUseByItemForLocation(
      organizationId,
      locationId,
      new Date(now.getTime() - SUGGESTION_WINDOW_DAYS * 86_400_000),
    ),
  ]);
  const levelByItemId = new Map(levels.map((l) => [l.inventoryItemId, l]));

  let differs = 0;
  const rows = items.map((item): RestockLevelRow => {
    const level = levelByItemId.get(item.id)?.level ?? null;
    const onHandQty = onHandByItemId.get(item.id) ?? new Prisma.Decimal(0);
    const status = restockStatus(onHandQty, level);
    const suggestion = computeSuggestion(useByItemId.get(item.id), now);
    if (suggestionDiffers(level, suggestion.suggestedLevel)) differs += 1;
    return {
      inventoryItemId: item.id,
      itemName: item.name,
      usageUnit: item.usageUnit,
      onHandQty: onHandQty.toString(),
      level: level ? level.toString() : null,
      isBelowLevel: status === 'OUT' || status === 'LOW',
      status,
      suggestedLevel: suggestion.suggestedLevel,
      suggestionNote: suggestion.suggestionNote,
    };
  });
  return { rows, differs };
};

/** Central Store items with a level set and on-hand below it: the strip's count and the `lowOrOut` filter (§29.3, §30.1). */
const findCentralStoreLowOrOutIds = async (hubOrgId: string): Promise<string[]> => {
  const centralStore = await locationRepository.findCentralStore();
  if (!centralStore || centralStore.organizationId !== hubOrgId) return [];
  const [levels, onHand, live] = await Promise.all([
    restockLevelRepository.findAllByLocation(hubOrgId, centralStore.id),
    restockLevelRepository.sumOnHandByItemForLocation(hubOrgId, centralStore.id),
    restockLevelRepository.findLiveItemIds(hubOrgId),
  ]);
  const liveIds = new Set(live);
  return levels
    .filter((l) => {
      if (!liveIds.has(l.inventoryItemId)) return false;
      const status = restockStatus(onHand.get(l.inventoryItemId) ?? new Prisma.Decimal(0), l.level);
      return status === 'OUT' || status === 'LOW';
    })
    .map((l) => l.inventoryItemId);
};

/**
 * Resolves the (organizationId, locationId, departmentTag) triple a restock
 * request runs against, per actor role. A Store Manager must be on the hub org
 * (D-15) and name whose levels: the Central Store (`locationId` or `scope`), or
 * a branch department (`scope` + `branchId`, B10). A Department Head may not
 * pass any of these — their own department is implicit and anything else is
 * rejected.
 *
 * `catalogOrganizationId` is where the items themselves live — always the
 * hub (D-15). Milestone Six S1 fix: the Department Head path used to look
 * items up on their branch org, which has none, so their restock screen
 * was always empty and every save 404'd.
 */
const resolveRestockScope = async (
  actor: Actor,
  query: RestockScopeQuery,
): Promise<{ organizationId: string; catalogOrganizationId: string; locationId: string; departmentTag?: DepartmentTag }> => {
  if (actor.isDepartmentHead) {
    if (query.locationId || query.scope || query.branchId) {
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
  if (!query.locationId && !query.scope) {
    throw new ValidationError('locationId or scope is required');
  }

  if (query.scope && query.scope !== 'CENTRAL_STORE') {
    if (!query.branchId) throw new ValidationError('branchId is required for a department scope');
    const branch = await branchRepository.findById(query.branchId);
    if (!branch || branch.id === organizationId) {
      throw new ValidationError('branchId must be a branch, not the hub');
    }
    const location = await locationRepository.findByOrganizationTypeDepartment(branch.id, 'BRANCH_DEPARTMENT', query.scope);
    if (!location) {
      throw new NotFoundError(`${branch.name} has no ${query.scope.toLowerCase()} department`);
    }
    return { organizationId: branch.id, catalogOrganizationId: organizationId, locationId: location.id, departmentTag: query.scope };
  }

  const centralStore = await locationRepository.findCentralStore();
  if (!centralStore || centralStore.organizationId !== organizationId) {
    throw new ValidationError('No Central Store is configured for this organization');
  }
  if (query.locationId && centralStore.id !== query.locationId) {
    throw new ValidationError('locationId must be the Central Store');
  }
  return { organizationId, catalogOrganizationId: organizationId, locationId: centralStore.id };
};
