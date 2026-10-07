import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { matchOrderLine } from '../_shared/supplier-line-match';
import { openInvoiceCount, owedBySupplier, priceAlertOf, summaryOf } from './supplier-purchasing-logic';

const D = (v: number | string) => new Prisma.Decimal(v);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const pay = (orderId: string, kind: 'ADVANCE' | 'INVOICE' | 'REVERSAL', amount: number, status: 'RECORDED' | 'REVERSED' = 'RECORDED', paidOn = '2026-09-25') => ({ orderId, kind, status, amount: D(amount), paidOn: day(paidOn) });
const inv = (orderId: string, supplierId: string, amount: number, disputed = false, invoiceDate = '2026-09-06') => ({ orderId, supplierId, amount: D(amount), disputed, invoiceDate: day(invoiceDate) });

describe('owedBySupplier and openInvoiceCount', () => {
  const invoices = [inv('o1', 's1', 10000), inv('o2', 's1', 3000, true), inv('o3', 's2', 500)];
  const payments = [pay('o1', 'ADVANCE', 2500), pay('o1', 'INVOICE', 1000), pay('o3', 'INVOICE', 500)];

  it('sums balances after advances and payments, counts a disputed invoice, and leaves a paid one out', () => {
    const owed = owedBySupplier(invoices, payments);
    expect(owed.get('s1')?.toString()).toBe('9500'); // 6,500 + 3,000
    expect(owed.has('s2')).toBe(false);
  });

  it('ignores a reversed payment and its reversal line', () => {
    const owed = owedBySupplier([inv('o1', 's1', 10000)], [pay('o1', 'INVOICE', 4000, 'REVERSED'), pay('o1', 'REVERSAL', -4000)]);
    expect(owed.get('s1')?.toString()).toBe('10000');
  });

  it('counts open invoices (not paid in full)', () => {
    expect(openInvoiceCount(invoices, payments)).toBe(2);
  });
});

describe('priceAlertOf', () => {
  it('flags a confirmed price that moved and gives the percentage and the old price', () => {
    expect(priceAlertOf({ unitPrice: D(2340), confirmedPrice: D(2400) })).toEqual({ pct: 3, previous: D(2340) });
  });
  it('flags nothing when the price held or was never confirmed', () => {
    expect(priceAlertOf({ unitPrice: D(100), confirmedPrice: D(100) })).toBeNull();
    expect(priceAlertOf({ unitPrice: D(100), confirmedPrice: null })).toBeNull();
  });
});

describe('summaryOf', () => {
  const deliveries = [
    { receivedAt: day('2026-09-10'), deliveredTotal: D(10000), lines: [{ result: 'AS_ORDERED', unitPrice: D(100), confirmedPrice: D(100) }] },
    { receivedAt: day('2026-09-20'), deliveredTotal: D(5000), lines: [{ result: 'SHORT', unitPrice: D(100), confirmedPrice: D(110) }, { result: 'AS_ORDERED', unitPrice: D(10), confirmedPrice: D(10) }] },
  ];

  it('totals spend, finds the last purchase, counts alerts and short deliveries, and averages days to pay on paid invoices only', () => {
    const s = summaryOf(deliveries, [inv('o1', 's1', 10000, false, '2026-09-10'), inv('o2', 's1', 5000, false, '2026-09-20')], [pay('o1', 'INVOICE', 10000, 'RECORDED', '2026-09-20')]);
    expect(s).toEqual({ totalSpend: '15000', lastPurchaseAt: '2026-09-20T00:00:00.000Z', receiptsCount: 2, averageDaysToPay: 10, priceAlerts: 1, shortDeliveries: 1 });
  });

  it('has no average when nothing is paid and nothing last purchase when nothing was delivered', () => {
    expect(summaryOf([], [], [])).toEqual({ totalSpend: '0', lastPurchaseAt: null, receiptsCount: 0, averageDaysToPay: null, priceAlerts: 0, shortDeliveries: 0 });
  });
});

describe('matchOrderLine', () => {
  const bag25 = { id: 'a', buyUnit: 'bag', packSize: D(25) };
  const bag50 = { id: 'b', buyUnit: 'bag', packSize: D(50) };
  const bagNoPack = { id: 'c', buyUnit: 'Bag', packSize: null };

  it('takes the exact pack first', () => {
    expect(matchOrderLine([bag25, bag50], { buyUnit: 'bag', packSize: D(50) })?.id).toBe('b');
  });
  it('takes the one line with the same unit and no pack when the order took its pack from the item', () => {
    expect(matchOrderLine([bag25, bagNoPack], { buyUnit: 'bag', packSize: D(10) })?.id).toBe('c');
  });
  it('takes a line that states no unit and no pack', () => {
    expect(matchOrderLine([{ id: 'd', buyUnit: null, packSize: null }], { buyUnit: 'kg', packSize: D(1) })?.id).toBe('d');
  });
  it('never matches a different named pack, and never guesses between several', () => {
    expect(matchOrderLine([bag25], { buyUnit: 'sack', packSize: D(10) })).toBeNull();
    expect(matchOrderLine([bag25, bag50], { buyUnit: 'sack', packSize: D(10) })).toBeNull();
    expect(matchOrderLine([bagNoPack, { id: 'e', buyUnit: 'bag', packSize: null }], { buyUnit: 'bag', packSize: D(10) })).toBeNull();
  });
});
