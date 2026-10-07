'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { YIELD_REASONS } from '../../_shared/lib/states-copy';
import type { YieldReason } from '../../_shared/types/prep-contract';

/** "What happened? Optional" (Paper step 7): Trimmed more, Spillage, Burnt, Other. Tapping the chosen one again clears it. */
export function YieldReasonChips({ value, onChange }: { value: YieldReason | undefined; onChange: (next: YieldReason | undefined) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted">What happened? Optional</span>
      <div role="group" aria-label="What happened?" className="flex flex-wrap gap-wds-2">
        {YIELD_REASONS.map((r) => {
          const on = value === r.value;
          return (
            <button
              key={r.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? undefined : r.value)}
              className={cn(
                'h-10 border px-wds-4 font-wds-sans text-wds-body-sm outline-none transition-colors focus-visible:shadow-wds-ring',
                on ? 'border-wds-espresso-700 bg-wds-espresso-50 text-wds-espresso-700' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-50'
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
