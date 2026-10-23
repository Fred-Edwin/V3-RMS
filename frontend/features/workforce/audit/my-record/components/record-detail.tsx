'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { Callout, ErrorBlock, KeyValueRows, ListSkeleton } from '../../../_shared';
import { useEntryFlow } from '../hooks/use-entry-flow';
import { RECORD_COPY } from '../lib/my-record-words';
import { NotMeDialog } from './not-me-dialog';

/**
 * The entry beside the table on a desktop (frame 13.12): its title and rows, then "That was me" (brown) and "This wasn't me" (red
 * outline) where the entry asks for an answer, with the line about what the second one does. Opening an entry writes nothing.
 */
export function RecordDetail({ id, onAnswered, onSignedOut }: { id: string; onAnswered: () => void; onSignedOut: () => void }) {
  const flow = useEntryFlow(id, onAnswered, onSignedOut);
  const { card, answer, thanks } = flow;

  if (card.status === 'loading') return <ListSkeleton rows={3} columns={[80, 'fill']} label="Loading the entry" />;
  if (card.status === 'error' || !card.data) {
    const gone = card.status === 'error' && card.error.status === 404;
    return <ErrorBlock title={gone ? 'We could not find that entry.' : RECORD_COPY.error} line={gone ? 'It may have been moved.' : RECORD_COPY.errorLine} onRetry={gone ? undefined : card.reload} reference={gone || card.status !== 'error' ? undefined : card.error.code} />;
  }
  const c = card.data;
  return (
    <div className="flex flex-col gap-3.5">
      <section aria-labelledby="record-detail-title" className="flex flex-col gap-3 border border-wds-border bg-wds-surface px-5 py-5">
        <h2 id="record-detail-title" className="m-0 font-wds-sans text-[20px] font-semibold leading-[26px] tracking-[-0.02em] text-wds-text-ink">{c.title}</h2>
        <KeyValueRows rows={c.rows.map((r) => ({ label: r.label, value: r.value, mono: /^(Opened|When)$/.test(r.label) }))} aria-label="About this entry" />
      </section>
      {thanks ? <Callout tone="success" role="status">{RECORD_COPY.thanks}</Callout> : null}
      {c.answered === 'ME' && !thanks ? <Callout tone="neutral" role="status">{RECORD_COPY.answeredMe}</Callout> : null}
      {c.answered === 'NOT_ME' ? <Callout tone="warning" role="status">{RECORD_COPY.answeredNotMe}</Callout> : null}
      {answer.error ? <Callout tone="error" role="alert">{answer.error}</Callout> : null}
      {c.needsAnswer && !thanks ? (
        <>
          <Button type="button" className="h-11 w-full" disabled={answer.busy} onClick={() => void flow.meDone()}>{RECORD_COPY.meButton}</Button>
          <button
            type="button"
            disabled={answer.busy}
            onClick={() => flow.setConfirming(true)}
            className="h-11 w-full border border-wds-error-fg bg-wds-surface font-wds-sans text-[14px] font-medium leading-[18px] text-wds-error-fg outline-none hover:bg-wds-error-bg focus-visible:shadow-wds-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {RECORD_COPY.notMeButton}
          </button>
          <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">{c.note ?? RECORD_COPY.notMeNote}</p>
        </>
      ) : null}
      <NotMeDialog open={flow.confirming} busy={answer.busy} onClose={() => flow.setConfirming(false)} onConfirm={() => void flow.notMe()} />
    </div>
  );
}
