import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * The vertical circle stepper (Paper Chapter 11 steps 01, 02: the story of one notice; Leave uses it for a request). Circle 24, a 2 px
 * line 44 high between steps, 14 gap. Done is green with a tick; the current step has a 2 px amber ring and a 10 px dot; a step still
 * to come is a white circle with a grey ring; `amber` is a done step that needs a second look ("Given, not signed"); `declined` is red.
 *
 * It is an ordered list. The current item carries `aria-current="step"`, and every state has a visually hidden word, so the stepper is
 * never colour alone. It holds no data and no role: the screen passes the steps it was given by the server.
 *
 * Paper's ring colour #B0610F and fill #FCF2E4 have no token; `caramel-600` and `warning-bg` are the nearest, as in the Inbox row.
 */
export type CircleStepState = 'done' | 'current' | 'todo' | 'amber' | 'declined' | 'passed' | 'cancelled';

export interface CircleStep {
  key: string;
  state: CircleStepState;
  title: string;
  line?: string;
  /** Something after the line: a link ("See the new notice"). */
  action?: React.ReactNode;
}

const SPOKEN: Record<CircleStepState, string> = { done: 'Done: ', current: 'Now: ', todo: 'To come: ', amber: 'Done, needs a look: ', declined: 'Declined: ', passed: 'Passed by time: ', cancelled: 'Cancelled: ' };

function Dot({ state }: { state: CircleStepState }) {
  if (state === 'done' || state === 'amber') {
    return (
      <span aria-hidden className={cn('flex size-6 items-center justify-center rounded-full text-[13px] font-semibold leading-none text-white', state === 'done' ? 'bg-wds-success-fg' : 'bg-wds-caramel-600')}>
        ✓
      </span>
    );
  }
  if (state === 'declined' || state === 'cancelled') {
    return (
      <span aria-hidden className={cn('flex size-6 items-center justify-center rounded-full text-[13px] font-semibold leading-none text-white', state === 'declined' ? 'bg-wds-error-fg' : 'bg-wds-neutral-400')}>
        ×
      </span>
    );
  }
  // Passed by time (Leave: the 3-day step a request moves past). No Paper token for the fill; caramel-700 is the nearest, as in the Leave decisions file.
  if (state === 'passed') {
    return (
      <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-wds-caramel-700 text-[13px] font-semibold leading-none text-white">
        ✓
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span aria-hidden className="flex size-6 items-center justify-center rounded-full border-2 border-wds-caramel-600 bg-wds-warning-bg">
        <span className="size-2.5 rounded-full bg-wds-caramel-600" />
      </span>
    );
  }
  return <span aria-hidden className="size-6 rounded-full border-2 border-wds-border-strong bg-wds-surface" />;
}

export function CircleStepper({ steps, label, className }: { steps: readonly CircleStep[]; /** Spoken name of the list: "Where this notice is". */ label: string; className?: string }) {
  return (
    <ol aria-label={label} className={cn('m-0 flex list-none flex-col p-0', className)}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const lineTone = step.state === 'done' || step.state === 'amber' || step.state === 'passed' ? 'bg-wds-success-fg' : 'bg-wds-border-strong';
        return (
          <li key={step.key} aria-current={step.state === 'current' ? 'step' : undefined} className={cn('flex gap-3.5', !last && 'pb-5')}>
            <div className="relative flex w-6 shrink-0 flex-col items-center">
              <Dot state={step.state} />
              {last ? null : <span aria-hidden className={cn('absolute left-1/2 top-6 -ml-px h-[calc(100%+20px-24px)] w-0.5', lineTone)} />}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 pt-px">
              <span className={cn('font-wds-sans text-[14px] font-semibold leading-[18px]', step.state === 'todo' ? 'text-wds-text-faint' : 'text-wds-text-ink')}>
                <span className="sr-only">{SPOKEN[step.state]}</span>
                {step.title}
              </span>
              {step.line ? (
                <span className={cn('font-wds-sans text-[12px] leading-4', step.state === 'current' || step.state === 'amber' ? 'text-wds-warning-fg' : step.state === 'declined' ? 'text-wds-error-fg' : step.state === 'todo' ? 'text-wds-text-faint' : 'text-wds-text-secondary')}>{step.line}</span>
              ) : null}
              {step.action}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
