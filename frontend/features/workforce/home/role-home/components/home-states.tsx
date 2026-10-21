'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED, formatReference, onHover, type RemoteError } from '../../../_shared';

/**
 * The four Home states, shown once for every role (Paper 1.13): loading is grey blocks the shape of the page (no spinner, no words),
 * nothing waiting is a green tick, a busy system is a clock that retries by itself, and an error replaces only the part that failed.
 * The wording is the same for every role. `busy` is a 429 or a gateway answer; anything else is a plain error.
 */
export const HOME_STATE_COPY = {
  nothing: { title: 'Nothing needs you', line: 'You are up to date. New requests appear here and in the bell.' },
  busy: { title: 'The system is busy', line: 'Trying again in a few seconds. Nothing was changed.' },
  error: { title: 'We could not load this', line: 'Nothing was changed. Try again, or tell your manager' },
} as const;

/** True for the answers that mean "too many people at once", not "this is broken". */
export const isBusy = (error: RemoteError): boolean => error.status === 429 || error.status === 502 || error.status === 503 || error.status === 504;

const Block = ({ className }: { className?: string }) => <span aria-hidden className={cn('block bg-wds-neutral-100 motion-safe:animate-pulse', className)} />;

/** Grey blocks that keep the page the same shape while it loads. */
export function HomeLoading({ phone = false }: { phone?: boolean }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading Home" className="flex flex-col gap-6">
      <div className={cn('grid gap-3', phone ? 'grid-cols-2' : 'grid-cols-5')}>
        {Array.from({ length: phone ? 4 : 5 }, (_, i) => (
          <Block key={i} className="h-[84px]" />
        ))}
      </div>
      <div className="flex flex-col gap-3 border-t border-t-wds-neutral-800 pt-3">
        {[70, 100, 55, 90, 60].map((w, i) => (
          <Block key={i} className={cn('h-3', i % 2 ? 'bg-wds-neutral-50' : '')} />
        ))}
      </div>
    </div>
  );
}

function Mark({ tone, children }: { tone: 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const colour = { success: 'border-wds-success-fg text-wds-success-fg', warning: 'border-wds-warning-fg text-wds-warning-fg', error: 'border-wds-error-fg text-wds-error-fg' }[tone];
  return (
    <span aria-hidden className={cn('flex size-6 items-center justify-center rounded-full border-2 font-wds-sans text-[13px] font-semibold leading-none', colour)}>
      {children}
    </span>
  );
}

const Retry = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className={cn('self-start border border-wds-border-strong bg-wds-surface px-4 py-[9px] font-wds-sans text-[13px] leading-4 text-wds-text-ink', MOTION, FOCUS_RING, PRESSED, onHover('bg-wds-neutral-50'))}>
    Try again
  </button>
);

/** Nothing waiting. "Latest keeps showing what happened." sits under it only where Latest is drawn. */
export function HomeNothingWaiting({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 border-t-2 border-t-wds-neutral-800 pt-4', className)}>
      <Mark tone="success">✓</Mark>
      <h3 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{HOME_STATE_COPY.nothing.title}</h3>
      <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{HOME_STATE_COPY.nothing.line}</p>
    </div>
  );
}

export function HomeBusy({ className }: { className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col gap-2 border-t-2 border-t-wds-neutral-800 pt-4', className)}>
      <Mark tone="warning">◷</Mark>
      <h3 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{HOME_STATE_COPY.busy.title}</h3>
      <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{HOME_STATE_COPY.busy.line}</p>
    </div>
  );
}

/** Error: replaces only the part that failed. The reference lets support find the log entry; a made-up one is never shown. */
export function HomeError({ error, onRetry, className }: { error: RemoteError; onRetry: () => void; className?: string }) {
  const reference = /^WF-/i.test(error.code) ? formatReference(error.code) : null;
  return (
    <div role="alert" className={cn('flex flex-col gap-2 border-t-2 border-t-wds-neutral-800 pt-4', className)}>
      <Mark tone="error">!</Mark>
      <h3 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{HOME_STATE_COPY.error.title}</h3>
      <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
        {HOME_STATE_COPY.error.line}
        {reference ? ` (reference ${reference}).` : '.'}
      </p>
      <Retry onClick={onRetry} />
    </div>
  );
}

/** Busy retries by itself after a few seconds, then the caller moves to the error state. */
export function useBusyRetry(busy: boolean, retry: () => void, attempts = 3, everyMs = 4000): { gaveUp: boolean } {
  const [tries, setTries] = React.useState(0);
  React.useEffect(() => {
    if (!busy) {
      setTries(0);
      return;
    }
    if (tries >= attempts) return;
    const id = window.setTimeout(() => {
      setTries((n) => n + 1);
      retry();
    }, everyMs);
    return () => window.clearTimeout(id);
  }, [busy, tries, attempts, everyMs, retry]);
  return { gaveUp: busy && tries >= attempts };
}
