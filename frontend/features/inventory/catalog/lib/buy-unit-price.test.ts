import { describe, expect, it } from 'vitest';

import { buyUnitPriceFromCost } from './buy-unit-price';

describe('buyUnitPriceFromCost', () => {
  it('converts a per-kg cost back to a per-bag price', () => {
    expect(buyUnitPriceFromCost('480.0000', '25.0000')).toBe('12000');
  });

  it('is unchanged for an item with no conversion', () => {
    expect(buyUnitPriceFromCost('85', null)).toBe('85');
  });

  it('rounds away the 4dp cost residue', () => {
    expect(buyUnitPriceFromCost('183.3333', '12')).toBe('2200');
  });

  it('returns the input on a nonsensical factor', () => {
    expect(buyUnitPriceFromCost('85', '0')).toBe('85');
  });
});
