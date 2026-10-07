import { Prisma } from '@prisma/client';
import type { ExpectedYield, VsUsual } from './prep-contract';
import { NOTIFY_RATIO, ON_TARGET_RATIO, PAST_RUNS_MAX, PAST_RUNS_WINDOW_DAYS, TYPO_FACTOR } from './prep-constants';

/**
 * The Prep scaling and judging rules, pure (no database, no clock unless passed in). The front end keeps a hand-written copy
 * of `scaleRecipe` for the edit drawer's live scaling rows; both are pinned to the same cases in `expected-yield.cases.json`.
 * Rules: docs/features/inventory/prep-plan.md §5.
 */

type Dec = Prisma.Decimal;
const D = (value: Prisma.Decimal.Value): Dec => new Prisma.Decimal(value);

/** `expected = targetYield × mainUsed ÷ recipeMainAmount`, 2 dp. Null when there is nothing to scale from (no main used, or a recipe with no main amount). */
export const scaleRecipe = (input: { targetYield: Prisma.Decimal.Value; recipeMainAmount: Prisma.Decimal.Value; mainUsed: Prisma.Decimal.Value }): Dec | null => {
  const main = D(input.recipeMainAmount);
  const used = D(input.mainUsed);
  if (!main.isFinite() || !used.isFinite() || main.lte(0) || used.lte(0)) return null;
  return D(input.targetYield).times(used).dividedBy(main).toDecimalPlaces(2);
};

export type YieldTier = 'ON_TARGET' | 'WARN' | 'NOTIFY';
export type YieldJudgement = {
  /** The label the screens show; NO_BASIS when there is nothing to judge by. */
  label: VsUsual['label'];
  /** Null for NO_BASIS. */
  tier: YieldTier | null;
  /** made − expected, null for NO_BASIS. */
  delta: Dec | null;
  /** |made − expected| ÷ expected, null for NO_BASIS. */
  ratio: Dec | null;
};

/** ≤15% off is on target; >15% warns (low or high); >35% also notifies. No expected figure means no judgement. */
export const judgeYield = (made: Prisma.Decimal.Value, expected: Prisma.Decimal.Value | null): YieldJudgement => {
  if (expected === null || D(expected).lte(0)) return { label: 'NO_BASIS', tier: null, delta: null, ratio: null };
  const exp = D(expected);
  const delta = D(made).minus(exp);
  const ratio = delta.abs().dividedBy(exp);
  const tier: YieldTier = ratio.lte(ON_TARGET_RATIO) ? 'ON_TARGET' : ratio.lte(NOTIFY_RATIO) ? 'WARN' : 'NOTIFY';
  const label: VsUsual['label'] = tier === 'ON_TARGET' ? 'ON_TARGET' : delta.isNegative() ? 'LOW' : 'HIGH';
  return { label, tier, delta, ratio };
};

/** Made over 3× or under ⅓ of the expected figure (strictly beyond) looks like a typo: the screen warns, nothing blocks. */
export const isTypoSuspect = (made: Prisma.Decimal.Value, expected: Prisma.Decimal.Value | null): boolean => {
  if (expected === null || D(expected).lte(0)) return false;
  const m = D(made);
  const e = D(expected);
  return m.gt(e.times(TYPO_FACTOR)) || m.lt(e.dividedBy(TYPO_FACTOR));
};

export type PastRun = { actualYield: Prisma.Decimal.Value; createdAt: Date };

/**
 * The past-runs fallback: the mean of the last 10 runs or of those in the last 30 days, whichever gives fewer; null with none.
 * Pass only RECORDED runs of the one output item (a corrected original and a cancelled run do not count).
 */
export const pastRunsExpected = (runs: readonly PastRun[], now: Date): Dec | null => {
  const newestFirst = [...runs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const since = now.getTime() - PAST_RUNS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const lastTen = newestFirst.slice(0, PAST_RUNS_MAX);
  const inWindow = newestFirst.filter((r) => r.createdAt.getTime() >= since);
  const used = lastTen.length <= inWindow.length ? lastTen : inWindow;
  if (used.length === 0) return null;
  return used.reduce((sum, r) => sum.plus(D(r.actualYield)), D(0)).dividedBy(used.length).toDecimalPlaces(2);
};

// ── Wording (the "ready to show" strings in the contract) ───────────────────────────────────────────────────────────────

const WHOLE_NUMBER_UNITS = /^(portions?|pcs?|pieces?|plates?|servings?|units?)$/i;

/** Whole numbers for portions and pieces, one decimal for kg and litres and the rest; a trailing ".0" is dropped. */
export const formatAmount = (value: Prisma.Decimal.Value, unit: string): string => {
  const places = WHOLE_NUMBER_UNITS.test(unit.trim()) ? 0 : 1;
  const text = D(value).toDecimalPlaces(places, Prisma.Decimal.ROUND_HALF_UP).toFixed(places);
  return places === 1 && text.endsWith('.0') ? text.slice(0, -2) : text;
};

const signed = (delta: Dec, unit: string): string => {
  const body = formatAmount(delta.abs(), unit);
  if (delta.isZero() || body === '0') return '0';
  return `${delta.isNegative() ? '−' : '+'}${body}`;
};

/** "about 76 portions", "about 3 kg, from past runs", or "no usual yet". */
export const expectedYieldFor = (amount: Prisma.Decimal.Value | null, unit: string, source: ExpectedYield['source']): ExpectedYield => {
  if (amount === null || source === 'NONE') return { amount: null, unit, source: 'NONE', text: 'no usual yet' };
  const text = `about ${formatAmount(amount, unit)} ${unit}${source === 'PAST_RUNS' ? ', from past runs' : ''}`;
  return { amount: D(amount).toFixed(2), unit, source, text };
};

/** The "vs usual" chip: "on target", "−16 portions · low yield", "+0.3 kg · high yield". */
export const vsUsualFor = (made: Prisma.Decimal.Value, expected: Prisma.Decimal.Value | null, unit: string): VsUsual => {
  const j = judgeYield(made, expected);
  if (j.label === 'NO_BASIS' || j.delta === null) return { label: 'NO_BASIS', deltaAmount: null, text: 'nothing to compare with yet' };
  const deltaAmount = signed(j.delta, unit);
  if (j.label === 'ON_TARGET') return { label: 'ON_TARGET', deltaAmount, text: 'on target' };
  return { label: j.label, deltaAmount, text: `${deltaAmount} ${unit} · ${j.label === 'LOW' ? 'low' : 'high'} yield` };
};
