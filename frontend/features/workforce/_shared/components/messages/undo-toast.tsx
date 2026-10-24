'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED, UNDO_WINDOW_MS, onHover } from '../../lib/style/interaction';
import { undoSecondsLeft } from '../../lib/data/undo';

/**
 * Undo toast (rule 03). Shown after an answer: "Approved Lucy's overtime. Undo",
 * with the seconds left and a thin line that drains over the 30 seconds. It does
 * not move or hide when you hover it, and it is a polite live region, so a
 * screen reader hears it without losing the place.
 *
 * The screen owns what Undo does (it calls the undo endpoint) and what happens at
 * the end (`onExpire`: the answer stands). The toast only keeps time.
 *
 * Time is read from `Date.now()` at the moment of showing; for a server-timed
 * window pass `startedAt` from the server.
 */
export function UndoToast({
  message,
  undoLabel = 'Undo',
  onUndo,
  onExpire,
  startedAt,
  windowMs = UNDO_WINDOW_MS,
  className,
}: {
  message: string;
  undoLabel?: string;
  onUndo: () => void;
  onExpire: () => void;
  startedAt?: number;
  windowMs?: number;
  className?: string;
}) {
  const [start] = React.useState(() => startedAt ?? Date.now());
  const [now, setNow] = React.useState(start);
  const expireRef = React.useRef(onExpire);
  expireRef.current = onExpire;

  React.useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    const done = window.setTimeout(() => expireRef.current(), Math.max(0, start + windowMs - Date.now()));
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, [start, windowMs]);

  const left = undoSecondsLeft(start, now, windowMs);
  const [draining, setDraining] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setDraining(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative flex w-[420px] max-w-[calc(100vw-32px)] items-center gap-4 overflow-hidden border border-wds-border bg-wds-surface py-3 pl-4 pr-3 shadow-wds-md',
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none',
        className
      )}
    >
      <span aria-hidden className="h-6 w-[3px] shrink-0 bg-wds-success-fg" />
      <p className="m-0 min-w-0 flex-1 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{message}</p>
      <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary" aria-hidden>
        {left} s
      </span>
      <button
        type="button"
        onClick={onUndo}
        className={cn(
          'inline-flex h-8 items-center border border-wds-border-strong px-3 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink',
          MOTION,
          FOCUS_RING,
          PRESSED,
          onHover('bg-wds-neutral-50')
        )}
      >
        {undoLabel}
        <span className="sr-only">. {left} seconds left</span>
      </button>
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-wds-neutral-300 ease-linear motion-reduce:hidden"
        style={{ transform: draining ? 'scaleX(0)' : 'scaleX(1)', transitionProperty: 'transform', transitionDuration: `${windowMs}ms` }}
      />
    </div>
  );
}
