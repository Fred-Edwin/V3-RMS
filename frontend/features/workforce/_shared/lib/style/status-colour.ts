/**
 * Status colour rules (owner, 5 Oct 2026; Interaction spec rule 04), as pure
 * functions so the thresholds are tested once and no screen re-decides them.
 *
 * Completeness ring: red under 50, amber 50 to 84, green 85 to 99, solid green
 * with a tick at 100.
 * Probation bar: green with more than 30 days left, amber at 30 or fewer, red
 * at 7 or fewer.
 */
export type StatusColour = 'red' | 'amber' | 'green';

/** Clamp to a whole percent 0 to 100 (a bad number never draws a broken ring). */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function completenessColour(percent: number): StatusColour {
  const p = clampPercent(percent);
  if (p < 50) return 'red';
  if (p < 85) return 'amber';
  return 'green';
}

/** At 100 the ring is solid green and shows a tick instead of the number. */
export function isComplete(percent: number): boolean {
  return clampPercent(percent) === 100;
}

export function probationColour(daysLeft: number): StatusColour {
  if (daysLeft <= 7) return 'red';
  if (daysLeft <= 30) return 'amber';
  return 'green';
}

/** Share of the probation period used, 0 to 100, for the bar fill. */
export function probationProgress(dayNumber: number, totalDays: number): number {
  if (!Number.isFinite(dayNumber) || !Number.isFinite(totalDays) || totalDays <= 0) return 0;
  return clampPercent((dayNumber / totalDays) * 100);
}

/** CSS colour (design-token variables) for each status colour. */
export const STATUS_STROKE: Record<StatusColour, string> = {
  red: 'var(--wds-error-fg)',
  // Paper draws the amber stroke #E0A020, which has no token; caramel-500 is the nearest. See README.
  amber: 'var(--wds-caramel-500)',
  green: 'var(--wds-success-fg)',
};

export const STATUS_TEXT_CLASS: Record<StatusColour, string> = {
  red: 'text-wds-error-fg',
  amber: 'text-wds-warning-fg',
  green: 'text-wds-success-fg',
};

export const STATUS_FILL_CLASS: Record<StatusColour, string> = {
  red: 'bg-wds-error-fg',
  amber: 'bg-wds-caramel-500',
  green: 'bg-wds-success-fg',
};
