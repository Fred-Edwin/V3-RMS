import { LEVEL_ORDER, type ConductLevel } from './conduct-model';

/** What the ladder needs to know about a notice already on the file: only active, not replaced or withdrawn ones are passed in. */
export interface LadderNotice {
  level: ConductLevel;
}

export interface LadderAdvice {
  /** The level the screen pre-selects; null when a final warning is already on file. */
  suggested: ConductLevel | null;
  /** Whether Final written warning may be chosen: it needs an active written warning and no final already on file (C7). */
  finalAllowed: boolean;
  finalAlreadyActive: boolean;
}

const has = (notices: readonly LadderNotice[], level: ConductLevel): boolean => notices.some((n) => n.level === level);

/** The ladder (C7): no active notice → verbal; verbal → written; written → final; final → speak to HR. Legacy rows never count. */
export function suggestLevel(active: readonly LadderNotice[]): LadderAdvice {
  const finalAlreadyActive = has(active, 'FINAL_WRITTEN_WARNING');
  const finalAllowed = !finalAlreadyActive && has(active, 'WRITTEN_WARNING');
  if (finalAlreadyActive) return { suggested: null, finalAllowed: false, finalAlreadyActive };
  if (has(active, 'WRITTEN_WARNING')) return { suggested: 'FINAL_WRITTEN_WARNING', finalAllowed, finalAlreadyActive };
  if (has(active, 'VERBAL_NOTE')) return { suggested: 'WRITTEN_WARNING', finalAllowed, finalAlreadyActive };
  return { suggested: 'VERBAL_NOTE', finalAllowed, finalAlreadyActive };
}

/** The levels a notice can be reduced to: from Written, Verbal; from Final, Written or Verbal. */
export const reduceTargets = (level: ConductLevel): ConductLevel[] => LEVEL_ORDER.filter((l) => LEVEL_ORDER.indexOf(l) < LEVEL_ORDER.indexOf(level));
