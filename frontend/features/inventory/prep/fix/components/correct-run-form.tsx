'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Textarea } from '@/components/ui2/textarea';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { WarningBox, warningText } from '../../_shared/components/expected-yield-note';
import { PrepStepper } from '../../_shared/components/prep-stepper';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { formatQuantity, isPositive } from '../../_shared/lib/prep-format';
import type { CheckResult, CorrectReason, RunDetail } from '../../_shared/types/prep-contract';
import { IngredientPicker } from '../../record/components/ingredient-picker';
import { useFixForm } from '../hooks/use-fix-form';
import { CORRECT_REASONS, checkRows, reasonLabel, type FixFailure, type FixLine } from '../lib/fix-logic';
import { FixModal } from './fix-modal';
import { ReasonChips } from './reason-chips';

const sectionLabel = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted';

export interface CorrectRunFormViewProps {
  run: RunDetail;
  lines: FixLine[];
  made: string;
  reason: CorrectReason | undefined;
  note: string;
  check: CheckResult | null;
  checkFailed: boolean;
  /** Why "Review the correction" is off, or null. Shown under the button so a disabled button always says why. */
  blocker: string | null;
  disabled?: boolean;
  onQuantity: (itemId: string, quantity: string) => void;
  onMade: (quantity: string) => void;
  onRemove: (itemId: string) => void;
  onAdd: () => void;
  onReason: (reason: CorrectReason) => void;
  onNote: (note: string) => void;
  onReview: () => void;
}

/**
 * The correct form (Paper step 14 `7ZQ-0`): "What you used" with a stepper per ingredient and "Was 10 kg" under a changed one,
 * "What you made", "Why are you correcting it?" chips, then "Review the correction". Pure of state so each state can be rendered
 * in a test; `CorrectRunForm` below wires it to the hook.
 */
export function CorrectRunFormView(p: CorrectRunFormViewProps) {
  const warning = p.check ? warningText(p.check, p.run.unit) : null;
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-2">
        <span className={sectionLabel}>What you used</span>
        <ul className="border border-wds-border bg-wds-surface">
          {p.lines.map((line) => {
            const removedNow = line.was !== null && !isPositive(line.quantity);
            const changed = line.was !== null && Number(line.was) !== Number(line.quantity);
            return (
              <li key={line.itemId} className="flex items-center justify-between gap-wds-3 border-b border-wds-border py-[10px] pl-wds-4 pr-wds-3 last:border-b-0">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="break-words font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink">{line.name}</span>
                  {line.was !== null ? (
                    changed ? (
                      <span className="font-wds-sans text-wds-caption leading-4 text-wds-warning-fg">{removedNow ? `Was ${formatQuantity(line.was)} ${line.unit} · not used now` : `Was ${formatQuantity(line.was)} ${line.unit}`}</span>
                    ) : null
                  ) : (
                    <button type="button" disabled={p.disabled} onClick={() => p.onRemove(line.itemId)} className="w-fit font-wds-sans text-wds-caption leading-4 text-wds-text-copy-muted underline outline-none focus-visible:shadow-wds-ring">
                      Remove
                    </button>
                  )}
                </div>
                <PrepStepper numeral="sans" label={line.name} unit={line.unit} value={line.quantity} onChange={(q) => p.onQuantity(line.itemId, q)} disabled={p.disabled} className={cn('[&_label]:min-w-[84px]', changed && '[&_label]:border-y [&_label]:border-wds-warning-fg')} />
              </li>
            );
          })}
        </ul>
        <button type="button" disabled={p.disabled} onClick={p.onAdd} className="w-fit font-wds-sans text-wds-body-sm font-medium text-wds-espresso-700 outline-none hover:underline focus-visible:shadow-wds-ring">
          + Add something else you used
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className={sectionLabel}>What you made</span>
        <div className="flex items-center justify-between gap-wds-3 border border-wds-border bg-wds-surface py-3 pl-wds-4 pr-wds-3">
          <span className="min-w-0 break-words font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink">{p.run.outputName}</span>
          <PrepStepper numeral="sans" label={`${p.run.outputName} made`} unit={p.run.unit} value={p.made} onChange={p.onMade} wide disabled={p.disabled} className="[&_button]:h-12 [&_input]:text-[20px] [&_input]:leading-6 [&_label]:h-12 [&_label]:min-w-[116px]" />
        </div>
      </div>

      <ReasonChips label="Why are you correcting it?" options={CORRECT_REASONS} value={p.reason} onChange={p.onReason} disabled={p.disabled} />

      {p.reason === 'OTHER' ? (
        <label className="flex flex-col gap-2">
          <span className={sectionLabel}>Tell the Store Manager what happened (optional)</span>
          <Textarea maxLength={300} rows={2} value={p.note} disabled={p.disabled} onChange={(e) => p.onNote(e.target.value)} />
        </label>
      ) : null}

      {warning ? <WarningBox>{warning}</WarningBox> : null}
      {p.check?.typoSuspect.suspect && p.check.typoSuspect.text ? <WarningBox>{p.check.typoSuspect.text}</WarningBox> : null}
      {p.checkFailed ? <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{PREP_STATES_COPY.record.checkFailed}</p> : null}

      <div className="flex flex-col items-center gap-2 pt-wds-2">
        <Button className="h-[52px] w-full text-[16px] font-semibold leading-5" disabled={p.blocker !== null || p.disabled} onClick={p.onReview}>
          Review the correction
        </Button>
        <p role="status" className="text-center font-wds-sans text-wds-caption leading-4 text-wds-text-copy-muted">
          {p.blocker ?? 'The original run stays on record, linked to this one.'}
        </p>
      </div>
    </div>
  );
}

/** "Check the correction" body (Paper step 15): the before and after of every line, the reason, and who will see it. */
export function CheckCorrectionBody({ run, lines, made, reason, toManager, failure }: { run: RunDetail; lines: FixLine[]; made: string; reason: CorrectReason; toManager: boolean; failure: FixFailure | null }) {
  const rows = checkRows(run, lines, made);
  const cell = 'flex items-center justify-between gap-wds-4 border-b border-wds-border bg-wds-neutral-50 px-[14px] py-3 last:border-b-0';
  return (
    <>
      <dl className="border border-wds-border">
        {rows.map((row) => (
          <div key={row.label} className={cell}>
            <dt className="min-w-0 break-words font-wds-sans text-wds-body-sm leading-4 text-wds-text-copy-muted">{row.label}</dt>
            <dd className={cn('shrink-0 text-right font-wds-sans text-wds-body leading-[18px]', row.changed ? 'font-medium text-wds-text-ink' : 'text-wds-text-copy-muted')}>{row.value}</dd>
          </div>
        ))}
        <div className={cell}>
          <dt className="font-wds-sans text-wds-body-sm leading-4 text-wds-text-copy-muted">Reason</dt>
          <dd className="font-wds-sans text-wds-body font-medium leading-[18px] text-wds-text-ink">{reasonLabel(reason)}</dd>
        </div>
      </dl>
      {toManager ? <div className="border border-wds-info-border bg-wds-info-bg px-3 py-[10px] font-wds-sans text-wds-body-sm leading-[18px] text-wds-info-fg">The Store Manager will see this correction.</div> : null}
      {failure ? <WarningBox>{failure.message}</WarningBox> : null}
    </>
  );
}

export interface CorrectRunFormProps {
  run: RunDetail;
  /** Called with the NEW run once the correction is saved. */
  onDone: (newRun: RunDetail) => void;
  /** The server said this person may no longer fix this run (24 hours passed): the caller switches to the locked view. */
  onLocked?: () => void;
  /** Reports whether anything was entered, so the caller can ask before discarding. */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * The stateful correct flow: the form, the "Check the correction" step, and the one save. Mount it with `key={run.id}` so each run
 * starts a fresh form with a fresh idempotency key. The new run is returned through `onDone`; the old one stays on record as Corrected.
 */
export function CorrectRunForm({ run, onDone, onLocked, onDirtyChange }: CorrectRunFormProps) {
  const form = useFixForm(run);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const { failure, changed, submit } = form;
  // Attendant payloads carry no `flags`; theirs is the correction a manager is told about.
  const toManager = run.flags === undefined;

  React.useEffect(() => {
    onDirtyChange?.(changed || form.reason !== undefined);
  }, [changed, form.reason, onDirtyChange]);

  React.useEffect(() => {
    if (failure?.locked) {
      setReviewOpen(false);
      onLocked?.();
    }
  }, [failure, onLocked]);

  const save = async (): Promise<void> => {
    const created = await submit();
    if (!created) return;
    setReviewOpen(false);
    useWdsToastStore.getState().addToast({ variant: 'success', title: `${created.reference} saved`, description: `Corrects ${run.reference}. The original stays on record.` });
    onDone(created);
  };

  return (
    <>
      <CorrectRunFormView
        run={run}
        lines={form.lines}
        made={form.made}
        reason={form.reason}
        note={form.note}
        check={form.check}
        checkFailed={form.checkFailed}
        blocker={form.blocker}
        disabled={form.saving}
        onQuantity={form.setQuantity}
        onMade={form.setMade}
        onRemove={form.removeLine}
        onAdd={() => setPickerOpen(true)}
        onReason={form.setReason}
        onNote={form.setNote}
        onReview={() => {
          form.clearFailure();
          setReviewOpen(true);
        }}
      />
      <IngredientPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeItemIds={[run.outputItemId, ...form.lines.map((l) => l.itemId)]}
        onPick={(item) => {
          form.addLine(item);
          setPickerOpen(false);
        }}
      />
      <FixModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        locked={form.saving}
        title="Check the correction"
        description="Nothing is deleted. The original run stays on record."
        footerNote="The original run stays on record."
        footer={
          <>
            <Button variant="secondary" className="h-[52px] w-[110px] text-[15px] md:h-9 md:w-auto" disabled={form.saving} onClick={() => setReviewOpen(false)}>
              Back
            </Button>
            <Button className="h-[52px] grow text-[16px] font-semibold md:h-9 md:grow-0 md:text-wds-body-sm" disabled={form.saving || form.reason === undefined} onClick={() => void save()}>
              {form.saving ? 'Saving…' : 'Save correction'}
            </Button>
          </>
        }
      >
        {form.reason ? <CheckCorrectionBody run={run} lines={form.lines} made={form.made} reason={form.reason} toManager={toManager} failure={form.failure} /> : null}
      </FixModal>
    </>
  );
}
