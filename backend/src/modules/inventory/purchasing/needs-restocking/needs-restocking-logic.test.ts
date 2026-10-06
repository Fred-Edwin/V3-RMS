import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { bestLinePerSupplier, buildCatalog, buildNeeds, buildNeedsLine, chooseLine, packOf, termsLabelOf } from './needs-restocking-logic';
import type { BelowLevelItem, CatalogLine, SupplierLine, SupplierSummary } from './needs-restocking-repository';

const D = (v: string | number) => new Prisma.Decimal(v);

const samrat: SupplierSummary = { id: 's-samrat', name: 'Samrat Supermarket Ltd', code: 'SUPPLIER-0001', type: 'REGULAR', defaultPaymentTerms: 'INVOICE_TO_FOLLOW', paymentDays: 14 };
const kagumo: SupplierSummary = { id: 's-kagumo', name: 'Kagumo Poultry Farm', code: 'SUPPLIER-0002', type: 'REGULAR', defaultPaymentTerms: 'PAY_NOW', paymentDays: 0 };
const summer: SupplierSummary = { id: 's-summer', name: 'Summer Limited', code: 'SUPPLIER-0003', type: 'OCCASIONAL', defaultPaymentTerms: 'INVOICE_TO_FOLLOW', paymentDays: 30 };

const item = (over: Partial<BelowLevelItem> & Pick<BelowLevelItem, 'id' | 'name' | 'onHand' | 'level'>): BelowLevelItem => ({
  category: 'Dry goods',
  usageUnit: 'kg',
  buyUnit: 'kg',
  packSize: null,
  preferredSupplierId: null,
  ...over,
});

const line = (inventoryItemId: string, supplier: SupplierSummary, over: Partial<SupplierLine> = {}): SupplierLine => ({
  inventoryItemId,
  buyUnit: 'kg',
  packSize: null,
  lastPrice: D(168),
  lastPriceAt: new Date('2026-09-18T08:00:00Z'),
  isPreferred: false,
  supplier,
  ...over,
});

describe('suggested quantity (Paper figures)', () => {
  it('sugar: level 100, on hand 18, sold by the kg -> 82', () => {
    const l = buildNeedsLine(item({ id: 'sugar', name: 'Kabras Sugar 1kg', onHand: D(18), level: D(100) }), [line('sugar', samrat)]);
    expect(l).toMatchObject({ suggestedQty: '82', lastPrice: '168.00', estimatedTotal: '13776.00', status: 'LOW', chosenSupplierId: 's-samrat', buyUnit: 'kg' });
  });
  it('oil: 40 L in 10 L jerricans -> 4', () => {
    const l = buildNeedsLine(item({ id: 'oil', name: 'Salt Cooking Oil 10ltr', usageUnit: 'L', buyUnit: 'jerrican', onHand: D(0), level: D(40) }), [
      line('oil', samrat, { buyUnit: 'jerrican', packSize: D(10), lastPrice: D(2340) }),
    ]);
    expect(l).toMatchObject({ suggestedQty: '4', status: 'OUT', estimatedTotal: '9360.00' });
    expect(l.subLabel).toBe('Dry goods · bought by the jerrican (10 L)');
  });
  it('margarine 14 kg in 10 kg boxes -> 2; flour 38 kg in 24 kg cartons -> 2; chicken 22 kg in 5 kg trays -> 5', () => {
    const q = (id: string, level: number, pack: number) =>
      buildNeedsLine(item({ id, name: id, onHand: D(0), level: D(level) }), [line(id, samrat, { buyUnit: 'box', packSize: D(pack) })]).suggestedQty;
    expect([q('m', 14, 10), q('f', 38, 24), q('c', 22, 5)]).toEqual(['2', '2', '5']);
  });
  it('an item never bought has no supplier, no pack and no quantity', () => {
    const l = buildNeedsLine(item({ id: 'coco', name: 'Coco Primo', onHand: D(2), level: D(10) }), []);
    expect(l).toMatchObject({ chosenSupplierId: null, suggestedQty: null, estimatedTotal: null, buyUnit: null, supplierOptions: [] });
    expect(l.subLabel).toBe('Dry goods · never bought before');
  });
  it('a line with no pack stated and a different buy unit falls back to the item pack, else gives no quantity', () => {
    expect(packOf({ buyUnit: 'tray', packSize: null }, { usageUnit: 'kg', buyUnit: 'tray', packSize: D(5) })?.toString()).toBe('5');
    expect(packOf({ buyUnit: 'tray', packSize: null }, { usageUnit: 'kg', buyUnit: 'tray', packSize: null })).toBeNull();
  });
});

describe('choosing the supplier', () => {
  const sugar = item({ id: 'sugar', name: 'Sugar', onHand: D(18), level: D(100) });
  it('takes the cheapest when nobody is preferred, and says how much cheaper the others are', () => {
    const l = buildNeedsLine(sugar, [line('sugar', samrat, { lastPrice: D(178) }), line('sugar', summer, { lastPrice: D(168) })]);
    expect(l.chosenSupplierId).toBe('s-summer');
    expect(l.supplierOptions.find((o) => o.supplierId === 's-summer')?.cheaperBy).toBeNull();
    expect(l.supplierOptions.find((o) => o.supplierId === 's-samrat')?.cheaperBy).toBeNull();
  });
  it('a dearer preferred supplier wins and the cheaper option shows "KES 10 cheaper"', () => {
    const l = buildNeedsLine(sugar, [line('sugar', samrat, { lastPrice: D(178), isPreferred: true }), line('sugar', summer, { lastPrice: D(168) })]);
    expect(l.chosenSupplierId).toBe('s-samrat');
    expect(l.supplierOptions.find((o) => o.supplierId === 's-summer')).toMatchObject({ cheaperBy: '10.00', preferred: false });
    expect(l.supplierOptions.find((o) => o.supplierId === 's-samrat')?.preferred).toBe(true);
  });
  it('honours the item-level preferred supplier', () => {
    const l = buildNeedsLine({ ...sugar, preferredSupplierId: 's-samrat' }, [line('sugar', samrat, { lastPrice: D(178) }), line('sugar', summer, { lastPrice: D(168) })]);
    expect(l.chosenSupplierId).toBe('s-samrat');
  });
  it('puts an unpriced line after a priced one, and reports no price for it', () => {
    const l = buildNeedsLine(sugar, [line('sugar', samrat, { lastPrice: null }), line('sugar', summer, { lastPrice: D(168) })]);
    expect(l.chosenSupplierId).toBe('s-summer');
    expect(l.supplierOptions.find((o) => o.supplierId === 's-samrat')?.lastPrice).toBeNull();
  });
  it('keeps one line per supplier: the preferred, else the cheapest', () => {
    const lines = [line('sugar', samrat, { lastPrice: D(200), buyUnit: 'bag' }), line('sugar', samrat, { lastPrice: D(170), buyUnit: 'kg' })];
    expect(bestLinePerSupplier(lines)).toHaveLength(1);
    expect(bestLinePerSupplier(lines)[0]?.buyUnit).toBe('kg');
    expect(chooseLine([], null)).toBeNull();
  });
});

describe('buildNeeds: grouping, sorting, filters', () => {
  const items = [
    item({ id: 'sugar', name: 'Kabras Sugar 1kg', onHand: D(18), level: D(100) }),
    item({ id: 'oil', name: 'Salt Cooking Oil 10ltr', usageUnit: 'L', buyUnit: 'jerrican', onHand: D(0), level: D(40) }),
    item({ id: 'chicken', name: 'Chicken breast', onHand: D(2), level: D(22) }),
    item({ id: 'coco', name: 'Coco Primo', onHand: D(1), level: D(10) }),
  ];
  const lines = [
    line('sugar', samrat),
    line('oil', samrat, { buyUnit: 'jerrican', packSize: D(10), lastPrice: D(2340) }),
    line('chicken', kagumo, { buyUnit: 'tray', packSize: D(5), lastPrice: D(2450) }),
  ];
  const result = buildNeeds(items, lines, [samrat, kagumo, summer], {});

  it('counts items and suppliers', () => {
    expect(result.itemCount).toBe(4);
    expect(result.supplierCount).toBe(2);
  });
  it('groups by supplier with the item with no supplier last', () => {
    expect(result.groups.map((g) => g.supplier?.name ?? null)).toEqual(['Samrat Supermarket Ltd', 'Kagumo Poultry Farm', null]);
    expect(result.groups[0]).toMatchObject({ itemCount: 2, estimatedTotal: '23136.00', termsLabel: 'Regular · Invoice 14 days' });
    expect(result.groups[1]?.termsLabel).toBe('Regular · Cash on delivery');
  });
  it('most urgent first: Out before Low, then furthest below level', () => {
    expect(result.groups[0]?.lines.map((l) => l.inventoryItemId)).toEqual(['oil', 'sugar']);
  });
  it('sorts by name or by value on request', () => {
    const samratLines = (sort: 'name' | 'value') =>
      buildNeeds(items, lines, [samrat, kagumo], { sort }).groups.find((g) => g.supplier?.id === 's-samrat')?.lines.map((l) => l.inventoryItemId);
    expect(samratLines('name')).toEqual(['sugar', 'oil']);
    expect(samratLines('value')).toEqual(['sugar', 'oil']); // 13,776 against 9,360
    expect(buildNeeds(items, lines, [samrat, kagumo], { sort: 'name' }).groups[0]?.supplier?.id).toBe('s-kagumo'); // "Chicken" sorts first
  });
  it('filters to one supplier', () => {
    const r = buildNeeds(items, lines, [samrat, kagumo], { supplierId: 's-kagumo' });
    expect(r.itemCount).toBe(1);
    expect(r.groups[0]?.supplier?.id).toBe('s-kagumo');
  });
  it('offers every orderable supplier to choose from', () => {
    expect(result.suppliers.map((s) => s.name)).toEqual(['Samrat Supermarket Ltd', 'Kagumo Poultry Farm', 'Summer Limited']);
    expect(termsLabelOf(summer)).toBe('Occasional · Invoice 30 days');
  });
});

describe('buildCatalog', () => {
  const cl = (id: string, name: string, price: number): CatalogLine => ({
    ...line(id, samrat, { lastPrice: D(price) }),
    item: { id, name, category: 'Dry goods', usageUnit: 'kg', buyUnit: 'kg', packSize: null },
  });
  const lines = [cl('sugar', 'Sugar', 168), cl('rice', 'Rice', 210), cl('flour', 'Flour', 90)];
  const stock = [
    { inventoryItemId: 'sugar', onHand: D(18), level: D(100) },
    { inventoryItemId: 'rice', onHand: D(50), level: D(40) },
    { inventoryItemId: 'flour', onHand: D(0), level: D(30) },
  ];
  it('shows Low and Out by default with suggested quantities, counting what is hidden', () => {
    const r = buildCatalog(lines, stock, { supplierId: 's-samrat' });
    expect(r.items.map((i) => [i.itemName, i.status, i.qty])).toEqual([['Sugar', 'LOW', '82'], ['Flour', 'OUT', '30']]);
    expect(r.counts).toEqual({ lowOrOut: 2, all: 3 });
    expect(r.shown).toBe(2);
  });
  it('shows everything on request, with no quantity for an item that is fine', () => {
    const r = buildCatalog(lines, stock, { supplierId: 's-samrat', filter: 'all' });
    expect(r.items).toHaveLength(3);
    expect(r.items.find((i) => i.itemName === 'Rice')).toMatchObject({ status: 'OK', qty: null, price: '210.00' });
  });
  it('treats an item with no restock level as fine', () => {
    const r = buildCatalog(lines, [{ inventoryItemId: 'sugar', onHand: D(0), level: null }], { supplierId: 's-samrat', filter: 'all' });
    expect(r.items.find((i) => i.itemName === 'Sugar')?.status).toBe('OK');
  });
});
