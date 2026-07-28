import type { Request } from 'express';
import { Prisma, type WasteReason } from '@prisma/client';
import { prisma } from '../config/database';
import { wasteLogRepository, type WasteLogWithItem } from '../repositories/waste-log-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { NotFoundError, ValidationError } from '../utils/errors';
import type { CreateWasteLogInput } from '../validators/waste-log-schemas';

type Actor = NonNullable<Request['user']>;

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

export const wasteLogService = {
  /**
   * View — Manager sees all entries; Attendant sees only entries they
   * logged themselves (§8.3 footnote's recommended default, confirmed —
   * no client sign-off yet for full-log Attendant visibility, so this is
   * the stricter option, not a guess).
   */
  list: async (actor: Actor, filters: { locationId?: string; reason?: WasteReason } = {}) => {
    const organizationId = requireOrganization(actor);
    const loggedById = actor.role === 'STORE_ATTENDANT' ? actor.id : undefined;
    return wasteLogRepository.findAllByOrganization(organizationId, { ...filters, loggedById });
  },

  getById: async (actor: Actor, id: string): Promise<WasteLogWithItem> => {
    const organizationId = requireOrganization(actor);
    const entry = await wasteLogRepository.findById(id, organizationId);
    if (!entry) {
      throw new NotFoundError('Waste log entry not found');
    }
    if (actor.role === 'STORE_ATTENDANT' && entry.loggedById !== actor.id) {
      throw new NotFoundError('Waste log entry not found');
    }
    return entry;
  },

  /**
   * 3-tap entry — both roles (§8.3). Writes the WasteLog row and a `waste`
   * ledger transaction (negative quantity, at the item's current cost)
   * atomically — waste is a stock movement like any other, per feature
   * plan §1's ledger table.
   */
  create: async (actor: Actor, input: CreateWasteLogInput): Promise<WasteLogWithItem> => {
    const organizationId = requireOrganization(actor);
    const quantity = new Prisma.Decimal(input.quantity);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new ValidationError('Waste quantity must be greater than zero');
    }

    const entry = await prisma.$transaction(async (tx) => {
      const item = await inventoryItemRepository.findById(input.inventoryItemId, organizationId, tx);
      if (!item) {
        throw new NotFoundError('Inventory item not found');
      }

      const wasteLog = await tx.wasteLog.create({
        data: {
          organizationId,
          locationId: input.locationId,
          inventoryItemId: input.inventoryItemId,
          quantity,
          reason: input.reason,
          note: input.note,
          loggedById: actor.id,
        },
      });

      await inventoryTransactionRepository.create(
        {
          organizationId,
          locationId: input.locationId,
          inventoryItemId: input.inventoryItemId,
          type: 'WASTE',
          quantity: quantity.neg(),
          unitCost: item.currentCost,
          userId: actor.id,
          reason: input.reason,
          wasteLogId: wasteLog.id,
        },
        tx,
      );

      return wasteLog;
    });

    return wasteLogService.getById(actor, entry.id);
  },
};
