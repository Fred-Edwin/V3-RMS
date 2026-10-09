'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { BottomSheet, SheetGrabber } from '../../../_shared/components/bottom-sheet';
import { PHONE_PRIMARY_BUTTON_TOKEN, PHONE_SECONDARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { clockLabel } from '../../../counting/_shared/lib/count-format';
import { BRANCH_WASTE_BUTTONS, BRANCH_WASTE_STATES_COPY } from '../../_shared/lib/branch-waste-copy';
import { WASTE_REVERSAL_REASONS, WASTE_REVERSAL_TEXT, type BranchWasteEntry, type WasteReversalReason } from '../../_shared/types/waste-contract';
import { useBranchReverse } from '../hooks/use-branch-reverse';
import { quantityLabel, shortPerson } from '../../_shared/lib/branch-waste-people';
import { entrySummary } from '../lib/branch-waste-format';
import { radioGroupKeyDown, radioTabIndex, SectionLabel } from './parts';

/** The third reason reads "Other, add a note" on both devices (owner ruling, 9 Oct 2026). */
const reasonLabel = (r: WasteReversalReason): string => (r === 'OTHER' ? 'Other, add a note' : WASTE_REVERSAL_TEXT[r]);

/**
 * Reverse a wrong entry (Paper W5): a bottom sheet with the entry's summary, three reasons as a radio list (none chosen at first,
 * one required), a note field when "Other, add a note" is chosen, and Reverse entry / Keep it. No PIN. A refusal from the server
 * (not yours, window passed, already reversed) is shown inside the sheet and the entry stays. Focus opens on the first reason and
 * returns to where it came from when the sheet closes.
 */
export function ReverseSheet({ entry, onClose, onDone }: { entry: BranchWasteEntry | null; onClose: () => void; onDone: (e: BranchWasteEntry) => void }) {
  const f = useBranchReverse(entry, onDone);
  const firstRadio = React.useRef<HTMLButtonElement>(null);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    if (f.reason === 'OTHER') noteRef.current?.focus();
  }, [f.reason]);

  return (
    <BottomSheet open={entry !== null} onOpenChange={(open) => (open ? undefined : onClose())} label="Reverse a wrong entry" scrim={52} dismissible={!f.busy} initialFocusRef={firstRadio} className="gap-[14px] px-4 pb-5 pt-2.5">
      <SheetGrabber />
      <div className="flex flex-col gap-0.5">
        <h2 className="font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink">Reverse this entry?</h2>
        <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{entry ? entrySummary(entry) : ''}</p>
      </div>
      <div className="flex flex-col gap-2">
        <SectionLabel>Why? · required</SectionLabel>
        <div role="radiogroup" aria-label="Why" aria-required onKeyDown={(e) => radioGroupKeyDown(e, WASTE_REVERSAL_REASONS, f.reason, f.setReason)} className="flex flex-col gap-2">
          {WASTE_REVERSAL_REASONS.map((r, i) => {
            const chosen = f.reason === r;
            return (
              <button
                key={r}
                ref={i === 0 ? firstRadio : undefined}
                type="button"
                role="radio"
                aria-checked={chosen}
                tabIndex={radioTabIndex(i, chosen, f.reason !== null)}
                disabled={f.busy}
                onClick={() => f.setReason(r)}
                className={cn('flex h-12 items-center gap-3 px-3.5 text-left font-wds-sans text-[14px] leading-[18px] text-wds-text-ink outline-none transition-colors duration-100 focus-visible:shadow-wds-ring', chosen ? 'border-[1.5px] border-wds-selected-edge bg-wds-espresso-50' : 'border border-wds-border-strong bg-wds-surface')}
              >
                <span className={cn('box-border size-4 shrink-0 rounded-full', chosen ? 'border-4 border-wds-selected-edge' : 'border-[1.5px] border-wds-neutral-400')} aria-hidden />
                {reasonLabel(r)}
              </button>
            );
          })}
        </div>
        {f.reason === 'OTHER' ? (
          <>
            <label htmlFor="bw-reverse-note" className="sr-only">
              Add a note
            </label>
            <textarea
              id="bw-reverse-note"
              ref={noteRef}
              value={f.note}
              onChange={(e) => f.setNote(e.target.value)}
              rows={1}
              maxLength={300}
              placeholder="Add a note"
              aria-required
              disabled={f.busy}
              className="h-11 w-full resize-none border border-wds-border-strong bg-wds-surface px-3 py-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink outline-none placeholder:text-wds-neutral-500 focus:border-wds-selected-edge focus:shadow-wds-ring"
            />
          </>
        ) : null}
      </div>
      <p className="border border-wds-border bg-wds-neutral-50 px-3 py-2.5 font-wds-sans text-[12px] leading-[17px] text-wds-neutral-700">
        The entry stays on record, marked reversed. The {entry ? quantityLabel(entry.quantity, entry.unit) : ''} goes back into stock.
      </p>
      {f.error ? (
        <p role="alert" className="font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {f.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <button type="button" disabled={!f.ready || f.busy} title={!f.ready ? (f.needsNote ? 'Add a note first' : 'Pick a reason first') : undefined} onClick={() => void f.submit()} className={cn(PHONE_PRIMARY_BUTTON_TOKEN, 'h-[50px] w-full text-[16px] leading-5')}>
          {f.busy ? BRANCH_WASTE_STATES_COPY.reversePhone.loading : BRANCH_WASTE_BUTTONS.reverse}
        </button>
        <button type="button" disabled={f.busy} onClick={onClose} className={cn(PHONE_SECONDARY_BUTTON, 'w-full')}>
          {BRANCH_WASTE_BUTTONS.keep}
        </button>
      </div>
    </BottomSheet>
  );
}

/** A reversed row's chip says only "Reversed 09:12" on the phone; tapping it opens this small sheet with the reason (G9). */
export function ReversedDetailSheet({ entry, onClose }: { entry: BranchWasteEntry | null; onClose: () => void }) {
  const r = entry?.reversal;
  return (
    <BottomSheet open={entry !== null} onOpenChange={(open) => (open ? undefined : onClose())} label="Why this entry was reversed" scrim={52} className="gap-[14px] px-4 pb-5 pt-2.5">
      <SheetGrabber />
      <div className="flex flex-col gap-0.5">
        <h2 className="font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink">{r ? `Reversed ${clockLabel(r.at)}` : 'Reversed'}</h2>
        <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{entry ? entrySummary(entry) : ''}</p>
      </div>
      {r ? (
        <div className="flex flex-col border border-wds-border bg-wds-neutral-50 px-3 py-2.5 font-wds-sans text-[12px] leading-[17px] text-wds-neutral-700">
          <span>
            {r.reasonText}
            {r.note ? `: ${r.note}` : ''}
          </span>
          <span>Reversed by {shortPerson(r.by.name)}</span>
          <span>The stock went back.</span>
        </div>
      ) : null}
      <button type="button" onClick={onClose} className={cn(PHONE_SECONDARY_BUTTON, 'w-full')}>
        Close
      </button>
    </BottomSheet>
  );
}
