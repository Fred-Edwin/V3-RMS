import type { RestockLevelRow, RestockStatus } from '../../types';
import { formatNumber } from '../../_shared/components/stock-format';
import { levelNumber, suggestedPerDay, suggestionVerdict, SUGGESTION_COVER_DAYS, type ChangeEffectKind } from './restock-logic';

/**
 * What the Department Head's phone screen says and does with a level (Paper chapter 7).
 * Levels are quantities, not money, but are still kept to four decimals so a step never leaves 0.30000000000000004.
 */

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/** One step on the big − and + buttons. A level cannot go below 0. */
export const LEVEL_STEP = 1;

/**
 * The level after a tap. With no level yet, + starts from the suggestion (or 1 with none); − stays at none.
 * Returns the level as the string the API takes.
 */
export function stepLevel(current: string | null, direction: 1 | -1, suggested: string | null): string | null {
  if (current === null) {
    if (direction === -1) return null;
    return suggested !== null ? String(round4(Number.parseFloat(suggested))) : String(LEVEL_STEP);
  }
  const next = Math.max(0, round4(Number.parseFloat(current) + direction * LEVEL_STEP));
  return String(next);
}

const STATUS_LABEL: Record<RestockStatus, string> = { OUT: 'Out', LOW: 'Low', OK: 'OK', NO_LEVEL: 'No level' };
export const statusLabel = (status: RestockStatus): string => STATUS_LABEL[status];

export type SuggestionTone = 'muted' | 'success';

export interface SuggestionLine {
  text: string;
  tone: SuggestionTone;
}

/**
 * The line under a stepper: "Suggested 40 · you use about 38 a day". `saved` is the level on file, `typed` the one on screen.
 * Wording from Paper step 27; "Needs 14 days of use first" is the backend's own note for an item with too little history (§29.5).
 */
export function suggestionLine(
  row: Pick<RestockLevelRow, 'suggestedLevel' | 'suggestionNote' | 'usageUnit' | 'daysOfCover'>,
  saved: string | null,
  typed: string | null
): SuggestionLine | null {
  if (row.suggestionNote === 'NEEDS_HISTORY') return { text: 'Needs 14 days of use first', tone: 'muted' };
  if (row.suggestedLevel === null) return null;
  const suggested = Number.parseFloat(row.suggestedLevel);
  const cover = Number.parseFloat(row.daysOfCover);
  const perDay = formatNumber(suggestedPerDay(suggested, Number.isFinite(cover) && cover > 0 ? cover : SUGGESTION_COVER_DAYS));
  const use = `you use about ${perDay} ${row.usageUnit} a day`;
  const head = `Suggested ${formatNumber(suggested)}`;
  const verdict = suggestionVerdict(levelNumber(saved), levelNumber(typed), suggested);
  switch (verdict) {
    case 'APPLIED':
      return { text: `${head} · applied. ${use[0]?.toUpperCase()}${use.slice(1)}.`, tone: 'success' };
    case 'HIGHER':
      return { text: `${head} · you chose higher`, tone: 'muted' };
    case 'LOWER':
      return { text: `${head} · you chose lower`, tone: 'muted' };
    default:
      return { text: `${head} · ${use}`, tone: 'muted' };
  }
}

const EFFECT_PHRASE: Record<ChangeEffectKind, string> = {
  STAYS_LOW: 'Still Low',
  STAYS_OUT: 'Still Out',
  STAYS_OK: 'Still OK',
  BECOMES_LOW: 'Becomes Low',
  BECOMES_OUT: 'Becomes Out',
  BECOMES_OK: 'Becomes OK',
  LEVEL_SET: 'Level set',
  LEVEL_CLEARED: 'Level cleared',
};

/** "Still Low · 9 kg on hand" under a changed item on the review sheet. */
export function reviewSubline(kind: ChangeEffectKind, onHand: string, unit: string): string {
  return `${EFFECT_PHRASE[kind]} · ${formatNumber(onHand)} ${unit} on hand`;
}

/** "2 changes", "1 change". */
export const changeCountLabel = (n: number): string => `${n} ${n === 1 ? 'change' : 'changes'}`;
