'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { Skeleton } from '@/components/ui2/skeleton';
import { ErrorState } from '@/components/app/shell/shell-states';
import { roleLabel } from '@/components/app/shell/role-label';
import { useAuthStore } from '@/store/authStore';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { useLoader } from '../../../_shared/hooks/use-async';
import { OutputSelect } from '../../_shared/components/output-picker';
import { WarningBox } from '../../_shared/components/expected-yield-note';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { formatDayAndClock, formatQuantity } from '../../_shared/lib/prep-format';
import { prepApi } from '../../_shared/services/prep-api';
import type { RunDetail } from '../../_shared/types/prep-contract';
import { useRecordForm } from '../hooks/use-record-form';
import { yieldIsOff } from './confirm-sheet';
import { IngredientPicker } from './ingredient-picker';
import { RunFormBody } from './run-form-body';
import { YieldReasonChips } from './yield-reason-chips';

const money = (value: string): string => `KES ${Number(value).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

/**
 * "New prep run" for the Store Manager and System Admin (Paper step 41 `1UPP-0`): the same form as the Attendant's, in a drawer on
 * the Runs home, with "In stock now" under each ingredient and the input cost and cost per portion under the made figure. A run the
 * manager records shows in Runs like any other. Mounted only while open, so each opening is a fresh form with a fresh idempotency key.
 */
function DrawerBody({ onClose, onRecorded }: { onClose: () => void; onRecorded: (run: RunDetail) => void }) {
  const user = useAuthStore((s) => s.user);
  const outputs = useLoader('prep-outputs-drawer', () => prepApi.outputs().then((r) => r.items), PREP_STATES_COPY.record.outputsErrorTitle);
  const [itemId, setItemId] = React.useState<string | undefined>();
  const form = useRecordForm({ outputItemId: itemId, outputs: outputs.data });
  const [ingredientOpen, setIngredientOpen] = React.useState(false);
  const [repeatOpen, setRepeatOpen] = React.useState(false);

  const submit = async (): Promise<void> => {
    const run = await form.record();
    if (run) onRecorded(run);
  };
  const requestConfirm = (): void => {
    if (!form.canReview) return;
    if (form.check?.repeat.duplicate) setRepeatOpen(true);
    else void submit();
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>New prep run</SheetTitle>
        <SheetDescription className="font-wds-mono text-wds-field-label uppercase tracking-[0.04em]">
          Recorded as {user?.name ?? 'you'} · {roleLabel(user?.role)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-wds-4 overflow-y-auto px-wds-6 py-wds-5">
        <div className="flex flex-col gap-1.5">
          <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted">What did you make?</span>
          {outputs.status === 'error' ? (
            <ErrorState title={PREP_STATES_COPY.record.outputsErrorTitle} description={outputs.error ?? ''} onRetry={outputs.reload} />
          ) : outputs.status === 'ready' ? (
            <OutputSelect outputs={outputs.data ?? []} value={itemId} onChange={setItemId} />
          ) : (
            <Skeleton className="h-8 w-full" />
          )}
        </div>

        {form.output ? <RunFormBody form={form} mode="manager" onAddClick={() => setIngredientOpen(true)} /> : null}

        {form.output && form.check?.cost ? (
          <dl className="border border-wds-border bg-wds-neutral-50">
            <div className="flex items-center justify-between border-b border-wds-neutral-100 px-wds-3 py-wds-2.5">
              <dt className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">Input cost</dt>
              <dd className="font-wds-mono text-wds-body-sm text-wds-text-ink">{money(form.check.cost.totalInput)}</dd>
            </div>
            <div className="flex items-center justify-between px-wds-3 py-wds-2.5">
              <dt className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">Cost per {form.output.unit === 'portions' ? 'portion' : form.output.unit}</dt>
              <dd className="font-wds-mono text-wds-body-sm text-wds-text-ink">{form.check.cost.perUnit !== null ? money(form.check.cost.perUnit) : '—'}</dd>
            </div>
          </dl>
        ) : null}

        {yieldIsOff(form) ? <YieldReasonChips value={form.yieldReason} onChange={form.setYieldReason} /> : null}
        {form.saveError ? <WarningBox>{form.saveError}</WarningBox> : null}
      </div>

      <SheetFooter className="items-end justify-between gap-wds-6">
        <p className="max-w-[420px] font-wds-sans text-wds-caption text-wds-text-copy-muted">
          This writes one entry to the record. A run you record yourself shows in Prep history like any other. Nothing is saved until you confirm.
        </p>
        <div className="flex shrink-0 gap-wds-2">
          <Button variant="secondary" onClick={onClose} disabled={form.saving}>
            Cancel
          </Button>
          <Button disabled={!form.canReview || form.saving} onClick={requestConfirm}>
            {form.saving ? 'Recording…' : 'Confirm run'}
          </Button>
        </div>
      </SheetFooter>

      <IngredientPicker
        open={ingredientOpen}
        onOpenChange={setIngredientOpen}
        excludeItemIds={[...(form.output ? [form.output.itemId] : []), ...form.lines.map((l) => l.itemId)]}
        onPick={(item) => {
          form.addLine(item);
          setIngredientOpen(false);
        }}
      />
      <ConfirmDialog
        open={repeatOpen}
        onOpenChange={setRepeatOpen}
        title="Looks like a repeat"
        description={
          form.check?.repeat.of
            ? `${form.check.repeat.of.reference} was recorded ${formatDayAndClock(form.check.repeat.of.at)} with the same amounts. Record it again?`
            : 'This matches a run recorded today. Record it again?'
        }
        confirmLabel="Record again"
        cancelLabel="Go back"
        destructive={false}
        onConfirm={() => {
          setRepeatOpen(false);
          void submit();
        }}
      />
    </>
  );
}

export function ManagerRunDrawer({ open, onOpenChange, onRecorded }: { open: boolean; onOpenChange: (open: boolean) => void; onRecorded: (run: RunDetail) => void }) {
  const handleRecorded = (run: RunDetail): void => {
    useWdsToastStore.getState().addToast({
      variant: 'success',
      title: `${run.reference} recorded`,
      description: `${run.outputName} · ${formatQuantity(run.made)} ${run.unit}`,
    });
    onOpenChange(false);
    onRecorded(run);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[600px] sm:max-w-full">{open ? <DrawerBody onClose={() => onOpenChange(false)} onRecorded={handleRecorded} /> : null}</SheetContent>
    </Sheet>
  );
}
