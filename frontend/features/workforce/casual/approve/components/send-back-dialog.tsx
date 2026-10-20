'use client';

import * as React from 'react';

import { DialogButton, EMPTY_REASON, KitDialog, ReasonChips, isReasonComplete, reasonText, type ReasonValue } from '../../../_shared';

const REASONS = [
  { key: 'times', label: 'The times look wrong' },
  { key: 'worker', label: 'A worker is missing or should not be there' },
  { key: 'day', label: 'This is the wrong day' },
];

/** Send a sheet back to the head with a reason (at least 5 characters). The head sees it and can edit and send again. */
export function SendBackDialog({ open, onOpenChange, role, busy, error, onSend }: { open: boolean; onOpenChange: (open: boolean) => void; role: string; busy: boolean; error: string | null; onSend: (reason: string) => void }) {
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  React.useEffect(() => {
    if (open) setReason(EMPTY_REASON);
  }, [open]);
  const text = reasonText(reason, Object.fromEntries(REASONS.map((r) => [r.key, r.label])));
  const ready = isReasonComplete(reason) && (text?.length ?? 0) >= 5;
  return (
    <KitDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Send back to the ${role}`}
      description="Say what to change. The sheet opens for editing again."
      busy={busy}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" disabled={!ready || busy} onClick={() => text && onSend(text)}>
            {busy ? 'Sending…' : 'Send back'}
          </DialogButton>
        </>
      }
    >
      <ReasonChips legend="Why?" legendStyle="sentence" hint="required" options={REASONS} value={reason} onChange={setReason} />
      {error ? (
        <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {error}
        </p>
      ) : null}
    </KitDialog>
  );
}
