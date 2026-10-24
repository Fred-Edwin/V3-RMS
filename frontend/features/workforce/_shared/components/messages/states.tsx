'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED, STILL_LOADING_AFTER_MS, STUCK_AFTER_MS, onHover } from '../../lib/style/interaction';
import { STATES_FIXED, formatReference } from '../../lib/copy/states-copy';

/**
 * The States kit (Paper "Workforce · States kit", 1Q6R-0): the moments between
 * data. Loading is grey bars in the shape of the rows; empty comes in two kinds
 * ("nothing yet" invites the first action, "nothing found" names the filter and
 * offers to clear it); an error replaces only the part that failed and carries a
 * reference; the offline strip and the "Saved on this phone" marker belong to the
 * clock events that work without signal.
 *
 * Words come from `states-copy.ts` (by screen key) or the caller; none of these
 * holds a role or a sentence of its own, except the fixed lines in STATES_FIXED.
 */

/** True after `ms` of `active` being true; resets when it goes false. */
export function useStillLoading(active: boolean, ms: number = STILL_LOADING_AFTER_MS): boolean {
  const [late, setLate] = React.useState(false);
  React.useEffect(() => {
    if (!active) {
      setLate(false);
      return;
    }
    const id = window.setTimeout(() => setLate(true), ms);
    return () => window.clearTimeout(id);
  }, [active, ms]);
  return late;
}

/**
 * Loading, for a list. `columns` is the widths of each row's bars so the bars sit
 * in the same columns as the real rows: a number is a fixed px width, `'fill'` takes
 * the rest. The first row is a shade darker, as drawn. After 8 seconds the
 * "Still loading" line appears under the bars.
 */
export function ListSkeleton({
  rows = 3,
  columns = [70, 'fill', 90],
  label = 'Loading',
  className,
}: {
  rows?: number;
  columns?: Array<number | 'fill'>;
  label?: string;
  className?: string;
}) {
  const late = useStillLoading(true);
  const stuck = useStillLoading(true, STUCK_AFTER_MS);
  // A short code to quote when asking for help: nothing is stored under it, it only marks this moment on this screen.
  const reference = React.useRef(Math.random().toString(36).slice(2, 6).toUpperCase());
  if (stuck) {
    return (
      <ErrorBlock
        title={STATES_FIXED.couldNotLoad}
        line={STATES_FIXED.couldNotLoadLine}
        reference={reference.current}
        onRetry={() => window.location.reload()}
        className={className}
      />
    );
  }
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div role="status" aria-busy="true" aria-label={label} className="flex flex-col border border-wds-border bg-wds-surface">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className={cn('flex gap-3.5 px-4 py-3.5', r < rows - 1 && 'border-b border-wds-neutral-100')}>
            {columns.map((c, i) => (
              <span
                key={i}
                aria-hidden
                className={cn('h-3 motion-safe:animate-pulse', r === 0 ? 'bg-wds-neutral-100' : 'bg-wds-neutral-50', c === 'fill' ? 'flex-1' : 'shrink-0')}
                style={c === 'fill' ? undefined : { width: c }}
              />
            ))}
          </div>
        ))}
      </div>
      {late ? (
        <p role="status" className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">
          {STATES_FIXED.stillLoading}
        </p>
      ) : null}
    </div>
  );
}

/** A plain outlined action for a state (the screen decides whether the role may see it, and passes it only if so). */
export function StateButton({
  primary = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center font-wds-sans text-[13px] leading-4',
        MOTION,
        FOCUS_RING,
        PRESSED,
        primary
          ? cn('bg-wds-primary px-4 py-[9px] font-semibold text-wds-primary-fg', onHover('bg-wds-primary-hover'))
          : cn('border border-wds-border-strong px-4 py-[9px] text-wds-text-ink', onHover('bg-wds-neutral-50')),
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Empty. `kind="nothingYet"` is the first-time state; `kind="nothingFound"` is a
 * search or filter with no match. Never blames the person. Pass `action` only if
 * the role may take it (rule 04: hidden, never greyed).
 */
export function EmptyState({
  kind,
  title,
  line,
  action,
  className,
}: {
  kind: 'nothingYet' | 'nothingFound';
  title: string;
  line?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      data-state={kind}
      className={cn('flex flex-col items-center gap-2 border border-wds-border bg-wds-surface px-6 py-[34px] text-center', className)}
    >
      <span aria-hidden className="h-10 w-10 shrink-0 rounded-full border-2 border-wds-neutral-300" />
      <h3 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{title}</h3>
      {line ? <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">{line}</p> : null}
      {action ? (
        <StateButton className="mt-1.5" onClick={action.onClick}>
          {action.label}
        </StateButton>
      ) : null}
    </div>
  );
}

/**
 * Error. Replaces only the part that failed; the rest of the page stays usable.
 * `title` says what did not load or save, `line` says whether anything was lost
 * and the one thing to do, and the reference lets support find the log entry.
 */
export function ErrorBlock({
  title,
  line,
  reference,
  onRetry,
  retrying = false,
  className,
}: {
  title: string;
  line: string;
  /** The server's code; shown as "Reference WF-xxxx". */
  reference?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col gap-2 border border-wds-border border-t-[3px] border-t-wds-error-fg bg-wds-surface px-6 py-[22px]', className)}
    >
      <h3 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{title}</h3>
      <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-neutral-700">{line}</p>
      {reference ? (
        <p className="m-0 font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">
          {STATES_FIXED.referencePrefix} {formatReference(reference)}
        </p>
      ) : null}
      {onRetry ? (
        <div className="flex gap-2.5">
          <StateButton primary onClick={onRetry} disabled={retrying} aria-disabled={retrying}>
            {retrying ? 'Trying…' : STATES_FIXED.tryAgain}
          </StateButton>
        </div>
      ) : null}
    </div>
  );
}

/** Offline strip, at the top of a phone screen: "No signal. [What still works.]" */
export function OfflineStrip({ stillWorks, className }: { stillWorks: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('border border-wds-warning-border bg-wds-warning-bg px-4 py-3', className)}>
      <p className="m-0 font-wds-sans text-[13px] leading-[19px] text-wds-warning-fg">
        {STATES_FIXED.offlineStrip} {stillWorks}
      </p>
    </div>
  );
}

/** Marker on anything waiting to send: a caramel left edge and "SAVED ON THIS PHONE". */
export function SavedOnPhoneMarker({ what, className }: { what: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-[3px] border border-wds-border border-l-4 border-l-wds-caramel-500 bg-wds-surface px-3.5 py-3', className)}>
      <span className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-warning-fg">{STATES_FIXED.savedOnPhone}</span>
      <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">{what}</span>
    </div>
  );
}
