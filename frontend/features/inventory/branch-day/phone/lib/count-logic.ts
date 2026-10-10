import type { CountLine } from '../../_shared/types/branch-day-contract';

/** What a person types in a count box: digits and one decimal point; blank stays blank (blank is "not counted", zero must be typed). */
export const cleanFigure = (raw: string): string => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 3)}` : whole;
};

/** A figure the server accepts: a number, zero allowed. "." alone and blank are not figures. */
export const isFigure = (value: string | null | undefined): value is string => value !== null && value !== undefined && value.trim() !== '' && Number.isFinite(Number(value));

/** "5 of 8 counted" numbers from what is typed, by item id. */
export const progressOf = (itemIds: readonly string[], typed: Readonly<Record<string, string>>): { filled: number; total: number; blank: number; percent: number } => {
  const total = itemIds.length;
  const filled = itemIds.filter((id) => isFigure(typed[id])).length;
  return { filled, total, blank: total - filled, percent: total === 0 ? 0 : Math.round((filled / total) * 100) };
};

/** The helper line under the button: "3 items still to count." (none at zero). */
export const stillToCount = (blank: number): string | null => (blank <= 0 ? null : `${blank} ${blank === 1 ? 'item' : 'items'} still to count.`);

/** The first row after `index` that has no figure yet (Enter moves there); the next row when all are filled; null at the end. */
export const nextRowToCount = (itemIds: readonly string[], typed: Readonly<Record<string, string>>, index: number): number | null => {
  for (let i = index + 1; i < itemIds.length; i += 1) if (!isFigure(typed[itemIds[i] ?? ''])) return i;
  return index + 1 < itemIds.length ? index + 1 : null;
};

/** The lines as the server stored them, keyed by item id, for the boxes. */
export const typedFrom = (lines: readonly CountLine[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of lines) out[line.itemId] = line.countedQty ?? '';
  return out;
};

/** B3b: the group sections ("Drinks and dry goods · 5 items" over the item names), in the order the lines come. */
export const groupSections = (lines: readonly CountLine[]): { name: string; itemCount: number; names: string[] }[] => {
  const groups: { name: string; itemCount: number; names: string[] }[] = [];
  for (const line of lines) {
    const name = line.categoryPath[0] ?? 'Items';
    const found = groups.find((g) => g.name === name);
    if (found) {
      found.itemCount += 1;
      found.names.push(line.itemName);
    } else groups.push({ name, itemCount: 1, names: [line.itemName] });
  }
  return groups;
};

/** The lines to save: only the ones that differ from what the server holds. A cleared box saves null. */
export const changedLines = (typed: Readonly<Record<string, string>>, saved: Readonly<Record<string, string>>): { itemId: string; countedQty: string | null }[] =>
  Object.keys(typed)
    .filter((id) => (typed[id] ?? '') !== (saved[id] ?? ''))
    .map((id) => ({ itemId: id, countedQty: isFigure(typed[id]) ? String(typed[id]) : null }));

export const unitHint = (unit: string): string => `Count in ${unit.toLowerCase()}`;
