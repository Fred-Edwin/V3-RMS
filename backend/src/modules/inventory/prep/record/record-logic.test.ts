import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { PrepRecipeRead } from '../_shared/prep-recipe-reader';
import { assertValidInputs, expectedBasisFor, findRepeat, typoNote, usualRecipeText } from './record-logic';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const chicken = 'chicken';
const paste = 'paste';
const now = new Date('2026-10-07T09:00:00Z');

const recipe: PrepRecipeRead = {
  versionId: 'v1',
  version: 1,
  targetYield: D(38),
  lines: [
    { inputItemId: chicken, itemName: 'chicken', unit: 'kg', amount: D(10), isMain: true },
    { inputItemId: paste, itemName: 'paste', unit: 'kg', amount: D(1), isMain: false },
  ],
};

describe('assertValidInputs', () => {
  const ok = [{ itemId: chicken, quantity: D(10) }];
  it('accepts a clean run', () => {
    expect(() => assertValidInputs('out', ok, D(38))).not.toThrow();
  });
  it.each([
    ['QUANTITY_NOT_POSITIVE', [{ itemId: chicken, quantity: D(0) }], D(38)],
    ['QUANTITY_NOT_POSITIVE', ok, D(0)],
    ['INPUT_IS_OUTPUT', [{ itemId: 'out', quantity: D(1) }], D(38)],
    ['DUPLICATE_INPUT_LINE', [...ok, { itemId: chicken, quantity: D(2) }], D(38)],
  ])('refuses with %s', (code, inputs, made) => {
    expect(() => assertValidInputs('out', inputs, made)).toThrowError(expect.objectContaining({ statusCode: 422, code }));
  });
});

describe('expectedBasisFor', () => {
  const run = (kg: number) => [{ itemId: chicken, quantity: D(kg) }];
  it('scales the recipe by the main ingredient', () => {
    const b = expectedBasisFor({ recipe, inputs: run(20), pastRuns: [], now });
    expect(b).toMatchObject({ source: 'RECIPE', recipeVersionId: 'v1', mainIngredientMissing: false });
    expect(b.amount?.toString()).toBe('76');
  });
  it('falls back to past runs when the main ingredient is not used, and says so', () => {
    const b = expectedBasisFor({ recipe, inputs: [{ itemId: paste, quantity: D(1) }], pastRuns: [{ actualYield: D(30), createdAt: new Date('2026-10-05T09:00:00Z') }], now });
    expect(b).toMatchObject({ source: 'PAST_RUNS', recipeVersionId: null, mainIngredientMissing: true });
    expect(b.amount?.toString()).toBe('30');
  });
  it('uses past runs with no recipe, and nothing with neither', () => {
    expect(expectedBasisFor({ recipe: null, inputs: run(5), pastRuns: [{ actualYield: D(3), createdAt: new Date('2026-10-06T09:00:00Z') }], now }).source).toBe('PAST_RUNS');
    expect(expectedBasisFor({ recipe: null, inputs: run(5), pastRuns: [], now })).toMatchObject({ source: 'NONE', amount: null });
  });
});

describe('usualRecipeText', () => {
  it('reads like the Paper wording', () => {
    expect(usualRecipeText({ recipe, outputUnit: 'portions', inputs: [{ itemId: chicken, quantity: D(20) }], expected: D(76) })).toBe(
      'Usual recipe: 10 kg chicken and 1 kg paste give 38 portions. For 20 kg chicken that is about 76.',
    );
  });
  it('is null with no recipe', () => {
    expect(usualRecipeText({ recipe: null, outputUnit: 'kg', inputs: [], expected: null })).toBeNull();
  });
});

describe('typoNote', () => {
  const basis = { amount: D(38), source: 'RECIPE' as const, recipeVersionId: 'v1', mainIngredientMissing: false };
  it('warns on 380 vs 38 and 12 vs 38, never on a normal figure or no basis', () => {
    expect(typoNote(D(380), basis, 'portions').suspect).toBe(true);
    expect(typoNote(D(12), basis, 'portions').suspect).toBe(true);
    expect(typoNote(D(60), basis, 'portions')).toEqual({ suspect: false, text: null });
    expect(typoNote(D(380), { ...basis, amount: null, source: 'NONE' }, 'portions').suspect).toBe(false);
    expect(typoNote(null, basis, 'portions').suspect).toBe(false);
  });
});

describe('findRepeat', () => {
  const lines = (q: number) => [{ inputItemId: chicken, quantity: D(q) }, { inputItemId: paste, quantity: D(1) }];
  const candidate = (q: number) => ({ id: 'r1', reference: 'PREP-0001', createdAt: now, inputLines: lines(q) });
  const inputs = [{ itemId: paste, quantity: D(1) }, { itemId: chicken, quantity: D(10) }];
  it('matches the same inputs with the same amounts, in any order', () => {
    expect(findRepeat(inputs, [candidate(10)])?.id).toBe('r1');
  });
  it('does not match a different amount or a different set of items', () => {
    expect(findRepeat(inputs, [candidate(9)])).toBeNull();
    expect(findRepeat([inputs[0]!], [candidate(10)])).toBeNull();
  });
});
