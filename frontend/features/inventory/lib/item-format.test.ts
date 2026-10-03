import { describe, expect, it } from 'vitest';

import { formatHowWeBuy, formatPackLine, formatUsedBy, itemNeedsSetup, trimDecimal } from './item-format';

const base = { type: 'STOCKED' as const, buyUnit: 'bag', usageUnit: 'kg', conversionFactor: '50.0000' as string | null, packSize: '50.0000' as string | null };

describe('item-format', () => {
  it('trims trailing zeros', () => {
    expect(trimDecimal('25.0000')).toBe('25');
    expect(trimDecimal('12.5000')).toBe('12.5');
    expect(trimDecimal('100')).toBe('100');
  });
  it('how we buy it', () => {
    expect(formatHowWeBuy(base)).toBe('bag = 50 kg');
    expect(formatHowWeBuy({ ...base, buyUnit: 'kg', conversionFactor: null, packSize: null })).toBe('sold by the kg');
    expect(formatHowWeBuy({ ...base, type: 'PREPPED', usageUnit: 'portions' })).toBe('portions');
  });
  it('pack line', () => {
    expect(formatPackLine(base)).toBe('1 bag = 50 kg');
    expect(formatPackLine({ ...base, conversionFactor: null, packSize: null })).toBe('1 bag, no size');
  });
  it('used by', () => {
    expect(formatUsedBy({ type: 'RAW_INGREDIENT', departmentTags: [] })).toBe('Prep only');
    expect(formatUsedBy({ type: 'STOCKED', departmentTags: ['KITCHEN', 'BARISTA'] })).toBe('Kitchen, Barista');
    expect(formatUsedBy({ type: 'STOCKED', departmentTags: [] })).toBe('Central Store only');
  });
  it('needs setup is placeholder units from seeding', () => {
    expect(itemNeedsSetup({ buyUnit: 'kg', usageUnit: 'KG', conversionFactor: null, packSize: null })).toBe(true);
    expect(itemNeedsSetup({ buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', packSize: null })).toBe(false);
    expect(itemNeedsSetup({ buyUnit: 'bag', usageUnit: 'kg', conversionFactor: null, packSize: null })).toBe(false);
  });
});
