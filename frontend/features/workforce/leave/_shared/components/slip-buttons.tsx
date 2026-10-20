'use client';

import * as React from 'react';

import { PhoneButton } from '../../../_shared';
import { canShareFiles, useFileAction } from '../hooks/use-file-action';
import { slipFile } from '../services/leave-services';

const FAILED = 'The download did not finish. Try again.';
const fileName = (code: string): string => `Leave-slip-${code}.pdf`;

const downloadIcon = (
  <svg aria-hidden width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M7 2v7M4 6.5l3 3 3-3M2.5 12h9" />
  </svg>
);

/** "Download PDF" (or another label) for one slip: "Preparing…" while it goes, one line of words if it fails. */
export function DownloadSlipButton({ id, code, kind = 'outlined', label = 'Download PDF', disabled, className, onDone }: { id: string; code: string; kind?: 'primary' | 'outlined'; label?: string; disabled?: boolean; className?: string; onDone?: () => void }) {
  const action = useFileAction();
  return (
    <div className={className}>
      <PhoneButton
        kind={kind}
        size="sm"
        disabled={disabled || action.busy}
        aria-busy={action.busy}
        onClick={async () => {
          await action.download(() => slipFile(id, fileName(code)), FAILED);
          onDone?.();
        }}
      >
        {action.busy ? 'Preparing…' : <span className="inline-flex items-center gap-2">{downloadIcon}{label}</span>}
      </PhoneButton>
      {action.failed ? <p role="alert" className="mt-1.5 text-center font-wds-sans text-[12px] leading-4 text-wds-error-fg">{action.failed}</p> : null}
    </div>
  );
}

/** Share hands the slip to the phone's share sheet. Hidden where the browser has none. */
export function ShareSlipButton({ id, code, disabled, className }: { id: string; code: string; disabled?: boolean; className?: string }) {
  const action = useFileAction();
  const [can, setCan] = React.useState(false);
  React.useEffect(() => setCan(canShareFiles()), []);
  if (!can) return null;
  return (
    <div className={className}>
      <PhoneButton kind="outlined" size="sm" disabled={disabled || action.busy} onClick={() => action.share(() => slipFile(id, fileName(code)), FAILED, `Leave slip ${code}`)}>
        {action.busy ? 'Preparing…' : (
          <span className="inline-flex items-center gap-2">
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 10V2M5 5l3-3 3 3M3 8v5h10V8" /></svg>
            Share
          </span>
        )}
      </PhoneButton>
      {action.failed ? <p role="alert" className="mt-1.5 text-center font-wds-sans text-[12px] leading-4 text-wds-error-fg">{action.failed}</p> : null}
    </div>
  );
}
