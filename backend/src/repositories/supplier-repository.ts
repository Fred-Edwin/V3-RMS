import { Prisma, type Supplier, type SupplierItem } from '@prisma/client';
import { prisma } from '../config/database';

export type SupplierWithItemCount = Supplier & { _count: { supplierItems: number } };

export type CreateSupplierInput = {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
};

export type UpdateSupplierInput = {
  name?: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
};

export const supplierRepository = {
  findAllByOrganization: async (
    organizationId: string,
    filters: { isActive?: boolean } = {},
  ): Promise<SupplierWithItemCount[]> => {
    return prisma.supplier.findMany({
      where: {
        organizationId,
        ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      include: { _count: { select: { supplierItems: true } } },
      orderBy: { name: 'asc' },
    });
  },

  findById: async (id: string, organizationId: string): Promise<Supplier | null> => {
    return prisma.supplier.findFirst({ where: { id, organizationId } });
  },

  create: async (organizationId: string, data: CreateSupplierInput): Promise<Supplier> => {
    return prisma.supplier.create({
      data: {
        organizationId,
        name: data.name,
        contactName: data.contactName,
        phone: data.phone,
        email: data.email,
      },
    });
  },

  update: async (
    id: string,
    organizationId: string,
    data: UpdateSupplierInput,
  ): Promise<Supplier | null> => {
    const updated = await prisma.supplier.updateMany({
      where: { id, organizationId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    if (updated.count === 0) return null;
    return prisma.supplier.findFirst({ where: { id, organizationId } });
  },

  /** Soft delete (deactivate) — never a hard delete; POs/invoices reference suppliers. */
  deactivate: async (id: string, organizationId: string): Promise<Supplier | null> => {
    return supplierRepository.update(id, organizationId, { isActive: false });
  },

  // ── SupplierItem (default-supplier-per-item assignment) ──────────────────

  findSupplierItem: async (
    supplierId: string,
    inventoryItemId: string,
    organizationId: string,
  ): Promise<SupplierItem | null> => {
    return prisma.supplierItem.findFirst({
      where: { supplierId, inventoryItemId, organizationId },
    });
  },

  findItemsForSupplier: async (
    supplierId: string,
    organizationId: string,
  ): Promise<(SupplierItem & { inventoryItem: { id: string; name: string } })[]> => {
    return prisma.supplierItem.findMany({
      where: { supplierId, organizationId },
      include: { inventoryItem: { select: { id: true, name: true } } },
      orderBy: { inventoryItem: { name: 'asc' } },
    });
  },

  findSuppliersForItem: async (
    inventoryItemId: string,
    organizationId: string,
  ): Promise<(SupplierItem & { supplier: { id: string; name: string } })[]> => {
    return prisma.supplierItem.findMany({
      where: { inventoryItemId, organizationId },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { supplier: { name: 'asc' } },
    });
  },

  /**
   * Assigns (or updates) a supplier for an item. If `isDefault` is true,
   * unsets any other default for that item first (one default per item).
   */
  assignSupplierItem: async (
    organizationId: string,
    supplierId: string,
    inventoryItemId: string,
    isDefault: boolean,
    lastPrice?: Prisma.Decimal.Value,
  ): Promise<SupplierItem> => {
    return prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.supplierItem.updateMany({
          where: { organizationId, inventoryItemId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const existing = await tx.supplierItem.findFirst({
        where: { supplierId, inventoryItemId, organizationId },
      });

      if (existing) {
        return tx.supplierItem.update({
          where: { id: existing.id },
          data: {
            isDefault,
            ...(lastPrice !== undefined ? { lastPrice: new Prisma.Decimal(lastPrice) } : {}),
          },
        });
      }

      return tx.supplierItem.create({
        data: {
          organizationId,
          supplierId,
          inventoryItemId,
          isDefault,
          ...(lastPrice !== undefined ? { lastPrice: new Prisma.Decimal(lastPrice) } : {}),
        },
      });
    });
  },

  removeSupplierItem: async (
    supplierId: string,
    inventoryItemId: string,
    organizationId: string,
  ): Promise<boolean> => {
    const result = await prisma.supplierItem.deleteMany({
      where: { supplierId, inventoryItemId, organizationId },
    });
    return result.count > 0;
  },

  findDefaultSupplierForItem: async (
    inventoryItemId: string,
    organizationId: string,
  ): Promise<SupplierItem | null> => {
    return prisma.supplierItem.findFirst({
      where: { inventoryItemId, organizationId, isDefault: true },
    });
  },
};
