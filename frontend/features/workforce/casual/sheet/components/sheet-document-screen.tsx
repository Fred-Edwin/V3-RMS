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
    <PhoneScreen screen={CASUAL_COPY.screen} kicker={preview ? 'CASUAL PAY SHEET · PREVIEW' : 'CASUAL PAY SHEET'} back={preview ? '/app/workforce/casuals' : `/app/workforce/casuals/${id}`} desktopTitle="Casual pay sheet">
      <div className="flex h-[72dvh] min-h-[420px] flex-col">
        <PdfViewer
          name={preview ? 'Casual pay sheet, draft' : 'Casual pay sheet'}
          load={async () => (await load()).blob}
          footer={
            preview ? (
              <div className="flex w-full flex-col gap-1.5">
                <PhoneButton kind="outlined" size="sm" onClick={() => router.back()}>
                  Back to edit
                </PhoneButton>
                <button type="button" disabled className="h-[46px] w-full bg-wds-border-strong font-wds-sans text-[14px] font-semibold text-wds-text-secondary">
                  Print after approval
                </button>
                <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">The head checks the sheet here before it goes to the Branch Manager. After approval it can be printed and the workers sign.</p>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-2.5 min-[400px]:flex-row">
                <PhoneButton size="sm" disabled={busy !== null} onClick={() => void run('share')}>
                  {busy === 'share' ? 'Preparing…' : 'Print or share'}
                </PhoneButton>
                <PhoneButton kind="outlined" size="sm" disabled={busy !== null} onClick={() => void run('save')}>
                  {busy === 'save' ? 'Preparing…' : 'Download PDF'}
                </PhoneButton>
              </div>
            )
          }
        />
      </div>
      {failed ? (
        <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {failed}
        </p>
      ) : null}
    </PhoneScreen>
  );
}
