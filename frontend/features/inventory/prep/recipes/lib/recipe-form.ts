import type { RecipeDetail, RecipeInput, RecipeReason } from '../../_shared/types/prep-contract';
import { trimNumber } from './recipe-scaling';

/** The edit drawer's working copy of a recipe. Amounts are strings the manager can type into. */
export interface FormLine {
  /** Stable React key; not sent. */
  key: string;
  itemId: string;
  itemName: string;
  unit: string;
  amount: string;
  isMain: boolean;
}

export interface RecipeFormState {
  targetYield: string;
  lines: FormLine[];
  reason: RecipeReason | null;
  reasonNote: string;
}

export const REASON_OPTIONS: ReadonlyArray<{ value: RecipeReason; label: string }> = [
  { value: 'BETTER_RECIPE', label: 'Better recipe' },
  { value: 'PORTION_SIZE_CHANGED', label: 'Portion size changed' },
  { value: 'NEW_SUPPLIER', label: 'New supplier' },
  { value: 'OTHER', label: 'Other' },
];

let counter = 0;
export const newLineKey = (): string => `line-${++counter}`;

const KG_LIKE = /^(kg|l|litres?|liters?|g|ml)$/i;

/** Step of the + and - buttons: 0.5 for kg and litres, 1 for portions and other counted units. */
export function stepFor(unit: string): number {
  return KG_LIKE.test(unit.trim()) ? 0.5 : 1;
}

/** One press of + or -; never below one step, so an amount cannot reach zero by the stepper. */
export function bumpAmount(amount: string, direction: 1 | -1, unit: string): string {
  const step = stepFor(unit);
  const current = Number(amount);
  const base = Number.isFinite(current) && current > 0 ? current : 0;
  const next = Math.max(step, base + direction * step);
  return trimNumber(next);
}

export const isPositiveAmount = (value: string): boolean => /^\d+(\.\d+)?$/.test(value.trim()) && Number(value) > 0;

/** The form for an item that already has a recipe, or an empty one for its first. */
export function formFromDetail(detail: RecipeDetail): RecipeFormState {
  if (!detail.current) return { targetYield: '', lines: [], reason: null, reasonNote: '' };
  return {
    targetYield: trimNumber(detail.current.targetYield),
    lines: detail.current.lines.map((l) => ({
      key: newLineKey(),
      itemId: l.itemId,
      itemName: l.itemName,
      unit: l.unit,
      amount: trimNumber(l.amount),
      isMain: l.isMain,
    })),
    reason: null,
    reasonNote: '',
  };
}

/** "Use these": the last run's inputs and yield, with the largest ingredient proposed as the main one. */
export function formFromSuggestion(detail: RecipeDetail): RecipeFormState | null {
  const s = detail.suggestFromLastRun;
  if (!s || s.lines.length === 0) return null;
  const largest = s.lines.reduce((best, l) => (Number(l.amount) > Number(best.amount) ? l : best), s.lines[0]);
  return {
    targetYield: trimNumber(s.made),
    lines: s.lines.map((l) => ({
      key: newLineKey(),
      itemId: l.itemId,
      itemName: l.itemName,
      unit: l.unit,
      amount: trimNumber(l.amount),
      isMain: l.itemId === largest.itemId,
    })),
    reason: null,
    reasonNote: '',
  };
}

/** Exactly one main ingredient: setting one clears the others. */
export function setMain(lines: FormLine[], key: string): FormLine[] {
  return lines.map((l) => ({ ...l, isMain: l.key === key }));
}

/** Removing the main ingredient leaves none; the caller shows "pick a main ingredient". Removing the only line leaves an empty list. */
export function removeLine(lines: FormLine[], key: string): FormLine[] {
  return lines.filter((l) => l.key !== key);
}

export interface RecipeFormCheck {
  /** The reason chips are required (the item already has a recipe). */
  reasonRequired: boolean;
  /** Nothing differs from the current version (only when editing). */
  unchanged: boolean;
  problems: {
    targetYield?: string;
    lines?: string;
    main?: string;
    amounts?: string;
    reason?: string;
  };
  /** Save is enabled only when this is true. */
  canSave: boolean;
}

const sortKey = (l: { itemId: string; amount: string; isMain: boolean }): string => `${l.itemId}|${Number(l.amount)}|${l.isMain}`;

function sameAsCurrent(state: RecipeFormState, detail: RecipeDetail): boolean {
  const current = detail.current;
  if (!current) return false;
  if (Number(state.targetYield) !== Number(current.targetYield)) return false;
  if (state.lines.length !== current.lines.length) return false;
  const a = state.lines.map(sortKey).sort();
  const b = current.lines.map(sortKey).sort();
  return a.every((v, i) => v === b[i]);
}

export function checkRecipeForm(state: RecipeFormState, detail: RecipeDetail): RecipeFormCheck {
  const reasonRequired = detail.current !== null;
  const problems: RecipeFormCheck['problems'] = {};

  if (!isPositiveAmount(state.targetYield)) problems.targetYield = 'Enter what one batch should give.';
  if (state.lines.length === 0) problems.lines = 'Add at least one ingredient.';
  if (state.lines.some((l) => !isPositiveAmount(l.amount))) problems.amounts = 'Every ingredient needs an amount above zero.';
  if (state.lines.length > 0 && state.lines.filter((l) => l.isMain).length !== 1) problems.main = 'Pick one main ingredient. The target scales by it.';
  const unchanged = reasonRequired && sameAsCurrent(state, detail);
  if (reasonRequired && !unchanged && state.reason === null) problems.reason = 'Say why you are changing it.';

  const hasProblem = Object.keys(problems).length > 0;
  return { reasonRequired, unchanged, problems, canSave: !hasProblem && !unchanged };
}

export function toRecipeInput(state: RecipeFormState, reasonRequired: boolean): RecipeInput {
  const note = state.reasonNote.trim();
  return {
    targetYield: trimNumber(state.targetYield),
    lines: state.lines.map((l) => ({ itemId: l.itemId, amount: trimNumber(l.amount), isMain: l.isMain })),
    ...(reasonRequired && state.reason ? { reason: state.reason } : {}),
    ...(reasonRequired && state.reason === 'OTHER' && note ? { reasonNote: note } : {}),
  };
}

export type RecipeSaveProblem = { field: 'form' | 'reason' | 'main'; message: string };

/** Maps the stable Prep error codes to the text under the field they belong to. */
export function mapSaveError(code: string | null, fallback: string): RecipeSaveProblem {
  switch (code) {
    case 'RECIPE_UNCHANGED':
      return { field: 'form', message: 'Nothing is different from the current recipe, so nothing was saved.' };
    case 'REASON_REQUIRED':
      return { field: 'reason', message: 'Say why you are changing it.' };
    case 'MAIN_INGREDIENT_REQUIRED':
      return { field: 'main', message: 'Pick one main ingredient. The target scales by it.' };
    default:
      return { field: 'form', message: fallback };
  }
}
