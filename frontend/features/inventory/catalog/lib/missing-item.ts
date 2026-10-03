import type { CreateItemInput, InventoryItemType } from '../../types';

/**
 * The attendant's short "New item" form (Paper chapter 6, step 25): a name, what it is, and how it arrives.
 * No prices, no stock, no category or supplier; the Store Manager finishes those from "Needs setup" (§29.4).
 * Prepped is not offered: Prep runs make those.
 */

export type MissingItemType = Extract<InventoryItemType, 'STOCKED' | 'RAW_INGREDIENT'>;

export const MISSING_ITEM_TYPES: ReadonlyArray<{ value: MissingItemType; label: string; explainer: string }> = [
  { value: 'STOCKED', label: 'Stocked', explainer: 'Used as it comes: milk, cooking oil, tissue.' },
  { value: 'RAW_INGREDIENT', label: 'Raw ingredient', explainer: 'Goes into Prep: flour, raw chicken, tomatoes.' },
];

export interface MissingItemDraft {
  name: string;
  type: MissingItemType;
  /** "tin" */
  packUnit: string;
  /** "400" */
  holds: string;
  /** "g" */
  usageUnit: string;
}

export type MissingItemField = 'name' | 'packUnit' | 'holds' | 'usageUnit';

const HOLDS_PATTERN = /^\d+(\.\d{1,4})?$/;

/** The first thing wrong with each field, by field; empty when the form can be sent. */
export function missingItemErrors(draft: MissingItemDraft): Partial<Record<MissingItemField, string>> {
  const errors: Partial<Record<MissingItemField, string>> = {};
  if (draft.name.trim() === '') errors.name = 'Give the item a name.';
  if (draft.packUnit.trim() === '') errors.packUnit = 'Say what it comes in, like tin or bag.';
  if (draft.usageUnit.trim() === '') errors.usageUnit = 'Say what it is counted in, like g or ml.';
  const holds = draft.holds.trim();
  if (holds === '' || !HOLDS_PATTERN.test(holds) || Number.parseFloat(holds) <= 0) errors.holds = 'Enter how many it holds, like 400.';
  return errors;
}

/** "1 tin = 400 g"; empty until the three parts are filled. */
export function packPreview(draft: Pick<MissingItemDraft, 'packUnit' | 'holds' | 'usageUnit'>): string {
  const pack = draft.packUnit.trim();
  const holds = draft.holds.trim();
  const usage = draft.usageUnit.trim();
  if (!pack || !holds || !usage || !HOLDS_PATTERN.test(holds)) return '';
  return `1 ${pack} = ${holds} ${usage}`;
}

/** Sentence case for a typed name: "tomato paste" -> "Tomato paste". Only the first letter changes. */
export function tidyName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  return name === '' ? '' : name.charAt(0).toUpperCase() + name.slice(1);
}

/** "tin" -> "tins", "box" -> "boxes". Display only. */
export function pluralUnit(unit: string): string {
  const u = unit.trim();
  if (/(s|x|z|ch|sh)$/i.test(u)) return `${u}es`;
  return `${u}s`;
}

/** The body for `POST /inventory/items` — only the fields an attendant may send (§29.4). */
export function toMissingItemInput(draft: MissingItemDraft): CreateItemInput {
  const holds = draft.holds.trim();
  return {
    name: tidyName(draft.name),
    type: draft.type,
    buyUnit: draft.packUnit.trim(),
    usageUnit: draft.usageUnit.trim(),
    conversionFactor: holds === '1' ? null : holds,
    departmentTags: [],
  };
}

/** Items whose name contains what was typed, best (starts-with) first. */
export function matchItems<T extends { name: string }>(items: readonly T[], query: string, limit = 8): T[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    const n = item.name.toLowerCase();
    if (n.startsWith(q)) starts.push(item);
    else if (n.includes(q)) contains.push(item);
  }
  return [...starts, ...contains].slice(0, limit);
}
