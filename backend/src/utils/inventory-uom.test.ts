import { describe, expect, it } from 'vitest';
import {
  buyToUsageQty,
  usageToBuyQty,
  costPerUsageUnit,
  costPerBuyUnit,
} from './inventory-uom';

describe('inventory-uom conversions', () => {
  it('converts buy qty to usage qty (kg -> g)', () => {
    expect(buyToUsageQty('2', 1000).toString()).toBe('2000');
  });

  it('converts usage qty back to buy qty (g -> kg)', () => {
    expect(usageToBuyQty('2000', 1000).toString()).toBe('2');
  });

  it('handles fractional usage-unit deduction (200ml out of a litre-bought item)', () => {
    // Milk bought in litres (buyUnit=L), usage unit ml, conversionFactor 1000.
    // A latte deducts 200ml -> 0.2 L in buy-unit terms.
    expect(usageToBuyQty('200', 1000).toString()).toBe('0.2');
  });

  it('round-trips buy -> usage -> buy without precision loss for a non-integer buy qty', () => {
    const buyQty = '1.75';
    const usage = buyToUsageQty(buyQty, 1000);
    expect(usage.toString()).toBe('1750');
    expect(usageToBuyQty(usage, 1000).toString()).toBe(buyQty);
  });

  it('converts cost per buy unit to cost per usage unit', () => {
    // 650 KES/kg -> 0.65 KES/g
    expect(costPerUsageUnit('650', 1000).toString()).toBe('0.65');
  });

  it('converts cost per usage unit back to cost per buy unit', () => {
    expect(costPerBuyUnit('0.65', 1000).toString()).toBe('650');
  });

  it('handles a conversion factor that does not divide evenly, keeping Decimal precision', () => {
    // Buy unit "case" of 3 items, usage unit "each" -> conversionFactor 3.
    // 1 usage unit costs 10/3, not representable exactly as a float.
    const perUsage = costPerUsageUnit('10', 3);
    expect(perUsage.toString()).toBe('3.3333333333333333333');
  });

  it('handles a fractional conversion factor (buy unit smaller than usage unit)', () => {
    // e.g. buy unit "sack" = 0.5 usage unit "bag" would be unusual, but the
    // math must still hold for conversionFactor < 1.
    expect(buyToUsageQty('4', '0.5').toString()).toBe('2');
    expect(usageToBuyQty('2', '0.5').toString()).toBe('4');
  });
});
