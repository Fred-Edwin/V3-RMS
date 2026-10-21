'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION } from '../lib/interaction';
import { PersonAvatar } from './person-avatar';
import { PersonLabel } from './person-label';

/**
 * A short list of people to choose one from (Paper Chapter 3 step 03, "Who should lead it"): a radio, the avatar, the name, a grey
 * line, and an optional green marker at the right ("Recommended"). Real radio inputs, so the arrow keys move the choice; the chosen
 * row has the espresso edge and the warm fill. It holds no data and no role.
 */
export interface PersonChoice {
  value: string;
  name: string;
  /** "Housekeeper · since Mar 2025 · has a login". Not drawn when `position` or `site` is given: the person label draws "position · site". */
  line: string;
  /** With `position` or `site` the row is the shared person label (frame 7.5). */
  position?: string | null;
  site?: string | null;
  marker?: string;
}

export function PersonRadioList({
  legend,
  people,
  value,
  onChange,
  disabled = false,
  query,
  className,
}: {
  /** What was typed in the search, so matching letters are marked. */
  query?: string;
  /** Spoken name of the group; also drawn as the mono caption. */
  legend: string;
  people: readonly PersonChoice[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const name = React.useId();
  return (
    <fieldset className={cn('m-0 flex min-w-0 flex-col gap-2 border-0 p-0', className)} disabled={disabled}>
      <legend className="mb-2 p-0 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{legend}</legend>
      <div className="flex flex-col border border-wds-border">
        {people.map((p) => {
          const chosen = p.value === value;
          return (
            <label
              key={p.value}
              className={cn(
                'relative flex cursor-pointer items-center gap-3 border-b border-wds-border px-3.5 py-3 last:border-b-0',
                MOTION,
                'focus-within:shadow-wds-ring',
                chosen ? 'bg-[color-mix(in_oklab,var(--wds-caramel-100)_55%,white)]' : 'bg-wds-surface'
              )}
            >
              <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px] bg-wds-primary', chosen ? 'opacity-100' : 'opacity-0')} />
              <input type="radio" name={name} value={p.value} checked={chosen} onChange={() => onChange(p.value)} className={cn('peer sr-only', FOCUS_RING)} />
              <span aria-hidden className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border', chosen ? 'border-wds-primary' : 'border-wds-border-strong')}>
                {chosen ? <span className="h-2 w-2 rounded-full bg-wds-primary" /> : null}
              </span>
              {p.position !== undefined || p.site !== undefined ? (
                <PersonLabel name={p.name} position={p.position} site={p.site} query={query} className="flex-1" />
              ) : (
                <>
                  <PersonAvatar name={p.name} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{p.name}</span>
                    <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{p.line}</span>
                  </span>
                </>
              )}
              {p.marker ? <span className="shrink-0 font-wds-sans text-[12px] leading-4 text-wds-success-fg">{p.marker}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
