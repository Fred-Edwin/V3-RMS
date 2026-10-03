import { describe, expect, it } from 'vitest';

import { formatHistoryEntry, formatHistoryWhen, formatMoney, normalizePriceInput, pricePerUsageUnit, validateOptionalPrice } from './item-price';

describe('price input', () => {
  it('strips thousands separators and spaces', () => {
    expect(normalizePriceInput('8,900')).toBe('8900');
    expect(normalizePriceInput(' 1 200.50 ')).toBe('1200.50');
  });
  it('is optional, and otherwise a positive amount like the backend reads it', () => {
    expect(validateOptionalPrice('')).toBeNull();
    expect(validateOptionalPrice('8,900')).toBeNull();
    expect(validateOptionalPrice('380.50')).toBeNull();
    expect(validateOptionalPrice('0')).not.toBeNull();
    expect(validateOptionalPrice('-5')).not.toBeNull();
    expect(validateOptionalPrice('abc')).not.toBeNull();
    expect(validateOptionalPrice('1.23456')).not.toBeNull();
  });
});

describe('formatMoney', () => {
  it('writes whole amounts plain and keeps up to two decimals', () => {
    expect(formatMoney('8900')).toBe('KES 8,900');
    expect(formatMoney(178)).toBe('KES 178');
    expect(formatMoney(177.7777)).toBe('KES 177.78');
  });
});

describe('pricePerUsageUnit', () => {
  it('divides a pack price by what the pack holds', () => {
    expect(pricePerUsageUnit('8,900', '50')).toBe(178);
    expect(pricePerUsageUnit('380', '2')).toBe(190);
  });
  it('is the price itself when the unit is the same both ways', () => {
    expect(pricePerUsageUnit('480', null)).toBe(480);
    expect(pricePerUsageUnit('480', '')).toBe(480);
  });
  it('is null until the numbers are usable', () => {
    expect(pricePerUsageUnit('', '50')).toBeNull();
    expect(pricePerUsageUnit('8900', '0')).toBeNull();
    expect(pricePerUsageUnit('8900', 'x')).toBeNull();
  });
});

describe('history text', () => {
  const who = { id: 'u', name: 'Isabel Njoki' };
  it('says created as "Created by", everything else as who then what', () => {
    expect(formatHistoryEntry({ kind: 'CREATED', summary: 'created the item', changedBy: who })).toBe('Created by Isabel Njoki');
    expect(formatHistoryEntry({ kind: 'SUPPLIER_ADDED', summary: 'added Samrat Supermarket Ltd at KES 8,900 per bag, preferred', changedBy: who })).toBe(
      'Isabel Njoki added Samrat Supermarket Ltd at KES 8,900 per bag, preferred'
    );
  });
  it('writes the time in Nairobi, day first', () => {
    expect(formatHistoryWhen('2026-10-12T06:58:00Z')).toBe('12 Oct 09:58');
  });
});
