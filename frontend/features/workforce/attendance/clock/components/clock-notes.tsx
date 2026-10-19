'use client';

import * as React from 'react';
import Link from 'next/link';

import { Callout, PhoneButton, formatMmSs } from '../../../_shared';
import { dateOf, hmOf } from '../../_shared/lib/nairobi-clock';
import type { MyEntry, MyNotice } from '../../_shared/types/attendance-types';
import type { QueuedTap } from '../lib/offline-queue';
import { CLOCK_COPY } from '../lib/clock-copy';

/** The small notes around the clock card (Paper Chapter 6 steps 1, 2 and 5). Each draws nothing unless it has something to say. */

/** "Clocked in at 05:58 · Undo 1:52": the two-minute window, counted on the server's clock. */
export function UndoNote({ entry, nowMs, busy, onUndo }: { entry: MyEntry; nowMs: number; busy: boolean; onUndo: () => void }) {
  const undo = entry.undo;
  if (!undo) return null;
  const left = (Date.parse(undo.until) - nowMs) / 1000;
  if (left <= 0) return null;
  const at = hmOf(undo.kind === 'IN' ? (entry.clockedInAt ?? undo.until) : (entry.clockedOutAt ?? undo.until));
  return (
    <Callout
      tone="success"
      title={CLOCK_COPY.undoTitle(undo.kind, at)}
      actionAt="end"
      action={
        <PhoneButton kind="outlined" size="sm" className="h-11 w-auto px-4 text-[13px]" disabled={busy} onClick={onUndo}>
          Undo · {formatMmSs(left)}
        </PhoneButton>
      }
    >
      {CLOCK_COPY.undoNote}
    </Callout>
  );
}

export function HeadsUpNote({ entry, minutes }: { entry: MyEntry; minutes: number }) {
  return (
    <Callout tone="warning" variant="bar" title={CLOCK_COPY.headsUpTitle(entry.endTime)}>
      {CLOCK_COPY.headsUpBody(minutes)}
    </Callout>
  );
}

/** Taps kept on this phone because there was no signal (Paper step 5, left). */
export function WaitingToSend({ queued, site, notSaved }: { queued: readonly QueuedTap[]; site: string; notSaved: boolean }) {
  if (notSaved) return <Callout tone="error">{CLOCK_COPY.notSaved}</Callout>;
  const first = queued[0];
  if (!first) return null;
  return (
    <div className="flex flex-col gap-3">
      <Callout tone="warning" title={CLOCK_COPY.noSignalTitle(first.kind, hmOf(first.deviceAt))}>
        {CLOCK_COPY.noSignalBody}
      </Callout>
      <div className="flex flex-col gap-0.5 border border-wds-border bg-wds-surface px-[18px] py-3.5">
        <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">Waiting to send · {queued.length}</span>
        {queued.map((t) => (
          <span key={t.body.clientEventId} className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
            Clock {t.kind === 'IN' ? 'in' : 'out'} · {hmOf(t.deviceAt)} · {site}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The way into Report a problem for a day (Timesheets, slice 4a): "Clocked out by mistake?" and "I worked longer" both end here. */
export function ReportProblemLink({ date, className, children }: { date: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={`/app/workforce/my-time/report?date=${date}`} className={className ?? 'font-wds-sans text-[13px] font-medium text-wds-primary underline underline-offset-2'}>
      {children}
    </Link>
  );
}

/** A shift the phone closed (Paper step 5, right). "I worked longer" is a Report a problem. */
export function ClosedNotices({ notices }: { notices: readonly MyNotice[] }) {
  return (
    <>
      {notices.map((n) => (
        <Callout key={n.entryId} tone="warning" variant="bar" title={CLOCK_COPY.closedTitle(hmOf(n.closedAt))} action={<ReportProblemLink date={dateOf(n.closedAt)}>Report a problem</ReportProblemLink>}>
          {CLOCK_COPY.closedBody}
        </Callout>
      ))}
    </>
  );
}
