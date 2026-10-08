import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { itemStockStatus, stockStatusText } from './stock-status';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('itemStockStatus', () => {
  it.each([
    ['-4', '30', 'NEGATIVE'],
    ['-4', null, 'NEGATIVE'],
    ['0', '30', 'OUT'],
    ['0', null, 'OK'],
    ['12', '30', 'LOW'],
    ['0.5', '30', 'LOW'],
    ['30', '30', 'OK'],
    ['164', '180', 'LOW'],
    ['500', '30', 'OK'],
    ['12', null, 'OK'],
  ] as const)('on hand %s with level %s is %s', (onHand, level, expected) => {
    expect(itemStockStatus(D(onHand), level === null ? null : D(level))).toBe(expected);
  });
});

describe('stockStatusText', () => {
  it('names the level where there is one', () => {
    expect(stockStatusText('LOW', D(180), 'kg')).toBe('Low · restock level 180 kg');
    expect(stockStatusText('OUT', D(30), 'kg')).toBe('Out · restock level 30 kg');
    expect(stockStatusText('NEGATIVE', D(30), 'kg')).toBe('Negative · restock level 30 kg');
    expect(stockStatusText('NEGATIVE', null, 'kg')).toBe('Negative · needs a count');
    expect(stockStatusText('OK', null, 'kg')).toBe('OK · no restock level set');
    expect(stockStatusText('OK', D(100), 'kg')).toBe('OK · restock level 100 kg');
  });
});
