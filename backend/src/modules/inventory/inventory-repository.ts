import { Prisma, type Category, type DepartmentTag, type InventoryItem, type InventoryItemType, type RestockLevel, type Supplier, type SupplierPaymentTerms } from '@prisma/client';
import { prisma } from '../../config/database';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryWithItemCount = Category & { itemCount: number };

const categoryFindByLiveName = async (
  client: Client,
  organizationId: string,
  name: string,
): Promise<Category | null> => {
  return client.category.findFirst({
    where: { organizationId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
  });
};

export const categoryRepository = {
  findAllByOrganization: async (
    organizationId: string,
    includeRetired: boolean,
  ): Promise<CategoryWithItemCount[]> => {
    const categories = await prisma.category.findMany({
      where: { organizationId, ...(includeRetired ? {} : { deletedAt: null }) },
      orderBy: { name: 'asc' },
    });
    if (categories.length === 0) return [];

    const counts = await prisma.inventoryItem.groupBy({
      by: ['categoryId'],
      where: { organizationId, deletedAt: null, categoryId: { in: categories.map((c) => c.id) } },
      _count: { _all: true },
    });
    const countByCategoryId = new Map(counts.map((c) => [c.categoryId, c._count._all]));

    return categories.map((c) => ({ ...c, itemCount: countByCategoryId.get(c.id) ?? 0 }));
  },

  findById: async (id: string, organizationId: string): Promise<Category | null> => {
    return prisma.category.findFirst({ where: { id, organizationId } });
  },

  findByLiveName: async (
    organizationId: string,
    name: string,
    tx: TxClient = prisma,
  ): Promise<Category | null> => {
    return categoryFindByLiveName(tx, organizationId, name);
  },

  create: async (organizationId: string, name: string, tx: TxClient = prisma): Promise<Category> => {
    return tx.category.create({ data: { organizationId, name } });
  },

  rename: async (id: string, organizationId: string, name: string): Promise<Category | null> => {
    const updated = await prisma.category.updateMany({ where: { id, organizationId }, data: { name } });
    if (updated.count === 0) return null;
    return prisma.category.findFirst({ where: { id, organizationId } });
  },

  retire: async (id: string, organizationId: string): Promise<Category | null> => {
    const updated = await prisma.category.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (updated.count === 0) return null;
    return prisma.category.findFirst({ where: { id, organizationId } });
  },

  restore: async (id: string, organizationId: string): Promise<Category | null> => {
    const updated = await prisma.category.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (updated.count === 0) return null;
    return prisma.category.findFirst({ where: { id, organizationId } });
  },

  countLiveItems: async (id: string, organizationId: string): Promise<number> => {
    return prisma.inventoryItem.count({ where: { organizationId, categoryId: id, deletedAt: null } });
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
  departmentTags: DepartmentTag[];
};

export type UpdateInventoryItemInput = Partial<CreateInventoryItemInput>;

export type ListItemsFilters = {
  search?: string;
  type?: InventoryItemType;
  categoryId?: string;
  departmentTag?: DepartmentTag;
  includeRetired: boolean;
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
const supplierLineSearch = (organizationId: string, search: string): Prisma.SupplierItemWhereInput => ({
  organizationId,
  OR: [
    { supplierItemCode: { equals: search, mode: 'insensitive' } },
    { supplierItemName: { contains: search, mode: 'insensitive' } },
  ],
});

const searchWhere = (organizationId: string, search: string): Prisma.InventoryItemWhereInput[] => [
  { name: { contains: search, mode: 'insensitive' } },
  { supplierItems: { some: supplierLineSearch(organizationId, search) } },
];

export const inventoryItemRepository = {
  /** The supplier lines that matched a search, for the "Matched Samrat code 190035" caption. */
  findSearchMatches: async (organizationId: string, inventoryItemIds: string[], search: string) =>
    prisma.supplierItem.findMany({
      where: { inventoryItemId: { in: inventoryItemIds }, ...supplierLineSearch(organizationId, search) },
      select: {
        inventoryItemId: true,
        supplierItemName: true,
        supplierItemCode: true,
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

  findAllByOrganization: async (
    organizationId: string,
    filters: ListItemsFilters,
  ): Promise<{ items: InventoryItemWithRelations[]; total: number }> => {
    const where: Prisma.InventoryItemWhereInput = {
      organizationId,
      ...(filters.includeRetired ? {} : { deletedAt: null }),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.departmentTag ? { departmentTags: { has: filters.departmentTag } } : {}),
      ...(filters.search ? { OR: searchWhere(organizationId, filters.search) } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: itemInclude,
        orderBy: { name: 'asc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return { items, total };
  },

  findById: async (
    id: string,
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<InventoryItemWithRelations | null> => {
    return tx.inventoryItem.findFirst({ where: { id, organizationId }, include: itemInclude });
  },

  /** Live items only, for the raw-ingredient-on-hand check (§5.4 rule 2). */
  findLiveByIds: async (ids: string[], organizationId: string): Promise<InventoryItem[]> => {
    if (ids.length === 0) return [];
    return prisma.inventoryItem.findMany({ where: { id: { in: ids }, organizationId, deletedAt: null } });
  },

  /** Case-insensitive match among LIVE items only — duplicate-name warning (§5.4 rule 3). */
  findLiveByName: async (
    organizationId: string,
    name: string,
    excludeId?: string,
  ): Promise<InventoryItem | null> => {
    return prisma.inventoryItem.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  },

  create: async (
    organizationId: string,
    data: CreateInventoryItemInput,
    tx: TxClient = prisma,
  ): Promise<InventoryItemWithRelations> => {
    return tx.inventoryItem.create({
      data: {
        organizationId,
        name: data.name,
        type: data.type,
        categoryId: data.categoryId,
        preferredSupplierId: data.preferredSupplierId,
        buyUnit: data.buyUnit,
        usageUnit: data.usageUnit,
        conversionFactor: data.conversionFactor !== null ? new Prisma.Decimal(data.conversionFactor) : null,
        packSize: data.packSize !== null ? new Prisma.Decimal(data.packSize) : null,
        departmentTags: data.departmentTags,
      },
      include: itemInclude,
    });
  },

  update: async (
    id: string,
    organizationId: string,
    data: UpdateInventoryItemInput,
    tx: TxClient = prisma,
  ): Promise<InventoryItemWithRelations | null> => {
    const updated = await tx.inventoryItem.updateMany({
      where: { id, organizationId },
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
        ...(data.departmentTags !== undefined ? { departmentTags: data.departmentTags } : {}),
      },
    });

    if (updated.count === 0) return null;
    return tx.inventoryItem.findFirst({ where: { id, organizationId }, include: itemInclude });
  },

  /** Soft delete (retire) — never a hard delete; the ledger references items. */
  retire: async (id: string, organizationId: string): Promise<InventoryItemWithRelations | null> => {
    const updated = await prisma.inventoryItem.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (updated.count === 0) return null;
    return prisma.inventoryItem.findFirst({ where: { id, organizationId }, include: itemInclude });
  },

  restore: async (id: string, organizationId: string): Promise<InventoryItemWithRelations | null> => {
    const updated = await prisma.inventoryItem.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (updated.count === 0) return null;
    return prisma.inventoryItem.findFirst({ where: { id, organizationId }, include: itemInclude });
  },

  /** KPI strip counts (F1's four figures) — plan §5.3 `ItemCatalogMetaSchema`. */
  getCatalogMeta: async (
    organizationId: string,
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
        prisma.inventoryItem.count({ where: { organizationId, deletedAt: null } }),
        prisma.inventoryItem.groupBy({ by: ['type'], where: { organizationId, deletedAt: null } }),
        prisma.category.count({ where: { organizationId, deletedAt: null } }),
        prisma.category.count({ where: { organizationId, deletedAt: { not: null } } }),
        prisma.inventoryItem.findMany({
          where: { organizationId, deletedAt: null },
          select: { departmentTags: true },
        }),
        prisma.supplier.count({ where: { organizationId, deletedAt: null } }),
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
    organizationId: string,
    locationId: string,
  ): Promise<RestockLevel[]> => {
    return prisma.restockLevel.findMany({ where: { organizationId, locationId } });
  },

  /** Levels for a specific set of items at one location — joined into the items read path. */
  findByItemIdsForLocation: async (
    organizationId: string,
    locationId: string,
    inventoryItemIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> => {
    if (inventoryItemIds.length === 0) return new Map();
    const rows = await prisma.restockLevel.findMany({
      where: { organizationId, locationId, inventoryItemId: { in: inventoryItemIds } },
      select: { inventoryItemId: true, level: true },
    });
    return new Map(rows.map((r) => [r.inventoryItemId, r.level]));
  },

  /** Items live at this org, optionally filtered by search — the restock grid's row set. */
  findLiveItemsForRestock: async (
    organizationId: string,
    filters: { departmentTag?: DepartmentTag; search?: string },
  ): Promise<InventoryItem[]> => {
    return prisma.inventoryItem.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filters.departmentTag ? { departmentTags: { has: filters.departmentTag } } : {}),
        ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  },

  /** Bulk atomic upsert — `level: null` deletes the row (Flow 19: clearing a level). */
  bulkUpsert: async (
    organizationId: string,
    locationId: string,
    setById: string,
    levels: { inventoryItemId: string; level: Prisma.Decimal.Value | null }[],
  ): Promise<void> => {
    await prisma.$transaction(async (tx) => {
      const toClear = levels.filter((l) => l.level === null).map((l) => l.inventoryItemId);
      const toSet = levels.filter((l) => l.level !== null);

      if (toClear.length > 0) {
        await tx.restockLevel.deleteMany({
          where: { organizationId, locationId, inventoryItemId: { in: toClear } },
        });
      }

      for (const l of toSet) {
        await tx.restockLevel.upsert({
          where: { locationId_inventoryItemId: { locationId, inventoryItemId: l.inventoryItemId } },
          update: { level: new Prisma.Decimal(l.level!), setById },
          create: {
            organizationId,
            locationId,
            inventoryItemId: l.inventoryItemId,
            level: new Prisma.Decimal(l.level!),
            setById,
          },
        });
      }
    });
  },

  /** Sum of ledger quantity per item at one location — onHandQty, derived live, never stored. */
  sumOnHandByItemForLocation: async (
    organizationId: string,
    locationId: string,
  ): Promise<Map<string, Prisma.Decimal>> => {
    const rows = await prisma.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { organizationId, locationId },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.inventoryItemId, r._sum.quantity ?? new Prisma.Decimal(0)]));
  },
};
