import type { RestockLevelRow, RestockStatus } from '../types';

/**
 * What a restock level change does, and how a suggestion reads next to the level.
 * Pure: the page and its tests share it. Levels are decimal strings on the wire;
 * the helpers here take numbers and only the edge functions parse.
 */

/** The backend's fixed days of cover (§29.5). Per-item cover is not modelled yet. */
export const SUGGESTION_COVER_DAYS = 15;

/** A suggestion differs when it is more than this far from the level (§29.5). */
export const SUGGESTION_DIFFER_RATIO = 0.2;

/** Same rule as the backend (§29.2). */
export function statusFor(onHand: number, level: number | null): RestockStatus {
  if (level === null) return 'NO_LEVEL';
  if (onHand <= 0) return 'OUT';
  if (onHand < level) return 'LOW';
  return 'OK';
}

export type ChangeEffectKind = 'STAYS_LOW' | 'STAYS_OUT' | 'STAYS_OK' | 'BECOMES_LOW' | 'BECOMES_OUT' | 'BECOMES_OK' | 'LEVEL_SET' | 'LEVEL_CLEARED';

export type EffectTone = 'warning' | 'error' | 'success' | 'neutral';

export interface ChangeEffect {
  kind: ChangeEffectKind;
  label: string;
  /** A dot and a colour for the changes that move an item into or out of trouble; plain text otherwise. */
  tone: EffectTone;
}

const EFFECT_LABEL: Record<ChangeEffectKind, string> = {
  STAYS_LOW: 'Stays Low',
  STAYS_OUT: 'Stays Out',
  STAYS_OK: 'Stays OK',
  BECOMES_LOW: 'Becomes Low',
  BECOMES_OUT: 'Becomes Out',
  BECOMES_OK: 'Becomes OK',
  LEVEL_SET: 'Level set',
  LEVEL_CLEARED: 'Level cleared',
};

const EFFECT_TONE: Record<ChangeEffectKind, EffectTone> = {
  STAYS_LOW: 'neutral',
  STAYS_OUT: 'neutral',
  STAYS_OK: 'neutral',
  BECOMES_LOW: 'warning',
  BECOMES_OUT: 'error',
  BECOMES_OK: 'success',
  LEVEL_SET: 'neutral',
  LEVEL_CLEARED: 'neutral',
};

/** From the status now and the status the new level would give. */
export function changeEffect(before: RestockStatus, after: RestockStatus): ChangeEffect {
  let kind: ChangeEffectKind;
  if (after === 'NO_LEVEL') kind = 'LEVEL_CLEARED';
  else if (before === after) kind = after === 'LOW' ? 'STAYS_LOW' : after === 'OUT' ? 'STAYS_OUT' : 'STAYS_OK';
  else if (after === 'LOW') kind = 'BECOMES_LOW';
  else if (after === 'OUT') kind = 'BECOMES_OUT';
  else kind = before === 'NO_LEVEL' ? 'LEVEL_SET' : 'BECOMES_OK';
  return { kind, label: EFFECT_LABEL[kind], tone: EFFECT_TONE[kind] };
}

/** The effect of giving `row` the level `next` (null clears it), from its on-hand and saved status. */
export function effectOfLevel(row: Pick<RestockLevelRow, 'onHandQty' | 'status'>, next: number | null): ChangeEffect {
  return changeEffect(row.status, statusFor(Number.parseFloat(row.onHandQty), next));
}

// ─── Typing a level ─────────────────────────────────────────────────────────

const LEVEL_PATTERN = /^\d+(\.\d{1,4})?$/;

/** Strips thousands separators and spaces the way the price field does. */
export function normalizeLevelInput(raw: string): string {
  return raw.replace(/[,\s]/g, '');
}

export type ParsedLevel = { ok: true; level: number | null; text: string | null } | { ok: false; message: string };

/** Empty clears the level. Zero or more, up to four decimals. */
export function parseLevelInput(raw: string): ParsedLevel {
  const text = normalizeLevelInput(raw);
  if (text === '') return { ok: true, level: null, text: null };
  if (!LEVEL_PATTERN.test(text)) return { ok: false, message: 'Enter an amount like 150 or 12.5.' };
  return { ok: true, level: Number.parseFloat(text), text };
}

export const levelNumber = (level: string | null): number | null => (level === null ? null : Number.parseFloat(level));

export const sameLevel = (a: number | null, b: number | null): boolean => a === b;

// ─── Suggestions ────────────────────────────────────────────────────────────

/** More than 20 % apart; a level of 0 differs whenever there is a suggestion above 0 (§29.5). */
export function suggestionDiffers(level: number | null, suggested: number | null): boolean {
  if (level === null || suggested === null) return false;
  if (level === 0) return suggested > 0;
  return Math.abs(suggested - level) > SUGGESTION_DIFFER_RATIO * level;
}

export type SuggestionVerdict = 'APPLIED' | 'MATCHES' | 'CLOSE' | 'HIGHER' | 'LOWER';

export const SUGGESTION_VERDICT_LABEL: Record<SuggestionVerdict, string> = {
  APPLIED: 'applied',
  MATCHES: 'matches',
  CLOSE: 'close',
  HIGHER: 'you chose higher',
  LOWER: 'you chose lower',
};

/**
 * How the level shown in the row reads against the suggestion. `saved` is the level on file,
 * `typed` the one in the field (the same when nothing was changed). Null when there is no level to compare.
 */
export function suggestionVerdict(saved: number | null, typed: number | null, suggested: number): SuggestionVerdict | null {
  if (typed === null) return null;
  if (typed === suggested) return typed === saved ? 'MATCHES' : 'APPLIED';
  if (!suggestionDiffers(typed, suggested)) return 'CLOSE';
  return typed > suggested ? 'HIGHER' : 'LOWER';
}

/** The "12 kg a day" part: the suggestion divided back by the fixed cover. Up to two decimals. */
export function suggestedPerDay(suggested: number): number {
  return Math.round((suggested / SUGGESTION_COVER_DAYS) * 100) / 100;
}

// ─── The list ───────────────────────────────────────────────────────────────

export type RestockTab = 'LOW_OUT_FIRST' | 'ALL' | 'NO_LEVEL';

const ATTENTION_RANK: Record<RestockStatus, number> = { OUT: 0, LOW: 1, OK: 2, NO_LEVEL: 3 };

/** Out, then Low, then the rest; by name within each group. */
export function sortLowAndOutFirst<T extends Pick<RestockLevelRow, 'status' | 'itemName'>>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => ATTENTION_RANK[a.status] - ATTENTION_RANK[b.status] || a.itemName.localeCompare(b.itemName));
}

/** "Low and Out first" lists items that have a level (Out, Low, then OK); "All" lists everything by name; "No level set" the rest. */
export function rowsForTab<T extends Pick<RestockLevelRow, 'status' | 'itemName'>>(rows: readonly T[], tab: RestockTab): T[] {
  switch (tab) {
    case 'LOW_OUT_FIRST':
      return sortLowAndOutFirst(rows.filter((r) => r.status !== 'NO_LEVEL'));
    case 'NO_LEVEL':
      return rows.filter((r) => r.status === 'NO_LEVEL');
    case 'ALL':
      return [...rows].sort((a, b) => a.itemName.localeCompare(b.itemName));
  }
}

/** The strip's cells filter the rows below; "differ" needs the suggestion, so it is a row test too. */
export type StripFilter = 'OUT' | 'LOW' | 'NO_LEVEL' | 'DIFFER';

export function matchesStripFilter(row: RestockLevelRow, filter: StripFilter): boolean {
  switch (filter) {
    case 'OUT':
      return row.status === 'OUT';
    case 'LOW':
      return row.status === 'LOW';
    case 'NO_LEVEL':
      return row.status === 'NO_LEVEL';
    case 'DIFFER':
      return suggestionDiffers(levelNumber(row.level), levelNumber(row.suggestedLevel));
  }
}
