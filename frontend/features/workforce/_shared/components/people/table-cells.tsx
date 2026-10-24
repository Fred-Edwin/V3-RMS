import * as React from 'react';

import { cn } from '@/lib/cn';

import { PersonAvatar, type Presence } from './person-avatar';
import { VALUE_TONE_CLASS, type ValueTone } from '../layout/key-value-rows';

/**
 * Cell contents for the Workforce table look (`<DataTable tableLook="workforce">` or
 * `<Table look="workforce">`; Paper R3L-0, 18BR-0, 1O9L-0). Search, filters, the
 * numbered pager and URL state come from `ui2/data-table`; these only fill cells.
 */

/** Avatar, a name (14 px, 500) and a second line (12 px grey): the first cell of Employees. */
export function AvatarCell({
  name,
  sub,
  photoUrl,
  presence,
  children,
}: {
  name: string;
  sub?: string;
  photoUrl?: string | null;
  presence?: Presence;
  /** Replaces the name, e.g. `<HighlightMatch>` so the searched letters are bold. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <PersonAvatar name={name} size="sm" photoUrl={photoUrl} presence={presence} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{children ?? name}</span>
        {sub ? <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{sub}</span> : null}
      </div>
    </div>
  );
}

/** Hours, money, counts: Geist Mono, right-aligned, digits the same width. Put it in a column with `align: 'right'`. */
export function NumberCell({ children, tone = 'default', className }: { children: React.ReactNode; tone?: ValueTone; className?: string }) {
  return <span className={cn('block text-right font-wds-mono text-[13px] leading-4 tabular-nums', VALUE_TONE_CLASS[tone], className)}>{children}</span>;
}

/** A status written as coloured words (no box): "Approved", "2 h over". */
export function StatusText({ tone = 'default', children }: { tone?: ValueTone; children: React.ReactNode }) {
  return <span className={cn('font-wds-sans text-[13px] leading-4', VALUE_TONE_CLASS[tone])}>{children}</span>;
}

/** The small line under a cell that says a row needs the reader: a square marker and warning-coloured words. */
export function NeedsYouLine({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-0.5 flex items-center gap-1.5 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-wds-warning-fg" />
      {children}
    </span>
  );
}
