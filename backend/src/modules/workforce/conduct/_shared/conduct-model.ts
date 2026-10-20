import type { ConductAbout, ConductLevel, ConductStatus } from '@prisma/client';

export type { ConductAbout, ConductLevel, ConductStatus };

/** HR has this many days to decide an appeal; on the next day the Director is told (C20). A constant: the Rules tab has no row for it. */
export const HR_DECISION_DAYS = 7;

/** The own line the manager writes into the letter (C6). */
export const OWN_LINE_MIN = 20;
export const OWN_LINE_MAX = 300;
/** The reason an appeal or a decision gives. */
export const APPEAL_TEXT_MIN = 10;
export const APPEAL_TEXT_MAX = 1000;
export const DECISION_REASON_MIN = 10;
export const DECISION_REASON_MAX = 1000;

/** A witness who has not answered in this many days leaves the notice valid and shows "Witness not confirmed" (C13). */
export const WITNESS_WAIT_DAYS = 3;

/** The levels in ladder order (low to high). */
export const LEVEL_ORDER: readonly ConductLevel[] = ['VERBAL_NOTE', 'WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING'];

/** Only written and final warnings are letters with a number. A verbal note is a record line (C23). */
export const hasLetter = (level: ConductLevel): boolean => level !== 'VERBAL_NOTE';

export const LEVEL_LABELS: Record<ConductLevel, string> = {
  VERBAL_NOTE: 'Verbal note',
  WRITTEN_WARNING: 'Written warning',
  FINAL_WRITTEN_WARNING: 'Final written warning',
};

export const ABOUT_LABELS: Record<ConductAbout, string> = {
  LATENESS: 'Lateness',
  ABSENCE: 'Absence',
  BEHAVIOUR: 'Behaviour',
  SAFETY_HYGIENE: 'Safety or hygiene',
  OTHER: 'Other',
};

/** Lateness and Absence carry facts from the timesheets; the others carry the manager's own line only (C5). */
export const hasTimesheetFacts = (about: ConductAbout): boolean => about === 'LATENESS' || about === 'ABSENCE';

export type NotSignedReason = 'REFUSED' | 'NOT_REACHED' | 'NO_LOGIN';
export type DecisionOutcome = 'KEEP' | 'REDUCE_TO_WRITTEN' | 'REDUCE_TO_VERBAL' | 'WITHDRAW';

/** What the notice says after the person sees it: the number shown on screens, "WRN-0007" (null for a verbal note). */
export const noticeNumberLabel = (number: number | null): string | null => (number === null ? null : `WRN-${String(number).padStart(4, '0')}`);

/** The four reasons the staff member can tick on an appeal, per category (S6). */
export const APPEAL_REASON_KEYS = ['FACTS_WRONG', 'GOOD_REASON', 'TOO_STRONG', 'OTHER'] as const;
export type AppealReasonKey = (typeof APPEAL_REASON_KEYS)[number];

export const appealReasonLabel = (key: AppealReasonKey, about: ConductAbout): string => {
  if (key === 'FACTS_WRONG') return about === 'LATENESS' ? 'Some of the dates are wrong' : 'Some of the facts are wrong';
  if (key === 'GOOD_REASON') return about === 'LATENESS' ? 'I had a good reason for being late' : 'I had a good reason';
  if (key === 'TOO_STRONG') return 'The warning is too strong';
  return 'Something else';
};
