import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { compactKesText, kesText, money2, qty, signedKesText, unitCostText, wholeKes } from './stock-text';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('stock-text', () => {
  it('writes wire quantities and money without exponents or lost zeros', () => {
    expect(qty(D('160.0000'))).toBe('160');
    expect(qty(D('-20'))).toBe('-20');
    expect(qty(D('0.0005'))).toBe('0.0005');
    expect(money2(D('30012'))).toBe('30012.00');
    expect(money2(D('-359.996'))).toBe('-360.00');
  });

  it('writes KES with separators and the typographic minus', () => {
    expect(wholeKes(D('482400.4'))).toBe('482,400');
    expect(kesText(D(482400))).toBe('KES 482,400');
    expect(kesText(D(-360))).toBe('−KES 360');
    expect(kesText(D(0))).toBe('KES 0');
    expect(signedKesText(D(214600))).toBe('+KES 214,600');
    expect(signedKesText(D(-239000))).toBe('−KES 239,000');
  });

  it('shortens big figures', () => {
    expect(compactKesText(D(482400))).toBe('KES 482K');
    expect(compactKesText(D(950))).toBe('KES 950');
    expect(compactKesText(D(1_250_000))).toBe('KES 1.3M');
    expect(compactKesText(D(-3400))).toBe('−KES 3K');
  });

  it('writes a unit cost for a sentence', () => {
    expect(unitCostText(D(183))).toBe('183');
    expect(unitCostText(D('183.5'))).toBe('183.50');
  });
});
