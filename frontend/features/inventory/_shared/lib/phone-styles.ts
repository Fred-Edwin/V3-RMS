/**
 * The primary fill the Paper phone screens draw on their big buttons: the system primary gradient sampled from about half way
 * (Paper's own stop values are oklab 44 % to 29.3 %, which read as #7A4217 to #4A1D00), expressed with the primary button tokens so
 * no hex lives here. `WIDE` is the same fill for the tall keypad action key (oklab 47.8 %). Press and hover are added by the caller.
 */
export const PHONE_PRIMARY_FILL =
  'bg-[linear-gradient(180deg_in_oklab,color-mix(in_oklab,var(--wds-primary-btn-start)_53%,var(--wds-primary-btn-end)),var(--wds-primary-btn-end))]';

/** The 48 px full-width phone primary button, with its hover, pressed, focus and disabled states. */
export const PHONE_PRIMARY_BUTTON = `${PHONE_PRIMARY_FILL} flex shrink-0 items-center justify-center font-wds-sans font-semibold text-wds-surface outline-none transition-[filter,transform,box-shadow,opacity] duration-100 focus-visible:shadow-wds-ring enabled:[@media(hover:hover)]:hover:brightness-110 enabled:active:brightness-95 enabled:motion-safe:active:scale-[0.99] disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted`;

/** Paper draws the phone list filters 34 px tall; this stretches the tap area to 44 px without changing how they look. */
export const PHONE_FILTER_HIT = "relative before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-['']";

/** The 44 px white outline button under it ("Log waste", "Continue as counted", "Cancel"). */
export const PHONE_SECONDARY_BUTTON =
  'flex h-11 shrink-0 items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink outline-none transition-[background-color,transform,box-shadow,opacity] duration-100 focus-visible:shadow-wds-ring enabled:[@media(hover:hover)]:hover:bg-wds-neutral-50 enabled:active:bg-wds-neutral-100 enabled:motion-safe:active:scale-[0.99] disabled:opacity-50';
