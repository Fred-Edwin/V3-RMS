import { Check, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { ProgressStep } from '../../lib/dispatch-words';

/**
 * The one tracker for every role and width (Paper D22 "One tracker"): a green circle with a white tick is a step that happened, a
 * ringed circle is the step it is on (green, or amber when someone has to act), an empty grey circle is still to come, a red cross is
 * where a cancelled dispatch stopped. Horizontal on a line from `lg` up, a vertical list below. Under each step: the time, then
 * Name, Title. Values from D13: 18px circles, 2px line, 14/18 label, 13/16 second line.
 */
export function ProgressTracker({ steps, label = 'Progress' }: { steps: readonly ProgressStep[]; label?: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-3 lg:flex-row lg:gap-0">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const todo = step.state === 'TODO';
        return (
          <li key={step.key} aria-current={step.state === 'CURRENT' ? 'step' : undefined} className={cn('flex gap-3 lg:flex-col lg:gap-2', last ? 'lg:w-[150px] lg:shrink-0' : 'lg:flex-1')}>
            <div className="flex items-center lg:w-full">
              <Marker step={step} />
              {!last ? <span aria-hidden className={cn('hidden h-[2px] flex-1 lg:block', step.state === 'DONE' ? 'bg-wds-success-fg' : 'bg-wds-border')} /> : null}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 lg:pr-3">
              <span className={cn('font-wds-sans text-[14px] leading-[18px]', todo ? 'text-wds-text-secondary' : step.state === 'CURRENT' || step.state === 'CANCELLED' ? 'font-semibold text-wds-text-ink' : 'font-medium text-wds-text-ink', step.state === 'CANCELLED' && 'text-wds-error-fg')}>
                {step.label}
                <span className="sr-only">{step.state === 'DONE' ? ' (done)' : step.state === 'CURRENT' ? ' (now)' : step.state === 'CANCELLED' ? ' (cancelled)' : ' (to come)'}</span>
              </span>
              {step.second ? <span className={cn('font-wds-sans text-[13px] leading-4', todo ? 'text-wds-text-faint' : 'text-wds-text-secondary')}>{step.second}</span> : null}
              {step.third ? <span className="font-wds-sans text-[13px] leading-4 text-wds-info-fg">{step.third}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Marker({ step }: { step: ProgressStep }) {
  if (step.state === 'DONE') {
    return (
      <span aria-hidden className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-wds-success-fg text-wds-surface">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (step.state === 'CANCELLED') {
    return (
      <span aria-hidden className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-wds-error-fg text-wds-surface">
        <X className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (step.state === 'CURRENT') {
    const amber = step.tone === 'act';
    return (
      <span aria-hidden className={cn('flex size-[18px] shrink-0 items-center justify-center rounded-full border-2', amber ? 'border-wds-warning-fg' : 'border-wds-success-fg')}>
        <span className={cn('size-1.5 rounded-full', amber ? 'bg-wds-warning-fg' : 'bg-wds-success-fg')} />
      </span>
    );
  }
  return <span aria-hidden className="size-[18px] shrink-0 rounded-full border-2 border-wds-border-strong bg-wds-surface" />;
}
