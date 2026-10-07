/**
 * The recipes validators are the frozen contract's schemas, and what the service returns parses against them.
 */
import { describe, expect, it } from 'vitest';
import { recipeDetailSchema, recipeInputSchema, recipeRowSchema, recipesListSchema, recipesQuerySchema } from './recipes-validators';
import { ingredientsTextOf, initialsOf, lowerFirst, nairobiDayText, roleLabelOf, sameRecipe } from './recipes-view';
import { Prisma } from '@prisma/client';

const id = '44444444-4444-4444-8444-444444444444';
const person = { id: 'u1', name: 'Isabel Wanjiru', initials: 'IW', roleLabel: 'Store Manager' };

describe('recipes validators', () => {
  it('defaults the list query', () => {
    expect(recipesQuerySchema.parse({})).toEqual({ show: 'all', changed: 'any', page: 1, perPage: 25 });
    expect(() => recipesQuerySchema.parse({ perPage: '101' })).toThrow();
  });

  it('accepts a RecipeInput and rejects numbers, zero amounts and an empty or oversize line list', () => {
    const ok = { targetYield: '38', lines: [{ itemId: id, amount: '10', isMain: true }], reason: 'BETTER_RECIPE' };
    expect(recipeInputSchema.parse(ok)).toEqual(ok);
    expect(() => recipeInputSchema.parse({ ...ok, targetYield: 38 })).toThrow();
    expect(() => recipeInputSchema.parse({ ...ok, targetYield: '0' })).toThrow();
    expect(() => recipeInputSchema.parse({ ...ok, lines: [] })).toThrow();
    expect(() => recipeInputSchema.parse({ ...ok, lines: Array.from({ length: 31 }, () => ok.lines[0]) })).toThrow();
    expect(() => recipeInputSchema.parse({ ...ok, lines: [{ itemId: 'x', amount: '1', isMain: true }] })).toThrow();
    expect(() => recipeInputSchema.parse({ ...ok, reasonNote: 'x'.repeat(301) })).toThrow();
  });

  it('parses the response shapes, with and without a recipe and with the cost key absent', () => {
    const row = {
      itemId: id, itemName: 'Fried chicken', unit: 'portions',
      recipe: { ingredientsText: '10 kg chicken, cut', targetYield: '38', mainItemName: 'Chicken, cut', version: 1, lastChangedAt: '2026-10-05T10:00:00.000Z', lastChangedBy: person },
      pastRunsAverageText: null,
    };
    expect(recipeRowSchema.parse(row)).toEqual(row);
    expect(recipeRowSchema.parse({ ...row, recipe: null, pastRunsAverageText: 'about 3 kg' }).recipe).toBeNull();
    expect(recipesListSchema.parse({ items: [row], total: 1, totalItems: 3, withoutRecipe: 2 }).total).toBe(1);
    const detail = {
      itemId: id, itemName: 'Fried chicken', unit: 'portions',
      current: { version: 1, targetYield: '38', lines: [{ itemId: id, itemName: 'Chicken, cut', unit: 'kg', amount: '10', isMain: true }], changedAt: '2026-10-05T10:00:00.000Z', changedBy: person, reason: null },
      suggestFromLastRun: null,
      history: [{ version: 1, at: '2026-10-05T10:00:00.000Z', by: person, reason: null, reasonNote: null }],
    };
    expect('costPerUnitNow' in recipeDetailSchema.parse(detail)).toBe(false);
    expect(recipeDetailSchema.parse({ ...detail, costPerUnitNow: '118.42' }).costPerUnitNow).toBe('118.42');
  });
});

describe('recipes view helpers', () => {
  it('builds the ingredients line in the recipe order, with the unit and a lower-case name', () => {
    const lines = [
      { amount: new Prisma.Decimal('10'), inputItem: { name: 'Chicken, cut', usageUnit: 'kg' } },
      { amount: new Prisma.Decimal('1.5'), inputItem: { name: 'Garlic-ginger paste', usageUnit: 'kg' } },
    ];
    expect(ingredientsTextOf(lines)).toBe('10 kg chicken, cut · 1.5 kg garlic-ginger paste');
  });

  it('keeps an acronym’s capitals', () => {
    expect(lowerFirst('KFC sauce')).toBe('KFC sauce');
    expect(lowerFirst('Tomato')).toBe('tomato');
  });

  it('makes initials and role labels', () => {
    expect(initialsOf('Sarah Achieng')).toBe('SA');
    expect(initialsOf('  isabel ')).toBe('I');
    expect(roleLabelOf('STORE_ATTENDANT')).toBe('Store Attendant');
    expect(roleLabelOf('MANAGER')).toBe('Branch Manager');
  });

  it('compares recipes by content, not order or number format', () => {
    const current = { targetYield: new Prisma.Decimal('38'), lines: [{ inputItemId: 'a', amount: new Prisma.Decimal('10'), isMain: true }, { inputItemId: 'b', amount: new Prisma.Decimal('1'), isMain: false }] };
    expect(sameRecipe(current, { targetYield: '38.00', lines: [{ itemId: 'b', amount: '1.0', isMain: false }, { itemId: 'a', amount: '10', isMain: true }] })).toBe(true);
    expect(sameRecipe(current, { targetYield: '39', lines: [{ itemId: 'a', amount: '10', isMain: true }, { itemId: 'b', amount: '1', isMain: false }] })).toBe(false);
    expect(sameRecipe(current, { targetYield: '38', lines: [{ itemId: 'a', amount: '10', isMain: true }] })).toBe(false);
    expect(sameRecipe(current, { targetYield: '38', lines: [{ itemId: 'a', amount: '10', isMain: true }, { itemId: 'c', amount: '1', isMain: false }] })).toBe(false);
  });

  it('names the Nairobi day of an instant', () => {
    expect(nairobiDayText(new Date('2026-10-05T22:30:00.000Z'))).toBe('6 Oct');
    expect(nairobiDayText(new Date('2026-10-05T10:00:00.000Z'))).toBe('5 Oct');
  });
});
