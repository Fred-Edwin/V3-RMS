import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

/**
 * Query helpers for the Session 5 reports layer. All on-hand/valuation
 * figures are derived from `InventoryTransaction` (the ledger) — never a
 * second mutable counter — matching every prior session's approach (see
 * `inventoryTransactionRepository.sumQuantityByItemAndLocation`).
 */
export const inventoryReportRepository = {
  /** All active items with their current cost, for stock valuation / low-stock. */
  findActiveItemsByOrganization: async (organizationId: string) => {
    return prisma.inventoryItem.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        buyUnit: true,
        usageUnit: true,
        reorderLevel: true,
        currentCost: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  /** On-hand qty per item, grouped, for one location (the Phase 1 Central Store). */
  sumQuantityByItemGrouped: async (
    organizationId: string,
    locationId: string,
  ): Promise<Map<string, Prisma.Decimal>> => {
    const rows = await prisma.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { organizationId, locationId },
      _sum: { quantity: true },
    });
    return new Map(rows.map((row) => [row.inventoryItemId, row._sum.quantity ?? new Prisma.Decimal(0)]));
  },

  /**
   * Price history for one item, optionally filtered to one supplier — sourced
   * from the RECEIVE ledger (`InventoryTransaction`), not `PurchaseOrderLine`
   * directly. Every PO receipt writes both rows, but ad-hoc/seeded receives
   * (`inventoryTransactionService.recordReceive` called without a PO line —
   * e.g. `seed-inventory-demo.ts`'s dated real-price history) only write the
   * ledger row, so a PO-line-only query was silently blind to that data.
   *
   * Ad-hoc receives have no supplier attribution via their own PO (there
   * isn't one) — but Phase 1 items are typically assigned to exactly one
   * supplier via `SupplierItem`, and the caller (Suppliers' Items & Pricing
   * list) only ever asks for this item's history *because* it's looking at
   * that exact supplier-item relationship. So when `supplierId` is given,
   * ad-hoc rows are included if-and-only-if that supplier is the one
   * assigned to this item — not for any arbitrary supplier — so a
   * multi-supplier item (if one ever exists) can't have its ad-hoc history
   * wrongly attributed to whichever supplier happens to be asked about.
   */
  findReceivedLinesForItem: async (
    organizationId: string,
    inventoryItemId: string,
    supplierId?: string,
  ) => {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, organizationId },
      select: { conversionFactor: true },
    });
    if (!item) return [];

    let itemBelongsToSupplier = false;
    if (supplierId) {
      const assignment = await prisma.supplierItem.findFirst({
        where: { organizationId, inventoryItemId, supplierId },
        select: { id: true },
      });
      itemBelongsToSupplier = !!assignment;
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        organizationId,
        inventoryItemId,
        type: 'RECEIVE',
        ...(supplierId
          ? {
              OR: [
                { purchaseOrderLine: { purchaseOrder: { supplierId } } },
                ...(itemBelongsToSupplier ? [{ purchaseOrderLineId: null }] : []),
              ],
            }
          : {}),
      },
      select: {
        id: true,
        unitCost: true,
        quantity: true,
        createdAt: true,
        purchaseOrderLine: {
          select: {
            id: true,
            invoicePrice: true,
            purchaseOrder: { select: { id: true, poNumber: true, supplierId: true, supplier: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return transactions.map((tx) => {
      // unitCost is per usage unit (e.g. per gram); convert to buy-unit so
      // ad-hoc-receive rows land in the same unit as PO-line invoicePrice/
      // unitPrice, which are natively buy-unit — otherwise the series would
      // jump discontinuously between the two kinds of row.
      const buyUnitPrice = tx.unitCost.mul(item.conversionFactor);
      return {
        id: tx.purchaseOrderLine?.id ?? tx.id,
        unitPrice: buyUnitPrice,
        invoicePrice: tx.purchaseOrderLine?.invoicePrice ?? null,
        receivedQty: tx.quantity,
        receivedAt: tx.createdAt,
        purchaseOrder: tx.purchaseOrderLine?.purchaseOrder ?? null,
      };
    });
  },

  /** Every PrepRecord for one output item, most-recent first (prep yield report). */
  findPrepRecordsForOutputItem: async (organizationId: string, outputItemId: string) => {
    return prisma.prepRecord.findMany({
      where: { organizationId, outputItemId },
      select: {
        id: true,
        actualYield: true,
        unitCost: true,
        recordedAt: true,
        recordedById: true,
        lines: { select: { inputItemId: true, quantity: true, unitCost: true } },
      },
      orderBy: { recordedAt: 'desc' },
    });
  },

  /** All output items that have at least one PrepRecord — drives the per-item breakdown. */
  findDistinctPrepOutputItems: async (organizationId: string) => {
    const rows = await prisma.prepRecord.findMany({
      where: { organizationId },
      distinct: ['outputItemId'],
      select: { outputItemId: true, outputItem: { select: { id: true, name: true, usageUnit: true } } },
    });
    return rows.map((row) => row.outputItem);
  },

  /** Submitted/approved stock count lines with a non-null gap, for the discrepancy report. */
  findCountLinesForOrganization: async (
    organizationId: string,
    filters: { locationId?: string; stockCountId?: string } = {},
  ) => {
    return prisma.stockCountLine.findMany({
      where: {
        organizationId,
        gapQty: { not: null },
        stockCount: {
          organizationId,
          status: { in: ['SUBMITTED', 'APPROVED'] },
          ...(filters.locationId ? { locationId: filters.locationId } : {}),
          ...(filters.stockCountId ? { id: filters.stockCountId } : {}),
        },
      },
      select: {
        id: true,
        expectedQty: true,
        countedQty: true,
        gapQty: true,
        inventoryItem: { select: { id: true, name: true, usageUnit: true, currentCost: true } },
        stockCount: {
          select: { id: true, label: true, status: true, scheduledDate: true, locationId: true },
        },
      },
      orderBy: { stockCount: { scheduledDate: 'desc' } },
    });
  },

  /** Every SupplierInvoice with its payments, for AP aging. */
  findInvoicesForAging: async (organizationId: string) => {
    return prisma.supplierInvoice.findMany({
      where: { organizationId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      select: {
        id: true,
        referenceNumber: true,
        amount: true,
        amountPaid: true,
        status: true,
        invoiceDate: true,
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { invoiceDate: 'asc' },
    });
  },
};
