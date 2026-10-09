'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Textarea } from '@/components/ui2/textarea';
import { DecisionDialog, DialogLabel } from '../../../_shared/components/decision-dialog';
import { useAction } from '../../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { PinField } from '../../../requisitions/components/req-parts';
import { DISPATCH_CANCEL_PRESETS, DISPATCH_CANCEL_REASON_MAX, DISPATCH_CANCEL_REASON_SEPARATOR, type CancelDispatchResult, type DispatchCancelPreset } from '../../_shared/types/dispatch-contract';
import { CANCEL_WARNING, errorText } from '../../lib/dispatch-words';
import { dispatchDesktopApi } from '../../services/dispatch-desktop-api';
import { ChoiceChips } from './choice-chips';

/** The reason the server stores: "preset" or "preset — note". */
export const composeDispatchCancelReason = (preset: DispatchCancelPreset, note: string): string => {
  const trimmed = note.trim();
  return trimmed ? `${preset}${DISPATCH_CANCEL_REASON_SEPARATOR}${trimmed}` : preset;
};

const Row = ({ left, right }: { left: string; right: string }) => (
  <div className="flex items-center justify-between gap-4 border-t border-wds-border px-4 py-3 first:border-t-0">
    <span className="font-wds-sans text-[15px] leading-5 text-wds-text-ink">{left}</span>
    <span className="text-right font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{right}</span>
  </div>
);

/**
 * Paper D20: cancel a signed dispatch before the department counts it. Chips, then a note ("Other" needs one), then the PIN. A
 * dispatch the branch counted meanwhile closes the dialog and refreshes the file (`onAlreadyCounted`).
 */
export function CancelDispatchDialog({ dispatchId, reference, departmentName, signedAtLabel, lineCount, open, onOpenChange, onCancelled, onAlreadyCounted, returnFocus }: {
  dispatchId: string;
  reference: string;
  departmentName: string;
  signedAtLabel: string;
  lineCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: (result: CancelDispatchResult) => void;
  onAlreadyCounted: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const [preset, setPreset] = React.useState<DispatchCancelPreset | ''>('');
  const [note, setNote] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [noteHint, setNoteHint] = React.useState(false);
  const idem = useIdempotencyKey();
  const cancel = useAction((input: { reason: string; pin: string }) => dispatchDesktopApi.cancel(dispatchId, { ...input, idempotencyKey: idem.key() }), 'Could not cancel. Nothing was changed. Try again.');
  const needsNote = preset === 'Other';
  const ready = preset !== '' && pin.length === 4;
  const failure = cancel.failure && cancel.failure.code !== 'DISPATCH_ALREADY_COUNTED' ? errorText(cancel.failure.code, cancel.failure.message) : null;

  React.useEffect(() => {
    if (open) {
      setPreset('');
      setNote('');
      setPin('');
      setNoteHint(false);
      cancel.clear();
      idem.renew();
    }
    // Reset only when the dialog opens; the helpers are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (): Promise<void> => {
    if (!ready || !preset) return;
    if (needsNote && note.trim().length === 0) {
      setNoteHint(true);
      return;
    }
    const result = await cancel.run({ reason: composeDispatchCancelReason(preset, note), pin });
    if (result) onCancelled(result);
    else setPin('');
  };

  // The branch counted it while the dialog was open: close, and let the file refresh into its new state.
  const code = cancel.failure?.code;
  React.useEffect(() => {
    if (code === 'DISPATCH_ALREADY_COUNTED') onAlreadyCounted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <DecisionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cancel this dispatch?"
      description={`${reference} · ${departmentName} · signed ${signedAtLabel}`}
      eyebrow
      error={failure}
      busy={cancel.saving}
      returnFocus={returnFocus}
      actions={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={cancel.saving}>
            Keep the dispatch
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!ready || cancel.saving}>
            {cancel.saving ? 'Cancelling…' : 'Cancel the dispatch'}
          </Button>
        </>
      }
    >
      <div className="border border-wds-neutral-950">
        <p className="px-4 py-3 font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">What cancelling does</p>
        <div className="border-t border-wds-neutral-950">
          <Row left="Stock goes back to the Central Store" right={`${lineCount} lines, by a linked entry`} />
          <Row left={`${departmentName}'s lines return to the queue`} right="Status: To pack" />
          <Row left="The delivery note is voided" right="Kept on file, marked Cancelled" />
        </div>
      </div>
      <p className="border border-wds-warning-border bg-wds-warning-bg px-4 py-3 font-wds-sans text-[14px] leading-5 text-wds-text-ink">{CANCEL_WARNING(departmentName)}</p>
      <div className="flex flex-col gap-2">
        <DialogLabel hint="required">Why</DialogLabel>
        <ChoiceChips label="Why cancel" value={preset} options={DISPATCH_CANCEL_PRESETS.map((p) => ({ value: p, label: p }))} onChange={(next) => { setPreset(next); setNoteHint(false); }} disabled={cancel.saving} />
      </div>
      {preset !== '' ? (
        <div className="flex flex-col gap-2">
          <DialogLabel hint={needsNote ? 'required for Other' : 'optional'} htmlFor="dispatch-cancel-note">
            Note
          </DialogLabel>
          <Textarea id="dispatch-cancel-note" rows={2} maxLength={DISPATCH_CANCEL_REASON_MAX - 40} value={note} onChange={(event) => { setNote(event.target.value); setNoteHint(false); }} aria-invalid={noteHint || undefined} aria-describedby={noteHint ? 'dispatch-cancel-note-hint' : undefined} />
          {noteHint ? <p id="dispatch-cancel-note-hint" role="alert" className="font-wds-sans text-[13px] text-wds-error-fg">Add a note to say what happened.</p> : null}
        </div>
      ) : null}
      <PinField wide value={pin} onChange={setPin} onSubmit={() => void submit()} invalid={cancel.failure?.code === 'INVALID_PIN'} id="dispatch-cancel-pin" />
    </DecisionDialog>
  );
}
