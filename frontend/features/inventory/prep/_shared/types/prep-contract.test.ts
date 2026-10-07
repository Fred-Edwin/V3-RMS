import { describe, expect, it } from 'vitest';
import fixtures from './prep-contract.fixtures.json';
import type {
  CancelPreview,
  CheckResult,
  RecipeDetail,
  RecipesList,
  RunDetail,
  RunSummary,
  RunsSummary,
} from './prep-contract';

/**
 * Drift guard for the hand-written mirror: the same sample payloads the back end parses with Zod are
 * typed with the mirror types here (the build fails if a field's type changes) and their key sets are
 * pinned (a field added or dropped on one side fails this test).
 */
const keysOf = (o: object): string[] => Object.keys(o).sort();

describe('prep contract mirror', () => {
  it('RunSummary keys', () => {
    const run = fixtures.runSummaryAttendant as RunSummary;
    expect(keysOf(run)).toEqual(
      ['at', 'by', 'id', 'inputsPreview', 'isCorrection', 'made', 'mine', 'outputItemId', 'outputName', 'reference', 'status', 'unit', 'vsUsual'].sort(),
    );
  });

  it('RunDetail keys add to the summary', () => {
    const run = fixtures.runDetailManager as RunDetail;
    for (const k of ['inputs', 'expected', 'recipeVersion', 'yieldReason', 'yieldReasonNote', 'replaces', 'replacedBy', 'correction', 'cancellation', 'timeline', 'can', 'windowEndsAt', 'flags', 'totalInputCost', 'outputUnitCost', 'needsLook']) {
      expect(keysOf(run)).toContain(k);
    }
    expect(keysOf(run.can)).toEqual(['cancel', 'correct', 'lockedReason', 'review']);
  });

  it('recipes, check and cancel preview keys', () => {
    const list = fixtures.recipesList as RecipesList;
    expect(keysOf(list)).toEqual(['items', 'total', 'totalItems', 'withoutRecipe']);
    const detail = fixtures.recipeDetail as RecipeDetail;
    expect(keysOf(detail)).toEqual(['costPerUnitNow', 'current', 'history', 'itemId', 'itemName', 'suggestFromLastRun', 'unit']);
    const check = fixtures.checkResult as CheckResult;
    expect(keysOf(check)).toEqual(['cost', 'expected', 'mainIngredientMissing', 'repeat', 'stock', 'tier', 'typoSuspect', 'usualRecipeText', 'vsUsual']);
    const preview = fixtures.cancelPreview as CancelPreview;
    expect(keysOf(preview.items[0] as object)).toEqual(['belowZero', 'itemId', 'itemName', 'onHandAfter', 'onHandNow', 'unit']);
    const summary = fixtures.runsSummary as RunsSummary;
    expect(keysOf(summary)).toEqual(['needsLookCount', 'prepValue7d', 'runsThisWeek', 'runsToday']);
  });

  it('every decimal in the samples is a string', () => {
    const run = fixtures.runDetailManager as RunDetail;
    expect(typeof run.made).toBe('string');
    expect(typeof run.inputs[0]?.quantity).toBe('string');
  });
});
