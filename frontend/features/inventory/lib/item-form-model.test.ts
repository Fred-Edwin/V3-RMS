import { describe, expect, it } from 'vitest';

import {
  EMPTY_FORM_VALUES,
  buildEditPlan,
  holdsApplies,
  itemToFormValues,
  toCreateInput,
  validateItemForm,
  type ItemFormSource,
  type ItemFormValues,
} from './item-form-model';

const flour: ItemFormSource = {
  name: 'Wheat flour',
  type: 'RAW_INGREDIENT',
  buyUnit: 'bag',
  usageUnit: 'kg',
  conversionFactor: '25.0000',
  packSize: '25.0000',
  categoryId: 'cat-dry',
  departmentTags: [],
  centralStoreRestockLevel: '100.0000',
};

const values = (over: Partial<ItemFormValues>): ItemFormValues => ({ ...EMPTY_FORM_VALUES, ...over });

describe('itemToFormValues', () => {
  it('reads the pack as one entry and trims trailing zeros', () => {
    const v = itemToFormValues(flour);
    expect(v.holds).toBe('25');
    expect(v.restockLevel).toBe('100');
  });
});

describe('itemToFormValues, same unit both ways', () => {
  it('reads a stored conversion of 1 as no pack, so an unrelated edit is not a pack change', () => {
    const chicken: ItemFormSource = { ...flour, name: 'Chicken, cut', buyUnit: 'kg', conversionFactor: '1.0000', packSize: null };
    expect(itemToFormValues(chicken).holds).toBe('');
    const plan = buildEditPlan(chicken, { ...itemToFormValues(chicken), departmentTags: ['KITCHEN'] });
    expect(plan.risky).toEqual([]);
    const prepped: ItemFormSource = { ...flour, type: 'PREPPED', buyUnit: 'portion', usageUnit: 'portion', conversionFactor: '1.0000', packSize: null };
    expect(buildEditPlan(prepped, { ...itemToFormValues(prepped), departmentTags: ['KITCHEN'] }).risky).toEqual([]);
  });
});

describe('holdsApplies', () => {
  it('only when the buy unit differs from the usage unit and the item is bought', () => {
    expect(holdsApplies({ type: 'STOCKED', buyUnit: 'bag', usageUnit: 'kg' })).toBe(true);
    expect(holdsApplies({ type: 'STOCKED', buyUnit: 'KG', usageUnit: 'kg' })).toBe(false);
    expect(holdsApplies({ type: 'PREPPED', buyUnit: 'bag', usageUnit: 'kg' })).toBe(false);
  });
});

describe('validateItemForm', () => {
  it('asks for what is missing', () => {
    const errors = validateItemForm(values({}));
    expect(errors.name).toBeDefined();
    expect(errors.usageUnit).toBeDefined();
    expect(errors.buyUnit).toBeDefined();
  });
  it('needs "one holds" only when the units differ', () => {
    expect(validateItemForm(values({ name: 'Sugar', buyUnit: 'bag', usageUnit: 'kg' })).holds).toBeDefined();
    expect(validateItemForm(values({ name: 'Sugar', buyUnit: 'bag', usageUnit: 'kg', holds: '50' })).holds).toBeUndefined();
    expect(validateItemForm(values({ name: 'Chicken', buyUnit: 'kg', usageUnit: 'kg' })).holds).toBeUndefined();
  });
  it('does not ask a Prepped item how it is bought', () => {
    const errors = validateItemForm(values({ name: 'Chapati dough', type: 'PREPPED', usageUnit: 'kg' }));
    expect(errors.buyUnit).toBeUndefined();
  });
  it('rejects a bad restock level', () => {
    expect(validateItemForm(values({ name: 'x', buyUnit: 'kg', usageUnit: 'kg', restockLevel: '-1' })).restockLevel).toBeDefined();
  });
});

describe('toCreateInput', () => {
  it('sends the pack as both conversion and pack size', () => {
    const input = toCreateInput(values({ name: ' Brown sugar ', buyUnit: 'bag', usageUnit: 'kg', holds: '50', category: 'cat-dry', departmentTags: ['KITCHEN', 'BARISTA'], restockLevel: '100' }));
    expect(input).toMatchObject({ name: 'Brown sugar', buyUnit: 'bag', usageUnit: 'kg', conversionFactor: '50', packSize: '50', categoryId: 'cat-dry', categoryName: null, centralStoreRestockLevel: '100' });
    expect(input.departmentTags).toEqual(['KITCHEN', 'BARISTA']);
  });
  it('states a conversion of 1 when the unit is the same both ways', () => {
    const input = toCreateInput(values({ name: 'Chicken, cut', type: 'RAW_INGREDIENT', buyUnit: 'kg', usageUnit: 'kg' }));
    expect(input).toMatchObject({ conversionFactor: '1', packSize: null });
  });
  it('drops departments for a raw ingredient and the buy unit for Prepped', () => {
    expect(toCreateInput(values({ name: 'Flour', type: 'RAW_INGREDIENT', buyUnit: 'bag', usageUnit: 'kg', holds: '25', departmentTags: ['KITCHEN'] })).departmentTags).toEqual([]);
    expect(toCreateInput(values({ name: 'Dough', type: 'PREPPED', usageUnit: 'kg' }))).toMatchObject({ buyUnit: 'kg', usageUnit: 'kg' });
  });
  it('creates a category by name when it is new', () => {
    expect(toCreateInput(values({ name: 'x', buyUnit: 'kg', usageUnit: 'kg', category: 'Seasonal', categoryIsNew: true }))).toMatchObject({ categoryId: null, categoryName: 'Seasonal' });
  });
});

describe('buildEditPlan', () => {
  it('sends nothing when nothing changed', () => {
    const plan = buildEditPlan(flour, itemToFormValues(flour));
    expect(plan.input).toEqual({});
    expect(plan.risky).toEqual([]);
  });
  it('a rename alone is not risky', () => {
    const plan = buildEditPlan(flour, { ...itemToFormValues(flour), name: 'Wheat flour 2' });
    expect(plan.input).toEqual({ name: 'Wheat flour 2' });
    expect(plan.risky).toEqual([]);
  });
  it('a pack change is risky and reads now / after', () => {
    const plan = buildEditPlan(flour, { ...itemToFormValues(flour), holds: '24' });
    expect(plan.input).toMatchObject({ conversionFactor: '24', packSize: '24' });
    expect(plan.risky).toEqual([{ what: 'Pack', now: '1 bag = 25 kg', after: '1 bag = 24 kg' }]);
    expect(plan.after).toMatchObject({ buyUnit: 'bag', usageUnit: 'kg', holds: '24' });
  });
  it('a type change is risky', () => {
    const plan = buildEditPlan(flour, { ...itemToFormValues(flour), type: 'STOCKED' });
    expect(plan.risky).toEqual([{ what: 'Type', now: 'Raw ingredient', after: 'Stocked' }]);
  });
  it('a seeded item saved with the same unit states a conversion of 1 without a review', () => {
    const seeded: ItemFormSource = { ...flour, buyUnit: 'kg', conversionFactor: null, packSize: null };
    const plan = buildEditPlan(seeded, { ...itemToFormValues(seeded), name: 'Chicken, cut' });
    expect(plan.input).toMatchObject({ name: 'Chicken, cut', conversionFactor: '1' });
    expect(plan.risky).toEqual([]);
  });
  it('clears the restock level with null', () => {
    const plan = buildEditPlan(flour, { ...itemToFormValues(flour), restockLevel: '' });
    expect(plan.input).toEqual({ centralStoreRestockLevel: null });
  });
});
