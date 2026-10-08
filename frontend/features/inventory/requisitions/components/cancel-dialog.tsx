'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import { Textarea } from '@/components/ui2/textarea';
import { DecisionDialog, DialogLabel } from '../../_shared/components/decision-dialog';
import { useAction } from '../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../_shared/hooks/use-idempotency-key';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import { CANCEL_PRESETS, CANCEL_REASON_MAX, CANCEL_REASON_SEPARATOR, type CancelPreset, type CancelResult } from '../_shared/types/requisitions-contract';
import { errorWords } from '../_shared/lib/requisitions-words';
import { PinField } from './req-parts';

/** The reason the server stores: "preset" or "preset — note". */
export const composeCancelReason = (preset: CancelPreset, note: string): string => {
  const trimmed = note.trim();
  return trimmed ? `${preset}${CANCEL_REASON_SEPARATOR}${trimmed}` : preset;
};

/** Paper step 19. Before approval only; the file stays, marked Cancelled. "Other" needs a note. */
export function CancelDialog({ requisitionId, reference, cycleLabel, lineCount, open, onOpenChange, onCancelled, returnFocus }: {
  returnFocus?: () => HTMLElement | null;
  requisitionId: string;
  reference: string;
  cycleLabel: string;
  lineCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: (result: CancelResult) => void;
}) {
  const [preset, setPreset] = React.useState<CancelPreset | ''>('');
  const [note, setNote] = React.useState('');
  const [pin, setPin] = React.useState('');
  const idem = useIdempotencyKey();
  const cancel = useAction((input: { reason: string; pin: string }) => requisitionsApi.cancel(requisitionId, input, idem.key()), 'Could not cancel. Nothing was changed. Try again.');
  const needsNote = preset === 'Other';
  const ready = preset !== '' && (!needsNote || note.trim().length > 0) && pin.length === 4;
  const failure = cancel.failure ? errorWords(cancel.failure.code, 'manager', cancel.failure.message, cancel.failure.message) : null;

  React.useEffect(() => {
    if (open) {
      setPreset('');
      setNote('');
      setPin('');
      cancel.clear();
      idem.renew();
    }
    // Reset only when the dialog opens; the helpers are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (): Promise<void> => {
    if (!ready || !preset) return;
    const result = await cancel.run({ reason: composeCancelReason(preset, note), pin });
    if (result) onCancelled(result);
    else setPin('');
  };

  return (
    <DecisionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cancel this requisition?"
      description={`${reference} · ${cycleLabel.split(' · ')[0]} · ${lineCount} lines`}
      error={failure}
      busy={cancel.saving}
      returnFocus={returnFocus}
      actions={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={cancel.saving}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={!ready || cancel.saving}>
            {cancel.saving ? 'Cancelling…' : 'Cancel requisition'}
          </Button>
        </>
      }
    >
      <div className="border border-wds-info-border bg-wds-info-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-info-fg">
        <p className="font-medium">Nothing has gone to the Central Store yet.</p>
        <p>It stays on record as Cancelled and the heads are told. Nothing is deleted. To ask again, start a new one.</p>
      </div>
      <div className="flex flex-col gap-2">
        <DialogLabel hint="required" htmlFor="cancel-reason">
          Reason
        </DialogLabel>
        <Select value={preset} onValueChange={(value) => setPreset(value as CancelPreset)}>
          <SelectTrigger id="cancel-reason" className="h-10 text-[14px]">
            <SelectValue placeholder="Choose a reason" />
          </SelectTrigger>
          <SelectContent>
            {CANCEL_PRESETS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <DialogLabel hint={needsNote ? 'required for Other' : 'optional'} htmlFor="cancel-note">
          Note
        </DialogLabel>
        <Textarea id="cancel-note" rows={3} maxLength={CANCEL_REASON_MAX - 40} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Started as Afternoon, should have been an Extra. Heads will resend." />
      </div>
      <PinField value={pin} onChange={setPin} onSubmit={() => void submit()} invalid={cancel.failure?.code === 'INVALID_PIN'} id="cancel-pin" />
    </DecisionDialog>
  );
}
