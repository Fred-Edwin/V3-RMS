/**
 * A reason picked from a short list plus "Other" (Interaction spec rule 06: a
 * change to time, pay, leave or a rule asks for a reason). Pure, so the rule
 * "Other needs words" is tested once and every dialog behaves the same.
 */
export const OTHER_REASON = '__other__';

export interface ReasonValue {
  /** The chosen chip's key, `OTHER_REASON`, or null when nothing is chosen. */
  choice: string | null;
  /** Free text, used only when `choice` is `OTHER_REASON`. */
  otherText: string;
}

export const EMPTY_REASON: ReasonValue = { choice: null, otherText: '' };

/** Complete when a chip is chosen, and for "Other" when some words are written. */
export function isReasonComplete(value: ReasonValue): boolean {
  if (value.choice === null) return false;
  if (value.choice === OTHER_REASON) return value.otherText.trim().length > 0;
  return true;
}

/** The text to store with the change: the chip's label, or the written words. */
export function reasonText(value: ReasonValue, labels: Record<string, string>): string | null {
  if (!isReasonComplete(value)) return null;
  if (value.choice === OTHER_REASON) return value.otherText.trim();
  return value.choice === null ? null : (labels[value.choice] ?? value.choice);
}
