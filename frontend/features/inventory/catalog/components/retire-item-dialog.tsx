'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Combobox } from '@/components/ui2/combobox';
import { Textarea } from '@/components/ui2/textarea';
import { ChoiceChips, DecisionDialog, DialogLabel, TouchLine } from '../../_shared/components/decision-dialog';
import { listItems } from '../../services';
import { composeRetireReason, REASON_MAX, retireTouches, RETIRE_REASONS, type RetireReason } from '../lib/retire-item';
import type { InventoryItemDetail, ItemChangeReview } from '../../types';

/** Live items other than this one, for "Replaced by". Loaded when the dialog opens; a failure just leaves the field empty. */
function useReplacementOptions(open: boolean, excludeId: string) {
  const [options, setOptions] = React.useState<Array<{ value: string; label: string }>>([]);
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const found: Array<{ value: string; label: string }> = [];
      for (let page = 1; page <= 5; page += 1) {
        try {
          const res = await listItems({ page, perPage: 100, includeRetired: false });
          found.push(...res.data.filter((i) => i.id !== excludeId).map((i) => ({ value: i.id, label: i.name })));
          if (page >= res.pagination.totalPages) break;
        } catch {
          break;
        }
      }
      if (!cancelled) setOptions(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, excludeId]);
  return options;
}

export interface RetireItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Pick<InventoryItemDetail, 'id' | 'name' | 'usageUnit' | 'centralStoreRestockLevel'>;
  review: ItemChangeReview;
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
}

/** Retire "Sugar, brown"? — Paper step 31. Nothing is deleted; a reason is required, a replacement is not. */
export function RetireItemDialog({ open, onOpenChange, item, review, busy, error, onConfirm }: RetireItemDialogProps) {
  const [reason, setReason] = React.useState<RetireReason | null>(null);
  const [note, setNote] = React.useState('');
  const [replacedById, setReplacedById] = React.useState('');
  const options = useReplacementOptions(open, item.id);
  React.useEffect(() => {
    if (open) {
      setReason(null);
      setNote('');
      setReplacedById('');
    }
  }, [open]);

  const replacedBy = options.find((o) => o.value === replacedById)?.label ?? null;
  const composed = composeRetireReason(reason, note, replacedBy);
  const touches = retireTouches(review, item.usageUnit, item.centralStoreRestockLevel !== null);

  return (
    <DecisionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Retire “${item.name}”?`}
      description="Nothing is deleted. The item stops being offered, and its history stays."
      footerNote="Restore any time from Show retired."
      error={error}
      busy={busy}
      actions={
        <>
          <Button variant="secondary" className="h-9 px-[18px] text-[14px]" onClick={() => onOpenChange(false)} disabled={busy}>
            Back
          </Button>
          <Button variant="destructive" className="h-9 px-[22px] text-[14px]" onClick={() => composed && onConfirm(composed)} disabled={busy || composed === null}>
            {busy ? 'Retiring…' : 'Retire item'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <DialogLabel>What this touches</DialogLabel>
        {touches.map((line) => (
          <TouchLine key={line.text} tone={line.tone}>
            {line.text}
          </TouchLine>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        <DialogLabel hint="required">Why?</DialogLabel>
        <ChoiceChips name="retire-reason" label="Why is it retired?" options={RETIRE_REASONS} value={reason} onChange={setReason} />
        {reason === 'Other' ? (
          <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, REASON_MAX - 20))} aria-label="Say why" placeholder="In a few words" rows={2} maxLength={REASON_MAX - 20} />
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <DialogLabel hint="optional">
          Replaced by
        </DialogLabel>
        <Combobox value={replacedBy ?? ''} onValueChange={setReplacedById} options={options} placeholder="Pick the item that takes its place" aria-label="Replaced by" chevron name="retire-replaced-by" />
      </div>
    </DecisionDialog>
  );
}
