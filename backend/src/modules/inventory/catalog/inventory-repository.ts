import { Prisma, type Category, type DepartmentTag, type InventoryItem, type InventoryItemType, type RestockLevel, type Supplier, type SupplierPaymentTerms } from '@prisma/client';
import { prisma } from '../../../config/database';
import { USE_TRANSACTION_TYPES, type ItemUse } from '../restock/restock-suggestion';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryWithItemCount = Category & { itemCount: number };

const categoryFindByLiveName = async (
  client: Client,
  siteId: string,
  name: string,
): Promise<Category | null> => {
  return client.category.findFirst({
    where: { siteId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
  });
};

export const categoryRepository = {
  findAllBySite: async (
    siteId: string,
    includeRetired: boolean,
  ): Promise<CategoryWithItemCount[]> => {
    const categories = await prisma.category.findMany({
      where: { siteId, ...(includeRetired ? {} : { deletedAt: null }) },
      orderBy: { name: 'asc' },
    });
    if (categories.length === 0) return [];

    const counts = await prisma.inventoryItem.groupBy({
      by: ['categoryId'],
      where: { siteId, deletedAt: null, categoryId: { in: categories.map((c) => c.id) } },
      _count: { _all: true },
    });
    const countByCategoryId = new Map(counts.map((c) => [c.categoryId, c._count._all]));

    return categories.map((c) => ({ ...c, itemCount: countByCategoryId.get(c.id) ?? 0 }));
  },

  findById: async (id: string, siteId: string): Promise<Category | null> => {
    return prisma.category.findFirst({ where: { id, siteId } });
  },

  findByLiveName: async (
    siteId: string,
    name: string,
    tx: TxClient = prisma,
  ): Promise<Category | null> => {
    return categoryFindByLiveName(tx, siteId, name);
  },

  create: async (siteId: string, name: string, tx: TxClient = prisma): Promise<Category> => {
    return tx.category.create({ data: { siteId, name } });
  },

  rename: async (id: string, siteId: string, name: string): Promise<Category | null> => {
    const updated = await prisma.category.updateMany({ where: { id, siteId }, data: { name } });
    if (updated.count === 0) return null;
    return prisma.category.findFirst({ where: { id, siteId } });
  },

  retire: async (id: string, siteId: string): Promise<Category | null> => {
    const updated = await prisma.category.updateMany({
      where: { id, siteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (updated.count === 0) return null;
    return prisma.category.findFirst({ where: { id, siteId } });
  },

  restore: async (id: string, siteId: string): Promise<Category | null> => {
    const updated = await prisma.category.updateMany({
      where: { id, siteId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (updated.count === 0) return null;
    return prisma.category.findFirst({ where: { id, siteId } });
  },

  countLiveItems: async (id: string, siteId: string): Promise<number> => {
    return prisma.inventoryItem.count({ where: { siteId, categoryId: id, deletedAt: null } });
  },
};

// ---------------------------------------------------------------------------
// Inventory items
// ---------------------------------------------------------------------------

export type InventoryItemWithRelations = InventoryItem & {
  category: { id: string; name: string } | null;
  preferredSupplier: { id: string; name: string } | null;
};

export type CreateInventoryItemInput = {
  name: string;
  type: InventoryItemType;
  categoryId: string | null;
  preferredSupplierId: string | null;
  buyUnit: string;
  usageUnit: string;
  conversionFactor: Prisma.Decimal.Value | null;
  packSize: Prisma.Decimal.Value | null;
  /** Days of cover for the suggested level; null = the default (15). */
  daysOfCover?: Prisma.Decimal.Value | null;
  departmentTags: DepartmentTag[];
  /** Per usage unit. Omitted = the column default (0). Set only from a Store Manager's usual price (§30.2). */
  currentCost?: Prisma.Decimal.Value;
};

export type UpdateInventoryItemInput = Partial<CreateInventoryItemInput>;

export type ListItemsFilters = {
  search?: string;
  type?: InventoryItemType;
  categoryId?: string;
  departmentTag?: DepartmentTag;
  includeRetired: boolean;
  /** When set, only these ids, oldest first (the "Needs setup" list, §29.3) unless `sort` says otherwise. */
  onlyIds?: string[];
  /** `name` (A→Z) or `newest` (newest first). Unset: name, or oldest first when `onlyIds` is set. */
  sort?: 'name' | 'newest';
  page: number;
  perPage: number;
};

const itemInclude = {
  category: { select: { id: true, name: true } },
  preferredSupplier: { select: { id: true, name: true } },
} satisfies Prisma.InventoryItemInclude;

/**
 * Catalog search (§28.5): our item name (partial), or any supplier's item code (exact) or item
 * name (partial) — all case-insensitive. ILIKE / insensitive equality cannot use the btree
 * indexes on supplier_items; at catalog scale (hundreds of rows) that is a sequential scan of a
 * small table, not a problem.
 */
const supplierLineSearch = (siteId: string, search: string): Prisma.SupplierItemWhereInput => ({
  siteId,
  OR: [
    { supplierItemCode: { equals: search, mode: 'insensitive' } },
    { supplierItemName: { contains: search, mode: 'insensitive' } },
  ],
});

const searchWhere = (siteId: string, search: string): Prisma.InventoryItemWhereInput[] => [
  { name: { contains: search, mode: 'insensitive' } },
  { supplierItems: { some: supplierLineSearch(siteId, search) } },
];

export const inventoryItemRepository = {
  /** The supplier lines that matched a search, for the "Matched Samrat code 190035" caption. */
  findSearchMatches: async (siteId: string, inventoryItemIds: string[], search: string) =>
    prisma.supplierItem.findMany({
      where: { inventoryItemId: { in: inventoryItemIds }, ...supplierLineSearch(siteId, search) },
      select: {
        inventoryItemId: true,
        supplierItemName: true,
        supplierItemCode: true,
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

  findAllBySite: async (
    siteId: string,
    filters: ListItemsFilters,
  ): Promise<{ items: InventoryItemWithRelations[]; total: number }> => {
    const where: Prisma.InventoryItemWhereInput = {
      siteId,
      ...(filters.includeRetired ? {} : { deletedAt: null }),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.departmentTag ? { departmentTags: { has: filters.departmentTag } } : {}),
      ...(filters.search ? { OR: searchWhere(siteId, filters.search) } : {}),
      ...(filters.onlyIds ? { id: { in: filters.onlyIds } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: itemInclude,
        orderBy:
          filters.sort === 'newest'
            ? [{ createdAt: 'desc' }, { id: 'desc' }]
            : filters.sort === 'name'
              ? [{ name: 'asc' }, { id: 'asc' }]
              : filters.onlyIds
                ? [{ createdAt: 'asc' }, { id: 'asc' }]
                : { name: 'asc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return { items, total };
  },

  findById: async (
    id: string,
    siteId: string,
    tx: TxClient = prisma,
  ): Promise<InventoryItemWithRelations | null> => {
    return tx.inventoryItem.findFirst({ where: { id, siteId }, include: itemInclude });
  },

  /** Live items only, for the raw-ingredient-on-hand check (§5.4 rule 2). */
  findLiveByIds: async (ids: string[], siteId: string): Promise<InventoryItem[]> => {
    if (ids.length === 0) return [];
    return prisma.inventoryItem.findMany({ where: { id: { in: ids }, siteId, deletedAt: null } });
  },

  /** Case-insensitive match among LIVE items only — duplicate-name warning (§5.4 rule 3). */
  findLiveByName: async (
    siteId: string,
    name: string,
    excludeId?: string,
  ): Promise<InventoryItem | null> => {
    return prisma.inventoryItem.findFirst({
      where: {
        siteId,
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  },

  create: async (
    siteId: string,
    data: CreateInventoryItemInput,
    tx: TxClient = prisma,
  ): Promise<InventoryItemWithRelations> => {
    return tx.inventoryItem.create({
      data: {
        siteId,
        name: data.name,
        type: data.type,
        categoryId: data.categoryId,
        preferredSupplierId: data.preferredSupplierId,
        buyUnit: data.buyUnit,
        usageUnit: data.usageUnit,
        conversionFactor: data.conversionFactor !== null ? new Prisma.Decimal(data.conversionFactor) : null,
        packSize: data.packSize !== null ? new Prisma.Decimal(data.packSize) : null,
        daysOfCover: data.daysOfCover != null ? new Prisma.Decimal(data.daysOfCover) : null,
        departmentTags: data.departmentTags,
        ...(data.currentCost !== undefined ? { currentCost: new Prisma.Decimal(data.currentCost) } : {}),
      },
      include: itemInclude,
    });
  },

  update: async (
    id: string,
    siteId: string,
    data: UpdateInventoryItemInput,
    tx: TxClient = prisma,
  ): Promise<InventoryItemWithRelations | null> => {
    const updated = await tx.inventoryItem.updateMany({
      where: { id, siteId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.preferredSupplierId !== undefined ? { preferredSupplierId: data.preferredSupplierId } : {}),
        ...(data.buyUnit !== undefined ? { buyUnit: data.buyUnit } : {}),
        ...(data.usageUnit !== undefined ? { usageUnit: data.usageUnit } : {}),
        ...(data.conversionFactor !== undefined
          ? { conversionFactor: data.conversionFactor !== null ? new Prisma.Decimal(data.conversionFactor) : null }
          : {}),
        ...(data.packSize !== undefined
          ? { packSize: data.packSize !== null ? new Prisma.Decimal(data.packSize) : null }
          : {}),
        ...(data.daysOfCover !== undefined
          ? { daysOfCover: data.daysOfCover !== null ? new Prisma.Decimal(data.daysOfCover) : null }
          : {}),
        ...(data.departmentTags !== undefined ? { departmentTags: data.departmentTags } : {}),
      },
    });

    if (updated.count === 0) return null;
    return tx.inventoryItem.findFirst({ where: { id, siteId }, include: itemInclude });
  },

  /** Soft delete (retire) — never a hard delete; the ledger references items. */
  retire: async (id: string, siteId: string, tx: TxClient = prisma): Promise<InventoryItemWithRelations | null> => {
    const updated = await tx.inventoryItem.updateMany({
      where: { id, siteId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (updated.count === 0) return null;
    return tx.inventoryItem.findFirst({ where: { id, siteId }, include: itemInclude });
  },

  restore: async (id: string, siteId: string, tx: TxClient = prisma): Promise<InventoryItemWithRelations | null> => {
    const updated = await tx.inventoryItem.updateMany({
      where: { id, siteId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (updated.count === 0) return null;
    return tx.inventoryItem.findFirst({ where: { id, siteId }, include: itemInclude });
  },

  /** Distinct suppliers with at least one catalog line, per item — the list's Suppliers column (§30.1). */
  countSuppliersByItem: async (siteId: string, inventoryItemIds: string[]): Promise<Map<string, number>> => {
    if (inventoryItemIds.length === 0) return new Map();
    const pairs = await prisma.supplierItem.groupBy({
      by: ['inventoryItemId', 'supplierId'],
      where: { siteId, inventoryItemId: { in: inventoryItemIds } },
    });
    const counts = new Map<string, number>();
    for (const pair of pairs) counts.set(pair.inventoryItemId, (counts.get(pair.inventoryItemId) ?? 0) + 1);
    return counts;
  },

  /** Live items per type — the counts on the catalog's type chips (§30.1). */
  countLiveByType: async (siteId: string): Promise<Record<InventoryItemType, number>> => {
    const groups = await prisma.inventoryItem.groupBy({ by: ['type'], where: { siteId, deletedAt: null }, _count: { _all: true } });
    const counts: Record<InventoryItemType, number> = { STOCKED: 0, RAW_INGREDIENT: 0, PREPPED: 0 };
    for (const group of groups) counts[group.type] = group._count._all;
    return counts;
  },

  /**
   * Live items still on placeholder units from seeding (API_CONTRACT.md §29.3): the usage unit equals the
   * buy unit (case- and space-insensitive) and neither a pack size nor a conversion factor was entered.
   * A column-to-column comparison, which Prisma's filter API cannot express, so it is raw SQL.
   */
  findNeedsSetupIds: async (siteId: string): Promise<string[]> => {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM inventory_items
      WHERE organization_id = ${siteId}
        AND deleted_at IS NULL
        AND pack_size IS NULL
        AND conversion_factor IS NULL
        AND lower(btrim(usage_unit)) = lower(btrim(buy_unit))
      ORDER BY created_at ASC, id ASC`;
    return rows.map((r) => r.id);
  },

  /** Live items created at or after `since` — "added this week". */
  countCreatedSince: async (siteId: string, since: Date): Promise<number> =>
    prisma.inventoryItem.count({ where: { siteId, deletedAt: null, createdAt: { gte: since } } }),

  /** KPI strip counts (F1's four figures) — plan §5.3 `ItemCatalogMetaSchema`. */
  getCatalogMeta: async (
    siteId: string,
  ): Promise<{
    itemsTracked: number;
    typesRepresented: number;
    categoryCount: number;
    retiredCategoryCount: number;
    departmentCount: number;
    supplierCount: number;
  }> => {
    const [itemsTracked, typeGroups, categoryCount, retiredCategoryCount, liveItemsWithTags, supplierCount] =
      await Promise.all([
        prisma.inventoryItem.count({ where: { siteId, deletedAt: null } }),
        prisma.inventoryItem.groupBy({ by: ['type'], where: { siteId, deletedAt: null } }),
        prisma.category.count({ where: { siteId, deletedAt: null } }),
        prisma.category.count({ where: { siteId, deletedAt: { not: null } } }),
        prisma.inventoryItem.findMany({
          where: { siteId, deletedAt: null },
          select: { departmentTags: true },
        }),
        prisma.supplier.count({ where: { siteId, deletedAt: null } }),
      ]);

    const departmentTagsSeen = new Set<DepartmentTag>();
    for (const item of liveItemsWithTags) {
      for (const tag of item.departmentTags) departmentTagsSeen.add(tag);
    }

    return {
      itemsTracked,
      typesRepresented: typeGroups.length,
      categoryCount,
      retiredCategoryCount,
      departmentCount: departmentTagsSeen.size,
      supplierCount,
    };
  },
};

// ---------------------------------------------------------------------------
// Restock levels
// ---------------------------------------------------------------------------

export const restockLevelRepository = {
  findAllByLocation: async (
    siteId: string,
    locationId: string,
  ): Promise<RestockLevel[]> => {
    return prisma.restockLevel.findMany({ where: { siteId, locationId } });
  },

  /** Levels for a specific set of items at one location — joined into the items read path. */
  findByItemIdsForLocation: async (
    siteId: string,
    locationId: string,
    inventoryItemIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> => {
    if (inventoryItemIds.length === 0) return new Map();
    const rows = await prisma.restockLevel.findMany({
      where: { siteId, locationId, inventoryItemId: { in: inventoryItemIds } },
      select: { inventoryItemId: true, level: true },
    });
    return new Map(rows.map((r) => [r.inventoryItemId, r.level]));
  },

  /** Ids of the org's live items, for counting levels that belong to retired items out of a strip. */
  findLiveItemIds: async (siteId: string): Promise<string[]> => {
    const rows = await prisma.inventoryItem.findMany({ where: { siteId, deletedAt: null }, select: { id: true } });
    return rows.map((r) => r.id);
  },

  /** Items live at this org, optionally filtered by search — the restock grid's row set. */
  findLiveItemsForRestock: async (
    siteId: string,
    filters: { departmentTag?: DepartmentTag; search?: string },
  ): Promise<InventoryItem[]> => {
    return prisma.inventoryItem.findMany({
      where: {
        siteId,
        deletedAt: null,
        ...(filters.departmentTag ? { departmentTags: { has: filters.departmentTag } } : {}),
        ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  },

  /**
   * Bulk atomic upsert — `level: null` deletes the row (Flow 19: clearing a level). Every level that
   * actually changes is also written to `restock_level_changes` in the same transaction (§29.2): who,
   * for which location, from what to what. A save that changes nothing logs nothing.
   */
  bulkUpsert: async (
    siteId: string,
    locationId: string,
    setById: string,
    levels: { inventoryItemId: string; level: Prisma.Decimal.Value | null }[],
    reason?: string,
  ): Promise<void> => {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.restockLevel.findMany({
        where: { siteId, locationId, inventoryItemId: { in: levels.map((l) => l.inventoryItemId) } },
        select: { inventoryItemId: true, level: true },
      });
      const before = new Map(existing.map((r) => [r.inventoryItemId, r.level]));
      const changes: Prisma.RestockLevelChangeCreateManyInput[] = [];

      const toClear = levels.filter((l) => l.level === null).map((l) => l.inventoryItemId);
      const toSet = levels.filter((l) => l.level !== null);

      if (toClear.length > 0) {
        await tx.restockLevel.deleteMany({
          where: { siteId, locationId, inventoryItemId: { in: toClear } },
        });
        for (const inventoryItemId of toClear) {
          const old = before.get(inventoryItemId);
          if (old === undefined) continue; // clearing a level that was never set changes nothing
          changes.push({ siteId, locationId, inventoryItemId, oldLevel: old, newLevel: null, changedById: setById, reason });
        }
      }

      for (const l of toSet) {
        const next = new Prisma.Decimal(l.level!);
        await tx.restockLevel.upsert({
          where: { locationId_inventoryItemId: { locationId, inventoryItemId: l.inventoryItemId } },
          update: { level: next, setById },
          create: {
            siteId,
            locationId,
            inventoryItemId: l.inventoryItemId,
            level: next,
            setById,
          },
        });
        const old = before.get(l.inventoryItemId);
        if (old !== undefined && old.equals(next)) continue;
        changes.push({
          siteId,
          locationId,
          inventoryItemId: l.inventoryItemId,
          oldLevel: old ?? null,
          newLevel: next,
          changedById: setById,
          reason,
        });
      }

      if (changes.length > 0) await tx.restockLevelChange.createMany({ data: changes });
    });
  },

  /**
   * Net use per item at one location, for the suggested level (§29.5): the sum over the last
   * `since…now` window and the first use row ever written. Only items with at least one use row appear.
   */
  findUseByItemForLocation: async (
    siteId: string,
    locationId: string,
    since: Date,
  ): Promise<Map<string, ItemUse>> => {
    const base = { siteId, locationId, type: { in: USE_TRANSACTION_TYPES } };
    const [inWindow, first] = await Promise.all([
      prisma.inventoryTransaction.groupBy({
        by: ['inventoryItemId'],
        where: { ...base, createdAt: { gte: since } },
        _sum: { quantity: true },
      }),
      prisma.inventoryTransaction.groupBy({
        by: ['inventoryItemId'],
        where: base,
        _min: { createdAt: true },
      }),
    ]);
    const windowSum = new Map(inWindow.map((r) => [r.inventoryItemId, r._sum.quantity ?? new Prisma.Decimal(0)]));
    const result = new Map<string, ItemUse>();
    for (const row of first) {
      if (!row._min.createdAt) continue;
      // Ledger use is negative, so net use is the negated sum.
      result.set(row.inventoryItemId, {
        useInWindow: (windowSum.get(row.inventoryItemId) ?? new Prisma.Decimal(0)).negated(),
        firstUseAt: row._min.createdAt,
      });
    }
    return result;
  },

  /** Sum of ledger quantity per item at one location — onHandQty, derived live, never stored. */
  sumOnHandByItemForLocation: async (
    siteId: string,
    locationId: string,
    inventoryItemIds?: string[],
  ): Promise<Map<string, Prisma.Decimal>> => {
    const rows = await prisma.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { siteId, locationId, ...(inventoryItemIds ? { inventoryItemId: { in: inventoryItemIds } } : {}) },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.inventoryItemId, r._sum.quantity ?? new Prisma.Decimal(0)]));
  },
};

// ---------------------------------------------------------------------------
// Restock level history (§30.5)
// ---------------------------------------------------------------------------

const restockChangeInclude = {
  changedBy: { select: { id: true, name: true } },
  inventoryItem: { select: { id: true, name: true, usageUnit: true, deletedAt: true } },
  location: { select: { id: true, type: true, siteId: true } },
} satisfies Prisma.RestockLevelChangeInclude;
export type RestockChangeRow = Prisma.RestockLevelChangeGetPayload<{ include: typeof restockChangeInclude }>;

export const restockChangeRepository = {
  /** Newest first. One item, or the location's recent changes across items. */
  list: (siteId: string, locationId: string, filters: { inventoryItemId?: string; limit: number }): Promise<RestockChangeRow[]> =>
    prisma.restockLevelChange.findMany({
      where: { siteId, locationId, ...(filters.inventoryItemId ? { inventoryItemId: filters.inventoryItemId } : {}) },
      include: restockChangeInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filters.limit,
    }),

  findById: (id: string): Promise<RestockChangeRow | null> =>
    prisma.restockLevelChange.findFirst({ where: { id }, include: restockChangeInclude }),

  /** The newest entry for one (location, item) — read back after a put back writes its own. */
  findLatest: (siteId: string, locationId: string, inventoryItemId: string): Promise<RestockChangeRow | null> =>
    prisma.restockLevelChange.findFirst({
      where: { siteId, locationId, inventoryItemId },
      include: restockChangeInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
};

// ---------------------------------------------------------------------------
// "Review a change" counts (B13, §29.6)
// ---------------------------------------------------------------------------

export const itemChangeReviewRepository = {
  /** Every count is a plain count, so an item with no history yields zeros — never null. */
  counts: async (
    inventoryItemId: string,
    siteId: string,
  ): Promise<{
    onHandQty: Prisma.Decimal;
    locationsHoldingStock: number;
    stockEntries: number;
    receipts: number;
    receiptLines: number;
    openOrders: number;
  }> => {
    const receiptWhere = { inventoryItemId, delivery: { siteId } };
    const [perLocation, stockEntries, receiptLines, receiptGroups, openOrderGroups] = await Promise.all([
      prisma.inventoryTransaction.groupBy({
        by: ['locationId'],
        where: { siteId, inventoryItemId },
        _sum: { quantity: true },
      }),
      prisma.inventoryTransaction.count({ where: { siteId, inventoryItemId } }),
      prisma.purchaseDeliveryLine.count({ where: receiptWhere }),
      prisma.purchaseDeliveryLine.groupBy({ by: ['deliveryId'], where: receiptWhere }),
      // An order still to arrive: approved or sent, with this item on a line.
      prisma.purchaseOrderLine.groupBy({
        by: ['orderId'],
        where: { inventoryItemId, order: { siteId, status: { in: ['APPROVED', 'SENT'] } } },
      }),
    ]);
    const zero = new Prisma.Decimal(0);
    const onHandQty = perLocation.reduce((sum, r) => sum.plus(r._sum.quantity ?? zero), zero);
    return {
      onHandQty,
      locationsHoldingStock: perLocation.filter((r) => !(r._sum.quantity ?? zero).isZero()).length,
      stockEntries,
      receipts: receiptGroups.length,
      receiptLines,
      openOrders: openOrderGroups.length,
    };
  },
};
