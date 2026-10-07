/**
 * Press feedback for every pressable thing on the recipes screens: scale(0.97) on :active, 150ms, ease-out, transform only.
 * Reduced motion keeps the colour change and drops the movement. Hover styles are gated to real pointers.
 */
export const PRESS =
  'transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:shadow-wds-ring';

/** Same, for the shared ui2 Button: overrides its colour transition and 0.98 scale (twMerge keeps the last). */
export const PRESS_BUTTON =
  'transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:active:scale-[0.97]';

/** Hover colour only on devices that really hover. */
export const HOVER_UNDERLINE = '[@media(hover:hover)_and_(pointer:fine)]:hover:underline';
