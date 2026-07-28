import type { Request } from 'express';
import { Prisma, type StockCountStatus } from '@prisma/client';
import { prisma } from '../config/database';
import {
  stockCountRepository,
  type StockCountWithLines,
} from '../repositories/stock-count-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import type {
  CreateStockCountInput,
  SubmitStockCountLineInput,
} from '../validators/stock-count-schemas';

type Actor = NonNullable<Request['user']>;

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

/**
 * D-14: strips `expectedQty` (and `gapQty`, which would leak it back out
 * before approval) from every line when the caller is a Store Attendant.
 * The field must be absent from the JSON response, not merely null/falsy —
 * so this deletes the key rather than setting it to undefined.
 */
const applyBlindCount = (
  count: StockCountWithLines,
  actor: Actor,
): StockCountWithLines | (Omit<StockCountWithLines, 'lines'> & { lines: Record<string, unknown>[] }) => {
  if (actor.role !== 'STORE_ATTENDANT') {
    return count;
  }

  return {
    ...count,
    lines: count.lines.map((line) => {
      const { expectedQty: _expectedQty, gapQty: _gapQty, ...rest } = line;
      return rest;
    }),
  };
};

export const stockCountService = {
  list: async (
    actor: Actor,
    filters: { locationId?: string; status?: StockCountStatus } = {},
  ) => {
    const organizationId = requireOrganization(actor);
    const counts = await stockCountRepository.findAllByOrganization(organizationId, filters);
    return counts.map((count) => applyBlindCount(count, actor));
  },

  getById: async (actor: Actor, id: string) => {
    const organizationId = requireOrganization(actor);
    const count = await stockCountRepository.findById(id, organizationId);
    if (!count) {
      throw new NotFoundError('Stock count not found');
    }
    return applyBlindCount(count, actor);
  },

  /**
   * Creates a count session — Manager-only (§8.3). expectedQty per line is
   * derived from the ledger (Session 2's sumQuantityByItemAndLocation) at
   * the moment of session creation — never a separate mutable counter.
   */
  create: async (actor: Actor, input: CreateStockCountInput): Promise<StockCountWithLines> => {
    const organizationId = requireOrganization(actor);

    const lines = await Promise.all(
      input.inventoryItemIds.map(async (inventoryItemId, index) => {
        const item = await inventoryItemRepository.findById(inventoryItemId, organizationId);
        if (!item) {
          throw new ValidationError(`Unknown inventory item: ${inventoryItemId}`);
        }
        const expectedQty = await inventoryTransactionRepository.sumQuantityByItemAndLocation(
          organizationId,
          inventoryItemId,
          input.locationId,
        );
        return { inventoryItemId, sequence: index + 1, expectedQty };
      }),
    );

    return stockCountRepository.create(organizationId, {
      locationId: input.locationId,
      label: input.label,
      scheduledDate: new Date(input.scheduledDate),
      createdById: actor.id,
      lines,
    });
  },

  /**
   * Execute/submit — both roles (§8.3). Records counted quantities per line
   * (gapQty computed against expectedQty even for an Attendant caller — the
   * value is written and used by Manager approval, just never returned to
   * the Attendant in this or any other response, per D-14/applyBlindCount).
   */
  submitCounts: async (
    actor: Actor,
    stockCountId: string,
    lines: SubmitStockCountLineInput[],
  ): Promise<ReturnType<typeof applyBlindCount>> => {
    const organizationId = requireOrganization(actor);

    const count = await stockCountRepository.findById(stockCountId, organizationId);
    if (!count) {
      throw new NotFoundError('Stock count not found');
    }
    if (count.status !== 'IN_PROGRESS') {
      throw new ConflictError('Stock count must be IN_PROGRESS to submit counts');
    }

    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const existingLine = await stockCountRepository.findLineById(line.lineId, organizationId, tx);
        if (!existingLine || existingLine.stockCountId !== stockCountId) {
          throw new NotFoundError(`Stock count line not found: ${line.lineId}`);
        }
        const countedQty = new Prisma.Decimal(line.countedQty);
        const gapQty = countedQty.sub(existingLine.expectedQty ?? new Prisma.Decimal(0));
        await stockCountRepository.updateLineCount(line.lineId, organizationId, { countedQty, gapQty }, tx);
      }

      await stockCountRepository.transitionStatus(
        stockCountId,
        organizationId,
        ['IN_PROGRESS'],
        'SUBMITTED',
        { submittedById: actor.id, submittedAt: new Date() },
        tx,
      );
    });

    const updated = await stockCountRepository.findById(stockCountId, organizationId);
    return applyBlindCount(updated!, actor);
  },

  /**
   * Approve — Manager-only (§8.3). Posts one `adjustment` transaction per
   * line whose gapQty != 0, using Session 2's ledger repository directly
   * (adjustment has no dedicated costing service function — it just writes
   * the gap at the item's current cost, per feature plan §1's `adjustment`
   * row: any location, either direction).
   */
  approve: async (actor: Actor, stockCountId: string): Promise<StockCountWithLines> => {
    const organizationId = requireOrganization(actor);

    const count = await stockCountRepository.findById(stockCountId, organizationId);
    if (!count) {
      throw new NotFoundError('Stock count not found');
    }
    if (count.status !== 'SUBMITTED') {
      throw new ConflictError('Stock count must be SUBMITTED to approve');
    }

    await prisma.$transaction(async (tx) => {
      for (const line of count.lines) {
        if (!line.gapQty || line.gapQty.isZero()) {
          continue;
        }
        const item = await inventoryItemRepository.findById(line.inventoryItemId, organizationId, tx);
        if (!item) {
          throw new NotFoundError(`Inventory item not found: ${line.inventoryItemId}`);
        }
        await inventoryTransactionRepository.create(
          {
            organizationId,
            locationId: count.locationId,
            inventoryItemId: line.inventoryItemId,
            type: 'ADJUSTMENT',
            quantity: line.gapQty,
            unitCost: item.currentCost,
            userId: actor.id,
            reason: 'Stock count adjustment',
            stockCountLineId: line.id,
          },
          tx,
        );
      }

      await stockCountRepository.transitionStatus(
        stockCountId,
        organizationId,
        ['SUBMITTED'],
        'APPROVED',
        { approvedById: actor.id, approvedAt: new Date() },
        tx,
      );
    });

    return stockCountRepository.findById(stockCountId, organizationId) as Promise<StockCountWithLines>;
  },
};
