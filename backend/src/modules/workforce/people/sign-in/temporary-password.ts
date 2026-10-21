import { randomInt } from 'node:crypto';
import { SWAHILI_WORDS } from './swahili-words';

/** An unused temporary password stops being valid after this many days (finding 43). */
export const TEMPORARY_PASSWORD_DAYS = 7;

/** The words, each once, so two picks can never be the same word spelled twice in the list. */
export const WORD_LIST: readonly string[] = [...new Set(SWAHILI_WORDS)];

/**
 * "kahawa.nyota.4721": two DIFFERENT words from the list and four digits (1000 to 9999), joined by dots. Generated on the
 * server from the system's secure random source, shown once, never emailed, never written to a log or an audit entry.
 */
export function generateTemporaryPassword(pick: (max: number) => number = randomInt): string {
  const first = WORD_LIST[pick(WORD_LIST.length)] ?? WORD_LIST[0]!;
  let second = first;
  while (second === first) second = WORD_LIST[pick(WORD_LIST.length)] ?? WORD_LIST[1]!;
  return `${first}.${second}.${1000 + pick(9000)}`;
}
