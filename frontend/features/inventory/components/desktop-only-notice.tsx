import * as React from 'react';

/**
 * Fallback for the two S6 screens (New Goods Receipt `UQE-0`, Goods Receipt
 * detail `UVN-0`) — neither has a mobile artboard; the Attendant mobile flow
 * reuses the Receiving worklist entry point instead. Shared rather than
 * duplicated since both screens need the same fallback.
 */
export function DesktopOnlyNotice({ screen, hint }: { screen: string; hint?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-wds-2 bg-wds-canvas px-wds-6 text-center">
      <span className="font-wds-sans text-wds-body font-medium text-wds-text-ink">Use a larger screen</span>
      <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
        {screen} is designed for desktop. {hint ?? 'Open it on a laptop or larger screen.'}
      </span>
    </div>
  );
}
