import { Prisma } from '@prisma/client';
import { invoiceFigures, priceMovePercent, type PaymentFacts } from '../_shared/money';

/**
 * What the Suppliers module shows about money and deliveries, computed from the purchase tables. Pure: the read repository
 * fetches rows, these functions decide the figures. They replace the old receipt/invoice sums.
 */
const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);
const ZERO = D(0);

export interface InvoiceRow {
  orderId: string;
  supplierId: string;
  invoiceDate: Date;
  amount: Prisma.Decimal;
  disputed: boolean;
}

export interface PaymentRow extends PaymentFacts {
  orderId: string;
  paidOn: Date;
}

const paymentsByOrder = (payments: readonly PaymentRow[]): Map<string, PaymentRow[]> => {
  const byOrder = new Map<string, PaymentRow[]>();
  for (const p of payments) byOrder.set(p.orderId, [...(byOrder.get(p.orderId) ?? []), p]);
  return byOrder;
};

/** What we owe each supplier: the sum of its live invoices that still have a balance (advances and payments counted). */
export const owedBySupplier = (invoices: readonly InvoiceRow[], payments: readonly PaymentRow[]): Map<string, Prisma.Decimal> => {
  const byOrder = paymentsByOrder(payments);
  const owed = new Map<string, Prisma.Decimal>();
  for (const inv of invoices) {
    const { balance } = invoiceFigures(inv.amount, byOrder.get(inv.orderId) ?? [], inv.disputed);
    if (balance.gt(0)) owed.set(inv.supplierId, (owed.get(inv.supplierId) ?? ZERO).plus(balance));
  }
  return owed;
};

/** Open invoices: live, with a balance or in dispute. */
export const openInvoiceCount = (invoices: readonly InvoiceRow[], payments: readonly PaymentRow[]): number => {
  const byOrder = paymentsByOrder(payments);
  return invoices.filter((inv) => !invoiceFigures(inv.amount, byOrder.get(inv.orderId) ?? [], inv.disputed).paidInFull).length;
};

export interface DeliveryRow {
  receivedAt: Date;
  deliveredTotal: Prisma.Decimal;
  lines: Array<{ result: string | null; unitPrice: Prisma.Decimal; confirmedPrice: Prisma.Decimal | null }>;
}

/** A line whose confirmed price moved from the order's price is a price alert; the percentage is how far it moved. */
export const priceAlertOf = (l: { unitPrice: Prisma.Decimal; confirmedPrice: Prisma.Decimal | null }): { pct: number; previous: Prisma.Decimal } | null => {
  if (!l.confirmedPrice || l.confirmedPrice.equals(l.unitPrice)) return null;
  const pct = priceMovePercent(l.confirmedPrice, l.unitPrice);
  return pct === null || pct === 0 ? null : { pct, previous: l.unitPrice };
};

export interface PurchasingSummary {
  totalSpend: string;
  lastPurchaseAt: string | null;
  receiptsCount: number;
  averageDaysToPay: number | null;
  priceAlerts: number;
  shortDeliveries: number;
}

/** The supplier page's summary strip. `averageDaysToPay` counts only invoices that are paid in full. */
export const summaryOf = (deliveries: readonly DeliveryRow[], invoices: readonly InvoiceRow[], payments: readonly PaymentRow[]): PurchasingSummary => {
  const byOrder = paymentsByOrder(payments);
  const last = deliveries.reduce<Date | null>((latest, d) => (!latest || d.receivedAt > latest ? d.receivedAt : latest), null);
  const days: number[] = [];
  for (const inv of invoices) {
    const mine = byOrder.get(inv.orderId) ?? [];
    if (!invoiceFigures(inv.amount, mine, inv.disputed).paidInFull) continue;
    const paidAt = mine.filter((p) => p.kind === 'INVOICE' && p.status === 'RECORDED').reduce<Date | null>((latest, p) => (!latest || p.paidOn > latest ? p.paidOn : latest), null);
    if (paidAt) days.push(Math.max(0, (paidAt.getTime() - inv.invoiceDate.getTime()) / 86_400_000));
  }
  return {
    totalSpend: deliveries.reduce((t, d) => t.plus(d.deliveredTotal), ZERO).toString(),
    lastPurchaseAt: last ? last.toISOString() : null,
    receiptsCount: deliveries.length,
    averageDaysToPay: days.length > 0 ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : null,
    priceAlerts: deliveries.reduce((n, d) => n + d.lines.filter((l) => priceAlertOf(l) !== null).length, 0),
    shortDeliveries: deliveries.filter((d) => d.lines.some((l) => l.result === 'SHORT' || l.result === 'NOT_SUPPLIED')).length,
  };
};
