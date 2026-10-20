import { describe, expect, it } from 'vitest';

import { bandRows, baseWords } from './tax-words';

describe('tax table rows', () => {
  it('writes band widths, not edges', () => {
    const rows = bandRows({
      kind: 'BANDS',
      employerRatePercent: null,
      bands: [
        { from: '0', to: '24000', ratePercent: '10', flatAmount: null },
        { from: '24000', to: '32333', ratePercent: '25', flatAmount: null },
        { from: '32333', to: null, ratePercent: '30', flatAmount: null },
      ],
    });
    expect(rows).toEqual([
      { label: 'First 24,000', value: '10%' },
      { label: 'Next 8,333', value: '25%' },
      { label: 'Above 32,333', value: '30%' },
    ]);
  });
  it('writes a flat rate as one row and names the base', () => {
    expect(bandRows({ kind: 'RATE', employerRatePercent: null, bands: [{ from: null, to: null, ratePercent: '6.0', flatAmount: null }] })).toEqual([{ label: 'Rate', value: '6%' }]);
    expect(baseWords('GROSS')).toBe('Gross pay');
  });
});
