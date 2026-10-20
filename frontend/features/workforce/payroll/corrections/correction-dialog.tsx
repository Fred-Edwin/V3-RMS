'use client';

import * as React from 'react';

import { ApiError } from '@/types/api';

import { Callout, ChoiceChips, ErrorBlock, FIELD_CLASS, FormField, KitDialog, ListSkeleton, RadioCards } from '../../_shared';
import { PadNumberInput } from '@/components/ui2/quantity-field';

import { PinActDialog } from '../_shared/components/pin-act-dialog';
import { useCorrectionInputs } from '../_shared/hooks/use-payroll-data';
import { dayMonthTime, kes, kesSigned } from '../_shared/lib/format';
import { refusalWords } from '../_shared/lib/month-view';
import { payrollWrites } from '../_shared/services/payroll-writes';
import { ADJUSTMENT_TYPES, type AdjustmentType, type CorrectionKind, type CorrectionPreview } from '../_shared/types/action-types';
import type { MonthView } from '../_shared/types/month-types';
import type { PayslipRow } from '../_shared/types/tab-types';
import { KIND_TITLES, buildChange, saveBlock, startDraft, type CorrectionDraft } from './correction-change';

const KINDS: CorrectionKind[] = ['LATE_DAYS', 'UNPAID_ABSENCE', 'OVERTIME', 'BASIC', 'EXTRA_LINE'];
const TYPE_WORDS: Record<AdjustmentType, string> = { ALLOWANCE: 'Allowance', INCENTIVE: 'Incentive', ARREARS: 'Arrears', OTHER_EARNING: 'Other earning', ADVANCE_REPAID: 'Advance repaid', HELB: 'HELB', OTHER_DEDUCTION: 'Other deduction' };

/**
 * Correct one payslip until the month is paid (spec S11). First "what is wrong?", then that kind's fields, with the payslip worked out
 * again live (NOW and CORRECTED; nothing is saved by the preview). A reason and the corrector's PIN save it as version n+1. The
 * `expectedVersion` the screen showed travels with every call, so two people correcting at once end in one result and a words message.
 */
export function CorrectionDialog({ view, row, onClose, onDone, onStale }: { view: MonthView; row: PayslipRow; onClose: () => void; onDone: (message: string) => void; onStale: () => void }) {
  const inputs = useCorrectionInputs(view.monthKey, row.payslipId, row.version);
  const [kind, setKind] = React.useState<CorrectionKind | null>(null);
  const [draft, setDraft] = React.useState<CorrectionDraft | null>(null);
  const [reason, setReason] = React.useState('');
  const [preview, setPreview] = React.useState<CorrectionPreview | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const current = inputs.data?.current ?? null;

  React.useEffect(() => {
    if (current && !draft) setDraft(startDraft(current));
  }, [current, draft]);

  const change = kind && draft && current ? buildChange(kind, draft, current) : null;
  const changeKey = JSON.stringify(change);

  React.useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (!change) return;
    let cancelled = false;
    setPreviewing(true);
    const t = window.setTimeout(() => {
      payrollWrites.previewCorrection(view.monthKey, row.payslipId, { change, expectedVersion: row.version }).then(
        (p) => !cancelled && (setPreview(p), setPreviewing(false)),
        (err: unknown) => {
          if (cancelled) return;
          setPreviewing(false);
          setPreviewError(err instanceof ApiError ? refusalWords(err.code, err.message) : 'We could not work that out. Check your connection.');
          if (err instanceof ApiError && err.code === 'PAYSLIP_CHANGED') onStale();
        }
      );
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // The preview follows the request itself (changeKey), not the objects that build it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeKey, view.monthKey, row.payslipId, row.version]);

  if (inputs.status === 'error' && !inputs.data) {
    return (
      <KitDialog open plain width={560} onOpenChange={(o) => !o && onClose()} title="Correct a payslip">
        <ErrorBlock title="The payslip did not load" line={inputs.error.message} onRetry={inputs.reload} reference={inputs.error.code} />
      </KitDialog>
    );
  }
  if (!inputs.data || !draft || !current) {
    return (
      <KitDialog open plain width={560} onOpenChange={(o) => !o && onClose()} title="Correct a payslip">
        <ListSkeleton rows={4} columns={['fill', 100]} label="Loading the payslip" />
      </KitDialog>
    );
  }
  const set = (patch: Partial<CorrectionDraft>): void => setDraft({ ...draft, ...patch });
  const bank = inputs.data.bankFile;
  const block = saveBlock(change, reason, previewError);
  const title = kind ? KIND_TITLES[kind].title : 'Correct a payslip';
  const netUp = preview ? Number(preview.netChange) >= 0 : true;

  return (
    <PinActDialog
      title={title}
      description={`${row.name} · ${row.siteName} · ${view.label} · payslip becomes version ${row.version + 1}. Nothing else on this payslip changes.`}
      confirmLabel="Save the correction"
      busyLabel="Saving…"
      blockedReason={block}
      width={620}
      note={`Recorded in the audit log with your name, the reason, and the old and new figures. The staff member is told and sees version ${row.version + 1} straight away. No other payslip changes.`}
      onClose={onClose}
      onStale={onStale}
      onSign={async (pin, idempotencyKey) => {
        if (!change) return;
        await payrollWrites.correct(view.monthKey, row.payslipId, { change, reason: reason.trim(), pin, expectedVersion: row.version, idempotencyKey });
        onDone('Payslip corrected. The staff member is told.');
      }}
    >
      <RadioCards legend="What is wrong?" legendStyle="caps" value={kind} onChange={(v) => setKind(v as CorrectionKind)} options={KINDS.map((k) => ({ value: k, title: KIND_TITLES[k].card, description: KIND_TITLES[k].line, disabled: k === 'BASIC' && current.basicAmount === null }))} />
      {kind === 'LATE_DAYS' ? (
        <FormField label="Late days counted" helper={`Now ${current.lateDaysCounted}. A correction can only take a counted day back.`}>
          {({ id }) => <PadNumberInput id={id} label="Late days counted" decimal={false} maxLength={2} value={draft.lateDays} onChange={(v) => set({ lateDays: v })} className={`${FIELD_CLASS} max-w-[140px] font-wds-mono`} />}
        </FormField>
      ) : null}
      {kind === 'UNPAID_ABSENCE' ? (
        <FormField label="Unpaid absence days" helper="In steps of half a day.">
          {({ id }) => <PadNumberInput id={id} label="Unpaid absence days" maxLength={4} value={draft.absentDays} onChange={(v) => set({ absentDays: v })} className={`${FIELD_CLASS} max-w-[140px] font-wds-mono`} />}
        </FormField>
      ) : null}
      {kind === 'OVERTIME' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Ordinary day (min)">{({ id }) => <PadNumberInput id={id} label="Ordinary day minutes" decimal={false} maxLength={5} value={draft.ordinary} onChange={(v) => set({ ordinary: v })} className={`${FIELD_CLASS} font-wds-mono`} />}</FormField>
          <FormField label="Rest day (min)">{({ id }) => <PadNumberInput id={id} label="Rest day minutes" decimal={false} maxLength={5} value={draft.rest} onChange={(v) => set({ rest: v })} className={`${FIELD_CLASS} font-wds-mono`} />}</FormField>
          <FormField label="Public holiday (min)">{({ id }) => <PadNumberInput id={id} label="Public holiday minutes" decimal={false} maxLength={5} value={draft.holiday} onChange={(v) => set({ holiday: v })} className={`${FIELD_CLASS} font-wds-mono`} />}</FormField>
        </div>
      ) : null}
      {kind === 'BASIC' ? (
        <FormField label="Basic pay for this month (KES)" helper={`Now ${kes(current.basicAmount)}.`}>
          {({ id }) => <PadNumberInput id={id} label="Basic pay for this month" maxLength={11} value={draft.basic} onChange={(v) => set({ basic: v })} className={`${FIELD_CLASS} max-w-[200px] font-wds-mono`} />}
        </FormField>
      ) : null}
      {kind === 'EXTRA_LINE' ? (
        <div className="flex flex-col gap-3">
          {current.extraLines.length > 0 ? (
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="pb-1.5 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">Take a line off</legend>
              {current.extraLines.map((l) => (
                <label key={l.id} className="flex items-center gap-2.5 py-1 font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                  <input type="checkbox" checked={draft.removeIds.includes(l.id)} onChange={(e) => set({ removeIds: e.target.checked ? [...draft.removeIds, l.id] : draft.removeIds.filter((x) => x !== l.id) })} />
                  {l.label} · {kes(l.amount)}
                </label>
              ))}
            </fieldset>
          ) : null}
          <ChoiceChips legend="Add a line" legendStyle="caps" size="sm" value={draft.addType} onChange={(v) => set({ addType: v as AdjustmentType })} options={ADJUSTMENT_TYPES.map((t) => ({ value: t, label: TYPE_WORDS[t] }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Label" hint="optional">{({ id }) => <input id={id} autoComplete="off" value={draft.addLabel} maxLength={60} onChange={(e) => set({ addLabel: e.target.value })} className={FIELD_CLASS} />}</FormField>
            <FormField label="Amount (KES)" hint="optional">{({ id }) => <PadNumberInput id={id} label="Amount in shillings" maxLength={11} value={draft.addAmount} onChange={(v) => set({ addAmount: v })} className={`${FIELD_CLASS} font-wds-mono`} />}</FormField>
          </div>
        </div>
      ) : null}
      {kind ? (
        <div aria-live="polite" className="flex flex-col">
          {previewing ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Working it out…</p> : null}
          {previewError ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{previewError}</p> : null}
          {preview ? (
            <table className="w-full border-collapse border-t border-wds-text-ink">
              <caption className="sr-only">What changes on the payslip</caption>
              <thead>
                <tr>
                  <th scope="col" className="py-2 text-left font-wds-mono text-[10px] font-normal tracking-[0.08em] text-wds-text-secondary">LINE</th>
                  <th scope="col" className="py-2 text-right font-wds-mono text-[10px] font-normal tracking-[0.08em] text-wds-text-secondary">NOW</th>
                  <th scope="col" className="py-2 text-right font-wds-mono text-[10px] font-normal tracking-[0.08em] text-wds-text-ink">CORRECTED</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((l, i) => (
                  <tr key={`${l.code}-${i}`} className="border-b border-wds-neutral-100">
                    <td className="py-2 font-wds-sans text-[13px] text-wds-text-ink">{l.label}</td>
                    <td className="py-2 text-right font-wds-mono text-[13px] text-wds-text-secondary">{l.now === null ? '—' : kes(l.now)}</td>
                    <td className="py-2 text-right font-wds-mono text-[13px] font-semibold text-wds-text-ink">{l.corrected === null ? 'removed' : kes(l.corrected)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-wds-sans text-[13px] font-semibold text-wds-text-ink">Net pay (KES)</td>
                  <td className="py-2 text-right font-wds-mono text-[13px] text-wds-text-secondary">{kes(preview.netNow)}</td>
                  <td className={`py-2 text-right font-wds-mono text-[13px] font-semibold ${netUp ? 'text-wds-success-fg' : 'text-wds-error-fg'}`}>
                    {kes(preview.netCorrected)} ({kesSigned(preview.netChange)})
                  </td>
                </tr>
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
      {kind ? (
        <FormField label="Why?" hint="required" helper="Say what is wrong, not how much. It is recorded.">
          {({ id, describedBy }) => <textarea id={id} autoComplete="off" aria-describedby={describedBy} rows={2} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} className={`${FIELD_CLASS} h-auto py-2`} />}
        </FormField>
      ) : null}
      {bank ? (
        <Callout tone="warning" size="sm" role="status">
          The bank file was downloaded on {dayMonthTime(bank.downloadedAt)}. Saving voids it and a new one is needed. If it was already uploaded at the bank, tell the Accountant first.
        </Callout>
      ) : null}
    </PinActDialog>
  );
}
