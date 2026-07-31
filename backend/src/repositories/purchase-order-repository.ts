import {
  Prisma,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type PurchaseOrderStatus,
} from '@prisma/client';
import { prisma } from '../config/database';

type TxClient = Prisma.TransactionClient;

export type PurchaseOrderWithLines = PurchaseOrder & {
  lines: (PurchaseOrderLine & {
    inventoryItem: { id: string; name: string; buyUnit: string; currentCost: Prisma.Decimal; conversionFactor: Prisma.Decimal };
  })[];
  supplier: { id: string; name: string };
};

export type CreatePurchaseOrderLineInput = {
  inventoryItemId: string;
  orderedQty: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
};

export type CreatePurchaseOrderInput = {
  supplierId: string;
  locationId: string;
  poNumber: string;
  createdById: string;
  lines: CreatePurchaseOrderLineInput[];
};

const detailInclude = {
  supplier: { select: { id: true, name: true } },
  lines: {
    include: {
      inventoryItem: { select: { id: true, name: true, buyUnit: true, currentCost: true, conversionFactor: true } },
    },
  },
} as const;

export const purchaseOrderRepository = {
  findAllByOrganization: async (
    organizationId: string,
    filters: { status?: PurchaseOrderStatus } = {},
  ): Promise<PurchaseOrderWithLines[]> => {
    return prisma.purchaseOrder.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: detailInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  findById: async (
    id: string,
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<PurchaseOrderWithLines | null> => {
    return tx.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: detailInclude,
    });
  },

  create: async (
    organizationId: string,
    data: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderWithLines> => {
    return prisma.purchaseOrder.create({
      data: {
        organizationId,
        supplierId: data.supplierId,
        locationId: data.locationId,
        poNumber: data.poNumber,
        createdById: data.createdById,
        status: 'DRAFT',
        lines: {
          create: data.lines.map((line) => ({
            organizationId,
            inventoryItemId: line.inventoryItemId,
            orderedQty: new Prisma.Decimal(line.orderedQty),
            unitPrice: new Prisma.Decimal(line.unitPrice),
          })),
        },
      },
      include: detailInclude,
    });
  },

  /** Scoped status transition — returns false if no row matched (wrong org, or not in `fromStatus`). */
  transitionStatus: async (
    id: string,
    organizationId: string,
    fromStatuses: PurchaseOrderStatus[],
    toStatus: PurchaseOrderStatus,
    extra: { sentAt?: Date | null; cancelledAt?: Date | null; closedAt?: Date | null } = {},
    tx: TxClient = prisma,
  ): Promise<boolean> => {
    const result = await tx.purchaseOrder.updateMany({
      where: { id, organizationId, status: { in: fromStatuses } },
      data: { status: toStatus, ...extra },
    });
    return result.count > 0;
  },

  updateLineReceipt: async (
    lineId: string,
    organizationId: string,
    data: { receivedQty: Prisma.Decimal.Value; invoicePrice: Prisma.Decimal.Value; receivedAt: Date },
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.purchaseOrderLine.updateMany({
      where: { id: lineId, organizationId },
      data: {
        receivedQty: { increment: new Prisma.Decimal(data.receivedQty) },
        invoicePrice: new Prisma.Decimal(data.invoicePrice),
        receivedAt: data.receivedAt,
      },
    });
  },

  findLineById: async (
    lineId: string,
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<PurchaseOrderLine | null> => {
    return tx.purchaseOrderLine.findFirst({ where: { id: lineId, organizationId } });
  },

  /**
   * Replace a DRAFT PO's lines wholesale — simplest correct semantics for an
   * edit form that lets the Manager add/remove/change lines freely. Only
   * ever called after the caller has confirmed the PO is still DRAFT.
   */
  replaceLines: async (
    purchaseOrderId: string,
    organizationId: string,
    lines: CreatePurchaseOrderLineInput[],
    tx: TxClient,
  ): Promise<void> => {
    await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId, organizationId } });
    await tx.purchaseOrderLine.createMany({
      data: lines.map((line) => ({
        organizationId,
        purchaseOrderId,
        inventoryItemId: line.inventoryItemId,
        orderedQty: new Prisma.Decimal(line.orderedQty),
        unitPrice: new Prisma.Decimal(line.unitPrice),
      })),
    });
  },

  /** Reverses a line's most recent receipt back to not-yet-received. */
  resetLineReceipt: async (
    lineId: string,
    organizationId: string,
    tx: TxClient = prisma,
  ): Promise<void> => {
    await tx.purchaseOrderLine.updateMany({
      where: { id: lineId, organizationId },
      data: { receivedQty: 0, invoicePrice: null, receivedAt: null },
    });
  },
};
