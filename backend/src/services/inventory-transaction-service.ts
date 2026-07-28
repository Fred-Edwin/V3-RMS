import { Prisma, type InventoryTransaction, type PrepRecord } from '@prisma/client';
import { prisma } from '../config/database';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { NotFoundError, ValidationError } from '../utils/errors';

export type ReceiveLineInput = {
  inventoryItemId: string;
  /** Quantity received, in the item's buy unit. */
  buyQty: Prisma.Decimal.Value;
  /** Invoice/actual unit price, per buy unit. */
  unitPrice: Prisma.Decimal.Value;
  purchaseOrderLineId?: string;
};

export type PrepInputLine = {
  inventoryItemId: string;
  /** Quantity consumed, in the input item's usage unit. */
  quantity: Prisma.Decimal.Value;
};

export type RecordPrepInput = {
  organizationId: string;
  locationId: string;
  outputItemId: string;
  /** Actual yield produced, in the output item's usage unit. */
  actualYield: Prisma.Decimal.Value;
  inputs: PrepInputLine[];
  recordedById: string;
};

const ZERO = new Prisma.Decimal(0);

/**
 * Weighted-average costing (D-8): new average cost per usage unit after
 * receiving `qty` more stock at `unitCost` (also per usage unit), given the
 * stock on hand and average cost immediately before this receipt.
 *
 * newAvgCost = (onHandQty * oldAvgCost + qty * unitCost) / (onHandQty + qty)
 *
 * If there was no stock on hand (or on-hand is zero/negative — e.g. first
 * ever receive), the new cost is simply this receipt's unit cost.
 */
export const weightedAverageCost = (
  onHandQty: Prisma.Decimal.Value,
  oldAvgCost: Prisma.Decimal.Value,
  incomingQty: Prisma.Decimal.Value,
  incomingUnitCost: Prisma.Decimal.Value,
): Prisma.Decimal => {
  const onHand = new Prisma.Decimal(onHandQty);
  const incoming = new Prisma.Decimal(incomingQty);
  const totalQty = onHand.add(incoming);

  if (totalQty.lessThanOrEqualTo(0)) {
    return new Prisma.Decimal(incomingUnitCost);
  }
  if (onHand.lessThanOrEqualTo(0)) {
    return new Prisma.Decimal(incomingUnitCost);
  }

  const totalValue = onHand.mul(oldAvgCost).add(incoming.mul(incomingUnitCost));
  return totalValue.div(totalQty);
};

export const inventoryTransactionService = {
  /**
   * Records a `receive` transaction for one PO/delivery line and recomputes
   * the item's weighted-average `currentCost`. Always atomic with the item's
   * cost update (D-8). Quantity and cost are both in the item's buy unit;
   * `InventoryItem.currentCost` is stored per usage unit (D-7), so the
   * conversion factor is applied before averaging.
   */
  recordReceive: async (
    params: {
      organizationId: string;
      locationId: string;
      userId: string;
    } & ReceiveLineInput,
  ): Promise<InventoryTransaction> => {
    const { organizationId, locationId, userId, inventoryItemId, purchaseOrderLineId } = params;
    const buyQty = new Prisma.Decimal(params.buyQty);
    const unitPrice = new Prisma.Decimal(params.unitPrice);

    if (buyQty.lessThanOrEqualTo(0)) {
      throw new ValidationError('Received quantity must be greater than zero');
    }
    if (unitPrice.lessThan(0)) {
      throw new ValidationError('Unit price cannot be negative');
    }

    return prisma.$transaction(async (tx) => {
      const item = await inventoryItemRepository.findById(inventoryItemId, organizationId, tx);
      if (!item) {
        throw new NotFoundError('Inventory item not found');
      }

      const usageQty = buyQty.mul(item.conversionFactor);
      const usageUnitCost = unitPrice.div(item.conversionFactor);

      const onHandQty = await inventoryTransactionRepository.sumQuantityByItemAndLocation(
        organizationId,
        inventoryItemId,
        locationId,
        tx,
      );

      const newCost = weightedAverageCost(onHandQty, item.currentCost, usageQty, usageUnitCost);

      const transaction = await inventoryTransactionRepository.create(
        {
          organizationId,
          locationId,
          inventoryItemId,
          type: 'RECEIVE',
          quantity: usageQty,
          unitCost: usageUnitCost,
          userId,
          purchaseOrderLineId,
        },
        tx,
      );

      await inventoryItemRepository.updateCurrentCost(inventoryItemId, organizationId, newCost, tx);

      return transaction;
    });
  },

  /**
   * Prep costing (D-12): given actual input lines and actual yield, computes
   * unitCost = totalInputCost / actualYield, writes prep_consume (one per
   * input) + prep_produce (the output) atomically, and updates the output
   * item's weighted-average currentCost. Also creates the PrepRecord +
   * PrepRecordLine rows in the same transaction.
   */
  recordPrep: async (input: RecordPrepInput): Promise<PrepRecord> => {
    const { organizationId, locationId, outputItemId, recordedById } = input;
    const actualYield = new Prisma.Decimal(input.actualYield);

    if (actualYield.lessThanOrEqualTo(0)) {
      throw new ValidationError('Actual yield must be greater than zero');
    }
    if (input.inputs.length === 0) {
      throw new ValidationError('At least one input line is required');
    }

    return prisma.$transaction(async (tx) => {
      const outputItem = await inventoryItemRepository.findById(outputItemId, organizationId, tx);
      if (!outputItem) {
        throw new NotFoundError('Output inventory item not found');
      }

      const inputItems = await Promise.all(
        input.inputs.map(async (line) => {
          const qty = new Prisma.Decimal(line.quantity);
          if (qty.lessThanOrEqualTo(0)) {
            throw new ValidationError('Prep input quantity must be greater than zero');
          }
          const item = await inventoryItemRepository.findById(line.inventoryItemId, organizationId, tx);
          if (!item) {
            throw new NotFoundError(`Input inventory item not found: ${line.inventoryItemId}`);
          }
          return { item, qty };
        }),
      );

      const totalInputCost = inputItems.reduce(
        (sum, { item, qty }) => sum.add(qty.mul(item.currentCost)),
        ZERO,
      );
      const unitCost = totalInputCost.div(actualYield);

      const priorOutputOnHandQty = await inventoryTransactionRepository.sumQuantityByItemAndLocation(
        organizationId,
        outputItemId,
        locationId,
        tx,
      );

      const prepRecord = await tx.prepRecord.create({
        data: {
          organizationId,
          locationId,
          outputItemId,
          actualYield,
          unitCost,
          recordedById,
          lines: {
            create: inputItems.map(({ item, qty }) => ({
              organizationId,
              inputItemId: item.id,
              quantity: qty,
              unitCost: item.currentCost,
            })),
          },
        },
      });

      await inventoryTransactionRepository.createMany(
        inputItems.map(({ item, qty }) => ({
          organizationId,
          locationId,
          inventoryItemId: item.id,
          type: 'PREP_CONSUME' as const,
          quantity: qty.neg(),
          unitCost: item.currentCost,
          userId: recordedById,
          prepRecordId: prepRecord.id,
        })),
        tx,
      );

      await inventoryTransactionRepository.create(
        {
          organizationId,
          locationId,
          inventoryItemId: outputItemId,
          type: 'PREP_PRODUCE',
          quantity: actualYield,
          unitCost,
          userId: recordedById,
          prepRecordId: prepRecord.id,
        },
        tx,
      );

      const newOutputCost = weightedAverageCost(
        priorOutputOnHandQty,
        outputItem.currentCost,
        actualYield,
        unitCost,
      );
      await inventoryItemRepository.updateCurrentCost(outputItemId, organizationId, newOutputCost, tx);

      return prepRecord;
    });
  },

  /**
   * Rolling-average soft-reference (feature plan §4, "Typical: ~6kg -> ~5.6kg"):
   * averages the last N PrepRecords for a given output item. Informational
   * only — never blocking, never a precondition for prepping (D-12).
   */
  getRollingAverageForOutputItem: async (
    organizationId: string,
    outputItemId: string,
    sampleSize = 5,
  ): Promise<{
    sampleCount: number;
    avgTotalInputQty: Prisma.Decimal | null;
    avgActualYield: Prisma.Decimal | null;
  }> => {
    const records = await prisma.prepRecord.findMany({
      where: { organizationId, outputItemId },
      orderBy: { recordedAt: 'desc' },
      take: sampleSize,
      include: { lines: true },
    });

    if (records.length === 0) {
      return { sampleCount: 0, avgTotalInputQty: null, avgActualYield: null };
    }

    const totalYield = records.reduce((sum, record) => sum.add(record.actualYield), ZERO);
    const totalInputQty = records.reduce(
      (sum, record) => sum.add(record.lines.reduce((lineSum, line) => lineSum.add(line.quantity), ZERO)),
      ZERO,
    );

    return {
      sampleCount: records.length,
      avgTotalInputQty: totalInputQty.div(records.length),
      avgActualYield: totalYield.div(records.length),
    };
  },
};
