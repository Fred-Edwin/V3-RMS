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

export const inventoryItemRepository = {
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
      ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
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
// Suppliers
// ---------------------------------------------------------------------------

export type SupplierWithRelations = Supplier & { category: { id: string; name: string } | null };

export type CreateSupplierInput = {
  name: string;
  contactName: string | null;
  categoryId: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  defaultPaymentTerms: SupplierPaymentTerms;
};

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

const supplierInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.SupplierInclude;

export const supplierRepository = {
  findAllByOrganization: async (
    organizationId: string,
    filters: { search?: string; includeRetired: boolean; page: number; perPage: number },
  ): Promise<{ suppliers: SupplierWithRelations[]; total: number }> => {
    const where: Prisma.SupplierWhereInput = {
      organizationId,
      ...(filters.includeRetired ? {} : { deletedAt: null }),
      ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: supplierInclude,
        orderBy: { name: 'asc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      prisma.supplier.count({ where }),
    ]);

    return { suppliers, total };
  },

  findById: async (id: string, organizationId: string): Promise<SupplierWithRelations | null> => {
    return prisma.supplier.findFirst({ where: { id, organizationId }, include: supplierInclude });
  },

  findByLiveName: async (organizationId: string, name: string): Promise<Supplier | null> => {
    return prisma.supplier.findFirst({
      where: { organizationId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
    });
  },

  create: async (organizationId: string, data: CreateSupplierInput): Promise<SupplierWithRelations> => {
    return prisma.supplier.create({
      data: {
        organizationId,
        name: data.name,
        contactName: data.contactName,
        categoryId: data.categoryId,
        phone: data.phone,
        email: data.email,
        location: data.location,
        defaultPaymentTerms: data.defaultPaymentTerms,
      },
      include: supplierInclude,
    });
  },

  update: async (
    id: string,
    organizationId: string,
    data: UpdateSupplierInput,
  ): Promise<SupplierWithRelations | null> => {
    const updated = await prisma.supplier.updateMany({
      where: { id, organizationId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.defaultPaymentTerms !== undefined ? { defaultPaymentTerms: data.defaultPaymentTerms } : {}),
      },
    });

    if (updated.count === 0) return null;
    return prisma.supplier.findFirst({ where: { id, organizationId }, include: supplierInclude });
  },

  retire: async (id: string, organizationId: string): Promise<SupplierWithRelations | null> => {
    const updated = await prisma.supplier.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (updated.count === 0) return null;
    return prisma.supplier.findFirst({ where: { id, organizationId }, include: supplierInclude });
  },

  restore: async (id: string, organizationId: string): Promise<SupplierWithRelations | null> => {
    const updated = await prisma.supplier.updateMany({
      where: { id, organizationId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (updated.count === 0) return null;
    return prisma.supplier.findFirst({ where: { id, organizationId }, include: supplierInclude });
  },

  /** Live items still naming this supplier as preferred — blocks retirement (§5.3). */
  findLiveItemsPreferringSupplier: async (
    supplierId: string,
    organizationId: string,
  ): Promise<{ id: string; name: string }[]> => {
    return prisma.inventoryItem.findMany({
      where: { organizationId, preferredSupplierId: supplierId, deletedAt: null },
      select: { id: true, name: true },
    });
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
