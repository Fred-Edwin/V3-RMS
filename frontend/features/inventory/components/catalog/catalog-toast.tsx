import * as React from 'react';

/**
 * The dark "Item added" bar at the bottom of the catalog (Paper step 04):
 * a green dot, the confirmation, and the next step as a caramel link. Not the
 * generic ui2 toast — this one carries an action and sits in the page.
 */
export function ItemAddedBar({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-4 bg-wds-text-ink px-4 py-3 shadow-wds-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
      >
        <span aria-hidden className="size-2 shrink-0 rounded-[4px] bg-[#7FB88A]" />
        <span className="font-wds-sans text-[13px] leading-4 text-white">{message}</span>
        <button
          type="button"
          onClick={onAction}
          className="whitespace-nowrap font-wds-sans text-[13px] font-medium leading-4 text-wds-caramel-500 hover:underline focus-visible:outline-none focus-visible:shadow-wds-ring"
        >
          {actionLabel}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 font-wds-sans text-[16px] leading-4 text-wds-text-muted hover:text-white focus-visible:outline-none focus-visible:shadow-wds-ring"
        >
          ×
        </button>
      </div>
    </div>
  );
}
