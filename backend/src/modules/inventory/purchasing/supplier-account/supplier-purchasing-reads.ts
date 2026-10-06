/**
 * What the Suppliers module reads from Purchasing: deliveries, invoices and payments per supplier. Database access only; every
 * query carries `siteId` (column `organization_id`). It replaces the reads the Suppliers module used to make on the old
 * goods-receipt, supplier-invoice and supplier-payment tables, and returns the same shapes so the screens do not change.
 */
import { Prisma, type SupplierPayMethodType } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { openInvoiceCount, owedBySupplier, priceAlertOf, summaryOf, type DeliveryRow, type InvoiceRow, type PaymentRow, type PurchasingSummary } from './supplier-purchasing-logic';

type Decimal = Prisma.Decimal;

export interface ReceiptSignedAt {
  id: string;
  reference: string;
  signedAt: Date;
  itemIds: string[];
}

export interface AlertLine {
  inventoryItemId: string;
  packBuyUnit: string | null;
  packSize: Decimal | null;
  priceAlertPct: Decimal;
  priceAlertPrevPrice: Decimal | null;
  signedAt: Date;
}

const live = { status: { not: 'VOIDED' as const } };

const loadInvoicesAndPayments = async (siteId: string, supplierIds?: readonly string[]): Promise<{ invoices: InvoiceRow[]; payments: PaymentRow[] }> => {
  const supplier = supplierIds ? { supplierId: { in: [...supplierIds] } } : {};
  const [invoices, payments] = await Promise.all([
    prisma.purchaseInvoice.findMany({ where: { siteId, ...supplier, ...live }, select: { orderId: true, supplierId: true, invoiceDate: true, amount: true, disputed: true } }),
    prisma.purchasePayment.findMany({ where: { siteId, ...supplier }, select: { orderId: true, kind: true, status: true, amount: true, paidOn: true } }),
  ]);
  return { invoices, payments };
};

export const supplierPurchasingReads = {
  /** What we owe each of these suppliers (all suppliers when none are named). */
  owedBySupplier: async (siteId: string, supplierIds?: readonly string[]): Promise<Map<string, Decimal>> => {
    const { invoices, payments } = await loadInvoicesAndPayments(siteId, supplierIds);
    return owedBySupplier(invoices, payments);
  },

  /** Invoices not yet fully paid: a supplier with any cannot be archived. */
  countOpenInvoices: async (supplierId: string, siteId: string): Promise<number> => {
    const { invoices, payments } = await loadInvoicesAndPayments(siteId, [supplierId]);
    return openInvoiceCount(invoices, payments);
  },

  /** Deliveries of one supplier received at exactly these moments, with the items on each (the Catalog tab's "from receipt"). */
  findReceiptsSignedAt: async (supplierId: string, siteId: string, times: Date[]): Promise<ReceiptSignedAt[]> => {
    if (times.length === 0) return [];
    const rows = await prisma.purchaseDelivery.findMany({
      where: { siteId, order: { supplierId }, receivedAt: { in: times } },
      select: { id: true, reference: true, receivedAt: true, lines: { select: { inventoryItemId: true } } },
    });
    return rows.map((r) => ({ id: r.id, reference: r.reference, signedAt: r.receivedAt, itemIds: r.lines.map((l) => l.inventoryItemId) }));
  },

  /** Delivered lines of one supplier whose confirmed price moved from the order's price since `since`, newest first. */
  findPriceAlertLines: async (supplierId: string, siteId: string, since: Date): Promise<AlertLine[]> => {
    const rows = await prisma.purchaseOrderLine.findMany({
      where: { confirmedPrice: { not: null }, order: { siteId, supplierId, delivery: { receivedAt: { gte: since } } } },
      select: { inventoryItemId: true, buyUnit: true, packSize: true, unitPrice: true, confirmedPrice: true, order: { select: { delivery: { select: { receivedAt: true } } } } },
      orderBy: { order: { delivery: { receivedAt: 'desc' } } },
    });
    return rows.flatMap((r) => {
      const alert = priceAlertOf(r);
      const at = r.order.delivery?.receivedAt;
      return alert && at ? [{ inventoryItemId: r.inventoryItemId, packBuyUnit: r.buyUnit, packSize: r.packSize, priceAlertPct: new Prisma.Decimal(alert.pct), priceAlertPrevPrice: alert.previous, signedAt: at }] : [];
    });
  },

  /** When the supplier last delivered this item before `before` (the date an alert compares against), if ever. */
  findPreviousSignedAt: async (supplierId: string, siteId: string, inventoryItemId: string, before: Date): Promise<Date | null> => {
    const previous = await prisma.purchaseDelivery.findFirst({
      where: { siteId, order: { supplierId }, receivedAt: { lt: before }, lines: { some: { inventoryItemId } } },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true },
    });
    return previous?.receivedAt ?? null;
  },

  /** Delivery lines of one supplier, newest first, for the "pack not on file" check (the service compares them to today's catalog). */
  findDeliveredPacks: (supplierId: string, siteId: string, limit: number) =>
    prisma.purchaseDeliveryLine.findMany({
      where: { delivery: { siteId, order: { supplierId } } },
      select: {
        id: true,
        inventoryItemId: true,
        unitPrice: true,
        orderLine: { select: { buyUnit: true, packSize: true } },
        delivery: { select: { id: true, reference: true, receivedAt: true } },
        inventoryItem: { select: { name: true } },
      },
      orderBy: { delivery: { receivedAt: 'desc' } },
      take: limit,
    }),

  /** Deliveries for the document timeline. */
  signedReceipts: async (supplierId: string, siteId: string, limit?: number) => {
    const rows = await prisma.purchaseDelivery.findMany({
      where: { siteId, order: { supplierId } },
      orderBy: { receivedAt: 'desc' },
      ...(limit ? { take: limit } : {}),
      select: { id: true, reference: true, receivedAt: true, deliveredTotal: true, receivedBy: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({ id: r.id, reference: r.reference, signedAt: r.receivedAt as Date | null, receiptTotal: r.deliveredTotal, signedBy: r.receivedBy }));
  },

  /** Live invoices for the document timeline. A disputed invoice reads OPEN, a settled one RESOLVED. */
  invoices: async (supplierId: string, siteId: string, limit: number) => {
    const rows = await prisma.purchaseInvoice.findMany({
      where: { siteId, supplierId, ...live },
      orderBy: { invoiceDate: 'desc' },
      take: limit,
      select: { id: true, number: true, invoiceDate: true, amount: true, disputed: true, settledAt: true, varianceReason: true, enteredAt: true, enteredBy: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.number,
      invoiceDate: r.invoiceDate,
      amountBilled: r.amount,
      disputeStatus: (r.disputed ? 'OPEN' : r.settledAt ? 'RESOLVED' : null) as 'OPEN' | 'RESOLVED' | null,
      disputeReason: r.varianceReason,
      updatedAt: r.settledAt ?? r.enteredAt,
      recordedBy: r.enteredBy,
    }));
  },

  /** Payments (advances, invoice payments and reversals) for the document timeline. */
  payments: async (supplierId: string, siteId: string, limit: number) => {
    const rows = await prisma.purchasePayment.findMany({
      where: { siteId, supplierId },
      orderBy: { paidOn: 'desc' },
      take: limit,
      select: { id: true, paidOn: true, amount: true, method: true, reference: true, reversesId: true, recordedBy: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({ id: r.id, paidAt: r.paidOn, amount: r.amount, method: r.method as SupplierPayMethodType, reference: r.reference, reversalOfId: r.reversesId, recordedBy: r.recordedBy }));
  },

  /** The summary strip: spend, last purchase, price alerts, short deliveries, average days to pay. */
  summary: async (supplierId: string, siteId: string): Promise<PurchasingSummary> => {
    const [deliveries, { invoices, payments }] = await Promise.all([loadDeliveries(siteId, supplierId), loadInvoicesAndPayments(siteId, [supplierId])]);
    return summaryOf(deliveries, invoices, payments);
  },

  /** Deliveries since `since`, with how many of their lines fired a price alert, and the latest delivery time (the Catalog strip). */
  catalogStrip: async (supplierId: string, siteId: string, since: Date) => {
    const [recent, latest] = await Promise.all([
      loadDeliveries(siteId, supplierId, since),
      prisma.purchaseDelivery.findFirst({ where: { siteId, order: { supplierId } }, orderBy: { receivedAt: 'desc' }, select: { receivedAt: true } }),
    ]);
    return { recentSpend: recent.reduce((t, d) => t.plus(d.deliveredTotal), new Prisma.Decimal(0)), priceAlerts: recent.reduce((n, d) => n + d.lines.filter((l) => priceAlertOf(l) !== null).length, 0), lastReceiptAt: latest?.receivedAt ?? null };
  },
};

const loadDeliveries = async (siteId: string, supplierId: string, since?: Date): Promise<DeliveryRow[]> => {
  const rows = await prisma.purchaseDelivery.findMany({
    where: { siteId, order: { supplierId }, ...(since ? { receivedAt: { gte: since } } : {}) },
    select: { receivedAt: true, deliveredTotal: true, order: { select: { lines: { select: { result: true, unitPrice: true, confirmedPrice: true } } } } },
  });
  return rows.map((r) => ({ receivedAt: r.receivedAt, deliveredTotal: r.deliveredTotal, lines: r.order.lines }));
};
