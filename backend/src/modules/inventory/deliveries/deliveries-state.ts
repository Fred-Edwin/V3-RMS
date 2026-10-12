import { Prisma } from '@prisma/client';
import type { LineCountState } from './_shared/deliveries-contract';

/**
 * The branch count as pure functions (docs/features/inventory/dispatch-contract.md §5, Amendment 1 row 5), table-tested in
 * `deliveries-state.test.ts`. Nothing here reads the database or the clock.
 *
 * A line carries `countedQty` (what was typed, saved as a draft) and `checkCount`:
 *   0  not checked yet                 (NOT_COUNTED without a number, COUNTED with one)
 *   1  checked once and it differs     (COUNT_AGAIN: the person counts again; the box keeps the number)
 *   2  final: it matched at a check, or it differed twice (SHORT or EXTRA)
 * A matching line becomes final at once, so a guess cannot be changed and tried again. Two checks at most decide a line.
 */

export interface CountFacts {
  sentQty: Prisma.Decimal;
  countedQty: Prisma.Decimal | null;
  checkCount: number;
}

export const FINAL_CHECKS = 2;

export const differs = (f: Pick<CountFacts, 'sentQty' | 'countedQty'>): boolean => f.countedQty !== null && !f.countedQty.equals(f.sentQty);

export const isFinal = (f: CountFacts): boolean => f.checkCount >= FINAL_CHECKS;

/** Counted fewer than sent is SHORT, more is EXTRA; null when it matches or has no number. */
export const directionOf = (f: Pick<CountFacts, 'sentQty' | 'countedQty'>): 'SHORT' | 'EXTRA' | null => {
  if (!differs(f) || f.countedQty === null) return null;
  return f.countedQty.lessThan(f.sentQty) ? 'SHORT' : 'EXTRA';
};

/** What the screen shows for a line. SHORT and EXTRA appear only once the second check has made the difference final. */
export const lineStateOf = (f: CountFacts): LineCountState => {
  if (f.countedQty === null) return 'NOT_COUNTED';
  if (f.checkCount === 0 || !differs(f)) return 'COUNTED';
  if (f.checkCount === 1) return 'COUNT_AGAIN';
  return directionOf(f) ?? 'COUNTED';
};

/** The direction is told to the screen only after a check has flagged the line (Paper D10): never before, never the size. */
export const visibleDirectionOf = (f: CountFacts): 'SHORT' | 'EXTRA' | null => (f.checkCount >= 1 ? directionOf(f) : null);

/** A line whose difference is final: the second count is final, so it can no longer be saved over. */
export const isLockedLine = (f: CountFacts): boolean => isFinal(f);

/** The result of running a check on one line: its new `checkCount` and whether this check made it count as "counted twice". */
export const checkLine = (f: CountFacts): { checkCount: number; countedTwice: boolean } => {
  if (f.countedQty === null || isFinal(f)) return { checkCount: f.checkCount, countedTwice: false };
  if (!differs(f)) return { checkCount: FINAL_CHECKS, countedTwice: f.checkCount >= 1 };
  return f.checkCount === 0 ? { checkCount: 1, countedTwice: false } : { checkCount: FINAL_CHECKS, countedTwice: true };
};

export interface ReasonFacts extends CountFacts {
  hasReason: boolean;
}

/** Why a delivery cannot be confirmed yet, in the order the screen cares about; null when nothing stops it. */
export const confirmBlockerOf = (lines: ReadonlyArray<ReasonFacts>): 'NOT_COUNTED' | 'COUNT_AGAIN_PENDING' | 'REASON_REQUIRED' | null => {
  if (lines.some((l) => l.countedQty === null)) return 'NOT_COUNTED';
  if (lines.some((l) => !isFinal(l))) return 'COUNT_AGAIN_PENDING';
  if (lines.some((l) => differs(l) && !l.hasReason)) return 'REASON_REQUIRED';
  return null;
};

/** "Check and sign" can be pressed once every line has a number (0 is a number; an empty box is not). */
export const canCheck = (lines: ReadonlyArray<Pick<CountFacts, 'countedQty'>>): boolean => lines.length > 0 && lines.every((l) => l.countedQty !== null);

/** The Branch Manager signs for a department they do not belong to; a member or head signs for their own. */
export const isOnBehalf = (actor: { role: string; departmentId: string | null }, dispatchDepartmentId: string): boolean =>
  actor.role === 'MANAGER' && actor.departmentId !== dispatchDepartmentId;

/** The result chip of the history list (G2): MATCHED, GAP_OPEN (any gap still held) or GAP_RESOLVED (every gap has a finding). */
export const deliveryResultOf = (discrepancies: ReadonlyArray<{ status: 'OPEN' | 'RECORDED' | 'REVERSED' }>): 'MATCHED' | 'GAP_OPEN' | 'GAP_RESOLVED' => {
  if (discrepancies.length === 0) return 'MATCHED';
  return discrepancies.some((d) => d.status !== 'RECORDED') ? 'GAP_OPEN' : 'GAP_RESOLVED';
};

/** gap = counted − sent, signed. */
export const gapOf = (f: { sentQty: Prisma.Decimal; countedQty: Prisma.Decimal }): Prisma.Decimal => f.countedQty.minus(f.sentQty);
