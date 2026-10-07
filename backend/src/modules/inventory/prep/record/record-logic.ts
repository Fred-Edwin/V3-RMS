import { Prisma } from '@prisma/client';
import { expectedYieldFor, formatAmount, isTypoSuspect, pastRunsExpected, scaleRecipe, type PastRun } from '../_shared/expected-yield';
import type { ExpectedYield } from '../_shared/prep-contract';
import type { PrepRecipeRead } from '../_shared/prep-recipe-reader';
import { TYPO_FACTOR } from '../_shared/prep-constants';
import { UnprocessableEntityError } from '../../../../utils/errors';

/** Pure rules for Record a run: no database, no clock unless passed in. Spec: docs/API_CONTRACT.md §33.5. */

export type RunInput = { itemId: string; quantity: Prisma.Decimal };

/** The 422s the contract names. Checked before anything is read from the database. */
export const assertValidInputs = (outputItemId: string, inputs: readonly RunInput[], made: Prisma.Decimal | null): void => {
  if (made !== null && !(made.isFinite() && made.gt(0))) throw new UnprocessableEntityError('The amount made must be more than zero', 'QUANTITY_NOT_POSITIVE');
  const seen = new Set<string>();
  for (const line of inputs) {
    if (!line.quantity.isFinite() || line.quantity.lte(0)) throw new UnprocessableEntityError('Every ingredient needs an amount above zero', 'QUANTITY_NOT_POSITIVE');
    if (line.itemId === outputItemId) throw new UnprocessableEntityError('An item cannot be an ingredient of itself', 'INPUT_IS_OUTPUT');
    if (seen.has(line.itemId)) throw new UnprocessableEntityError('Each ingredient can appear only once', 'DUPLICATE_INPUT_LINE');
    seen.add(line.itemId);
  }
};

export type ExpectedBasis = {
  amount: Prisma.Decimal | null;
  source: ExpectedYield['source'];
  recipeVersionId: string | null;
  /** A recipe exists but the run does not use its main ingredient, so past runs judged it instead. */
  mainIngredientMissing: boolean;
};

/** Recipe scaling when the run uses the recipe's main ingredient; otherwise the past-runs figure; otherwise nothing. */
export const expectedBasisFor = (input: {
  recipe: PrepRecipeRead | null;
  inputs: readonly RunInput[];
  pastRuns: readonly PastRun[];
  now: Date;
}): ExpectedBasis => {
  const { recipe } = input;
  let mainIngredientMissing = false;
  if (recipe) {
    const main = recipe.lines.find((line) => line.isMain);
    const used = main ? input.inputs.find((line) => line.itemId === main.inputItemId) : undefined;
    if (main && used) {
      const scaled = scaleRecipe({ targetYield: recipe.targetYield, recipeMainAmount: main.amount, mainUsed: used.quantity });
      if (scaled) return { amount: scaled, source: 'RECIPE', recipeVersionId: recipe.versionId, mainIngredientMissing: false };
    }
    mainIngredientMissing = true;
  }
  const past = pastRunsExpected(input.pastRuns, input.now);
  if (past) return { amount: past, source: 'PAST_RUNS', recipeVersionId: null, mainIngredientMissing };
  return { amount: null, source: 'NONE', recipeVersionId: null, mainIngredientMissing };
};

const joinWords = (parts: string[]): string => (parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

/** "Usual recipe: 10 kg chicken and 1 kg paste give 38 portions. For 20 kg chicken that is about 76." */
export const usualRecipeText = (input: { recipe: PrepRecipeRead | null; outputUnit: string; inputs: readonly RunInput[]; expected: Prisma.Decimal | null }): string | null => {
  const { recipe, outputUnit } = input;
  if (!recipe) return null;
  const lines = recipe.lines.map((line) => `${formatAmount(line.amount, line.unit)} ${line.unit} ${line.itemName}`);
  let text = `Usual recipe: ${joinWords(lines)} give ${formatAmount(recipe.targetYield, outputUnit)} ${outputUnit}.`;
  const main = recipe.lines.find((line) => line.isMain);
  const used = main ? input.inputs.find((line) => line.itemId === main.inputItemId) : undefined;
  if (main && used && input.expected) {
    text += ` For ${formatAmount(used.quantity, main.unit)} ${main.unit} ${main.itemName} that is about ${formatAmount(input.expected, outputUnit)}.`;
  }
  return text;
};

/** The warning for a made figure far from the expected one. Warns, never blocks, never stored. */
export const typoNote = (made: Prisma.Decimal | null, expected: ExpectedBasis, outputUnit: string): { suspect: boolean; text: string | null } => {
  if (made === null || expected.amount === null || !isTypoSuspect(made, expected.amount)) return { suspect: false, text: null };
  const usual = expectedYieldFor(expected.amount, outputUnit, expected.source).text;
  const more = made.gt(expected.amount.times(TYPO_FACTOR));
  return { suspect: true, text: `That is ${more ? 'much more' : 'much less'} than the usual (${usual}). Please check the number.` };
};

export type RepeatCandidate = { id: string; reference: string | null; createdAt: Date; inputLines: { inputItemId: string; quantity: Prisma.Decimal }[] };

/** Same output, same inputs with the same amounts, same Nairobi day: the caller passes that day's RECORDED runs of the output. */
export const findRepeat = (inputs: readonly RunInput[], candidates: readonly RepeatCandidate[]): RepeatCandidate | null =>
  candidates.find(
    (run) =>
      run.inputLines.length === inputs.length &&
      inputs.every((line) => run.inputLines.some((l) => l.inputItemId === line.itemId && l.quantity.eq(line.quantity))),
  ) ?? null;
