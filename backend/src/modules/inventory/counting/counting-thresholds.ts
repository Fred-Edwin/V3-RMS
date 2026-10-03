/**
 * Counting thresholds — defaults (Milestone Six, plan §1.9). These are the
 * fallback when an organization has no `CountingThresholds` row yet; a row is
 * created lazily on first save. Values are whole KES of |variance| × unit cost.
 */
export const COUNTING_THRESHOLD_DEFAULTS = {
  /** Central Store — reason required on accept / spot count. */
  hubReasonRequiredKes: 500,
  /** Branch — set by that branch's Branch Manager (Session 3). */
  branchReasonRequiredKes: 1000,
  branchOvernightAlertKes: 500,
  /** Company-wide, hub row only; set by the Director. */
  directorAlertKes: 5000,
} as const;

export const THRESHOLD_MIN_KES = 0;
export const THRESHOLD_MAX_KES = 1_000_000;
