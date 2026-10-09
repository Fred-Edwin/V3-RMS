'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Textarea } from '@/components/ui2/textarea';
import { DecisionDialog, DialogLabel } from '../../_shared/components/decision-dialog';
import { useAction } from '../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../_shared/hooks/use-idempotency-key';
import { PinField } from '../../requisitions/components/req-parts';
import { clock } from '../../requisitions/_shared/lib/requisitions-words';
import { itemWord } from '../../_shared/lib/block2-words';
import { REVERSE_PRESETS, errorText, type ReversePreset } from '../../dispatch/lib/dispatch-words';
import { ChoiceChips } from '../../dispatch/components/desktop/choice-chips';
import { discrepanciesApi } from '../../dispatch/services/branch-side-api';
import { FINDING_PROFILE, FINDING_TEXT, REVERSE_REASON_MAX, type DiscrepancyFile, type ReverseFindingResult } from '../_shared/types/discrepancies-contract';

const SEPARATOR = ' — ';

/** The stored reason: "preset" or "preset — note" ("Other" needs a note). */
export const composeReverseReason = (preset: ReversePreset, note: string): string => (note.trim() ? `${preset}${SEPARATOR}${note.trim()}` : preset);

const Box = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-[3px] border-t border-wds-border px-3.5 py-3 first:border-t-0">
    <span className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">{label}</span>
    {children}
  </div>
);

/** Paper D16: reverse a recorded finding with a new linked entry. Both entries stay on the file and in the audit log. */
export function ReverseDialog({ file, open, onOpenChange, onReversed, returnFocus }: { file: DiscrepancyFile; open: boolean; onOpenChange: (open: boolean) => void; onReversed: (result: ReverseFindingResult) => void; returnFocus?: () => HTMLElement | null }) {
  const [preset, setPreset] = React.useState<ReversePreset | ''>('');
  const [note, setNote] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [noteHint, setNoteHint] = React.useState(false);
  const idem = useIdempotencyKey();
  const reverse = useAction((input: { reason: string; pin: string }) => discrepanciesApi.reverse(file.id, { ...input, idempotencyKey: idem.key() }), 'Could not reverse the finding. Nothing was changed. Try again.');
  const finding = file.finding;
  const n = Math.abs(Number(file.gapQty));
  const what = itemWord(file.item.name);

  React.useEffect(() => {
    if (open) {
      setPreset('');
      setNote('');
      setPin('');
      setNoteHint(false);
      reverse.clear();
      idem.renew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (): Promise<void> => {
    if (preset === '' || pin.length !== 4) return;
    if (preset === 'Other' && note.trim() === '') return setNoteHint(true);
    const result = await reverse.run({ reason: composeReverseReason(preset, note), pin });
    if (result) onReversed(result);
    else setPin('');
  };

  if (!finding) return null;
  const profile = FINDING_PROFILE[finding.finding];
  const against = profile.against === 'CARRIER' ? `recorded against ${file.carrier.name}` : profile.against === 'STORE' ? 'recorded against the store' : profile.against === 'RECEIVER' ? 'recorded against the receiver' : 'unexplained';
  const failure = reverse.failure ? errorText(reverse.failure.code, reverse.failure.message) : null;

  return (
    <DecisionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reverse this finding?"
      description={`${file.reference} · finding recorded ${clock(finding.recorded.at)}`}
      eyebrow
      error={failure}
      busy={reverse.saving}
      returnFocus={returnFocus}
      actions={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={reverse.saving}>
            Keep the finding
          </Button>
          <Button onClick={() => void submit()} disabled={preset === '' || pin.length !== 4 || reverse.saving}>
            {reverse.saving ? 'Reversing…' : 'Reverse the finding'}
          </Button>
        </>
      }
    >
      <div className="border border-wds-neutral-950">
        <Box label="The finding">
          <p className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">
            {FINDING_TEXT[finding.finding]} · {file.item.name} · {n}
          </p>
          <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{profile.lossKind === 'LOSS' ? 'Written off at cost' : profile.lossKind === 'PACKING_ERROR' ? 'A packing error, not a loss' : 'A correction, not a loss'} · {against}</p>
        </Box>
        <div className="bg-wds-neutral-50">
          <Box label="What reversing does">
            <p className="font-wds-sans text-[14px] leading-5 text-wds-text-ink">
              The {n} {what} are put back as they were by a new entry linked to the original. Both entries stay on the file and in the audit log.
            </p>
          </Box>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <DialogLabel hint="required" className="text-[11px] leading-[14px]">Why</DialogLabel>
        <ChoiceChips label="Why reverse" value={preset} options={REVERSE_PRESETS.map((p) => ({ value: p, label: p }))} onChange={(next) => { setPreset(next); setNoteHint(false); }} disabled={reverse.saving} />
      </div>
      {preset !== '' ? (
        <div className="flex flex-col gap-2">
          <DialogLabel hint={preset === 'Other' ? 'required for Other' : 'optional'} htmlFor="reverse-note">
            Note
          </DialogLabel>
          <Textarea id="reverse-note" rows={2} maxLength={REVERSE_REASON_MAX - 40} value={note} onChange={(event) => { setNote(event.target.value); setNoteHint(false); }} aria-invalid={noteHint || undefined} />
          {noteHint ? <p role="alert" className="font-wds-sans text-[13px] text-wds-error-fg">Add a note to say what happened.</p> : null}
        </div>
      ) : null}
      <PinField wide value={pin} onChange={setPin} onSubmit={() => void submit()} invalid={reverse.failure?.code === 'INVALID_PIN'} id="reverse-pin" />
    </DecisionDialog>
  );
}
