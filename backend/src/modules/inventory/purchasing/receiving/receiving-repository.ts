/** Receiving a delivery: database access only. Every query carries `siteId`; writes take the service's `tx`. */
import type { Prisma, PurchaseLineResult } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export interface NewDeliveryLine {
  orderLineId: string;
  inventoryItemId: string;
  quantityBuyUnit: Prisma.Decimal;
  quantityUsageUnit: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineOrder: number;
}

export interface NewDelivery {
  siteId: string;
  orderId: string;
  reference: string;
  locationId: string;
  deliveryNoteNo: string;
  deliveryNoteFileId: string | null;
  receivedById: string;
  receivedAt: Date;
  deliveredTotal: Prisma.Decimal;
  notSuppliedTotal: Prisma.Decimal;
  lines: NewDeliveryLine[];
}

export interface LineReceipt {
  receivedQty: Prisma.Decimal;
  deliveredPrice: Prisma.Decimal | null;
  confirmedPrice: Prisma.Decimal;
  result: PurchaseLineResult;
}

export const receivingRepository = {
  /** Creates the delivery and its lines; returns each line's id keyed by the order line it came from. */
  createDelivery: async (tx: Tx, data: NewDelivery): Promise<{ id: string; lineIds: Map<string, string> }> => {
    const { lines, ...delivery } = data;
    const created = await tx.purchaseDelivery.create({ data: { ...delivery, lines: { create: lines } }, select: { id: true, lines: { select: { id: true, orderLineId: true } } } });
    return { id: created.id, lineIds: new Map(created.lines.map((l) => [l.orderLineId, l.id])) };
  },

  recordLineReceipt: async (tx: Tx, orderId: string, lineId: string, receipt: LineReceipt): Promise<void> => {
    await tx.purchaseOrderLine.updateMany({ where: { id: lineId, orderId }, data: receipt });
  },

  /** The item's cost follows the latest receipt, per usage unit (latest-price costing: no averaging). */
  setItemCost: async (tx: Tx, siteId: string, inventoryItemId: string, cost: Prisma.Decimal): Promise<void> => {
    await tx.inventoryItem.updateMany({ where: { id: inventoryItemId, siteId }, data: { currentCost: cost } });
  },
};
