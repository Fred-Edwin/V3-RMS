import type { Request } from 'express';
import { Prisma, type InventoryItem, type InventoryTransaction, type SupplierItem } from '@prisma/client';
import { prisma } from '../config/database';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { supplierRepository } from '../repositories/supplier-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { inventoryReportRepository } from '../repositories/inventory-report-repository';
import { NotFoundError, ValidationError } from '../utils/errors';
import type {
  AdjustCostInput,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
} from '../validators/inventory-item-schemas';

type Actor = NonNullable<Request['user']>;

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

export const inventoryItemService = {
  /**
   * `locationId` is optional so existing non-Stock-on-Hand callers (e.g.
   * catalog-management screens that don't care about on-hand qty) are
   * unaffected. When provided, attaches `onHandQty` (string, ledger-derived
   * via Session 5's `sumQuantityByItemGrouped` — one grouped query, not a
   * per-item loop like `listLowStock` uses) to every item — both roles can
   * read this per §8.3, so no RBAC change.
   */
  list: async (
    actor: Actor,
    isActive?: boolean,
    locationId?: string,
  ): Promise<(InventoryItem & { onHandQty?: string; lastReceivedUnitCost?: string })[]> => {
    const organizationId = requireOrganization(actor);
    const items = await inventoryItemRepository.findAllByOrganization(organizationId, { isActive });
    if (!locationId) return items;

    const [onHandByItemId, lastReceivedByItemId] = await Promise.all([
      inventoryReportRepository.sumQuantityByItemGrouped(organizationId, locationId),
      inventoryTransactionRepository.findLatestReceiveUnitCostByItemGrouped(organizationId),
    ]);
    return items.map((item) => ({
      ...item,
      onHandQty: (onHandByItemId.get(item.id) ?? new Prisma.Decimal(0)).toString(),
      lastReceivedUnitCost: lastReceivedByItemId.get(item.id)?.toString(),
    }));
  },

  getById: async (actor: Actor, id: string): Promise<InventoryItem> => {
    const organizationId = requireOrganization(actor);
    const item = await inventoryItemRepository.findById(id, organizationId);
    if (!item) {
      throw new NotFoundError('Inventory item not found');
    }
    return item;
  },

  create: async (actor: Actor, input: CreateInventoryItemInput): Promise<InventoryItem> => {
    const organizationId = requireOrganization(actor);

    if (input.defaultSupplierId) {
      const supplier = await supplierRepository.findById(input.defaultSupplierId, organizationId);
      if (!supplier) {
        throw new ValidationError('defaultSupplierId does not reference a known supplier');
      }
    }

    return inventoryItemRepository.create(organizationId, input);
  },

  update: async (
    actor: Actor,
    id: string,
    input: UpdateInventoryItemInput,
  ): Promise<InventoryItem> => {
    const organizationId = requireOrganization(actor);
    const item = await inventoryItemRepository.update(id, organizationId, input);
    if (!item) {
      throw new NotFoundError('Inventory item not found');
    }
    return item;
  },

  /** Soft delete — see repository comment. Deletion never removes the row. */
  deactivate: async (actor: Actor, id: string): Promise<InventoryItem> => {
    const organizationId = requireOrganization(actor);
    const item = await inventoryItemRepository.deactivate(id, organizationId);
    if (!item) {
      throw new NotFoundError('Inventory item not found');
    }
    return item;
  },

  /**
   * Low-stock items (on-hand <= reorderLevel), on-hand derived from the
   * ledger per item (Session 2's sumQuantityByItemAndLocation) — never a
   * second stock counter.
   */
  listLowStock: async (
    actor: Actor,
    locationId: string,
  ): Promise<(InventoryItem & { onHandQty: string })[]> => {
    const organizationId = requireOrganization(actor);
    const activeItems = await inventoryItemRepository.findAllByOrganization(organizationId, {
      isActive: true,
    });

    const onHandByItemId = new Map<string, Prisma.Decimal>();
    for (const item of activeItems) {
      const onHand = await inventoryTransactionRepository.sumQuantityByItemAndLocation(
        organizationId,
        item.id,
        locationId,
      );
      onHandByItemId.set(item.id, onHand);
    }

    const lowStockItems = await inventoryItemRepository.findLowStock(organizationId, onHandByItemId);
    return lowStockItems.map((item) => ({
      ...item,
      onHandQty: (onHandByItemId.get(item.id) ?? new Prisma.Decimal(0)).toString(),
    }));
  },

  /**
   * Manual cost override — Manager-only (route-gated). The weighted-average
   * currentCost can drift from reality (a supplier's real current price, a
   * data-entry mistake in an old receipt) with no way to correct it short
   * of fabricating a fake receive. This sets currentCost directly rather
   * than blending it, and posts a zero-quantity ADJUSTMENT transaction
   * carrying the required reason — an audit trail entry, not a silent
   * overwrite, following the same InventoryTransaction-as-audit-log pattern
   * as Stock Count adjustments and receiving reversals.
   */
  adjustCost: async (actor: Actor, itemId: string, input: AdjustCostInput): Promise<InventoryItem> => {
    const organizationId = requireOrganization(actor);
    const item = await inventoryItemRepository.findById(itemId, organizationId);
    if (!item) {
      throw new NotFoundError('Inventory item not found');
    }

    const newBuyUnitCost = new Prisma.Decimal(input.newBuyUnitCost);
    const newUsageUnitCost = newBuyUnitCost.div(item.conversionFactor);

    await prisma.$transaction(async (tx) => {
      await inventoryItemRepository.updateCurrentCost(itemId, organizationId, newUsageUnitCost, tx);
      await inventoryTransactionRepository.create(
        {
          organizationId,
          locationId: input.locationId,
          inventoryItemId: itemId,
          type: 'ADJUSTMENT',
          quantity: new Prisma.Decimal(0),
          unitCost: newUsageUnitCost,
          userId: actor.id,
          reason: `Cost adjustment: ${input.reason}`,
        },
        tx,
      );
    });

    return inventoryItemService.getById(actor, itemId);
  },

  /**
   * Movement history (the full ledger slice) for one item at one location —
   * powers Stock on Hand's side-panel drill-in (§8.1 row 1). Reuses Session
   * 2's `findByItemAndLocation`, newest first (that repository method
   * orders `asc` for costing-replay purposes; reversed here for display).
   */
  getTransactions: async (
    actor: Actor,
    itemId: string,
    locationId: string,
  ): Promise<InventoryTransaction[]> => {
    const organizationId = requireOrganization(actor);
    const item = await inventoryItemRepository.findById(itemId, organizationId);
    if (!item) {
      throw new NotFoundError('Inventory item not found');
    }
    const transactions = await inventoryTransactionRepository.findByItemAndLocation(
      organizationId,
      itemId,
      locationId,
    );
    return [...transactions].reverse();
  },

  /**
   * Every supplier currently assigned to this item (Item Catalog's Default
   * Supplier control needs this to know the current default when editing an
   * *existing* item, not just at creation — the field was previously
   * create-only because there was no read path for it).
   */
  getSuppliers: async (
    actor: Actor,
    itemId: string,
  ): Promise<(SupplierItem & { supplier: { id: string; name: string } })[]> => {
    const organizationId = requireOrganization(actor);
    const item = await inventoryItemRepository.findById(itemId, organizationId);
    if (!item) {
      throw new NotFoundError('Inventory item not found');
    }
    return supplierRepository.findSuppliersForItem(itemId, organizationId);
  },
};
