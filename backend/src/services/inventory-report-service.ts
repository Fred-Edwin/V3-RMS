import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { inventoryReportRepository } from '../repositories/inventory-report-repository';
import { inventoryTransactionService } from './inventory-transaction-service';
import { ValidationError } from '../utils/errors';

type Actor = NonNullable<Request['user']>;

const ZERO = new Prisma.Decimal(0);

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

const agingBucket = (daysOutstanding: number): '0-7' | '8-30' | '31+' => {
  if (daysOutstanding <= 7) return '0-7';
  if (daysOutstanding <= 30) return '8-30';
  return '31+';
};

export const inventoryReportService = {
  /**
   * Stock valuation (qty + value) — one row per active item. On-hand qty is
   * summed straight from the ledger (`InventoryTransaction`), never a
   * separate counter, matching every prior session's rule.
   */
  getStockValuation: async (actor: Actor, locationId: string) => {
    const organizationId = requireOrganization(actor);
    const [items, onHandByItem] = await Promise.all([
      inventoryReportRepository.findActiveItemsByOrganization(organizationId),
      inventoryReportRepository.sumQuantityByItemGrouped(organizationId, locationId),
    ]);

    const lines = items.map((item) => {
      const onHandQty = onHandByItem.get(item.id) ?? ZERO;
      const value = onHandQty.mul(item.currentCost);
      return {
        inventoryItemId: item.id,
        name: item.name,
        type: item.type,
        usageUnit: item.usageUnit,
        onHandQty,
        currentCost: item.currentCost,
        value,
      };
    });

    const totalValue = lines.reduce((sum, line) => sum.add(line.value), ZERO);
    return { locationId, lines, totalValue };
  },

  /** Low-stock alerts — items whose ledger-derived on-hand qty is at/under reorderLevel. */
  getLowStockAlerts: async (actor: Actor, locationId: string) => {
    const organizationId = requireOrganization(actor);
    const [items, onHandByItem] = await Promise.all([
      inventoryReportRepository.findActiveItemsByOrganization(organizationId),
      inventoryReportRepository.sumQuantityByItemGrouped(organizationId, locationId),
    ]);

    return items
      .map((item) => ({ item, onHandQty: onHandByItem.get(item.id) ?? ZERO }))
      .filter(({ item, onHandQty }) => onHandQty.lessThanOrEqualTo(item.reorderLevel))
      .map(({ item, onHandQty }) => ({
        inventoryItemId: item.id,
        name: item.name,
        onHandQty,
        reorderLevel: item.reorderLevel,
        usageUnit: item.usageUnit,
      }));
  },

  /**
   * Price history for one item, optionally filtered to one supplier —
   * sourced from the RECEIVE ledger. Ad-hoc receives with no linked PO
   * (e.g. seeded/manual ledger entries) have no supplier to attribute —
   * `poNumber`/`supplierId`/`supplierName` are null for those rows rather
   * than throwing, and they're already excluded server-side once a
   * `supplierId` filter is applied (see repository).
   */
  getPriceHistory: async (actor: Actor, inventoryItemId: string, supplierId?: string) => {
    const organizationId = requireOrganization(actor);
    const lines = await inventoryReportRepository.findReceivedLinesForItem(
      organizationId,
      inventoryItemId,
      supplierId,
    );

    return lines.map((line) => ({
      purchaseOrderLineId: line.id,
      poNumber: line.purchaseOrder?.poNumber ?? null,
      supplierId: line.purchaseOrder?.supplierId ?? null,
      supplierName: line.purchaseOrder?.supplier.name ?? null,
      unitPrice: line.unitPrice,
      invoicePrice: line.invoicePrice,
      receivedQty: line.receivedQty,
      receivedAt: line.receivedAt,
    }));
  },

  /**
   * Prep yield by output item/run. Per-run rows are the raw PrepRecords;
   * the rolling average reuses Session 2's own
   * `getRollingAverageForOutputItem` rather than recomputing it here.
   */
  getPrepYield: async (actor: Actor, outputItemId?: string) => {
    const organizationId = requireOrganization(actor);
    const outputItems = outputItemId
      ? [{ id: outputItemId, name: '', usageUnit: '' }]
      : await inventoryReportRepository.findDistinctPrepOutputItems(organizationId);

    const perItem = await Promise.all(
      outputItems.map(async (outputItem) => {
        const [records, rollingAverage] = await Promise.all([
          inventoryReportRepository.findPrepRecordsForOutputItem(organizationId, outputItem.id),
          inventoryTransactionService.getRollingAverageForOutputItem(organizationId, outputItem.id),
        ]);

        const runs = records.map((record) => {
          const totalInputQty = record.lines.reduce((sum, line) => sum.add(line.quantity), ZERO);
          const hasScaledYield = record.scaledExpectedYield && !record.scaledExpectedYield.isZero();
          return {
            prepRecordId: record.id,
            recordedAt: record.recordedAt,
            recordedById: record.recordedById,
            totalInputQty,
            actualYield: record.actualYield,
            scaledExpectedYield: record.scaledExpectedYield,
            /** Variance as a percentage of the scaled-expected yield — null when no recipe existed for this run. */
            variancePct: hasScaledYield
              ? record.actualYield.sub(record.scaledExpectedYield!).div(record.scaledExpectedYield!).mul(100)
              : null,
            unitCost: record.unitCost,
            yieldRatio: totalInputQty.isZero() ? null : record.actualYield.div(totalInputQty),
          };
        });

        return {
          outputItemId: outputItem.id,
          outputItemName: outputItem.name || undefined,
          runs,
          rollingAverage,
        };
      }),
    );

    return outputItemId ? perItem[0] : perItem;
  },

  /**
   * Count discrepancy — submitted/approved stock count lines with a
   * non-zero gap, valued in KES at the item's current cost.
   */
  getCountDiscrepancy: async (actor: Actor, filters: { locationId?: string; stockCountId?: string } = {}) => {
    const organizationId = requireOrganization(actor);
    const lines = await inventoryReportRepository.findCountLinesForOrganization(organizationId, filters);

    return lines.map((line) => {
      const gapQty = line.gapQty ?? ZERO;
      return {
        stockCountLineId: line.id,
        stockCountId: line.stockCount.id,
        stockCountLabel: line.stockCount.label,
        locationId: line.stockCount.locationId,
        scheduledDate: line.stockCount.scheduledDate,
        inventoryItemId: line.inventoryItem.id,
        itemName: line.inventoryItem.name,
        usageUnit: line.inventoryItem.usageUnit,
        expectedQty: line.expectedQty,
        countedQty: line.countedQty,
        gapQty,
        gapValue: gapQty.mul(line.inventoryItem.currentCost),
      };
    });
  },

  /** True cost per prepped item — most recent unitCost per output item, from its own PrepRecords. */
  getTrueCostPerPreppedItem: async (actor: Actor) => {
    const organizationId = requireOrganization(actor);
    const outputItems = await inventoryReportRepository.findDistinctPrepOutputItems(organizationId);

    return Promise.all(
      outputItems.map(async (outputItem) => {
        const records = await inventoryReportRepository.findPrepRecordsForOutputItem(
          organizationId,
          outputItem.id,
        );
        const mostRecent = records[0];
        const avgUnitCost = records.length
          ? records.reduce((sum, r) => sum.add(r.unitCost), ZERO).div(records.length)
          : null;

        return {
          outputItemId: outputItem.id,
          outputItemName: outputItem.name,
          usageUnit: outputItem.usageUnit,
          mostRecentUnitCost: mostRecent?.unitCost ?? null,
          mostRecentRecordedAt: mostRecent?.recordedAt ?? null,
          avgUnitCost,
          sampleCount: records.length,
        };
      }),
    );
  },

  /** Supplier AP aging — 0-7 / 8-30 / 31+ days outstanding, per unpaid/partially-paid invoice. */
  getSupplierApAging: async (actor: Actor) => {
    const organizationId = requireOrganization(actor);
    const invoices = await inventoryReportRepository.findInvoicesForAging(organizationId);
    const now = new Date();

    const lines = invoices.map((invoice) => {
      const outstanding = invoice.amount.sub(invoice.amountPaid);
      const daysOutstanding = Math.floor(
        (now.getTime() - invoice.invoiceDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        supplierInvoiceId: invoice.id,
        supplierId: invoice.supplier.id,
        supplierName: invoice.supplier.name,
        referenceNumber: invoice.referenceNumber,
        amount: invoice.amount,
        amountPaid: invoice.amountPaid,
        outstanding,
        status: invoice.status,
        invoiceDate: invoice.invoiceDate,
        daysOutstanding,
        bucket: agingBucket(daysOutstanding),
      };
    });

    const bySupplier = new Map<string, { supplierId: string; supplierName: string; totalOutstanding: Prisma.Decimal }>();
    for (const line of lines) {
      const existing = bySupplier.get(line.supplierId);
      if (existing) {
        existing.totalOutstanding = existing.totalOutstanding.add(line.outstanding);
      } else {
        bySupplier.set(line.supplierId, {
          supplierId: line.supplierId,
          supplierName: line.supplierName,
          totalOutstanding: line.outstanding,
        });
      }
    }

    return { lines, bySupplier: Array.from(bySupplier.values()) };
  },
};
