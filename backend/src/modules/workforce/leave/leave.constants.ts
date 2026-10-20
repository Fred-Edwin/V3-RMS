/** Leave constants (Segment 4). The 72 hours is a code constant, not a Rules setting (L20). */
export const ESCALATION_HOURS = 72;
export const ESCALATION_MS = ESCALATION_HOURS * 60 * 60 * 1000;

/** HR adjusts by whole days within this range (L26). */
export const ADJUST_MIN = -60;
export const ADJUST_MAX = 60;

/** The longest single request. A year is the hard edge anyway (a request never crosses 31 December). */
export const MAX_REQUEST_DAYS = 366;

/** Longest free-text note, kept short on purpose: it is a line, not a letter. */
export const NOTE_MAX = 300;

export const DECLINE_REASONS = ['TOO_FEW', 'BUSY', 'NOTICE', 'OTHER'] as const;
export const CANCEL_REASONS = ['STAFFING', 'PERSON_ASKED', 'MISTAKE', 'OTHER'] as const;
export const ADJUST_REASONS = ['DIRECTOR_GRANT', 'CORRECTION', 'RETURNED_EARLY', 'BIRTH_OR_ADOPTION', 'OTHER'] as const;

export type DeclineReason = (typeof DECLINE_REASONS)[number];
export type CancelReason = (typeof CANCEL_REASONS)[number];
export type AdjustReason = (typeof ADJUST_REASONS)[number];

/** The roles that can be a routed decider. */
export const DECIDER_ROLES = ['MANAGER', 'STORE_MANAGER', 'HR_MANAGER', 'DIRECTOR'] as const;
export type DeciderRole = (typeof DECIDER_ROLES)[number];

/** Whole-year bar colours, fixed in code (spec section 3). */
export const TONE_AMBER_BELOW = 0.5;
export const TONE_RED_BELOW = 0.25;

/** Rows a list may return at most, whatever the client asks for. */
export const MAX_PAGE_ROWS = 100;
export const DEFAULT_PAGE_ROWS = 25;

/** "Coming up" on Home looks this far ahead (spec section 6). */
export const COMING_UP_DAYS = 14;

/** The hourly escalation job takes at most this many requests per run, so one run is always short. */
export const ESCALATION_BATCH = 200;
