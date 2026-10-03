import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { describePack, hasPackKey, lineKeyString, matchSupplierLine, sameLineKey } from './supplier-line-key';

const line = (buyUnit: string | null, packSize: string | null, id = 'x') => ({
  id,
  buyUnit,
  packSize: packSize === null ? null : new Prisma.Decimal(packSize),
});

describe('line key normalisation (mirrors the supplier_items_line_key index)', () => {
  it('treats a missing buy unit and "" as the same', () => {
    expect(sameLineKey({ buyUnit: null, packSize: 50 }, { buyUnit: '', packSize: 50 })).toBe(true);
  });

  it('treats a missing pack size and 0 as the same', () => {
    expect(sameLineKey({ buyUnit: 'bag', packSize: null }, { buyUnit: 'bag', packSize: '0' })).toBe(true);
  });

  it('compares pack sizes numerically, not as text', () => {
    expect(sameLineKey({ buyUnit: 'bag', packSize: '50' }, { buyUnit: 'bag', packSize: '50.0000' })).toBe(true);
    expect(sameLineKey({ buyUnit: 'bag', packSize: '50' }, { buyUnit: 'bag', packSize: '2' })).toBe(false);
  });

  it('is case sensitive on the buy unit, as the index is', () => {
    expect(lineKeyString({ buyUnit: 'Bag', packSize: 50 })).not.toBe(lineKeyString({ buyUnit: 'bag', packSize: 50 }));
  });

  it('reports whether a pack was named', () => {
    expect(hasPackKey({ buyUnit: null, packSize: null })).toBe(false);
    expect(hasPackKey({ buyUnit: '', packSize: 0 })).toBe(false);
    expect(hasPackKey({ buyUnit: 'bag', packSize: null })).toBe(true);
    expect(hasPackKey({ buyUnit: null, packSize: 2 })).toBe(true);
  });
});

describe('matchSupplierLine', () => {
  const bag = line('bag', '50', 'bag');
  const packet = line('packet', '2', 'packet');

  it('matches the exact pack (Samrat sugar 50 kg bag vs 2 kg packet)', () => {
    expect(matchSupplierLine([bag, packet], { buyUnit: 'packet', packSize: 2 })?.id).toBe('packet');
    expect(matchSupplierLine([bag, packet], { buyUnit: 'bag', packSize: 50 })?.id).toBe('bag');
  });

  it('never falls back to another pack when a pack is named', () => {
    expect(matchSupplierLine([bag], { buyUnit: 'packet', packSize: 2 })).toBeNull();
    expect(matchSupplierLine([bag], { buyUnit: 'bag', packSize: 25 })).toBeNull();
  });

  it('uses the single line when no pack is named', () => {
    expect(matchSupplierLine([bag], { buyUnit: null, packSize: null })?.id).toBe('bag');
  });

  it('refuses to guess between several lines when no pack is named', () => {
    expect(matchSupplierLine([bag, packet], { buyUnit: null, packSize: null })).toBeNull();
  });

  it('returns null with no lines', () => {
    expect(matchSupplierLine([], { buyUnit: null, packSize: null })).toBeNull();
  });
});

describe('describePack', () => {
  it('reads like the screen', () => {
    expect(describePack({ buyUnit: 'bag', packSize: '50.0000' })).toBe('bag · 50');
    expect(describePack({ buyUnit: 'kg', packSize: null })).toBe('kg');
    expect(describePack({ buyUnit: null, packSize: null })).toBe('—');
  });
});
