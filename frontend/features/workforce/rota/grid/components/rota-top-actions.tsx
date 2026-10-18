'use client';

import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/cn';

import { DialogButton, FOCUS_RING, MOTION, onHover } from '../../../_shared';
import type { SaveStatus } from '../../_shared/hooks/use-rota-editor';
import { statusLine } from '../../_shared/lib/rota-copy';

/** The save status, "Saved just now": ages every 30 seconds, and says so plainly when a save failed. A live region, so it is heard. */
export function SaveStatusText({ status }: { status: SaveStatus }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const line = statusLine(status, status.kind === 'saved' ? Math.max(now, status.at) : now);
  return (
    <span role="status" aria-live="polite" className={cn('font-wds-sans text-[13px] leading-4', line.tone === 'error' ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>
      {line.text}
    </span>
  );
}

/** The top bar's right side on the Rota: the status, Print, and "Start from last week" (only for someone who may change the rota). */
export function RotaTopActions({ status, printHref, onStartFromLastWeek }: { status: SaveStatus; printHref: string; onStartFromLastWeek?: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <SaveStatusText status={status} />
      <Link
        href={printHref}
        target="_blank"
        rel="noopener"
        className={cn('inline-flex h-8 items-center border border-wds-border-strong px-3.5 font-wds-sans text-[13px] leading-4 text-wds-text-ink', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'))}
      >
        Print
      </Link>
      {onStartFromLastWeek ? (
        <DialogButton kind="cancel" onClick={onStartFromLastWeek} className="h-8">
          Start from last week
        </DialogButton>
      ) : null}
    </div>
  );
}
