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

  /** Price history for one item across its received PO lines, optionally filtered to one supplier. */
  findReceivedLinesForItem: async (
    organizationId: string,
    inventoryItemId: string,
    supplierId?: string,
  ) => {
    return prisma.purchaseOrderLine.findMany({
      where: {
        organizationId,
        inventoryItemId,
        receivedAt: { not: null },
        purchaseOrder: supplierId ? { supplierId } : undefined,
      },
      select: {
        id: true,
        invoicePrice: true,
        unitPrice: true,
        receivedQty: true,
        receivedAt: true,
        purchaseOrder: { select: { id: true, poNumber: true, supplierId: true, supplier: { select: { name: true } } } },
      },
      orderBy: { receivedAt: 'asc' },
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
