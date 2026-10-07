/**
 * Usual recipes: the scaling rule, front-end copy (plan section 5).
 * `expected = targetYield x mainUsed / recipeMainAmount`, 2 dp, null when there is nothing to scale from.
 * Hand-written twin of `scaleRecipe` in backend `_shared/expected-yield.ts`; both are pinned to
 * `_shared/lib/expected-yield.cases.json` (see recipe-scaling.test.ts).
 */

/** Round half up to `places` using the decimal text, so 0.425 -> 0.43 like the back end's Decimal. */
function roundHalfUp(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

const toNumber = (value: string | number): number => (typeof value === 'number' ? value : Number(value));

/** The expected yield for a batch that uses `mainUsed` of the main ingredient, as a 2 dp string; null with nothing to scale from. */
export function scaleRecipe(input: { targetYield: string | number; recipeMainAmount: string | number; mainUsed: string | number }): string | null {
  const main = toNumber(input.recipeMainAmount);
  const used = toNumber(input.mainUsed);
  const target = toNumber(input.targetYield);
  if (!Number.isFinite(main) || !Number.isFinite(used) || !Number.isFinite(target) || main <= 0 || used <= 0) return null;
  return roundHalfUp((target * used) / main, 2).toFixed(2);
}

const WHOLE_NUMBER_UNITS = /^(portions?|pcs?|pieces?|plates?|servings?|units?)$/i;

/** Whole numbers for portions and pieces, one decimal for kg, litres and the rest; a trailing ".0" is dropped (copy of the back end's formatAmount). */
export function formatAmount(value: string | number, unit: string): string {
  const places = WHOLE_NUMBER_UNITS.test(unit.trim()) ? 0 : 1;
  const text = roundHalfUp(toNumber(value), places).toFixed(places);
  return places === 1 && text.endsWith('.0') ? text.slice(0, -2) : text;
}

/** An amount the manager typed or the recipe stores, without trailing zeros and at most 2 dp: "1.5", "0.75", "10". */
export function trimNumber(value: string | number): string {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return String(value);
  return String(roundHalfUp(n, 2));
}

export interface ScalingRow {
  /** "5 kg chicken, cut" */
  label: string;
  /** "19 portions", or null when it cannot be worked out yet. */
  result: string | null;
  isOneBatch: boolean;
}

/** Half a batch, one batch, double: the three rows under the formula in the edit drawer. */
export const SCALING_FACTORS: ReadonlyArray<{ factor: number; isOneBatch: boolean }> = [
  { factor: 0.5, isOneBatch: false },
  { factor: 1, isOneBatch: true },
  { factor: 2, isOneBatch: false },
];

export function scalingRows(input: { targetYield: string; mainAmount: string; mainName: string; mainUnit: string; outputUnit: string }): ScalingRow[] {
  const main = toNumber(input.mainAmount);
  return SCALING_FACTORS.map(({ factor, isOneBatch }) => {
    const used = main * factor;
    const expected = Number.isFinite(used) && used > 0 ? scaleRecipe({ targetYield: input.targetYield, recipeMainAmount: input.mainAmount, mainUsed: used }) : null;
    return {
      label: `${trimNumber(used > 0 ? used : 0)} ${input.mainUnit} ${input.mainName.toLowerCase()}${isOneBatch ? ' · one batch' : ''}`,
      result: expected === null ? null : `${formatAmount(expected, input.outputUnit)} ${input.outputUnit}`,
      isOneBatch,
    };
  });
}

/** "TARGET = 38 PORTIONS x (KG OF CHICKEN USED / 10 KG)" in the drawer's mono caption. */
export function formulaText(input: { targetYield: string; mainAmount: string; mainName: string; mainUnit: string; outputUnit: string }): string {
  return `Target = ${trimNumber(input.targetYield)} ${input.outputUnit} × (${input.mainUnit} of ${input.mainName.toLowerCase()} used ÷ ${trimNumber(input.mainAmount)} ${input.mainUnit})`.toUpperCase();
}
