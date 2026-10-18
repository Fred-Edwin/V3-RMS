'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED, SHIFT_PAINT } from '../../../_shared';
import { cellLabelOf, toneOfColour } from '../../_shared/lib/shift-look';
import type { TemplateView } from '../../_shared/types/rota-types';

/**
 * The shift sheet under the chosen person (Paper step 9): "Grace Mwende · Saturday", one block per shift they may work, then "Day off".
 * One tap picks and saves. Blocks are at least 44 px tall for a thumb.
 */
export function PhoneShiftSheet({
  title,
  options,
  currentIds,
  onPick,
}: {
  title: string;
  options: readonly TemplateView[];
  currentIds: readonly string[];
  onPick: (templateId: string | null) => void;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5 border border-wds-border bg-wds-surface p-3.5">
      <h3 className="m-0 font-wds-sans text-[12px] font-normal leading-4 text-wds-text-secondary">{title}</h3>
      {options.length === 0 ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">No shifts are set up for this team yet. Add them in Shift templates on a computer.</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {options.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={currentIds.includes(t.id)}
            onClick={() => onPick(t.id)}
            className={cn('min-h-[44px] border px-2 font-wds-mono text-[12px] leading-4', SHIFT_PAINT[toneOfColour(t.colour)].chip, MOTION, FOCUS_RING, PRESSED, currentIds.includes(t.id) && 'border-wds-primary')}
          >
            {t.name} {cellLabelOf(t)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={currentIds.length === 0}
          onClick={() => onPick(null)}
          className={cn('min-h-[44px] border border-wds-border-strong bg-wds-surface px-2 font-wds-sans text-[13px] leading-4 text-wds-text-ink', MOTION, FOCUS_RING, PRESSED, currentIds.length === 0 && 'border-wds-primary')}
        >
          Day off
        </button>
      </div>
    </section>
  );
}
