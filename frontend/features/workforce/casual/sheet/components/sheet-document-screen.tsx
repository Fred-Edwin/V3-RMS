'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { PdfViewer, PhoneButton, PhoneScreen } from '../../../_shared';
import { saveBlobTo } from '../../_shared/lib/save-file';
import { CASUAL_COPY } from '../../_shared/lib/casual-words';
import { casualReads } from '../../_shared/services/casual-services';
import type { FileBlob } from '../../_shared/types/casual-types';

/**
 * The pay sheet as the A4 file (spec S9, S10). `?preview=1` is the draft the head checks before sending: "CPS-draft", never stored,
 * with a disabled "Print after approval" that says why. An approved sheet offers Print or share and Download PDF.
 */
export function SheetDocumentScreen({ id }: { id: string }) {
  const router = useRouter();
  const preview = useSearchParams().get('preview') === '1';
  const [busy, setBusy] = React.useState<'save' | 'share' | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [counter, setCounter] = React.useState('');
  const load = React.useCallback(() => (preview ? casualReads.preview(id) : casualReads.document(id)), [id, preview]);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const run = async (kind: 'save' | 'share') => {
    setBusy(kind);
    setFailed(null);
    try {
      const file: FileBlob = await load();
      if (kind === 'save') saveBlobTo(file.blob, file.filename);
      else if (canShare) await navigator.share({ files: [new File([file.blob], file.filename, { type: 'application/pdf' })], title: 'Casual pay sheet' });
      else window.open(URL.createObjectURL(file.blob), '_blank');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed('Could not download. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <PhoneScreen screen={CASUAL_COPY.screen} kicker={preview ? 'CASUAL PAY SHEET · PREVIEW' : 'CASUAL PAY SHEET'} back={preview ? '/app/workforce/casuals' : `/app/workforce/casuals/${id}`} desktopTitle="Casual pay sheet" bleed trailing={counter ? <span className="font-wds-mono text-[11px] leading-[14px] tracking-[0.08em] text-wds-neutral-300">{counter}</span> : undefined}>
      <PdfViewer
        name={preview ? 'Casual pay sheet, draft' : 'Casual pay sheet'}
        load={async () => (await load()).blob}
        onPage={(page, pages) => setCounter(`${page} / ${pages}`)}
        footer={
          preview ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2.5">
                <div className="min-w-0 flex-1">
                  <PhoneButton kind="outlined" size="sm" onClick={() => router.back()}>
                    Back to edit
                  </PhoneButton>
                </div>
                <button type="button" disabled className="h-[46px] min-w-0 flex-1 bg-wds-border-strong font-wds-sans text-[14px] font-semibold text-wds-text-secondary">
                  Print after approval
                </button>
              </div>
              <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">The head checks the sheet here before it goes to the Branch Manager. After approval it can be printed and the workers sign.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2.5">
                <div className="min-w-0 flex-1">
                  <PhoneButton size="sm" disabled={busy !== null} onClick={() => void run('share')}>
                    {busy === 'share' ? 'Preparing…' : 'Print or share'}
                  </PhoneButton>
                </div>
                <div className="min-w-0 flex-1">
                  <PhoneButton kind="outlined" size="sm" disabled={busy !== null} onClick={() => void run('save')}>
                    {busy === 'save' ? 'Preparing…' : 'Download PDF'}
                  </PhoneButton>
                </div>
              </div>
              {failed ? (
                <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
                  {failed}
                </p>
              ) : null}
            </div>
          )
        }
      />
    </PhoneScreen>
  );
}
