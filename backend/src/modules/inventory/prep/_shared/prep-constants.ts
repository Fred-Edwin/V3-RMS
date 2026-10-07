/** Prep thresholds in one place (docs/features/inventory/prep-plan.md §5). Nothing else hard-codes these numbers. */

/** A yield within this share of the expected figure is "on target". */
export const ON_TARGET_RATIO = 0.15;
/** Beyond this share the run also sets the in-app notify flag (no push). */
export const NOTIFY_RATIO = 0.35;
/** Made more than this many times the expected figure, or under 1/this, looks like a typo (warns, never blocks). */
export const TYPO_FACTOR = 3;
/** Past-runs fallback: the last N RECORDED runs of the output, or those within the window, whichever gives fewer. */
export const PAST_RUNS_MAX = 10;
export const PAST_RUNS_WINDOW_DAYS = 30;
/** An Attendant may correct or cancel their own run for this long. */
export const FIX_WINDOW_HOURS = 24;
