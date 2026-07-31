import { Prisma, type DepartmentTag, type InventoryItem, type InventoryItemType } from '@prisma/client';
import { prisma } from '../config/database';

type TxClient = Prisma.TransactionClient;

export type CreateInventoryItemInput = {
  name: string;
  type: InventoryItemType;
  buyUnit: string;
  usageUnit: string;
  conversionFactor: Prisma.Decimal.Value;
  reorderLevel: Prisma.Decimal.Value;
  departmentTags: DepartmentTag[];
  defaultSupplierId?: string;
};

export type UpdateInventoryItemInput = {
  name?: string;
  type?: InventoryItemType;
  buyUnit?: string;
  usageUnit?: string;
  conversionFactor?: Prisma.Decimal.Value;
  reorderLevel?: Prisma.Decimal.Value;
  departmentTags?: DepartmentTag[];
  isActive?: boolean;
};

/**
 * InventoryItem access. `findById`/`updateCurrentCost` originated in Session 2
 * (costing) — extended here (Session 3) with full catalog CRUD. Kept as one
 * repository rather than splitting, since Session 2's two methods are a
 * strict subset of what a catalog repository needs (same model, same
 * organizationId-scoping rules) and duplicating them would just be two
 * repositories racing to stay in sync on the same table.
 */
export const inventoryItemRepository = {
  findById: async (
    id: string,
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<InventoryItem | null> => {
    return tx.inventoryItem.findFirst({ where: { id, organizationId } });
  },

  findAllByOrganization: async (
    organizationId: string,
    filters: { isActive?: boolean } = {},
  ): Promise<InventoryItem[]> => {
    return prisma.inventoryItem.findMany({
      where: {
        organizationId,
        ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      orderBy: { name: 'asc' },
    });
  },

  findLowStock: async (
    organizationId: string,
    onHandByItemId: Map<string, Prisma.Decimal>,
  ): Promise<InventoryItem[]> => {
    const items = await prisma.inventoryItem.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return items.filter((item) => {
      const onHand = onHandByItemId.get(item.id) ?? new Prisma.Decimal(0);
      return onHand.lessThanOrEqualTo(item.reorderLevel);
    });
  },

  create: async (
    organizationId: string,
    data: CreateInventoryItemInput,
    tx: TxClient = prisma,
  ): Promise<InventoryItem> => {
    return tx.inventoryItem.create({
      data: {
        organizationId,
        name: data.name,
        type: data.type,
        buyUnit: data.buyUnit,
        usageUnit: data.usageUnit,
        conversionFactor: new Prisma.Decimal(data.conversionFactor),
        reorderLevel: new Prisma.Decimal(data.reorderLevel),
        departmentTags: data.departmentTags,
        ...(data.defaultSupplierId
          ? {
              supplierItems: {
                create: {
                  organizationId,
                  supplierId: data.defaultSupplierId,
                  isDefault: true,
                },
              },
            }
          : {}),
      },
    });
  },

  update: async (
    id: string,
    organizationId: string,
    data: UpdateInventoryItemInput,
  ): Promise<InventoryItem | null> => {
    const updated = await prisma.inventoryItem.updateMany({
      where: { id, organizationId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.buyUnit !== undefined ? { buyUnit: data.buyUnit } : {}),
        ...(data.usageUnit !== undefined ? { usageUnit: data.usageUnit } : {}),
        ...(data.conversionFactor !== undefined
          ? { conversionFactor: new Prisma.Decimal(data.conversionFactor) }
          : {}),
        ...(data.reorderLevel !== undefined
          ? { reorderLevel: new Prisma.Decimal(data.reorderLevel) }
          : {}),
        ...(data.departmentTags !== undefined ? { departmentTags: data.departmentTags } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    if (updated.count === 0) return null;
    return prisma.inventoryItem.findFirst({ where: { id, organizationId } });
  },

  updateCurrentCost: async (
    id: string,
    organizationId: string,
    currentCost: Prisma.Decimal,
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.inventoryItem.updateMany({
      where: { id, organizationId },
      data: { currentCost },
    });
  },

  /** Soft delete (deactivate) — never a hard delete, since receipts/prep/PO lines reference items. */
  deactivate: async (id: string, organizationId: string): Promise<InventoryItem | null> => {
    return inventoryItemRepository.update(id, organizationId, { isActive: false });
  },
};
