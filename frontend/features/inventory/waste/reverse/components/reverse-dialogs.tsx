'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { BottomSheet, SheetGrabber } from '../../../_shared/components/bottom-sheet';
import { PHONE_PRIMARY_BUTTON, PHONE_SECONDARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { clockLabel, signedKes } from '../../../counting/_shared/lib/count-format';
import { WASTE_REVERSAL_REASONS, WASTE_REVERSAL_TEXT, type WasteEntry } from '../../_shared/types/waste-contract';
import { ReasonChips, ReverseError, ReverseNote, useReverse } from './reverse-form';

const stockBack = (e: WasteEntry): string => `${e.quantity} ${e.unit}`;

/** Reverse a wrong entry, phone (Paper step 20, `1ZJR-0`): a bottom sheet, the reasons as a radio list, "The 2 kg goes back into stock". */
export function ReversePhoneSheet({ entry, onClose, onDone }: { entry: WasteEntry | null; onClose: () => void; onDone: (e: WasteEntry) => void }) {
  const f = useReverse(entry, onDone);
  return (
    <BottomSheet open={entry !== null} onOpenChange={(o) => (o ? undefined : onClose())} label="Reverse this entry" scrim={45} dismissible={!f.busy} className="gap-4 px-4 pb-6 pt-2.5">
      <SheetGrabber />
      <div className="flex flex-col gap-1">
        <h2 className="font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink">Reverse this entry?</h2>
        <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
          {entry?.itemName} · {entry ? stockBack(entry) : ''} · {entry?.reasonText} · {entry ? clockLabel(entry.at) : ''}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Why? · required</span>
        <div role="radiogroup" aria-label="Why" className="flex flex-col gap-2">
          {WASTE_REVERSAL_REASONS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={f.reason === r} disabled={f.busy} onClick={() => f.setReason(r)} className={cn('flex h-12 items-center gap-3 border px-3.5 text-left font-wds-sans text-[15px] leading-5 text-wds-text-ink outline-none transition-colors duration-100 focus-visible:shadow-wds-ring', f.reason === r ? 'border-wds-selected-edge bg-wds-espresso-50' : 'border-wds-border-strong bg-wds-surface')}>
              <span className={cn('flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]', f.reason === r ? 'border-wds-selected-edge' : 'border-wds-neutral-400')}>
                {f.reason === r ? <span className="size-2 rounded-full bg-wds-selected-edge" /> : null}
              </span>
              {WASTE_REVERSAL_TEXT[r]}
            </button>
          ))}
        </div>
        {f.reason === 'OTHER' ? <ReverseNote value={f.note} onChange={f.setNote} /> : null}
      </div>
      <p className="border border-wds-border bg-wds-neutral-50 px-3.5 py-3 font-wds-sans text-[12px] leading-[17px] text-wds-neutral-700">
        The entry stays on record, marked reversed. The {entry ? stockBack(entry) : ''} goes back into stock.
      </p>
      <ReverseError text={f.error} />
      <div className="flex flex-col gap-2">
        <button type="button" disabled={!f.ready || f.busy} title={!f.ready ? 'Pick a reason first' : undefined} onClick={() => void f.submit()} className={cn(PHONE_PRIMARY_BUTTON, 'h-[52px] text-[16px] leading-5')}>
          {f.busy ? 'Reversing…' : 'Reverse entry'}
        </button>
        <button type="button" disabled={f.busy} onClick={onClose} className={PHONE_SECONDARY_BUTTON}>
          Keep it
        </button>
      </div>
    </BottomSheet>
  );
}

/** Reverse any entry, desktop (Paper step 23, `2008-0`): a 500 px square dialog, the entry's facts, the effect, reason chips, no PIN. */
export function ReverseDesktopDialog({ entry, onClose, onDone }: { entry: WasteEntry | null; onClose: () => void; onDone: (e: WasteEntry) => void }) {
  const f = useReverse(entry, onDone);
  const rows: [string, string][] = entry
    ? [
        ['Entry', `${entry.itemName} · ${stockBack(entry)} · ${entry.reasonText}`],
        ['Logged by', `${entry.loggedBy.name} · ${clockLabel(entry.at)}`],
        ...(entry.valueKes !== undefined ? ([['Value', signedKes(entry.valueKes)]] as [string, string][]) : []),
        ['Effect', `Stock goes up by ${stockBack(entry)}.${entry.valueKes !== undefined ? ` The waste total drops by ${signedKes(entry.valueKes)}.` : ''}`],
      ]
    : [];
  return (
    <DialogPrimitive.Root open={entry !== null} onOpenChange={(o) => (!o && !f.busy ? onClose() : undefined)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-wds-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 flex w-[500px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 border border-wds-border-strong bg-wds-surface px-7 py-6 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink">Reverse this waste entry?</DialogPrimitive.Title>
            <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">The original stays on record. A linked reversal is added.</p>
          </div>
          <dl className="flex flex-col border-t border-wds-text-ink">
            {rows.map(([k, v]) => (
              <div key={k} className="flex min-h-9 items-start justify-between gap-4 border-b border-wds-neutral-100 py-2">
                <dt className="font-wds-sans text-[13px] leading-5 text-wds-text-secondary">{k}</dt>
                <dd className="max-w-[300px] text-right font-wds-sans text-[13px] leading-5 text-wds-text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2">
            <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Why? · required</span>
            <ReasonChips value={f.reason} onChange={f.setReason} disabled={f.busy} />
            {f.reason === 'OTHER' ? <ReverseNote value={f.note} onChange={f.setNote} /> : null}
          </div>
          <ReverseError text={f.error} />
          <div className="flex justify-end gap-2.5">
            <button type="button" disabled={f.busy} onClick={onClose} className="h-10 border border-wds-border-strong bg-wds-surface px-5 font-wds-sans text-[14px] font-medium text-wds-text-ink outline-none hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring disabled:opacity-50">
              Cancel
            </button>
            <button type="button" disabled={!f.ready || f.busy} title={!f.ready ? 'Pick a reason first' : undefined} onClick={() => void f.submit()} className="h-10 bg-wds-gradient-primary px-5 font-wds-sans text-[14px] font-semibold text-wds-primary-fg outline-none hover:brightness-110 focus-visible:shadow-wds-ring disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted">
              {f.busy ? 'Reversing…' : 'Reverse entry'}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
