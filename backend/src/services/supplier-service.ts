import type { Request } from 'express';
import type { Supplier, SupplierItem } from '@prisma/client';
import { supplierRepository, type SupplierWithItemCount } from '../repositories/supplier-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { NotFoundError, ValidationError } from '../utils/errors';
import type {
  AssignSupplierItemInput,
  CreateSupplierInput,
  UpdateSupplierInput,
} from '../validators/supplier-schemas';

type Actor = NonNullable<Request['user']>;

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

export const supplierService = {
  list: async (actor: Actor, isActive?: boolean): Promise<SupplierWithItemCount[]> => {
    const organizationId = requireOrganization(actor);
    return supplierRepository.findAllByOrganization(organizationId, { isActive });
  },

  getById: async (actor: Actor, id: string): Promise<Supplier> => {
    const organizationId = requireOrganization(actor);
    const supplier = await supplierRepository.findById(id, organizationId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }
    return supplier;
  },

  create: async (actor: Actor, input: CreateSupplierInput): Promise<Supplier> => {
    const organizationId = requireOrganization(actor);
    return supplierRepository.create(organizationId, input);
  },

  update: async (actor: Actor, id: string, input: UpdateSupplierInput): Promise<Supplier> => {
    const organizationId = requireOrganization(actor);
    const supplier = await supplierRepository.update(id, organizationId, input);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }
    return supplier;
  },

  /** Soft delete (deactivate) — never a hard delete; POs/invoices reference suppliers. */
  deactivate: async (actor: Actor, id: string): Promise<Supplier> => {
    const organizationId = requireOrganization(actor);
    const supplier = await supplierRepository.deactivate(id, organizationId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }
    return supplier;
  },

  getItemsForSupplier: async (actor: Actor, supplierId: string) => {
    const organizationId = requireOrganization(actor);
    const supplier = await supplierRepository.findById(supplierId, organizationId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }
    return supplierRepository.findItemsForSupplier(supplierId, organizationId);
  },

  /** Assigns a supplier as (optionally default) supplier for an item. */
  assignSupplierItem: async (
    actor: Actor,
    supplierId: string,
    input: AssignSupplierItemInput,
  ): Promise<SupplierItem> => {
    const organizationId = requireOrganization(actor);

    const supplier = await supplierRepository.findById(supplierId, organizationId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }
    const item = await inventoryItemRepository.findById(input.inventoryItemId, organizationId);
    if (!item) {
      throw new NotFoundError('Inventory item not found');
    }

    return supplierRepository.assignSupplierItem(
      organizationId,
      supplierId,
      input.inventoryItemId,
      input.isDefault ?? false,
      input.lastPrice,
    );
  },

  removeSupplierItem: async (actor: Actor, supplierId: string, inventoryItemId: string): Promise<void> => {
    const organizationId = requireOrganization(actor);
    const removed = await supplierRepository.removeSupplierItem(supplierId, inventoryItemId, organizationId);
    if (!removed) {
      throw new NotFoundError('Supplier-item assignment not found');
    }
  },
};
