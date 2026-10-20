import { ApiError } from '@/types/api';

import type { AppealReasonKey, ConductAbout, ConductLevel, ConductStatus, DecisionOutcome, NotSignedReason } from '../types/conduct-types';

/**
 * Words and small rules of Conduct that more than one screen needs. Pure, so the tests can pin them. The letters themselves are
 * rendered by the server; nothing here states what a letter says, and no wording here is final (the lawyer replaces the letters).
 */
export const LEVEL_LABELS: Record<ConductLevel, string> = {
  VERBAL_NOTE: 'Verbal note',
  WRITTEN_WARNING: 'Written warning',
  FINAL_WRITTEN_WARNING: 'Final written warning',
};

export const ABOUT_OPTIONS: ReadonlyArray<{ value: ConductAbout; label: string }> = [
  { value: 'LATENESS', label: 'Lateness' },
  { value: 'ABSENCE', label: 'Absence' },
  { value: 'BEHAVIOUR', label: 'Behaviour' },
  { value: 'SAFETY_HYGIENE', label: 'Safety or hygiene' },
  { value: 'OTHER', label: 'Other' },
];

export const hasTimesheetFacts = (about: ConductAbout): boolean => about === 'LATENESS' || about === 'ABSENCE';

/** Lateness and Absence carry facts; the others do not (spec C5). */
export const OWN_LINE_MIN = 20;
export const OWN_LINE_MAX = 300;
export const APPEAL_TEXT_MIN = 10;
export const APPEAL_TEXT_MAX = 1000;
export const DECISION_REASON_MIN = 10;
export const DECISION_REASON_MAX = 1000;

/** The four appeal chips; the first two read differently for lateness (spec S6). */
export function appealChips(about: ConductAbout | string): ReadonlyArray<{ value: AppealReasonKey; label: string }> {
  const lateness = about === 'Lateness' || about === 'LATENESS';
  return [
    { value: 'FACTS_WRONG', label: lateness ? 'Some of the dates are wrong' : 'Some of the facts are wrong' },
    { value: 'GOOD_REASON', label: lateness ? 'I had a good reason for being late' : 'I had a good reason' },
    { value: 'TOO_STRONG', label: 'The warning is too strong' },
    { value: 'OTHER', label: 'Something else' },
  ];
}

export const plural = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** What a decision does, in the words of the option rows (spec S13). */
export const OUTCOME_COPY: Record<DecisionOutcome, { title: string; line: string; button: string }> = {
  KEEP: { title: 'Keep the warning', line: 'The notice stays exactly as it is.', button: 'Keep the warning' },
  REDUCE_TO_WRITTEN: { title: 'Reduce to a written warning', line: 'A new written warning replaces it, with its own number and no new appeal.', button: 'Reduce to a written warning' },
  REDUCE_TO_VERBAL: { title: 'Reduce to a verbal note', line: 'The letter is replaced by a note on the file, with no letter.', button: 'Reduce to a verbal note' },
  WITHDRAW: { title: 'Withdraw the warning', line: 'It no longer counts. It stays on the file, marked as withdrawn.', button: 'Withdraw the warning' },
};

/** "decided: now a verbal note" style phrase for the Inbox and the staff list. */
export const OUTCOME_PHRASE: Record<DecisionOutcome, string> = {
  KEEP: 'the notice stands',
  REDUCE_TO_WRITTEN: 'now a written warning',
  REDUCE_TO_VERBAL: 'now a verbal note',
  WITHDRAW: 'the notice is withdrawn',
};

export const NOT_SIGNED_CHIPS: ReadonlyArray<{ value: Exclude<NotSignedReason, 'NO_LOGIN'>; label: string }> = [
  { value: 'REFUSED', label: 'I gave them the letter, they refused to sign' },
  { value: 'NOT_REACHED', label: 'I could not reach them' },
];

export const NOT_SIGNED_WORDS: Record<NotSignedReason, string> = { REFUSED: 'refused to sign', NOT_REACHED: 'could not be reached', NO_LOGIN: 'has no login' };

/** Status words and tones. Staff see "To sign" where the desk sees "Issued" (the server sends the word; the tone is chosen here). */
export type WordTone = 'default' | 'success' | 'warning' | 'muted';

export function staffTone(status: ConductStatus, waiting: boolean): WordTone {
  if (waiting) return 'warning';
  if (status === 'SIGNED' || status === 'RECORDED' || status === 'KEPT') return 'success';
  if (status === 'APPEALED') return 'default';
  if (status === 'ISSUED' || status === 'GIVEN_NOT_SIGNED') return 'warning';
  return 'muted';
}

export function deskTone(status: ConductStatus): WordTone {
  if (status === 'SIGNED' || status === 'KEPT') return 'success';
  if (status === 'ISSUED' || status === 'GIVEN_NOT_SIGNED') return 'warning';
  if (status === 'APPEALED') return 'default';
  return 'muted';
}

/** The help text under the "i" of a status tag: the status table of spec section 3 as words. */
export const STATUS_HELP: ReadonlyArray<{ word: string; means: string; next: string }> = [
  { word: 'Issued', means: 'Sent to the person. Nothing signed yet.', next: 'They sign, or it is recorded as given and not signed. The appeal days run either way.' },
  { word: 'Recorded', means: 'A verbal note on the file, with no letter.', next: 'It can be appealed, or ends by itself.' },
  { word: 'Signed', means: 'The person signed that they received it.', next: 'It can be appealed in the days left, or ends by itself.' },
  { word: 'Given, not signed', means: 'Given by hand, not signed, with a witness.', next: 'It stands. The person can still sign or appeal.' },
  { word: 'Appealed', means: 'With HR (the Director when HR issued the notice).', next: 'HR keeps, reduces or withdraws it. HR decides within 7 days; if HR does not, the Director is told.' },
  { word: 'Kept on appeal', means: 'HR decided it stands.', next: 'It ends by itself on its end date.' },
  { word: 'Replaced on appeal', means: 'HR reduced it; a new notice took its place.', next: 'It stays on the list, marked replaced.' },
  { word: 'Withdrawn', means: 'It no longer counts. It stays on the file with the reason.', next: 'Nothing more.' },
  { word: 'Ended', means: 'Its end date has passed.', next: 'It stays on the file, read only.' },
];

/** The words of a refusal, by the server's own code, in the spec's states. Anything unknown keeps the server's sentence. */
const ERROR_WORDS: Record<string, string> = {
  PIN_INVALID: 'That code is not right.',
  CODE_WRONG: 'That code is not right.',
  PIN_SLOWED: 'Too many tries. Wait a moment, then try again.',
  PIN_NOT_SET: 'Choose your code first.',
  ALREADY_APPEALED: 'You have already appealed this notice.',
  APPEAL_WINDOW_CLOSED: 'The days to appeal have ended. Speak to HR.',
  NOT_APPEALABLE: 'This notice can no longer be appealed.',
  NOT_SIGNABLE: 'This notice can no longer be signed.',
  INVALID_TRANSITION: 'This notice changed a moment ago. Open it again.',
  ALREADY_SIGNED: 'This notice was signed a moment ago.',
  ALREADY_RECORDED: 'This was already recorded.',
  ALREADY_DECIDED: 'This appeal was just decided by HR. Nothing was changed.',
  NOTHING_TO_DECIDE: 'There is nothing to decide on this notice.',
  FINAL_NEEDS_WRITTEN: 'A final written warning needs an active written warning on the file.',
  FINAL_ALREADY_ACTIVE: 'A final written warning is already on file. Speak to HR.',
  NO_FACTS: 'There are no unexcused days for that month. Choose another month or add your own line.',
  TOO_EARLY: 'This can be recorded after the days to sign have passed.',
  CONDUCT_NOT_ENABLED: 'This branch does not use the new Conduct yet.',
};

export function conductError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.statusCode === 0) return 'No signal. Nothing was sent. Try again when you are back online.';
    return ERROR_WORDS[err.code] ?? (err.message || fallback);
  }
  return fallback;
}

/** How long to wait, when the server paused a code (`403 PIN_INVALID` with a wait). */
export function waitSecondsOf(err: unknown): number {
  if (!(err instanceof ApiError)) return 0;
  const details = err.details;
  if (details && typeof details === 'object' && 'waitSeconds' in details) {
    const n = Number((details as { waitSeconds: unknown }).waitSeconds);
    return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 0;
  }
  return 0;
}

export const isRefusedCode = (err: unknown, ...codes: string[]): boolean => err instanceof ApiError && codes.includes(err.code);
