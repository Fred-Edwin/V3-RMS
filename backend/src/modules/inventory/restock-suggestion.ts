/**
 * Suggested restock level (API_CONTRACT.md §29.5). PROVISIONAL: the formula is the one the walkthrough
 * sketched ("average use per day times days of cover") with one default of 15 days for every item;
 * per-item days of cover and the 14 / 30-day windows are open owner decisions. Pure — the repository
 * supplies the ledger sums, this decides what they mean.
 */
import { Prisma, type InventoryTransactionType } from '@prisma/client';

/** Ledger types that count as "use" at a location. Reversals net out because they carry the opposite sign. */
export const USE_TRANSACTION_TYPES: InventoryTransactionType[] = ['PREP_CONSUME', 'DISPATCH_OUT', 'WASTE', 'SALE'];

export const SUGGESTION_MIN_HISTORY_DAYS = 14;
export const SUGGESTION_WINDOW_DAYS = 30;
export const SUGGESTION_DAYS_OF_COVER = 15;
/** A level that is further than this from the suggestion counts under "suggestions differ". */
export const SUGGESTION_DIFFERS_RATIO = 0.2;

export type ItemUse = {
  /** Net use (positive number) over the last `SUGGESTION_WINDOW_DAYS`. */
  useInWindow: Prisma.Decimal;
  /** When the item's first use row at this location was written. */
  firstUseAt: Date;
};

export type Suggestion = {
  suggestedLevel: string | null;
  suggestionNote: 'NEEDS_HISTORY' | null;
};

const DAY_MS = 86_400_000;

export const computeSuggestion = (use: ItemUse | undefined, now: Date): Suggestion => {
  if (!use) return { suggestedLevel: null, suggestionNote: null };
  const historyDays = (now.getTime() - use.firstUseAt.getTime()) / DAY_MS;
  if (historyDays < SUGGESTION_MIN_HISTORY_DAYS) return { suggestedLevel: null, suggestionNote: 'NEEDS_HISTORY' };
  if (use.useInWindow.lessThanOrEqualTo(0)) return { suggestedLevel: null, suggestionNote: null };

  const windowDays = Math.min(SUGGESTION_WINDOW_DAYS, historyDays);
  const raw = use.useInWindow.div(windowDays).mul(SUGGESTION_DAYS_OF_COVER);
  // Round UP to 2 dp — a suggestion that rounds down would under-stock.
  const rounded = raw.toDecimalPlaces(2, Prisma.Decimal.ROUND_UP);
  return { suggestedLevel: rounded.toFixed(2), suggestionNote: null };
};

/** "Suggestions differ": a level is set, a suggestion exists, and they are more than 20 % apart. */
export const suggestionDiffers = (level: Prisma.Decimal | null, suggestedLevel: string | null): boolean => {
  if (level === null || suggestedLevel === null) return false;
  const suggested = new Prisma.Decimal(suggestedLevel);
  if (level.isZero()) return suggested.greaterThan(0);
  return suggested.minus(level).abs().div(level).greaterThan(SUGGESTION_DIFFERS_RATIO);
};

export type RestockStatus = 'OUT' | 'LOW' | 'OK' | 'NO_LEVEL';

export const restockStatus = (onHand: Prisma.Decimal, level: Prisma.Decimal | null): RestockStatus => {
  if (level === null) return 'NO_LEVEL';
  if (onHand.lessThanOrEqualTo(0)) return 'OUT';
  return onHand.lessThan(level) ? 'LOW' : 'OK';
};
