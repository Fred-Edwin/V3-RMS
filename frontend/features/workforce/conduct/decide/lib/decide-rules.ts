import type { KeyValueRow } from '../../../_shared';
import { dayMonthYear } from '../../_shared/lib/conduct-dates';
import { DECISION_REASON_MAX, DECISION_REASON_MIN, LEVEL_LABELS, OUTCOME_COPY, plural } from '../../_shared/lib/conduct-words';
import type { DecisionOutcome, DecisionPreview, DeskDetail } from '../../_shared/types/conduct-types';

/**
 * The rules of the decision dialog (spec S13), pure. Which outcomes show comes from the server (`actions.outcomes`, already without Keep
 * when there is no appeal); this file words them, says why the brown button waits, and turns the server's preview into the key-value rows.
 */
export const decisionReasonLength = (text: string): number => text.replace(/\s+/g, ' ').trim().length;

export function titleFor(detail: DeskDetail, mode: 'decide' | 'change'): string {
  return mode === 'change' ? `Change ${detail.personName}'s notice` : `Decide ${detail.personName}'s appeal`;
}

export const outcomeOptions = (outcomes: readonly DecisionOutcome[]) => outcomes.map((o) => ({ value: o, title: OUTCOME_COPY[o].title, description: OUTCOME_COPY[o].line }));

export interface DecideInputs {
  outcome: DecisionOutcome | null;
  reason: string;
  pin: string;
  online: boolean;
  hasPin: boolean | null;
}

export function decideBlock(i: DecideInputs): string | null {
  if (!i.outcome) return 'Choose an outcome.';
  if (decisionReasonLength(i.reason) < DECISION_REASON_MIN) return `Say why (at least ${DECISION_REASON_MIN} characters).`;
  if (decisionReasonLength(i.reason) > DECISION_REASON_MAX) return `Keep it to ${DECISION_REASON_MAX} characters.`;
  if (i.hasPin === false) return 'Set your PIN first.';
  if (i.pin.length < 4) return 'Enter your PIN.';
  if (!i.online) return 'No signal. The decision was not made. Try again when you are back online.';
  return null;
}

const lower = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** The three rows under the options, from the server's preview (the dialog never works out dates itself). */
export function previewRows(detail: DeskDetail, preview: DecisionPreview): KeyValueRow[] {
  const taken = preview.daysTaken === null ? '' : ` · ${plural(preview.daysTaken, 'day')} to decide`;
  const record =
    preview.outcome === 'KEEP'
      ? `Kept${taken}`
      : preview.outcome === 'WITHDRAW'
        ? `${LEVEL_LABELS[preview.from]} withdrawn${taken}`
        : `${LEVEL_LABELS[preview.from]} to ${lower(LEVEL_LABELS[preview.to ?? 'VERBAL_NOTE'])}${taken}`;
  const ends: KeyValueRow = preview.endsOn === null ? { label: 'Ends by itself on', value: 'Does not count', mono: true } : { label: 'Ends by itself on', value: dayMonthYear(preview.endsOn), mono: true };
  const oldWord = preview.oldNotice === 'REPLACED' ? 'Marked as replaced, kept on the file' : preview.oldNotice === 'WITHDRAWN' ? 'Marked as withdrawn, kept on the file' : 'Stays exactly as it is';
  return [{ label: 'The record', value: record }, ends, { label: detail.number ?? 'The notice', value: oldWord }];
}

/** The small print: roles, not names. */
export const decidePrint = (mode: 'decide' | 'change'): string =>
  mode === 'change'
    ? 'The staff member and the issuer are told. Recorded in the audit log with your name, the reason and the time. The change is final.'
    : 'The staff member and the issuer are told. Recorded in the audit log with your name, the reason and the time. The decision is final.';

export const doneLine = 'Decided. The staff member and the issuer have been told.';
