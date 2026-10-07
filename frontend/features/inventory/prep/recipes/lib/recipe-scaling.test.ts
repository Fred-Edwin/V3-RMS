import { describe, expect, it } from 'vitest';

import cases from '../../_shared/lib/expected-yield.cases.json';
import { formatAmount, formulaText, scaleRecipe, scalingRows, trimNumber } from './recipe-scaling';

describe('scaleRecipe, pinned to the shared cases', () => {
  for (const c of cases.scale) {
    it(`${c.targetYield} x ${c.mainUsed} / ${c.recipeMainAmount} = ${c.expected}`, () => {
      expect(scaleRecipe({ targetYield: c.targetYield, recipeMainAmount: c.recipeMainAmount, mainUsed: c.mainUsed })).toBe(c.expected === null ? null : Number(c.expected).toFixed(2));
    });
  }
});

describe('wording', () => {
  it('formats portions whole and kg to one decimal', () => {
    expect(formatAmount('76', 'portions')).toBe('76');
    expect(formatAmount('1.5', 'kg')).toBe('1.5');
    expect(formatAmount('3', 'kg')).toBe('3');
    expect(formatAmount('0.43', 'kg')).toBe('0.4');
  });
  it('trims amounts', () => {
    expect(trimNumber('10.0000')).toBe('10');
    expect(trimNumber('0.75')).toBe('0.75');
  });
});

describe('scaling rows (Paper step 25)', () => {
  const input = { targetYield: '38', mainAmount: '10', mainName: 'Chicken, cut', mainUnit: 'kg', outputUnit: 'portions' };
  it('shows half, one batch and double', () => {
    expect(scalingRows(input).map((r) => r.result)).toEqual(['19 portions', '38 portions', '76 portions']);
    expect(scalingRows(input)[1]).toMatchObject({ isOneBatch: true, label: '10 kg chicken, cut · one batch' });
  });
  it('moves with the input', () => {
    expect(scalingRows({ ...input, targetYield: '40' }).map((r) => r.result)).toEqual(['20 portions', '40 portions', '80 portions']);
    expect(scalingRows({ ...input, mainAmount: '5' }).map((r) => r.result)).toEqual(['19 portions', '38 portions', '76 portions']);
  });
  it('has no result without a main amount', () => {
    expect(scalingRows({ ...input, mainAmount: '' }).map((r) => r.result)).toEqual([null, null, null]);
  });
  it('writes the formula caption', () => {
    expect(formulaText(input)).toBe('TARGET = 38 PORTIONS × (KG OF CHICKEN, CUT USED ÷ 10 KG)');
  });
});
