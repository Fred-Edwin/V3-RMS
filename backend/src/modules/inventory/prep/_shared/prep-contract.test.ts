/**
 * Contract drift guard for the Prep rebuild: the shared sample payloads parse against the frozen Zod
 * schemas, bad inputs are refused, and the front end's copy of the payloads is byte-identical (its own
 * test checks them against the hand-written mirror types).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './prep-contract.fixtures.json';
import {
  cancelInputSchema,
  cancelPreviewSchema,
  checkInputSchema,
  checkResultSchema,
  correctInputSchema,
  outputsResponseSchema,
  prepAgainResponseSchema,
  recipeDetailSchema,
  recipeInputSchema,
  recipesListSchema,
  recipesQuerySchema,
  recordInputSchema,
  runDetailSchema,
  runsQuerySchema,
  runsSummarySchema,
  runSummarySchema,
} from './prep-contract';

describe('prep contract fixtures', () => {
  it.each([
    ['runSummaryAttendant', runSummarySchema],
    ['runDetailManager', runDetailSchema],
    ['recipesList', recipesListSchema],
    ['recipeDetail', recipeDetailSchema],
    ['recipeInput', recipeInputSchema],
    ['recordInput', recordInputSchema],
    ['checkInput', checkInputSchema],
    ['checkResult', checkResultSchema],
    ['correctInput', correctInputSchema],
    ['cancelInput', cancelInputSchema],
    ['cancelPreview', cancelPreviewSchema],
    ['runsSummary', runsSummarySchema],
    ['outputs', outputsResponseSchema],
    ['prepAgain', prepAgainResponseSchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse((fixtures as Record<string, unknown>)[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'prep-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(
      join(__dirname, '../../../../../../frontend/features/inventory/prep/_shared/types/prep-contract.fixtures.json'),
      'utf8',
    );
    expect(theirs).toBe(mine);
  });

  it('an Attendant run summary carries no cost or flag keys', () => {
    const keys = Object.keys(fixtures.runSummaryAttendant);
    for (const hidden of ['outputUnitCost', 'needsLook', 'reviewedBy', 'reviewedAt']) {
      expect(keys).not.toContain(hidden);
    }
  });
});

describe('prep contract refusals', () => {
  const key = '33333333-3333-4333-8333-333333333333';
  const item = '11111111-1111-4111-8111-111111111111';

  it('refuses a zero or non-string quantity', () => {
    expect(recordInputSchema.safeParse({ ...fixtures.recordInput, made: '0' }).success).toBe(false);
    expect(recordInputSchema.safeParse({ ...fixtures.recordInput, made: 38 }).success).toBe(false);
    expect(
      recordInputSchema.safeParse({ idempotencyKey: key, outputItemId: item, inputs: [{ itemId: item, quantity: '-1' }], made: '1' })
        .success,
    ).toBe(false);
  });

  it('refuses a run with no inputs and a bad idempotency key', () => {
    expect(recordInputSchema.safeParse({ ...fixtures.recordInput, inputs: [] }).success).toBe(false);
    expect(recordInputSchema.safeParse({ ...fixtures.recordInput, idempotencyKey: 'abc' }).success).toBe(false);
  });

  it('refuses an unknown reason', () => {
    expect(correctInputSchema.safeParse({ ...fixtures.correctInput, reason: 'BECAUSE' }).success).toBe(false);
    expect(cancelInputSchema.safeParse({ reason: 'BECAUSE' }).success).toBe(false);
  });

  it('applies list defaults and caps', () => {
    expect(recipesQuerySchema.parse({})).toEqual({ show: 'all', changed: 'any', page: 1, perPage: 25 });
    expect(recipesQuerySchema.safeParse({ perPage: '101' }).success).toBe(false);
    expect(runsQuerySchema.parse({ needsLook: 'true', mine: 'false', perPage: '10' })).toMatchObject({
      needsLook: true,
      mine: false,
      perPage: 10,
    });
    expect(runsQuerySchema.safeParse({ from: '07/10/2026' }).success).toBe(false);
  });
});
