import { Prisma } from '@prisma/client';

/**
 * Money arithmetic for Purchasing, on `Prisma.Decimal` so nothing is rounded by floating point. Amounts go on the wire as
 * strings with two decimals ("13776.00"); quantities with up to three ("82.000" is sent as "82").
 */
const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);
const ZERO = D(0);

export const toMoney = (v: Prisma.Decimal.Value): string => D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
export const toQty = (v: Prisma.Decimal.Value): string => D(v).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP).toString();

export interface PricedLine {
  orderedQty: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
  receivedQty?: Prisma.Decimal.Value | null;
  confirmedPrice?: Prisma.Decimal.Value | null;
}

export const lineTotal = (l: Pick<PricedLine, 'orderedQty' | 'unitPrice'>): Prisma.Decimal => D(l.orderedQty).mul(l.unitPrice);

export const orderedTotal = (lines: readonly PricedLine[]): Prisma.Decimal => lines.reduce((t, l) => t.plus(lineTotal(l)), ZERO);

/** What arrived, at the price the receiver confirmed (the order's price when nothing changed). */
export const deliveredTotal = (lines: readonly PricedLine[]): Prisma.Decimal =>
  lines.reduce((t, l) => t.plus(D(l.receivedQty ?? 0).mul(l.confirmedPrice ?? l.unitPrice)), ZERO);

/** The value of what was ordered but not supplied, at the order's price. */
export const notSuppliedTotal = (lines: readonly PricedLine[]): Prisma.Decimal =>
  lines.reduce((t, l) => t.plus(D(l.orderedQty).minus(l.receivedQty ?? 0).mul(l.unitPrice)), ZERO);

/** Usage units in a received quantity: buy units times the pack (a line with no pack is already in usage units). */
export const usageQty = (buyQty: Prisma.Decimal.Value, pack: Prisma.Decimal.Value | null): Prisma.Decimal => D(buyQty).mul(pack ?? 1);

/** The price per buy unit as a cost per usage unit (the ledger's `unitCost` and the item's `currentCost`), to the column's 4dp. */
export const costPerUsageUnit = (pricePerBuyUnit: Prisma.Decimal.Value, pack: Prisma.Decimal.Value | null): Prisma.Decimal =>
  D(pricePerBuyUnit).div(pack ?? 1).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);

export type LineResult = 'AS_ORDERED' | 'PRICE_CHANGED' | 'SHORT' | 'NOT_SUPPLIED';

export const lineResultOf = (orderedQty: Prisma.Decimal.Value, receivedQty: Prisma.Decimal.Value, priceChanged: boolean): LineResult => {
  const received = D(receivedQty);
  if (received.isZero()) return 'NOT_SUPPLIED';
  if (received.lt(orderedQty)) return 'SHORT';
  return priceChanged ? 'PRICE_CHANGED' : 'AS_ORDERED';
};

export interface PaymentFacts {
  kind: 'ADVANCE' | 'INVOICE' | 'REVERSAL';
  status: 'RECORDED' | 'REVERSED';
  amount: Prisma.Decimal.Value;
}

const live = (payments: readonly PaymentFacts[], kind: PaymentFacts['kind']): Prisma.Decimal =>
  payments.filter((p) => p.kind === kind && p.status === 'RECORDED').reduce((t, p) => t.plus(p.amount), ZERO);

export const advancesTotal = (payments: readonly PaymentFacts[]): Prisma.Decimal => live(payments, 'ADVANCE');
export const invoicePaymentsTotal = (payments: readonly PaymentFacts[]): Prisma.Decimal => live(payments, 'INVOICE');
/** Money actually out: recorded advances and invoice payments. A reversed payment and its REVERSAL line both drop out. */
export const paidTotal = (payments: readonly PaymentFacts[]): Prisma.Decimal => advancesTotal(payments).plus(invoicePaymentsTotal(payments));

export interface InvoiceFigures {
  advanceApplied: Prisma.Decimal;
  balance: Prisma.Decimal;
  paidInFull: boolean;
}

/**
 * The invoice after what has been paid. An advance is applied up to the invoice amount; anything above stays as credit
 * with the supplier. A disputed invoice is never "paid in full", whatever has gone out.
 */
export const invoiceFigures = (amount: Prisma.Decimal.Value, payments: readonly PaymentFacts[], disputed: boolean): InvoiceFigures => {
  const invoice = D(amount);
  const applied = Prisma.Decimal.min(advancesTotal(payments), invoice);
  const balance = Prisma.Decimal.max(invoice.minus(applied).minus(invoicePaymentsTotal(payments)), ZERO);
  return { advanceApplied: applied, balance, paidInFull: balance.lt('0.005') && !disputed };
};

/** Advance money left over once the invoice has used what it needs: credit held with the supplier. */
export const advanceCredit = (amount: Prisma.Decimal.Value, payments: readonly PaymentFacts[]): Prisma.Decimal =>
  Prisma.Decimal.max(advancesTotal(payments).minus(amount), ZERO);

export interface Variance {
  amount: Prisma.Decimal;
  differs: boolean;
}

/** Invoice minus delivered value: positive when the supplier charged more. */
export const varianceOf = (invoiceAmount: Prisma.Decimal.Value, delivered: Prisma.Decimal.Value): Variance => {
  const amount = D(invoiceAmount).minus(delivered).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { amount, differs: amount.abs().gte('0.005') };
};

export const addDaysIso = (iso: string, days: number): string => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export const dueDateOf = (invoiceDateIso: string, termsDays: number | null): string => addDaysIso(invoiceDateIso, termsDays ?? 0);

/** Whole buy units to order: round up of (restock level minus on hand) divided by the pack size. Null when never bought before. */
export const suggestedQty = (level: Prisma.Decimal.Value, onHand: Prisma.Decimal.Value, packSize: Prisma.Decimal.Value | null): number | null => {
  if (packSize === null || D(packSize).lte(0)) return null;
  return D(level).minus(onHand).div(packSize).ceil().toNumber();
};

/** Statement ageing buckets by whole days past due at the closing date. */
export type AgeingBucket = 'current' | 'days1to30' | 'days31to60' | 'days61to90' | 'days90plus';

export const ageingBucketOf = (daysPastDue: number): AgeingBucket =>
  daysPastDue <= 0 ? 'current' : daysPastDue <= 30 ? 'days1to30' : daysPastDue <= 60 ? 'days31to60' : daysPastDue <= 90 ? 'days61to90' : 'days90plus';

/** The percentage a price moved against the last order, for the "▲ 4% on the last order" flag. Null when nothing to compare. */
export const priceMovePercent = (price: Prisma.Decimal.Value, previous: Prisma.Decimal.Value | null): number | null => {
  if (previous === null || D(previous).isZero()) return null;
  return D(price).minus(previous).div(previous).mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
};
