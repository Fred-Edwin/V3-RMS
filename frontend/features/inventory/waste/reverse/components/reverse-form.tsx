'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { FormErrorBanner } from '../../../_shared/components/stock-states';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { WASTE_ERROR_COPY, WASTE_STATES_COPY } from '../../_shared/lib/states-copy';
import { wasteApi } from '../../_shared/services/waste-api';
import { WASTE_REVERSAL_REASONS, WASTE_REVERSAL_TEXT, type WasteEntry, type WasteReversalReason } from '../../_shared/types/waste-contract';

/**
 * The reversal form both screens share (no PIN, owner 8 Oct 2026): a reason (required; "Other" needs a note) and Reverse entry.
 * The phone sheet (step 20, `1ZJR-0`) draws the reasons as a radio list; the desktop dialog (step 23, `2008-0`) as chips. The
 * entry stays on record, marked reversed, and the stock goes back. A double tap cannot reverse twice (one request at a time, and a
 * second one is "already reversed" from the server).
 */
export function useReverse(entry: WasteEntry | null, onDone: (e: WasteEntry) => void) {
  const [reason, setReason] = React.useState<WasteReversalReason | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setReason(null);
    setNote('');
    setError(null);
  }, [entry?.id]);
  const needsNote = reason === 'OTHER' && note.trim() === '';
  const submit = async (): Promise<void> => {
    if (!entry || !reason || needsNote || busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await wasteApi.reverse(entry.id, { reason, ...(reason === 'OTHER' ? { note: note.trim() } : {}) }));
    } catch (err) {
      setError(scwErrorMessage(err, WASTE_ERROR_COPY, WASTE_STATES_COPY.reverseAny.error));
      setBusy(false);
    }
  };
  return { reason, setReason, note, setNote, busy, error, needsNote, submit, ready: Boolean(reason) && !needsNote };
}

export function ReverseNote({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <label htmlFor="reverse-note" className="sr-only">
        Say what happened
      </label>
      <textarea id="reverse-note" value={value} onChange={(e) => onChange(e.target.value)} rows={2} maxLength={300} placeholder="Say what happened" aria-required className="w-full border border-wds-border-strong bg-wds-surface p-2 font-wds-sans text-[14px] outline-none focus:border-wds-selected-edge focus:shadow-wds-ring" />
    </>
  );
}

export function ReverseError({ text }: { text: string | null }) {
  return text ? <FormErrorBanner title="Could not reverse it" description={text} /> : null;
}

export function ReasonChips({ value, onChange, disabled }: { value: WasteReversalReason | null; onChange: (r: WasteReversalReason) => void; disabled: boolean }) {
  return (
    <div role="radiogroup" aria-label="Why" className="flex flex-wrap gap-2">
      {WASTE_REVERSAL_REASONS.map((r) => (
        <button key={r} type="button" role="radio" aria-checked={value === r} disabled={disabled} onClick={() => onChange(r)} className={cn('h-10 border px-4 font-wds-sans text-[14px] leading-5 outline-none transition-colors duration-100 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]', value === r ? 'border-wds-text-ink bg-wds-text-ink font-medium text-white' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink [@media(hover:hover)]:hover:bg-wds-neutral-50')}>
          {r === 'OTHER' ? 'Other, add a note' : WASTE_REVERSAL_TEXT[r]}
        </button>
      ))}
    </div>
  );
}
