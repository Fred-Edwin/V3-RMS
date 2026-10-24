/**
 * Workforce behaviour rules as shared classes (Paper "Workforce · Interaction
 * spec", rules 04, 08, 09). Every kit piece composes these so hover, focus,
 * pressed and disabled look and move the same everywhere.
 *
 * - Hover only on pointer devices that can hover (touch taps would stick).
 * - Focus ring is the design system's 3px espresso ring, keyboard focus only.
 * - Pressed: scale 0.98, 150 ms. Motion is a fast ease-out and is dropped
 *   under prefers-reduced-motion (colour changes stay, movement goes).
 * - Disabled never hides the reason: pieces take a `disabledReason` and show it.
 */

/** Strong ease-out, 150 ms. Only colour-like properties and transform animate. */
export const MOTION =
  'transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-[color,background-color,border-color,opacity]';

/** Keyboard focus ring (`focus-visible` only, so a mouse click shows none). */
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:shadow-wds-ring';

/** Pressed feedback for anything tappable; skipped under reduced motion. */
export const PRESSED = 'motion-safe:active:scale-[0.98]';

/** Prefix a hover utility so it only applies where hover really exists. */
export const onHover = (utility: string): string =>
  `[@media(hover:hover)_and_(pointer:fine)]:hover:${utility}`;

/** A tappable, plain element: motion + focus + pressed, no colours. */
export const INTERACTIVE = `${MOTION} ${FOCUS_RING} ${PRESSED}`;

/** A disabled control: not clickable, dimmed. The reason is shown by the piece. */
export const DISABLED = 'disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60';

/** Minimum phone tap target (rule 08). */
export const TAP_TARGET = 'min-h-[44px] min-w-[44px]';

/** The only waiting time the kit owns: the "Still loading" line (States kit). */
export const STILL_LOADING_AFTER_MS = 8000;

/** A few seconds after "Still loading": the bars give way to "We could not load this" with a reference and Try again. Loading never lasts forever. */
export const STUCK_AFTER_MS = 14_000;

/** Undo window for an answered row (rule 03). */
export const UNDO_WINDOW_MS = 30_000;
