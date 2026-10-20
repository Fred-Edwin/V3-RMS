'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { PdfViewer, PhoneButton, PhoneScreen, useRemote } from '../../../_shared';
import { LoadingBlock, ProblemBlock } from '../../_shared/components/problem-block';
import { canShareFiles, useLetterAction } from '../../_shared/hooks/use-letter-action';
import { conductFiles, conductReads } from '../../_shared/services/conduct-services';

type Version = 1 | 2 | 3 | 'latest';
const versionOf = (value: string | null): Version => (value === '1' ? 1 : value === '2' ? 2 : value === '3' ? 3 : 'latest');

/**
 * The notice as the signed A4 file in the phone Document view (spec S10; the shared view of Chapter 10 step 6): the server's PDF fitted to
 * the width with pinch to zoom and double tap to fit, and Download PDF and Share under it. A verbal note has no letter, so its record is
 * shown as a line and there is nothing to download. `?v=1` opens "as issued" for the roles the server allows. A failed download says so and
 * the page stays; Share is absent where the browser cannot hand a PDF to the share sheet.
 */
export function ConductDocumentScreen({ id, back }: { id: string; back: string }) {
  const router = useRouter();
  const version = versionOf(useSearchParams().get('v'));
  const [counter, setCounter] = React.useState('');
  const letter = useLetterAction();
  const notice = useRemote(() => conductReads.detail(id), `conduct-doc:${id}`);
  const detail = notice.data;
  const number = detail?.number ?? null;
  const name = number ? `Warning notice ${number}${version === 1 ? ', as issued' : ''}` : 'Warning notice';
  const load = React.useCallback(async () => (await conductFiles.document(id, version, true)).blob, [id, version]);
  const file = () => conductFiles.document(id, version, false);

  return (
    <PhoneScreen
      screen="Conduct"
      kicker={`CONDUCT${number ? ` · ${number}` : ''}`}
      back={back}
      desktopTitle={number ? `Notice ${number}` : 'Notice'}
      bleed={Boolean(detail && detail.level !== 'VERBAL_NOTE')}
      trailing={counter ? <span className="font-wds-mono text-[11px] leading-[14px] tracking-[0.08em] text-wds-neutral-300">{counter}</span> : undefined}
    >
      {notice.status === 'loading' ? <LoadingBlock label="Loading the notice" rows={2} /> : null}
      {notice.status === 'error' && !detail ? <ProblemBlock error={notice.error} what="this notice" onRetry={notice.reload} /> : null}
      {detail && detail.level === 'VERBAL_NOTE' ? (
        <div className="flex flex-col gap-4">
          <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">A verbal note has no letter. It is a record on the file.</p>
          {detail.verbalLine ? <p className="m-0 border border-wds-border bg-wds-neutral-100 p-4 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{detail.verbalLine}</p> : null}
          <PhoneButton kind="outlined" onClick={() => router.push(back)}>
            Back
          </PhoneButton>
        </div>
      ) : null}
      {detail && detail.level !== 'VERBAL_NOTE' ? (
        <PdfViewer
          name={name}
          load={load}
          onPage={(page, pages) => setCounter(`${page} / ${pages}`)}
          footer={
            <div className="flex flex-col gap-2">
              {letter.failed ? (
                <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
                  {letter.failed}
                </p>
              ) : null}
              <div className="flex gap-2.5">
                <PhoneButton className="min-w-0 flex-1" disabled={letter.busy} onClick={() => letter.download(file, 'The notice could not be downloaded. Try again.')}>
                  {letter.busy ? 'Preparing your notice' : 'Download PDF'}
                </PhoneButton>
                {canShareFiles() ? (
                  <PhoneButton kind="outlined" className="w-auto shrink-0 px-5" disabled={letter.busy} onClick={() => letter.share(file,'The notice could not be shared. Try again.', name)}>
                    Share
                  </PhoneButton>
                ) : null}
              </div>
            </div>
          }
        />
      ) : null}
    </PhoneScreen>
  );
}
