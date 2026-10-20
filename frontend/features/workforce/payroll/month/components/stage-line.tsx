import * as React from 'react';

import { cn } from '@/lib/cn';

import { stageCaption, stageSpoken } from '../../_shared/lib/month-view';
import type { StageView } from '../../_shared/types/month-types';

const RULE: Record<StageView['status'], string> = { DONE: 'border-t-wds-success-fg', CURRENT: 'border-t-wds-caramel-600', TODO: 'border-t-wds-neutral-300' };
const TEXT: Record<StageView['status'], string> = { DONE: 'text-wds-success-fg', CURRENT: 'text-wds-warning-fg', TODO: 'text-wds-neutral-500' };

function Badge({ stage }: { stage: StageView }) {
  const base = 'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full font-wds-sans text-[11px] font-bold leading-[14px]';
  if (stage.status === 'DONE') {
    return (
      <span aria-hidden className={cn(base, 'bg-wds-success-fg text-white')}>
        ✓
      </span>
    );
  }
  if (stage.status === 'CURRENT') {
    return (
      <span aria-hidden className={cn(base, 'border-2 border-wds-caramel-600 bg-white text-wds-warning-fg')}>
        {stage.number}
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(base, 'bg-wds-neutral-100 text-wds-neutral-500')}>
      {stage.number}
    </span>
  );
}

/**
 * The six stages of a month (spec S-shell): a 3 px rule, a round badge (a check when done, the number otherwise), the name, and one
 * caption. An ordered list; the current stage has `aria-current="step"`. Colour is never the only signal: the badge and the words say it.
 * Below 1100 px it is a two-column grid.
 */
export function StageLine({ stages }: { stages: readonly StageView[] }) {
  if (stages.length === 0) return null;
  return (
    <ol aria-label="Where the month is" className="m-0 grid list-none grid-cols-2 p-0 min-[1100px]:grid-cols-6">
      {stages.map((stage) => {
        const caption = stageCaption(stage);
        return (
          <li key={stage.key} aria-current={stage.status === 'CURRENT' ? 'step' : undefined} aria-label={stageSpoken(stage)} className={cn('flex flex-col gap-1.5 border-t-[3px] pr-3 pt-2', RULE[stage.status])}>
            <span className="flex items-center gap-2">
              <Badge stage={stage} />
              <span className={cn('font-wds-sans text-[13px] leading-4', stage.status === 'TODO' ? 'font-normal text-wds-neutral-500' : 'font-semibold text-wds-text-ink')}>{stage.name}</span>
            </span>
            {caption ? <span className={cn('pl-[30px] font-wds-sans text-[12px] leading-4', TEXT[stage.status])}>{caption}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
