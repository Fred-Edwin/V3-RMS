/**
 * The five shift colours of the rota (Paper 16G6-0 and the swatches in 18XZ-0):
 * Morning blue, Afternoon green, Mid-day amber, Early bake lavender, Leave grey.
 *
 * Each maps to design-system tokens, never to a hex. Two are approximations (see README):
 * - Mid-day uses the warning tokens (Paper's amber #FBF1DE / #E9D3A8 has no token).
 * - Early bake uses a mix of the info and error tokens, the nearest to Paper's lavender
 *   (#F1ECF6) that does not need a new token. If the owner approves a lavender token, only
 *   this file changes.
 */
export type ShiftTone = 'morning' | 'afternoon' | 'midday' | 'earlyBake' | 'leave';

export const SHIFT_TONES: readonly ShiftTone[] = ['morning', 'afternoon', 'midday', 'earlyBake', 'leave'];

export interface ShiftPaint {
  /** Background, border and text classes of a chip or swatch. */
  chip: string;
  /** Default words for the legend and swatch picker. */
  label: string;
}

export const SHIFT_PAINT: Record<ShiftTone, ShiftPaint> = {
  morning: { chip: 'border-wds-info-border bg-wds-info-bg text-wds-info-fg', label: 'Morning' },
  afternoon: { chip: 'border-wds-success-border bg-wds-success-bg text-wds-success-fg', label: 'Afternoon' },
  midday: { chip: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg', label: 'Mid-day' },
  earlyBake: {
    chip: 'border-[color-mix(in_oklab,var(--wds-info-border)_55%,var(--wds-error-border))] bg-[color-mix(in_oklab,var(--wds-info-bg)_55%,var(--wds-error-bg))] text-[color-mix(in_oklab,var(--wds-info-fg)_60%,var(--wds-error-fg))]',
    label: 'Early bake',
  },
  leave: { chip: 'border-wds-border-strong bg-wds-neutral-100 text-wds-text-secondary', label: 'Leave' },
};

/** "06–14" for a cell: start and end hour, an en dash between (Paper 16G8-0). */
export function shiftCellLabel(start: string, end: string): string {
  const hour = (t: string): string => t.split(':')[0]?.padStart(2, '0') ?? t;
  return `${hour(start)}–${hour(end)}`;
}

/** "Morning 06:00 to 14:00" for a long label. */
export function shiftLongLabel(name: string, start: string, end: string): string {
  return `${name} ${start} to ${end}`;
}
