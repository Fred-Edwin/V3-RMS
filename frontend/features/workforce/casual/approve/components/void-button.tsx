'use client';

import * as React from 'react';

import { PhoneButton, WorkforcePinDialog, Callout } from '../../../_shared';
import { kes } from '../../_shared/lib/casual-words';
import type { Sheet } from '../../_shared/types/casual-types';
import { useDecision } from '../hooks/use-decision';

/**
 * "Void this sheet" (PD26): only on an approved sheet that no worker has signed. A reason of at least 5 characters and the PIN. The
 * number stays on record as VOID and the head records the day again. After a signature the button is not drawn.
 */
export function VoidButton({ sheet, onVoided, onStale }: { sheet: Sheet; onVoided: (next: Sheet, message: string) => void; onStale: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const decision = useDecision(sheet, (next, message) => {
    setOpen(false);
    onVoided(next, message);
  }, onStale);
  const signed = sheet.lines.some((l) => l.receivedAt !== null);
  if (sheet.status !== 'APPROVED' || signed) return null;
  const longEnough = reason.trim().length >= 5;
  return (
    <>
      <PhoneButton kind="outlined" size="sm" onClick={() => setOpen(true)}>
        Void this sheet
      </PhoneButton>
      <WorkforcePinDialog
        open={open}
        onOpenChange={setOpen}
        title="Void this pay sheet"
        description="The number stays on record as void. The head records the day again."
        summaryRows={[
          { label: 'Sheet', value: sheet.number ?? '', mono: true },
          { label: 'Department', value: sheet.departmentName },
          { label: 'Total KES', value: kes(sheet.total), mono: true },
        ]}
        summary={
          <div className="flex flex-col gap-1.5">
            <label htmlFor="void-reason" className="font-wds-sans text-[13px] font-medium text-wds-text-ink">
              Why? <span className="font-normal text-wds-text-secondary">required</span>
            </label>
            <textarea id="void-reason" rows={2} autoComplete="off"value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-wds-border-strong p-2 font-wds-sans text-[14px]" />
            {!longEnough && reason !== '' ? <Callout tone="warning" size="sm">Say why, in at least 5 characters.</Callout> : null}
          </div>
        }
        caption="You sign with your PIN. The head is told."
        confirmLabel="Void"
        submitting={decision.busy}
        error={decision.error ?? undefined}
        onSubmit={(pin) => {
          if (longEnough) void decision.voidSheet(reason.trim(), pin);
        }}
      />
    </>
  );
}
