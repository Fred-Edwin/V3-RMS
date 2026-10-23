'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { Callout, CircleStepper, useRemote } from '../../../_shared';
import { LoadingBlock, ProblemBlock } from '../../_shared/components/problem-block';
import { useLetterAction } from '../../_shared/hooks/use-letter-action';
import { useOnline } from '../../_shared/hooks/use-online';
import { appealHref, deskNoticeHref, signHref, staffDocumentHref, staffNoticeHref } from '../../_shared/lib/routes';
import { conductFiles, conductReads } from '../../_shared/services/conduct-services';
import { appealLine, decisionLine, fromLine, primaryAction, toCircleSteps } from '../lib/notice-view';

/**
 * One notice beside the list on a desktop (frame 13.11): its title, who gave it and why, the circle stepper from the server, then
 * Download signed notice (or Sign that I received it while it waits) and Appeal this notice in red outline, and "Read the full letter".
 * The same actions as the phone page, the same server wording. A reader who is not the subject is sent to the desk view of the notice.
 */
export function NoticePanel({ id }: { id: string }) {
  const router = useRouter();
  const online = useOnline();
  const letter = useLetterAction();
  const notice = useRemote(() => conductReads.detail(id), `conduct-notice:${id}`);
  const detail = notice.data;
  React.useEffect(() => {
    if (detail && detail.view === 'DESK') router.replace(deskNoticeHref(id));
  }, [detail, id, router]);

  if (!detail || detail.view === 'DESK') {
    return notice.status === 'error' ? <ProblemBlock error={notice.error} what="this notice" onRetry={notice.reload} /> : <LoadingBlock label="Loading the notice" />;
  }
  const primary = primaryAction(detail);
  const tail = appealLine(detail);
  const decision = decisionLine(detail);
  const steps = toCircleSteps(detail).map((s) =>
    s.key === 'replaced' && detail.replacedById
      ? { ...s, action: <Link href={staffNoticeHref(detail.replacedById)} className="mt-0.5 font-wds-sans text-[12px] font-medium leading-4 text-wds-primary underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-wds-ring">See the new notice</Link> }
      : s
  );
  const download = () => letter.download(() => conductFiles.document(detail.id, 'latest', false), 'The notice could not be downloaded. Try again.');
  return (
    <article aria-label="Notice detail" className="flex flex-col gap-4 border border-wds-border bg-wds-surface p-6">
      <header className="flex flex-col gap-1">
        <h2 className="m-0 font-wds-sans text-[20px] font-semibold leading-[26px] tracking-[-0.02em] text-wds-text-ink">{detail.title}</h2>
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
          {fromLine(detail)}
          {detail.factsLine || detail.verbalLine ? ` · ${detail.verbalLine ?? detail.factsLine}` : ''}
        </p>
      </header>
      <CircleStepper steps={steps} label="Where this notice is" />
      {decision ? (
        <Callout tone="neutral" title={decision.title}>
          <span className="block">Reason: {decision.reason}</span>
          <span className="mt-1 block text-wds-text-secondary">{decision.by}</span>
        </Callout>
      ) : null}
      {letter.failed ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{letter.failed}</p> : null}
      {!online ? <p role="status" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">No signal. Your notice needs a connection to open.</p> : null}
      <div className="flex flex-wrap items-center gap-2.5">
        {primary === 'sign' ? <Button type="button" size="dialog" className="px-5" disabled={!online} onClick={() => router.push(signHref(detail.id))}>Sign that I received it</Button> : null}
        {primary === 'download' ? <Button type="button" size="dialog" className="px-5" disabled={letter.busy} onClick={download}>{letter.busy ? 'Preparing your notice' : 'Download signed notice'}</Button> : null}
        {detail.actions.canAppeal ? (
          <button
            type="button"
            onClick={() => router.push(appealHref(detail.id))}
            className="h-[38px] border border-wds-error-fg bg-wds-surface px-5 font-wds-sans text-[14px] font-medium leading-[18px] text-wds-error-fg outline-none hover:bg-wds-error-bg focus-visible:shadow-wds-ring"
          >
            {primary === 'sign' ? 'I do not agree · appeal to HR' : 'Appeal this notice'}
          </button>
        ) : null}
      </div>
      {detail.actions.canDownload ? (
        <Link href={staffDocumentHref(detail.id)} className="self-start font-wds-sans text-[14px] font-medium leading-[18px] text-[#A8680A] underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:shadow-wds-ring">
          Read the full letter
        </Link>
      ) : null}
      {tail ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{tail}</p> : null}
    </article>
  );
}
