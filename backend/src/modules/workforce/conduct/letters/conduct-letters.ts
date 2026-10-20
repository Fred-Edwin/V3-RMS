/**
 * The letter wording: developer constants, one template per level (C4). PLACEHOLDER WORDING copied from the Paper design.
 * >>> THE CLIENT'S LAWYER MUST REPLACE THIS TEXT BEFORE THE FIRST REAL NOTICE AT NYERI TOWN (ship checklist, spec section 15). <<<
 * Nothing here states employment law as fact. To change a word: edit it here and bump LETTER_VERSION; notices already issued keep the
 * text they were made with (it is frozen in their snapshot). English only for now (C28).
 *
 * Blanks: {count} {monthYear} {datesLong} {minutes} {validUntilLong} {appealByLong} {appealDays} {aboutPhrase} {decidedAtLong} {ownLine}.
 * The first name and the dates are filled by letter-fill.ts; the own line is plain text, never markup.
 */
export const LETTER_VERSION = 'placeholder-2026-10-20';

export const LETTER_TEXT = {
  writtenIntro: 'This is a written warning.',
  finalIntro: 'This is a final written warning.',
  lateness: 'On {count} days in {monthYear} ({datesLong}) you arrived after the start of your shift, {minutes} minutes late in total. The timesheets are attached to this notice and none of these arrivals was excused.',
  absence: 'On {count} days in {monthYear} ({datesLong}) you were absent from your shift. The timesheets are attached to this notice and none of these absences was excused.',
  writtenOther: 'This is a written warning about {aboutPhrase}.',
  finalOther: 'This is a final written warning about {aboutPhrase}.',
  writtenFollow: 'If this does not improve, a final written warning may follow.',
  finalFollow: 'If this does not improve, HR will invite you to a hearing before any further step.',
  reduced: 'Reduced on appeal from a final written warning on {decidedAtLong}.',
  ending: 'This notice stays on your file until {validUntilLong} and then ends by itself. You may appeal in the app within {appealDays} days, by {appealByLong}, and HR will decide your appeal. Signing below shows that you received this letter. It does not mean you agree with it.',
  endingNoAppeal: 'This notice stays on your file until {validUntilLong} and then ends by itself. It was decided by HR on appeal and cannot be appealed again.',
  closing: 'Yours sincerely,',
  verbalLine: 'Verbal note recorded on {issuedAtLong} by {issuerRole}: {ownLine}',
} as const;

export const SUBJECTS: Record<'WRITTEN_WARNING' | 'FINAL_WRITTEN_WARNING', string> = {
  WRITTEN_WARNING: 'Written warning',
  FINAL_WRITTEN_WARNING: 'Final written warning',
};

/** The phrase the "other categories" paragraph uses: "This is about {aboutPhrase}." */
export const ABOUT_PHRASES = {
  LATENESS: 'lateness',
  ABSENCE: 'absence',
  BEHAVIOUR: 'your behaviour at work',
  SAFETY_HYGIENE: 'safety or hygiene at work',
  OTHER: 'a matter set out in this letter',
} as const;

/** The subject line: "Written warning: late arrival for work". */
export const SUBJECT_ABOUT = {
  LATENESS: 'late arrival for work',
  ABSENCE: 'absence from work',
  BEHAVIOUR: 'behaviour at work',
  SAFETY_HYGIENE: 'safety or hygiene',
  OTHER: 'conduct',
} as const;
