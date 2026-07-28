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
};
