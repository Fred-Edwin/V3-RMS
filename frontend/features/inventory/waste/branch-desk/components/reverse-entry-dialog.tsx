'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { ApiError } from '@/types/api';
import { ChoiceChips, DecisionDialog, DialogLabel } from '../../../_shared/components/decision-dialog';
import { scwErrorCode, scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { signedKes } from '../../../counting/_shared/lib/count-format';
import { BRANCH_WASTE_ERROR_COPY, BRANCH_WASTE_STATES_COPY } from '../../_shared/lib/branch-waste-copy';
import { WASTE_REVERSAL_REASONS, WASTE_REVERSAL_TEXT, type BranchWasteEntry, type WasteReversalReason } from '../../_shared/types/waste-contract';
import { dayClock, qtyLabel, shortName } from '../lib/branch-waste-desk-format';
import { branchWasteDeskApi } from '../services/branch-waste-desk-api';

const reasonLabel = (r: WasteReversalReason): string => (r === 'OTHER' ? 'Other, add a note' : WASTE_REVERSAL_TEXT[r]);

interface ReverseEntryDialogProps {
  entry: BranchWasteEntry | null;
  onClose: () => void;
  /** The entry came back reversed. */
  onDone: (entry: BranchWasteEntry) => void;
  /** The server says the list is out of date (already reversed): the screen reloads it while the message stays. */
  onStale: () => void;
  /** Where focus goes when the dialog closes and the Reverse link that opened it is gone. */
  fallbackFocus: () => HTMLElement | null;
}

/**
 * Paper W7: Reverse any entry, with a reason. A 500 px square dialog over a 60% scrim: the entry's facts, the effect, one required
 * reason (ink chips), and for "Other" a required note (gap G14). No PIN. Built on DecisionDialog, so it traps focus, closes on Escape
 * and Cancel, cannot be dismissed while the request is in flight, and gives focus back to the Reverse link that opened it.
 */
export function ReverseEntryDialog({ entry, onClose, onDone, onStale, fallbackFocus }: ReverseEntryDialogProps) {
  const [reason, setReason] = React.useState<WasteReversalReason | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const entryId = entry?.id ?? null;
  // A new entry starts clean: nothing chosen, as the reason is required.
  React.useEffect(() => {
    setReason(null);
    setNote('');
    setError(null);
    setBusy(false);
  }, [entryId]);

  const needsNote = reason === 'OTHER' && note.trim() === '';
  const ready = reason !== null && !needsNote;
  const submit = async (): Promise<void> => {
    if (!entry || !reason || !ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await branchWasteDeskApi.reverse(entry.id, { reason, ...(reason === 'OTHER' ? { note: note.trim() } : {}) }));
    } catch (err) {
      setError(scwErrorMessage(err, BRANCH_WASTE_ERROR_COPY, BRANCH_WASTE_STATES_COPY.reverseAny.error));
      if (scwErrorCode(err) === 'ALREADY_REVERSED' || (err instanceof ApiError && err.statusCode === 409)) onStale();
      setBusy(false);
    }
  };

  const money = entry?.valueKes !== undefined ? signedKes(entry.valueKes) : null;
  const facts: [string, React.ReactNode][] = entry
    ? [
        ['Entry', `${entry.itemName} · ${qtyLabel(entry.quantity, entry.unit)} · ${entry.reasonText}`],
        ['Logged by', `${shortName(entry.loggedBy.name)} · ${entry.department.name} · ${dayClock(entry.at)}`],
        ...(money ? ([['Value', <span key="v" className="font-wds-mono">{money}</span>]] as [string, React.ReactNode][]) : []),
      ]
    : [];

  return (
    <DecisionDialog
      open={entry !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Reverse this waste entry?"
      description="The original stays on record. A linked reversal is added."
      plain
      width={500}
      scrim="strong"
      busy={busy}
      error={error}
      returnFocus={() => (entry ? document.querySelector<HTMLElement>(`[data-reverse-for="${entry.id}"]`) : null) ?? fallbackFocus()}
      actions={
        <>
          <Button type="button" variant="flat" size="dialog" shape="square" className="w-[84px]" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="solid" size="dialog" shape="square" className="min-w-[130px]" disabled={!ready || busy} onClick={() => void submit()}>
            {busy ? BRANCH_WASTE_STATES_COPY.reverseAny.loading : 'Reverse entry'}
          </Button>
        </>
      }
    >
      <dl className="m-0 flex flex-col border-t border-wds-text-ink">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-wds-border py-2.5">
            <dt className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{label}</dt>
            <dd className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">{value}</dd>
          </div>
        ))}
        {entry ? (
          <div className="flex items-start justify-between gap-6 border-b border-wds-border py-2.5">
            <dt className="shrink-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Effect</dt>
            <dd className="m-0 w-[300px] text-right font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
              {entry.department.name} stock goes up by {qtyLabel(entry.quantity, entry.unit)}.{money ? ` The waste total drops by ${money}.` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-col gap-2">
        <DialogLabel hint={undefined} className="text-wds-text-secondary">
          Why? · required
        </DialogLabel>
        <ChoiceChips name="reverse-reason" label="Why" tone="ink" options={WASTE_REVERSAL_REASONS} value={reason} onChange={setReason} labelOf={reasonLabel} disabled={busy} />
        {reason === 'OTHER' ? (
          <>
            <label htmlFor="reverse-note" className="sr-only">
              Add a note
            </label>
            <input
              id="reverse-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Add a note"
              aria-required
              disabled={busy}
              className="h-[34px] w-full border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none placeholder:text-[#8D8982] focus:border-wds-selected-edge focus-visible:shadow-wds-ring"
            />
          </>
        ) : null}
      </div>
    </DecisionDialog>
  );
}
