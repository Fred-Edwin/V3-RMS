import * as React from 'react';

import { cn } from '@/lib/cn';

import { highlightParts, labelDetail } from '../lib/person-label';
import { PersonAvatar } from './person-avatar';

/**
 * The person label (Paper frame 7.5). One way to show a person everywhere someone is picked or listed.
 *  - `PersonLabel`: two lines in a picker. Circle avatar, name semibold, "position · site" grey.
 *  - `PersonLabelLine`: one line for a table cell, "Name · position · site". When space runs out the site is cut first, then the
 *    position, never the name.
 * Letters that match `query` are marked in the name and in the grey text.
 */
export interface PersonLabelProps {
  name: string;
  position?: string | null;
  site?: string | null;
  photoUrl?: string | null;
  /** What was typed in the search; matching letters are marked. */
  query?: string;
  className?: string;
}

function Marked({ text, query }: { text: string; query: string | undefined }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.match ? (
          <mark key={i} className="rounded-[1px] bg-wds-caramel-300 text-inherit">
            {p.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        )
      )}
    </>
  );
}

export function PersonLabel({ name, position, site, photoUrl, query, className }: PersonLabelProps) {
  const detail = labelDetail(position, site);
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <PersonAvatar name={name} size="sm" photoUrl={photoUrl} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-wds-sans text-[14px] font-semibold leading-5 text-wds-text-ink">
          <Marked text={name} query={query} />
        </span>
        {detail ? (
          <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            <Marked text={detail} query={query} />
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function PersonLabelLine({ name, position, site, query, className }: Omit<PersonLabelProps, 'photoUrl'>) {
  return (
    <span className={cn('flex min-w-0 items-baseline gap-1.5 font-wds-sans text-[14px] leading-5', className)} title={[name, position, site].filter(Boolean).join(' · ')}>
      <span className="shrink-0 font-semibold text-wds-text-ink">
        <Marked text={name} query={query} />
      </span>
      {position ? (
        <span className="min-w-0 shrink truncate text-wds-text-secondary">
          · <Marked text={position} query={query} />
        </span>
      ) : null}
      {site ? (
        <span className="min-w-0 shrink-[4] truncate text-wds-text-secondary">
          · <Marked text={site} query={query} />
        </span>
      ) : null}
    </span>
  );
}
