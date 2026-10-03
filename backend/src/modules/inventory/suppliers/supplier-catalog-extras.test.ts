import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { findLastReceipt, findPriceAlert } from './supplier-catalog-extras';

const d = (v: string) => new Prisma.Decimal(v);
const signed = new Date('2026-10-08T09:00:00Z');

const line = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  inventoryItemId: 'sugar',
  buyUnit: 'bag',
  packSize: d('50'),
  lastPriceAt: signed,
  lastPriceSetBy: null,
  ...over,
});

describe('findLastReceipt', () => {
  const receipts = [{ id: 'r1', reference: 'GRN-1042', signedAt: signed, itemIds: ['sugar', 'oil'] }];

  it('names the receipt that set the price', () => {
    expect(findLastReceipt(line(), receipts)).toEqual({ id: 'r1', reference: 'GRN-1042' });
  });
  it('is null for a price set by hand, an unset price, or another item', () => {
    expect(findLastReceipt(line({ lastPriceSetBy: { id: 'u', name: 'Isabel' } }), receipts)).toBeNull();
    expect(findLastReceipt(line({ lastPriceAt: null }), receipts)).toBeNull();
    expect(findLastReceipt(line({ inventoryItemId: 'flour' }), receipts)).toBeNull();
  });
});

describe('findPriceAlert', () => {
  const bag = line();
  const packet = line({ id: 'l2', buyUnit: 'packet', packSize: d('2') });
  const alert = (over: Record<string, unknown> = {}) => ({
    inventoryItemId: 'sugar', packBuyUnit: 'bag', packSize: d('50'), priceAlertPct: d('6'), priceAlertPrevPrice: d('8630'), signedAt: signed, ...over,
  });

  it('gives an alert to the line whose pack it names, and not to the other pack', () => {
    expect(findPriceAlert(bag, [bag, packet], [alert()])).toMatchObject({ pct: '6', previousPrice: '8630' });
    expect(findPriceAlert(packet, [bag, packet], [alert()])).toBeNull();
  });
  it('an alert that names no pack goes to the only line, never guessed between two', () => {
    const unnamed = alert({ packBuyUnit: null, packSize: null });
    expect(findPriceAlert(bag, [bag], [unnamed])).not.toBeNull();
    expect(findPriceAlert(bag, [bag, packet], [unnamed])).toBeNull();
  });
  it('takes the newest alert', () => {
    const older = alert({ priceAlertPct: d('3'), signedAt: new Date('2026-09-28T09:00:00Z') });
    expect(findPriceAlert(bag, [bag], [older, alert()])?.pct).toBe('6');
  });
});
