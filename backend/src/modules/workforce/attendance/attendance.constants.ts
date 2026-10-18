/** The chips Paper draws (Chapter 6). The codes are stored on the event; the screen owns the wording. */
export const EARLY_LEAVE_REASONS = ['SENT_HOME', 'UNWELL', 'EMERGENCY', 'OTHER'] as const;
export type EarlyLeaveReason = (typeof EARLY_LEAVE_REASONS)[number];

export const STAY_ON_REASONS = ['BUSY', 'COVERING', 'CLOSING', 'MANAGER_ASKED'] as const;
export type StayOnReason = (typeof STAY_ON_REASONS)[number];

/** "About 15, 30 or 60 minutes" (proposal 5.3). */
export const STAY_ON_ESTIMATES = [15, 30, 60] as const;

/** A tap kept on the phone with no signal is accepted this long after it was made; older than that goes to the manager. */
export const MAX_OFFLINE_DELAY_MINUTES = 12 * 60;

/** Reasons the system writes itself (never offered as a chip). */
export const SYSTEM_REASONS = { noAnswer: 'NO_ANSWER', forgot: 'FORGOT' } as const;

export const REASON_MAX_LENGTH = 300;

/** The nightly close-out of a clock-in that was never ended runs once Nairobi is past midnight and this many minutes. */
export const FORGOTTEN_CLOSE_AFTER_MIDNIGHT_MINUTES = 5;

/** How far back a sweep looks for open clock-ins, in Nairobi days. */
export const SWEEP_LOOKBACK_DAYS = 3;

export const ATTENDANCE_BASE = '/workforce/attendance';
