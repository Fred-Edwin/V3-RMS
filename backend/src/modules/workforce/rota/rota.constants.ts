/** The kit's shift palette: a template stores one of these keys, the screen maps it to the pale fill and the ink. */
export const SHIFT_COLOURS = ['BLUE', 'GREEN', 'AMBER', 'VIOLET', 'ROSE', 'GREY'] as const;
export type ShiftColour = (typeof SHIFT_COLOURS)[number];

/**
 * Notifications about changed shifts wait for this long without a further change to the same person, then go out once
 * (owner decision, 18 Oct 2026). The rules store has no field for it, so it is a constant (decision R6).
 */
export const CHANGE_QUIET_MS = 5 * 60 * 1000;

/** A change to a shift today or tomorrow needs a short reason (owner decision, 18 Oct 2026). */
export const REASON_DAYS_AHEAD = 1;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 200;

export const MAX_SHIFTS_PER_DAY = 3;
/** The rota can be planned this many weeks ahead and read this many weeks back. */
export const MAX_WEEKS_AHEAD = 26;
export const MAX_WEEKS_BACK = 104;

/** More cells than this in one request are summarised in the audit entry instead of listed. */
export const AUDIT_CELL_LIST_LIMIT = 100;
