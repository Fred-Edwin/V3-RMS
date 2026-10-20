import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * The circle stepper of a followed request (Leave Chapter 10 step 3, Conduct): a column of 24 px circles joined by a 2 px line, with a
 * title and a grey line beside each. Presentational: the steps come from the server. Colour is never the only signal, so each state
 * has its own mark (tick, cross, dot, clock) and the current step says "Current step" to a screen reader.
 */
export type CircleStepState = 'done' | 'current' | 'declined' | 'passed' | 'todo' | 'cancelled';

export interface CircleStep {
  key: string;
  state: CircleStepState;
  title: string;
  line?: string;
}

const SPOKEN: Record<CircleStepState, string> = { done: 'Done', current: 'Current step', declined: 'Declined', passed: 'Passed by time', todo: 'Still to come', cancelled: 'Cancelled' };

function Mark({ state }: { state: CircleStepState }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (state === 'done') return <svg aria-hidden width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.2l2.4 2.4 4.6-5" {...stroke} /></svg>;
  if (state === 'declined' || state === 'cancelled') return <svg aria-hidden width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" {...stroke} /></svg>;
  if (state === 'passed') return <svg aria-hidden width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" {...stroke} strokeWidth={1.6} /><path d="M7 4.2V7l1.9 1.2" {...stroke} strokeWidth={1.6} /></svg>;
  if (state === 'current') return <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-wds-caramel-600" />;
  return null;
}

const CIRCLE: Record<CircleStepState, string> = {
  done: 'bg-wds-success-fg text-white',
  current: 'border-2 border-wds-caramel-600 bg-wds-warning-bg',
  declined: 'bg-wds-error-fg text-white',
  cancelled: 'bg-wds-neutral-400 text-white',
  // Passed by time: amber-brown fill (no token in Paper's palette; caramel-700 is the nearest, see the Leave decisions file).
  passed: 'bg-wds-caramel-700 text-white',
  todo: 'border-2 border-wds-border-strong bg-white',
};

const TITLE: Record<CircleStepState, string> = {
  done: 'text-wds-text-ink',
  current: 'text-wds-text-ink',
  declined: 'text-wds-error-fg',
  cancelled: 'text-wds-text-ink',
  passed: 'text-wds-text-ink',
  todo: 'text-wds-neutral-400',
};

export function CircleStepper({ steps, label, className }: { steps: readonly CircleStep[]; label: string; className?: string }) {
  return (
    <ol aria-label={label} className={cn('m-0 flex list-none flex-col p-0', className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        // The line below a circle is green once the step is passed.
        const joined = step.state === 'done' || step.state === 'passed';
        return (
          <li key={step.key} className="flex gap-3.5" aria-current={step.state === 'current' ? 'step' : undefined}>
            <div className="flex w-6 shrink-0 flex-col items-center">
              <span aria-hidden className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', CIRCLE[step.state])}>
                <Mark state={step.state} />
              </span>
              {last ? null : <span aria-hidden className={cn('h-11 w-0.5', joined ? 'bg-wds-success-fg' : 'bg-wds-border-strong')} />}
            </div>
            <div className={cn('flex min-w-0 flex-col gap-0.5 pb-3', last && 'pb-0')}>
              <span className={cn('font-wds-sans text-[14px] font-semibold leading-[18px]', TITLE[step.state])}>
                {step.title}
                <span className="sr-only">{`. Step ${i + 1} of ${steps.length}, ${SPOKEN[step.state]}`}</span>
              </span>
              {step.line ? <span className={cn('font-wds-sans text-[12px] leading-4', step.state === 'current' ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{step.line}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
