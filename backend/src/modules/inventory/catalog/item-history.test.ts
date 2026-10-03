import { describe, expect, it } from 'vitest';
import { describeItemUpdate, describePriceSet, describeSupplierAdded, formatKes, trimDecimal, type ItemFields } from './item-history';

const flour: ItemFields = {
  name: 'Wheat flour',
  type: 'RAW_INGREDIENT',
  buyUnit: 'bag',
  usageUnit: 'kg',
  conversionFactor: '25.0000',
  packSize: '25.0000',
  daysOfCover: null,
  categoryName: 'Dry goods',
  departmentTags: [],
};

describe('formatting', () => {
  it('trims trailing zeros and writes money as the screens do', () => {
    expect(trimDecimal('25.0000')).toBe('25');
    expect(trimDecimal('12.5000')).toBe('12.5');
    expect(trimDecimal('100')).toBe('100');
    expect(formatKes('8900')).toBe('KES 8,900');
    expect(formatKes('178.5')).toBe('KES 178.5');
  });
});

describe('days of cover in the history', () => {
  it('says when it was set, changed and cleared, and ignores 5 vs 5.00', () => {
    expect(describeItemUpdate(flour, { ...flour, daysOfCover: '5.00' })?.summary).toBe('set the days of cover to 5');
    expect(describeItemUpdate({ ...flour, daysOfCover: '5.00' }, { ...flour, daysOfCover: '1.50' })?.summary).toBe('changed the days of cover from 5 to 1.5');
    expect(describeItemUpdate({ ...flour, daysOfCover: '5.00' }, flour)?.summary).toBe('cleared the days of cover (back to 15)');
    expect(describeItemUpdate({ ...flour, daysOfCover: '5.00' }, { ...flour, daysOfCover: '5' })).toBeNull();
  });
});

describe('describeItemUpdate', () => {
  it('returns null when nothing the history tracks changed', () => {
    expect(describeItemUpdate(flour, { ...flour })).toBeNull();
    // 25 and 25.0000 are the same number
    expect(describeItemUpdate(flour, { ...flour, conversionFactor: '25', packSize: '25' })).toBeNull();
  });

  it('says a pack change in the words the screens use, and keeps only the changed fields', () => {
    const change = describeItemUpdate(flour, { ...flour, conversionFactor: '24', packSize: '24' });
    expect(change?.summary).toBe('changed the pack from 1 bag = 25 kg to 1 bag = 24 kg');
    expect(change?.before).toMatchObject({ conversionFactor: '25.0000' });
    expect(change?.after).toMatchObject({ conversionFactor: '24' });
    expect(change?.after).not.toHaveProperty('name');
  });

  it('covers a rename, a type change, a category move and used-by in one sentence', () => {
    const change = describeItemUpdate(flour, {
      ...flour,
      name: 'Wheat flour 2',
      type: 'STOCKED',
      categoryName: 'Baking',
      departmentTags: ['KITCHEN', 'BARISTA'],
    });
    expect(change?.summary).toBe(
      'renamed it from Wheat flour to Wheat flour 2; changed the type from Raw ingredient to Stocked; moved it from Dry goods to Baking; changed used-by from Central Store only to Kitchen, Barista',
    );
  });

  it('handles a category being set or removed', () => {
    expect(describeItemUpdate({ ...flour, categoryName: null }, flour)?.summary).toBe('set the category to Dry goods');
    expect(describeItemUpdate(flour, { ...flour, categoryName: null })?.summary).toBe('removed the category');
  });

  it('describes an item with no pack as "no size"', () => {
    const change = describeItemUpdate({ ...flour, conversionFactor: null, packSize: null, buyUnit: 'kg' }, { ...flour, buyUnit: 'kg', conversionFactor: '1', packSize: null });
    expect(change?.summary).toContain('1 kg, no size');
  });

  it('does not mention used-by when only the order of tags differs', () => {
    expect(describeItemUpdate({ ...flour, departmentTags: ['KITCHEN', 'BARISTA'] }, { ...flour, departmentTags: ['BARISTA', 'KITCHEN'] })).toBeNull();
  });
});

describe('supplier sentences', () => {
  const samrat = { supplierName: 'Samrat Supermarket Ltd', buyUnit: 'bag', packSize: '50.0000', usageUnit: 'kg' };

  it('says a supplier was added, with the pack, price and preferred', () => {
    expect(describeSupplierAdded(samrat, '8900', true)).toBe('added Samrat Supermarket Ltd (bag of 50 kg) at KES 8,900 per bag, preferred');
    expect(describeSupplierAdded(samrat, null, false)).toBe('added Samrat Supermarket Ltd (bag of 50 kg)');
    expect(describeSupplierAdded({ ...samrat, buyUnit: null, packSize: null }, null, false)).toBe('added Samrat Supermarket Ltd');
  });

  it('says a price was set, with the previous one when there was one', () => {
    expect(describePriceSet(samrat, '9100', '8900')).toBe("set Samrat Supermarket Ltd's price to KES 9,100 per bag (was KES 8,900)");
    expect(describePriceSet(samrat, '9100', null)).toBe("set Samrat Supermarket Ltd's price to KES 9,100 per bag");
  });
});
