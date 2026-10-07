'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { RunSummaryPanel } from '../../_shared/components/run-summary-panel';
import { WarningBox } from '../../_shared/components/expected-yield-note';
import type { useRecordForm } from '../hooks/use-record-form';
import { YieldReasonChips } from './yield-reason-chips';

type Form = ReturnType<typeof useRecordForm>;

/** True when the yield is off (low or high), which is when "What happened?" is offered. */
export const yieldIsOff = (form: Form): boolean => form.check?.vsUsual?.label === 'LOW' || form.check?.vsUsual?.label === 'HIGH';

/**
 * "Confirm this run" bottom sheet (Paper step 4 `6XV-0`, step 7 with the reason chips): Made, Used, Compared with usual, then Back
 * and Confirm run. Phone only; from tablet width the live "This run" panel does this job. The Confirm button disables while the
 * write is in flight, and the form's one idempotency key means a double tap still records one run.
 */
export function ConfirmSheet({ open, onOpenChange, form, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; form: Form; onConfirm: () => void }) {
  const { output } = form;
  if (!output) return null;
  return (
    <Sheet open={open} onOpenChange={(next) => (form.saving ? undefined : onOpenChange(next))}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0">
        <SheetHeader className="border-b-0 px-wds-4 pb-wds-3">
          <SheetTitle className="text-[20px] font-semibold leading-6">Confirm this run</SheetTitle>
          <SheetDescription>Check the figures. This writes one entry to the record.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-wds-4 overflow-y-auto px-wds-4 pb-wds-4">
          <RunSummaryPanel
            variant="sheet"
            made={{ name: output.name, quantity: form.made, unit: output.unit }}
            used={form.lines.filter((l) => Number(l.quantity) > 0).map((l) => ({ name: l.name, quantity: l.quantity, unit: l.unit }))}
            check={form.check}
          />
          {yieldIsOff(form) ? <YieldReasonChips value={form.yieldReason} onChange={form.setYieldReason} /> : null}
          {form.saveError ? <WarningBox>{form.saveError}</WarningBox> : null}
        </div>
        <div className="flex gap-wds-3 border-t border-wds-border p-wds-4">
          <Button variant="secondary" className="h-12 flex-1 text-[15px]" disabled={form.saving} onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button className="h-12 flex-[2] text-[15px]" disabled={form.saving} onClick={onConfirm}>
            {form.saving ? 'Recording…' : 'Confirm run'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
