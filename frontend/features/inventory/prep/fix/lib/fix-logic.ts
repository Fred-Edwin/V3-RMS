/**
 * Pure rules for Fix a slip: reason labels, the before/after rows on the "Check the correction" sheet, whether anything changed,
 * and how a server error reads. No React here, so it is table-tested (`fix-logic.test.ts`).
 */
import { ApiError } from '@/types/api';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { formatQuantity, isPositive } from '../../_shared/lib/prep-format';
import type { CancelReason, CorrectReason, RunDetail } from '../../_shared/types/prep-contract';

export const CORRECT_REASONS: readonly { value: CorrectReason; label: string }[] = [
  { value: 'TYPO', label: 'Typo' },
  { value: 'WRONG_ITEM', label: 'Wrong item' },
  { value: 'WRONG_QUANTITY', label: 'Wrong quantity' },
  { value: 'OTHER', label: 'Other' },
];

export const CANCEL_REASONS: readonly { value: CancelReason; label: string }[] = [
  { value: 'ENTERED_TWICE', label: 'Entered twice' },
  { value: 'NEVER_MADE', label: 'Never made' },
  { value: 'WRONG_ITEM', label: 'Wrong item' },
  { value: 'OTHER', label: 'Other' },
];

/** "Wrong quantity" from the code the server stores; an unknown code reads as itself, never blank. */
export const reasonLabel = (value: string): string => [...CORRECT_REASONS, ...CANCEL_REASONS].find((r) => r.value === value)?.label ?? value;

/** One ingredient line of the form: what it is now, and what the recorded run had (null for a line added now). */
export interface FixLine {
  itemId: string;
  name: string;
  unit: string;
  quantity: string;
  was: string | null;
}

export const linesFromRun = (run: RunDetail): FixLine[] =>
  run.inputs.map((l) => ({ itemId: l.itemId, name: l.itemName, unit: l.unit, quantity: l.quantity, was: l.quantity }));

const same = (a: string, b: string): boolean => Number(a) === Number(b);

/** True when the form differs from the recorded run: an amount, the made figure, a line added, or a line taken out (amount 0). */
export const hasChanges = (run: RunDetail, lines: readonly FixLine[], made: string): boolean => {
  if (!same(run.made, made)) return true;
  return lines.some((l) => (l.was === null ? isPositive(l.quantity) : !same(l.was, isPositive(l.quantity) ? l.quantity : '0')));
};

export interface CheckRow {
  label: string;
  /** "10 kg → 9 kg", "1 kg · no change", "Added 2 kg", "10 kg → not used". */
  value: string;
  changed: boolean;
}

/** The rows of "Check the correction" (Paper step 15): every ingredient, the made figure, in the order the form shows them. */
export const checkRows = (run: RunDetail, lines: readonly FixLine[], made: string): CheckRow[] => {
  const rows: CheckRow[] = [];
  for (const line of lines) {
    const now = isPositive(line.quantity) ? line.quantity : null;
    if (line.was === null) {
      if (now !== null) rows.push({ label: line.name, value: `Added ${formatQuantity(now)} ${line.unit}`, changed: true });
      continue;
    }
    const was = `${formatQuantity(line.was)} ${line.unit}`;
    if (now === null) rows.push({ label: line.name, value: `${was} → not used`, changed: true });
    else if (same(line.was, now)) rows.push({ label: line.name, value: `${was} · no change`, changed: false });
    else rows.push({ label: line.name, value: `${was} → ${formatQuantity(now)} ${line.unit}`, changed: true });
  }
  const wasMade = `${formatQuantity(run.made)} ${run.unit}`;
  rows.push(
    same(run.made, made)
      ? { label: run.outputName, value: `${wasMade} · no change`, changed: false }
      : { label: run.outputName, value: `${wasMade} → ${formatQuantity(made)} ${run.unit}`, changed: true },
  );
  return rows;
};

/** The "put back" and "removed" lines of the cancel preview (Paper steps 16 and 18). Inputs come back; the output goes out. */
export const cancelEffectRows = (run: RunDetail): { label: string; value: string; tone: 'back' | 'out' }[] => [
  ...run.inputs.map((l) => ({ label: l.itemName, value: `${formatQuantity(l.quantity)} ${l.unit} put back`, tone: 'back' as const })),
  { label: run.outputName, value: `${formatQuantity(run.made)} ${run.unit} removed`, tone: 'out' as const },
];

export interface FixFailure {
  message: string;
  /** The run can no longer be fixed by this person (24 hours passed, or not theirs): the screen switches to the locked state. */
  locked: boolean;
  /** Someone already corrected or cancelled it: the screen offers a reload. */
  notOpen: boolean;
}

/**
 * A server error as a person reads it, never a raw code. Offline, a 5xx and anything unknown fall back to `fallback`; the form keeps
 * what the person entered in every case.
 */
export const fixFailure = (err: unknown, fallback: string): FixFailure => {
  if (err instanceof ApiError) {
    if (err.code === 'PREP_RUN_LOCKED') return { message: PREP_STATES_COPY.locked.description, locked: true, notOpen: false };
    if (err.code === 'RUN_NOT_OPEN') return { message: PREP_STATES_COPY.fix.notOpen, locked: false, notOpen: true };
    if (err.statusCode === 401) return { message: 'Your session ended. Sign in again, then try again.', locked: false, notOpen: false };
    if (err.statusCode === 403) return { message: 'You do not have permission to change this run.', locked: false, notOpen: false };
    if (err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
      switch (err.code) {
        case 'QUANTITY_NOT_POSITIVE':
          return { message: 'Every amount must be more than zero.', locked: false, notOpen: false };
        case 'INPUT_IS_OUTPUT':
          return { message: 'An item cannot be an ingredient of itself.', locked: false, notOpen: false };
        case 'DUPLICATE_INPUT_LINE':
          return { message: 'Each ingredient can appear only once.', locked: false, notOpen: false };
        default:
          if (err.message && err.statusCode !== 404) return { message: err.message, locked: false, notOpen: false };
      }
    }
  }
  return { message: fallback, locked: false, notOpen: false };
};
