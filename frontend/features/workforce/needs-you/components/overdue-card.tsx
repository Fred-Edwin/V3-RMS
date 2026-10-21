'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { Callout, DrawerSection, ErrorBlock, FOCUS_RING, ListSkeleton, MOTION, PRESSED, WorkforceDrawer } from '../../_shared';
import { kindLabel } from '../lib/needs-you-words';
import { useRemind } from '../hooks/use-remind';
import type { OverdueState } from '../hooks/use-overdue';
import type { OverdueRow } from '../types/needs-you-types';

const SUBLINE = 'On your Home. Anything that has waited more than 3 days, anywhere in the company. You only send reminders; leave is the one exception, when HR has not answered.';

const dayWords = (days: number): string => `${days} ${days === 1 ? 'day' : 'days'}`;
const PRIMARY = cn('inline-flex h-10 items-center justify-center bg-wds-primary px-5 font-wds-sans text-[14px] font-medium leading-4 text-wds-primary-fg disabled:opacity-60', MOTION, FOCUS_RING, PRESSED);

/**
 * The Director's Overdue card (Paper Chapter 15 step 4): KIND, REQUEST, WAITING ON, FOR. Choosing a row opens a panel with one
 * button, Send a reminder; it is logged and goes to the person the item waits on. A leave row shows Review instead (the one exception).
 * Not drawn when nothing is overdue.
 */
export function OverdueCard({ state }: { state: OverdueState }) {
  const [chosen, setChosen] = React.useState<string | null>(null);
  const rows = state.data?.rows ?? [];
  const row = rows.find((r) => r.id === chosen) ?? null;

  if (state.status === 'loading') return <ListSkeleton rows={3} label="Loading overdue" />;
  if (state.status === 'error' && !state.data) return <ErrorBlock title="We could not load the overdue list." line="Nothing was changed." onRetry={state.reload} />;
  if (rows.length === 0) return null;

  return (
    <section aria-label="Overdue" className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-wds-sans text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-wds-text-ink">Overdue · {rows.length}</h2>
        <p className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{SUBLINE}</p>
      </div>
      <Table look="workforce" aria-label="Overdue">
        <TableHeader>
          <TableRow className="h-9">
            <TableHead className="w-[110px]">Kind</TableHead>
            <TableHead>Request</TableHead>
            <TableHead className="w-[200px]">Waiting on</TableHead>
            <TableHead className="w-[90px]">For</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} size="compact" data-state={r.id === chosen ? 'selected' : undefined} className="h-12">
              <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{kindLabel(r.kind)}</TableCell>
              <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                <button type="button" onClick={() => setChosen(r.id)} aria-label={`${kindLabel(r.kind)}, ${r.text}, waiting ${dayWords(r.waitingDays)}`} className={cn('text-left', r.id === chosen && 'font-semibold', FOCUS_RING)}>
                  {r.text}
                </button>
              </TableCell>
              <TableCell className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{r.waitingOn.role}</TableCell>
              <TableCell className="font-wds-mono text-[11px] leading-[14px] text-wds-error-fg">{dayWords(r.waitingDays)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        Showing {rows.length} of {state.data?.total ?? rows.length} · across the company
      </p>
      <OverduePanel row={row} onClose={() => setChosen(null)} onSent={state.reload} />
    </section>
  );
}

function OverduePanel({ row, onClose, onSent }: { row: OverdueRow | null; onClose: () => void; onSent: () => void }) {
  const remind = useRemind(onSent);
  const leave = row?.kind === 'leave';
  return (
    <WorkforceDrawer open={row !== null} onOpenChange={(open) => !open && onClose()} title={row ? `${kindLabel(row.kind)} · waiting ${dayWords(row.waitingDays)}` : 'Overdue'} subtitle={row?.waitingOn.siteName ?? undefined}>
      {row ? (
        <>
          <p className="m-0 font-wds-sans text-[15px] leading-6 text-wds-text-ink">{row.text}</p>
          <p className="m-0 font-wds-sans text-[13px] leading-5 text-wds-text-secondary">It waits for the {row.waitingOn.role}{row.waitingOn.siteName ? ` of ${row.waitingOn.siteName}` : ''}, who has not answered.</p>
          <Callout tone="neutral">{leave ? 'HR has not answered in 3 days. Leave is the one thing you may decide.' : 'You do not decide this, you remind.'}</Callout>
          {remind.error ? <div role="alert"><Callout tone="error">{remind.error}</Callout></div> : null}
          <DrawerSection caption={leave ? 'WHAT YOU CAN DO' : 'REMINDER'}>
            {leave ? (
              <Link href="/app/workforce/leave" className={PRIMARY}>Review</Link>
            ) : row.canRemind ? (
              <>
                <button type="button" className={PRIMARY} disabled={remind.busy || row.remindedToday || remind.sent.has(row.id)} onClick={() => void remind.send(row.id)}>
                  {row.remindedToday || remind.sent.has(row.id) ? 'Reminder sent today' : remind.busy ? 'Sending…' : 'Send a reminder'}
                </button>
                <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">The reminder is logged and goes to the {row.waitingOn.role}.</p>
              </>
            ) : null}
          </DrawerSection>
        </>
      ) : null}
    </WorkforceDrawer>
  );
}
