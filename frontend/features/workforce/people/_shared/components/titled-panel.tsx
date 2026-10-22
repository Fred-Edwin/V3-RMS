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
      <header className="flex h-[52px] items-center justify-between gap-3 border-b border-wds-border px-5">
        <h3 className="m-0 font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{title}</h3>
        {aside}
      </header>
      <div className={cn(padded && 'px-5 py-3')}>{children}</div>
    </section>
  );
}

/** Put on a `KeyValueRows` inside a `TitledPanel`: the divider lines run edge to edge and the words keep 16 px from the border. */
export const PANEL_ROWS = '[&>div]:px-5 [&>div:last-child]:border-b-0';

/**
 * "Edit" at the top right of a card the role may change (frames 7.1 to 7.3): plain amber text, underlined, 14 px, no button box.
 * The amber `#A8680A` has no token yet; it is written here once so the whole feature follows it.
 */
export function PanelLink({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="min-h-6 border-0 bg-transparent p-0 font-wds-sans text-[14px] leading-[18px] text-[#A8680A] underline underline-offset-2 outline-none hover:text-wds-caramel-700 focus-visible:shadow-wds-ring"
    >
      {children}
    </button>
  );
}

/** The grey tag in the same spot on a card the role may read but not change ("Edited by HR", frames 7.1 and 12.1): a pale pill, 12 px words. */
export function PanelReadOnlyTag({ children }: { children: React.ReactNode }) {
  return <span className="bg-[#EFEDE9] px-2.5 py-[5px] font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{children}</span>;
}

export function PanelCaption({ children }: { children: React.ReactNode }) {
  return <span className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">{children}</span>;
}
