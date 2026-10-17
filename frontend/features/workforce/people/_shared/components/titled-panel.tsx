import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * A panel with a 14 px title at the left and something at the right of the same row: a link ("Edit"), a mono caption ("HR AND
 * ACCOUNTANT ONLY"), or nothing. The kit's `Panel` takes a text caption only; the file screens need a button there.
 */
export function TitledPanel({
  title,
  aside,
  children,
  className,
  padded = false,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section aria-label={title} className={cn('flex flex-col border border-wds-border bg-wds-surface', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-wds-border px-4 py-3">
        <h3 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{title}</h3>
        {aside}
      </header>
      <div className={cn(padded && 'px-4 py-3')}>{children}</div>
    </section>
  );
}

/** Put on a `KeyValueRows` inside a `TitledPanel`: the divider lines run edge to edge and the words keep 16 px from the border. */
export const PANEL_ROWS = '[&>div]:px-4 [&>div:last-child]:border-b-0';

/** The small brown text button used in a panel header ("Edit"). */
export function PanelLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="border-0 bg-transparent p-0 font-wds-sans text-[13px] leading-4 text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring">
      {children}
    </button>
  );
}

export function PanelCaption({ children }: { children: React.ReactNode }) {
  return <span className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">{children}</span>;
}
