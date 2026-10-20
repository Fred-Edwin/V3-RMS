import { describe, expect, it } from 'vitest';

import { shillings } from './portrait-doc';

describe('shillings (document money)', () => {
  it('groups thousands and keeps cents when asked', () => {
    expect(shillings('1234567')).toBe('1,234,567');
    expect(shillings('900', 2)).toBe('900.00');
  });

  it('prints a negative with a plain hyphen-minus, because the PDF font cannot draw U+2212 (it printed as a quote mark)', () => {
    expect(shillings('-100')).toBe('-100');
    expect(shillings('-1250.5', 2)).toBe('-1,250.50');
    expect(shillings('-100')).not.toContain('−');
  });
});
