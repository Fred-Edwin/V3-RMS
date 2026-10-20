'use client';

import * as React from 'react';

import { PhoneButton } from '../../../_shared';
import { canShareFiles, useFileAction } from '../hooks/use-file-action';
import { PAYSLIP_COPY } from '../lib/payslip-copy';
import type { FileBlob } from '../types/payslip-types';

/** Share hands the stored PDF to the phone's share sheet. Hidden where the browser has none (PD32); never a link outside the app. */
export function SharePdfButton({ load, title, className }: { load: () => Promise<FileBlob>; title: string; className?: string }) {
  const action = useFileAction();
  const [can, setCan] = React.useState(false);
  React.useEffect(() => setCan(canShareFiles()), []);
  if (!can) return null;
  return (
    <div className={className}>
      <PhoneButton kind="outlined" size="sm" disabled={action.busy} onClick={() => action.share(load, PAYSLIP_COPY.downloadFailed, title)}>
        {action.busy ? 'Preparing…' : (
          <span className="inline-flex items-center gap-2">
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M8 10V2M5 5l3-3 3 3M3 8v5h10V8" />
            </svg>
            Share
          </span>
        )}
      </PhoneButton>
      {action.failed ? (
        <p role="alert" className="mt-1.5 text-center font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {action.failed}
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Download PDF" for one stored file. "Preparing…" while it goes (a second line after 10 seconds), and on failure one line of words with
 * the button usable again. `kind` follows the screen: the brown button is the screen's one primary.
 */
export function DownloadPdfButton({ load, kind = 'outlined', label = 'Download PDF', failure = PAYSLIP_COPY.downloadFailed, className }: { load: () => Promise<FileBlob>; kind?: 'primary' | 'outlined'; label?: string; failure?: string; className?: string }) {
  const action = useFileAction();
  return (
    <div className={className}>
      <PhoneButton kind={kind} size="sm" disabled={action.busy} aria-busy={action.busy} onClick={() => action.download(load, failure)}>
        {action.busy ? (action.slow ? 'Still preparing…' : 'Preparing…') : (
          <span className="inline-flex items-center gap-2">
            <svg aria-hidden width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M7 2v7M4 6.5l3 3 3-3M2.5 12h9" />
            </svg>
            {label}
          </span>
        )}
      </PhoneButton>
      {action.failed ? (
        <p role="alert" className="mt-1.5 text-center font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {action.failed}
        </p>
      ) : null}
    </div>
  );
}
