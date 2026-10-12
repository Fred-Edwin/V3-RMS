import { describe, expect, it } from 'vitest';

import { allowsDecimal } from './units';

describe('allowsDecimal', () => {
  it('weight and volume take a decimal point', () => {
    for (const unit of ['kg', 'g', 'L', 'ml', 'litre']) expect(allowsDecimal(unit)).toBe(true);
  });

  it('a count of things does not', () => {
    for (const unit of ['pcs', 'crate', 'Bag', ' packet ', 'bottle', 'box']) expect(allowsDecimal(unit)).toBe(false);
  });

  it('an unknown or missing unit does, so 2.5 can always be typed', () => {
    expect(allowsDecimal('scoop')).toBe(true);
    expect(allowsDecimal(null)).toBe(true);
    expect(allowsDecimal(undefined)).toBe(true);
  });
});
