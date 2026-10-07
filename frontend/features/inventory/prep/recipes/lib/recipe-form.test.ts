import { describe, expect, it } from 'vitest';

import fixtures from '../../_shared/types/prep-contract.fixtures.json';
import type { RecipeDetail } from '../../_shared/types/prep-contract';
import { bumpAmount, checkRecipeForm, formFromDetail, formFromSuggestion, mapSaveError, setMain, stepFor, toRecipeInput } from './recipe-form';

const first = fixtures.recipeDetail as RecipeDetail;
const person = { id: 'u1', name: 'Joseph Mwangi', initials: 'JM', roleLabel: 'Store Manager' };
const edit: RecipeDetail = {
  itemId: 'chicken',
  itemName: 'Marinated chicken',
  unit: 'portions',
  current: {
    version: 1,
    targetYield: '38',
    lines: [
      { itemId: 'a', itemName: 'Chicken, cut', unit: 'kg', amount: '10', isMain: true },
      { itemId: 'b', itemName: 'Garlic-ginger paste', unit: 'kg', amount: '1', isMain: false },
    ],
    changedAt: '2026-10-08T08:00:00.000Z',
    changedBy: person,
    reason: null,
  },
  suggestFromLastRun: null,
  history: [],
};

describe('first recipe', () => {
  it('"Use these" fills lines and yield and proposes the largest as main', () => {
    const detail: RecipeDetail = {
      ...first,
      suggestFromLastRun: {
        lines: [
          { itemId: 'x', itemName: 'Cumin', unit: 'kg', amount: '1' },
          { itemId: 'y', itemName: 'Coriander', unit: 'kg', amount: '1.5' },
          { itemId: 'z', itemName: 'Cardamom', unit: 'kg', amount: '0.5' },
        ],
        made: '3',
        basedOn: 'PREP-0125',
      },
    };
    const form = formFromSuggestion(detail);
    expect(form?.targetYield).toBe('3');
    expect(form?.lines.filter((l) => l.isMain).map((l) => l.itemName)).toEqual(['Coriander']);
  });

  it('needs no reason and is valid with a target, an amount and one main', () => {
    const form = formFromSuggestion(first);
    expect(form).not.toBeNull();
    const check = checkRecipeForm(form!, first);
    expect(check.reasonRequired).toBe(false);
    expect(check.canSave).toBe(true);
    expect(toRecipeInput(form!, check.reasonRequired).reason).toBeUndefined();
  });

  it('is not valid empty', () => {
    const check = checkRecipeForm({ targetYield: '', lines: [], reason: null, reasonNote: '' }, first);
    expect(check.canSave).toBe(false);
    expect(check.problems.lines).toBeDefined();
    expect(check.problems.targetYield).toBeDefined();
  });
});

describe('editing a recipe', () => {
  it('is unchanged until something differs, then asks for a reason', () => {
    const form = formFromDetail(edit);
    expect(checkRecipeForm(form, edit)).toMatchObject({ unchanged: true, canSave: false });
    const moved = { ...form, targetYield: '40' };
    const check = checkRecipeForm(moved, edit);
    expect(check.unchanged).toBe(false);
    expect(check.problems.reason).toBeDefined();
    expect(check.canSave).toBe(false);
    expect(checkRecipeForm({ ...moved, reason: 'BETTER_RECIPE' }, edit).canSave).toBe(true);
  });

  it('sends the reason, and the note only for Other', () => {
    const form = { ...formFromDetail(edit), targetYield: '40', reason: 'OTHER' as const, reasonNote: ' bigger pan ' };
    expect(toRecipeInput(form, true)).toMatchObject({ targetYield: '40', reason: 'OTHER', reasonNote: 'bigger pan' });
    expect(toRecipeInput({ ...form, reason: 'NEW_SUPPLIER' }, true).reasonNote).toBeUndefined();
  });

  it('keeps exactly one main ingredient', () => {
    const form = formFromDetail(edit);
    const other = form.lines[1];
    const lines = setMain(form.lines, other.key);
    expect(lines.filter((l) => l.isMain)).toHaveLength(1);
    expect(lines.find((l) => l.isMain)?.itemId).toBe('b');
    const none = { ...form, lines: form.lines.map((l) => ({ ...l, isMain: false })), reason: 'OTHER' as const };
    expect(checkRecipeForm(none, edit).problems.main).toBeDefined();
  });

  it('refuses a zero or blank amount', () => {
    const form = formFromDetail(edit);
    const bad = { ...form, lines: form.lines.map((l, i) => (i === 1 ? { ...l, amount: '0' } : l)), reason: 'OTHER' as const };
    expect(checkRecipeForm(bad, edit).problems.amounts).toBeDefined();
  });
});

describe('stepper and errors', () => {
  it('steps 0.5 for kg and litres, 1 for portions, never below one step', () => {
    expect(stepFor('kg')).toBe(0.5);
    expect(stepFor('L')).toBe(0.5);
    expect(stepFor('portions')).toBe(1);
    expect(bumpAmount('1', 1, 'kg')).toBe('1.5');
    expect(bumpAmount('0.5', -1, 'kg')).toBe('0.5');
    expect(bumpAmount('', 1, 'portions')).toBe('1');
  });

  it('maps the stable error codes to inline text', () => {
    expect(mapSaveError('RECIPE_UNCHANGED', 'x').field).toBe('form');
    expect(mapSaveError('REASON_REQUIRED', 'x').field).toBe('reason');
    expect(mapSaveError('MAIN_INGREDIENT_REQUIRED', 'x').field).toBe('main');
    expect(mapSaveError(null, 'Not saved').message).toBe('Not saved');
  });
});
