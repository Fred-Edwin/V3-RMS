'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { DISABLED, FOCUS_RING, MOTION, PRESSED } from '../../../_shared';
import { money } from '../lib/pay-words';

/**
 * An amount that obeys the eye. While hidden NO figure is in the page: the dots are decoration (`aria-hidden`) and a visually hidden
 * "Amount hidden" is read once per group by the caller (`HiddenNote`), not per figure. The figure is only rendered when `shown`.
 */
export function Amount({ value, shown, dots = 5, className }: { value: string; shown: boolean; dots?: number; className?: string }) {
  if (shown) return <span className={cn('font-wds-mono tabular-nums', className)}>{money(value)}</span>;
  return (
    <span aria-hidden className={cn('font-wds-mono tracking-[0.12em]', className)}>
      {'•'.repeat(dots)}
    </span>
  );
}

/** Read once for a group of hidden figures (a list, a card). */
export function HiddenNote({ shown }: { shown: boolean }) {
  return shown ? null : <span className="sr-only">Amount hidden</span>;
}

/** The round eye of Paper's tall header. `onDark` is the brown disc; otherwise a light outlined button (desktop title row). */
export function EyeButton({ shown, onToggle, onDark = true }: { shown: boolean; onToggle: () => void; onDark?: boolean }) {
  const [said, setSaid] = React.useState('');
  return (
    <>
      <button
        type="button"
        aria-pressed={shown}
        aria-label={shown ? 'Hide amounts' : 'Show amounts'}
        onClick={() => {
          onToggle();
          setSaid(shown ? 'Amounts hidden' : 'Amounts shown');
        }}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-full',
          onDark ? 'bg-[color-mix(in_oklab,var(--wds-sidebar-top)_80%,white)] text-wds-sidebar-fg-active' : 'border border-wds-border-strong bg-wds-surface text-wds-text-ink',
          MOTION,
          FOCUS_RING,
          PRESSED,
          DISABLED
        )}
      >
        <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {shown ? <path d="M4 20 20 4" /> : null}
        </svg>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {said}
      </span>
    </>
  );
}
