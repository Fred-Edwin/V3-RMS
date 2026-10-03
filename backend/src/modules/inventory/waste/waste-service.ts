import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { wasteRepository, type WasteItemOptionRow, type WasteLogWithRelations } from './waste-repository';
import { stockRepository } from '../stock/stock-repository';
import { resolveWasteScope, type StockScope } from '../_shared/stock-scope';
import { inventoryItemRepository } from '../catalog/inventory-repository';
import { prisma } from '../../../config/database';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../utils/errors';
import { mapPrismaError } from '../../../utils/prisma-errors';
import { AttendantCreateWasteResultSchema, AttendantWasteItemOptionListSchema } from './waste-validators';
import type {
  AttendantCreateWasteResult,
  AttendantWasteItemOptionList,
  CreateWasteInput,
  CreateWasteResult,
  ListWasteQuery,
  WasteEntry,
  WasteItemOptionList,
  WasteItemsQuery,
  WasteList,
} from './waste.types';

type Actor = NonNullable<Request['user']>;

const DAY_MS = 24 * 60 * 60 * 1000;

const isAttendant = (actor: Actor): boolean => actor.role === 'STORE_ATTENDANT' && !actor.isDepartmentHead;

/**
 * The cost a waste entry is valued at (plan §1.3): Central Store — the
 * item's current cost now; department — the cost carried into the
 * department (latest DISPATCH_IN unit cost), falling back to current cost
 * when the item was never dispatched in.
 */
export const resolveWasteUnitCost = (
  scope: Pick<StockScope, 'departmentTag'>,
  currentCost: Prisma.Decimal,
  lastDispatchInCost: Prisma.Decimal | null,
): Prisma.Decimal => (scope.departmentTag && lastDispatchInCost ? lastDispatchInCost : currentCost);

const serializeEntry = (log: WasteLogWithRelations): WasteEntry => ({
  id: log.id,
  at: log.createdAt.toISOString(),
  itemId: log.inventoryItem.id,
  itemName: log.inventoryItem.name,
  quantity: log.quantity.toString(),
  usageUnit: log.inventoryItem.usageUnit,
  reason: log.reason,
  note: log.note,
  unitCost: log.unitCost.toString(),
  value: log.quantity.times(log.unitCost).toDecimalPlaces(2).toString(),
  loggedByName: log.loggedBy.name,
});

export const wasteService = {
  /**
   * One WasteLog + one negative WASTE ledger row, in one transaction.
   * Location comes from the actor, never the request. Negative resulting
   * stock is allowed (Flow 21) and reported back as `wentNegative` to roles
   * that may see on-hand; the attendant gets the entry only.
   */
  createWaste: async (actor: Actor, input: CreateWasteInput): Promise<CreateWasteResult | AttendantCreateWasteResult> => {
    const scope = await resolveWasteScope(actor);

    const item = await inventoryItemRepository.findById(input.inventoryItemId, scope.itemOrgId);
    if (!item) throw new NotFoundError('Inventory item not found');
    if (item.deletedAt) throw new ConflictError('This item is retired');
    if (scope.departmentTag && !item.departmentTags.includes(scope.departmentTag)) {
      throw new ForbiddenError('You may only log waste for items used in your department');
    }

    const lastDispatchInCost = scope.departmentTag
      ? await wasteRepository.latestDispatchInCost(scope.locationOrgId, scope.locationId, item.id)
      : null;
    const unitCost = resolveWasteUnitCost(scope, item.currentCost, lastDispatchInCost);
    const quantity = new Prisma.Decimal(input.quantity);

    const { log, onHandAfter } = await prisma
      .$transaction(async (tx) => {
        const created = await wasteRepository.create(
          {
            siteId: scope.locationOrgId,
            locationId: scope.locationId,
            inventoryItemId: item.id,
            quantity,
            reason: input.reason,
            note: input.note && input.note.length > 0 ? input.note : null,
            unitCost,
            loggedById: actor.id,
          },
          tx,
        );

        // Negative-signed, like PREP_CONSUME / DISPATCH_OUT — on-hand is a plain Σ quantity.
        await tx.inventoryTransaction.create({
          data: {
            siteId: scope.locationOrgId,
            locationId: scope.locationId,
            inventoryItemId: item.id,
            type: 'WASTE',
            quantity: quantity.negated(),
            unitCost,
            reason: input.reason,
            wasteLogId: created.id,
            userId: actor.id,
          },
        });

        const after = await stockRepository.onHandForItem(scope.locationOrgId, scope.locationId, item.id, tx);
        return { log: created, onHandAfter: after };
      })
      .catch((error: unknown) => mapPrismaError(error));

    const entry = serializeEntry(log);
    if (isAttendant(actor)) {
      return AttendantCreateWasteResultSchema.parse({ entry });
    }
    return { entry, onHandAfter: onHandAfter.toString(), wentNegative: onHandAfter.lessThan(0) };
  },

  listWaste: async (actor: Actor, query: ListWasteQuery): Promise<WasteList> => {
    const scope = await resolveWasteScope(actor);
    const since = new Date(Date.now() - query.days * DAY_MS);
    const logs = await wasteRepository.findRecentForLocation(scope.locationOrgId, scope.locationId, since);
    const entries = logs.map(serializeEntry);
    const totalValue = logs.reduce((sum, l) => sum.plus(l.quantity.times(l.unitCost)), new Prisma.Decimal(0));
    return { days: query.days, entries, totalValue: totalValue.toDecimalPlaces(2).toString() };
  },

  /**
   * The Log waste item picker. Store Manager / department head get the
   * on-hand + cost hint; the attendant gets cost only, through its own
   * schema (plan §7 Q-A). `/inventory/items` was not reused: it carries no
   * department carried-in cost, and the hint needs one source per role.
   */
  listItemOptions: async (
    actor: Actor,
    query: WasteItemsQuery,
  ): Promise<WasteItemOptionList | AttendantWasteItemOptionList> => {
    const scope = await resolveWasteScope(actor);
    const rows = await wasteRepository.findItemOptions(scope, {
      departmentTag: scope.departmentTag,
      search: query.search,
      limit: query.limit,
    });
    const toOption = (row: WasteItemOptionRow) => ({
      itemId: row.itemId,
      name: row.name,
      usageUnit: row.usageUnit,
      unitCost: resolveWasteUnitCost(scope, row.currentCost, row.lastDispatchInCost).toString(),
    });
    if (isAttendant(actor)) {
      return AttendantWasteItemOptionListSchema.parse({ items: rows.map(toOption) });
    }
    return { items: rows.map((row) => ({ ...toOption(row), onHand: row.onHand.toString() })) };
  },
};
