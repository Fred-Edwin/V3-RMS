import { Prisma, type InventoryTransaction, type InventoryTransactionType } from '@prisma/client';
import { prisma } from '../config/database';

type TxClient = Prisma.TransactionClient;

export type CreateInventoryTransactionInput = {
  organizationId: string;
  locationId: string;
  inventoryItemId: string;
  type: InventoryTransactionType;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  userId: string;
  reason?: string;
  purchaseOrderLineId?: string;
  prepRecordId?: string;
  wasteLogId?: string;
  stockCountLineId?: string;
};

export const inventoryTransactionRepository = {
  create: async (
    input: CreateInventoryTransactionInput,
    tx: TxClient = prisma,
  ): Promise<InventoryTransaction> => {
    return tx.inventoryTransaction.create({
      data: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        inventoryItemId: input.inventoryItemId,
        type: input.type,
        quantity: input.quantity,
        unitCost: input.unitCost,
        userId: input.userId,
        reason: input.reason,
        purchaseOrderLineId: input.purchaseOrderLineId,
        prepRecordId: input.prepRecordId,
        wasteLogId: input.wasteLogId,
        stockCountLineId: input.stockCountLineId,
      },
    });
  },

  createMany: async (
    inputs: CreateInventoryTransactionInput[],
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.inventoryTransaction.createMany({
      data: inputs.map((input) => ({
        organizationId: input.organizationId,
        locationId: input.locationId,
        inventoryItemId: input.inventoryItemId,
        type: input.type,
        quantity: input.quantity,
        unitCost: input.unitCost,
        userId: input.userId,
        reason: input.reason,
        purchaseOrderLineId: input.purchaseOrderLineId,
        prepRecordId: input.prepRecordId,
        wasteLogId: input.wasteLogId,
        stockCountLineId: input.stockCountLineId,
      })),
    });
  },

  findByItemAndLocation: async (
    organizationId: string,
    inventoryItemId: string,
    locationId: string,
    tx: TxClient = prisma,
  ): Promise<InventoryTransaction[]> => {
    return tx.inventoryTransaction.findMany({
      where: { organizationId, inventoryItemId, locationId },
      orderBy: { createdAt: 'asc' },
    });
  },

  sumQuantityByItemAndLocation: async (
    organizationId: string,
    inventoryItemId: string,
    locationId: string,
    tx: TxClient = prisma,
  ): Promise<Prisma.Decimal> => {
    const result = await tx.inventoryTransaction.aggregate({
      where: { organizationId, inventoryItemId, locationId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? new Prisma.Decimal(0);
  },

  /** Most recent RECEIVE transaction for a PO line — used to reverse a receiving mistake. */
  findLatestReceiveByPurchaseOrderLine: async (
    organizationId: string,
    purchaseOrderLineId: string,
    tx: TxClient = prisma,
  ): Promise<InventoryTransaction | null> => {
    return tx.inventoryTransaction.findFirst({
      where: { organizationId, purchaseOrderLineId, type: 'RECEIVE' },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Most recent RECEIVE unit cost per item across an organization (not
   * location-scoped — Central Store is the only receiving location in
   * Phase 1, and price history is an organization-wide concept). Distinct
   * from `currentCost` (a weighted average): this is what was actually
   * paid on the last delivery, for Stock on Hand's "last received price"
   * column. Two queries (`groupBy` can't return a sibling column's value
   * for the max row in one pass) rather than a per-item loop.
   */
  findLatestReceiveUnitCostByItemGrouped: async (
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<Map<string, Prisma.Decimal>> => {
    const latest = await tx.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { organizationId, type: 'RECEIVE' },
      _max: { createdAt: true },
    });
    if (latest.length === 0) return new Map();

    const rows = await tx.inventoryTransaction.findMany({
      where: {
        organizationId,
        type: 'RECEIVE',
        OR: latest.map((row) => ({
          inventoryItemId: row.inventoryItemId,
          createdAt: row._max.createdAt ?? undefined,
        })),
      },
      select: { inventoryItemId: true, unitCost: true, createdAt: true },
    });

    const result = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      result.set(row.inventoryItemId, row.unitCost);
    }
    return result;
  },
};
