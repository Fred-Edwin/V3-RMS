'use client';

import * as React from 'react';

import { Callout, ErrorBlock, KeyValueRows, ListSkeleton, PhoneButton } from '../../../_shared';
import { useEntryFlow } from '../hooks/use-entry-flow';
import { RECORD_COPY } from '../lib/my-record-words';
import type { RecordItem } from '../types/my-record-types';
import { NotMeDialog } from './not-me-dialog';

/**
 * One entry opened on a phone (Paper 14.2, right phone): the card's rows, and where it makes sense the two answers. "That was me" says
 * thank you; "This wasn't me" asks first (it signs out every phone), then hands over to the Security password page through `onSignedOut`.
 * Opening an entry marks nothing. An entry already answered shows what was said and no buttons. A desktop uses `RecordDetail` instead.
 */
export function RecordEntry({ item, onBack, onAnswered, onSignedOut }: { item: RecordItem; onBack: () => void; onAnswered: () => void; onSignedOut: () => void }) {
  const flow = useEntryFlow(item.id, onAnswered, onSignedOut);
  const { card, answer, thanks } = flow;
  const backRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => backRef.current?.focus(), []);

  let body: React.ReactNode;
  if (card.status === 'loading') body = <ListSkeleton rows={3} columns={[80, 'fill']} label="Loading the entry" />;
  else if (card.status === 'error' || !card.data) {
    const gone = card.status === 'error' && card.error.status === 404;
    body = <ErrorBlock title={gone ? 'We could not find that entry.' : RECORD_COPY.error} line={gone ? 'It may have been moved.' : RECORD_COPY.errorLine} onRetry={gone ? undefined : card.reload} reference={gone || card.status !== 'error' ? undefined : card.error.code} />;
  } else {
    const c = card.data;
    body = (
      <>
        <section aria-labelledby="record-entry-title" className="flex flex-col gap-3 border border-wds-border bg-wds-surface px-4 py-4">
          <h2 id="record-entry-title" className="m-0 font-wds-sans text-[17px] font-semibold leading-[22px] text-wds-text-ink">{c.title}</h2>
          <KeyValueRows rows={c.rows.map((r) => ({ label: r.label, value: r.value, mono: /^(Opened|When)$/.test(r.label) }))} aria-label="About this entry" />
        </section>
        {thanks ? <Callout tone="success" role="status">{RECORD_COPY.thanks}</Callout> : null}
        {c.answered === 'ME' && !thanks ? <Callout tone="neutral" role="status">{RECORD_COPY.answeredMe}</Callout> : null}
        {c.answered === 'NOT_ME' ? <Callout tone="warning" role="status">{RECORD_COPY.answeredNotMe}</Callout> : null}
        {answer.error ? <Callout tone="error" role="alert">{answer.error}</Callout> : null}
        {c.needsAnswer && !thanks ? (
          <div className="flex flex-col gap-2.5">
            <PhoneButton kind="primary" disabled={answer.busy} onClick={() => void flow.meDone()}>{RECORD_COPY.meButton}</PhoneButton>
            <PhoneButton kind="outlined" disabled={answer.busy} onClick={() => flow.setConfirming(true)} className="!border-wds-error-fg !text-wds-error-fg">{RECORD_COPY.notMeButton}</PhoneButton>
          </div>
        ) : null}
        {c.needsAnswer && c.note ? <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">{c.note}</p> : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button ref={backRef} type="button" onClick={onBack} className="self-start py-2 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-wds-ring">
        ‹ {item.title}
      </button>
      {body}
      <NotMeDialog open={flow.confirming} busy={answer.busy} onClose={() => flow.setConfirming(false)} onConfirm={() => void flow.notMe()} />
    </div>
  );
}
