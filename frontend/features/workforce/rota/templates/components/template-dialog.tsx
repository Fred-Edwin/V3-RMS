'use client';

import * as React from 'react';

import { Picker } from '@/components/ui2/picker';
import { ApiError, formatApiErrorMessage } from '@/types/api';

import {
  AddChip,
  Callout,
  ChoiceChips,
  DIALOG_LEADS,
  DialogButton,
  EMPTY_REASON,
  FIELD_CLASS,
  FormField,
  KitDialog,
  RadioCards,
  ReasonChips,
  RemovableChip,
  ShiftSwatchPicker,
  TimeField,
  reasonText,
  type ReasonValue,
} from '../../../_shared';
import { NEAR_TERM_REASONS } from '../../_shared/lib/rota-copy';
import { reasonProblem } from '../../_shared/lib/rota-edits';
import { breakWords, hoursUnit } from '../../_shared/lib/shift-look';
import { rotaWrites } from '../../_shared/services/rota-services';
import type { TemplateView } from '../../_shared/types/rota-types';
import { BREAK_CHOICES, EMPTY_FORM, canSave, formOf, paidMinutesOf, suggestLetter, timesChanged, toCreateBody, toUpdateBody, validateTemplate, type TemplateForm } from '../lib/template-form';

const LABELS = Object.fromEntries(NEAR_TERM_REASONS.map((r) => [r.key, r.label]));

/**
 * Add or edit a shift (Paper step 7). Name, times, unpaid break, colour, who can use it, departments. An edit explains in words what it
 * does to shifts already on the rota: past days keep what was worked, upcoming days move and staff are told.
 */
export function TemplateDialog({
  template,
  siteId,
  siteName,
  departments,
  canCompanyWide,
  takenLetters,
  onClose,
  onSaved,
}: {
  /** The shift being edited, or null to add one. */
  template: TemplateView | null;
  /** The site a "this site only" shift belongs to. */
  siteId: string | null;
  siteName: string;
  departments: readonly { id: string; name: string }[];
  /** HR and the Director may make a shift every site can use. */
  canCompanyWide: boolean;
  takenLetters: ReadonlySet<string>;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = React.useState<TemplateForm>(template ? formOf(template) : EMPTY_FORM);
  const [adding, setAdding] = React.useState(false);
  const [needsReason, setNeedsReason] = React.useState(false);
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);
  const set = (patch: Partial<TemplateForm>): void => setForm((f) => ({ ...f, ...patch }));
  const errors = touched ? validateTemplate(form) : {};
  const paid = paidMinutesOf(form);
  const editing = template !== null;
  const moves = editing && timesChanged(template, form);
  const text = reasonText(reason, LABELS);
  const blockedReason = needsReason && reasonProblem(text) !== null;
  const remaining = departments.filter((d) => !form.departmentIds.includes(d.id));
  const nameOf = (id: string): string => departments.find((d) => d.id === id)?.name ?? 'Department';

  const save = async (): Promise<void> => {
    setTouched(true);
    if (!canSave(form) || blockedReason) return;
    setBusy(true);
    setError(null);
    try {
      if (template) {
        await rotaWrites.updateTemplate(template.id, toUpdateBody(template, form, needsReason && text ? text : undefined));
        onSaved(`${form.name.trim()} was saved.`);
      } else {
        await rotaWrites.createTemplate(toCreateBody(form, siteId, suggestLetter(form.name, takenLetters)));
        onSaved(`${form.name.trim()} was added.`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'REASON_REQUIRED') setNeedsReason(true);
      setError(formatApiErrorMessage(err, 'That did not save. Nothing was changed.'));
    } finally {
      setBusy(false);
    }
  };

  const retire = async (t: TemplateView): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await rotaWrites.retireTemplate(t.id);
      onSaved(`${t.name} was retired.`);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'That did not go through. Nothing was changed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      busy={busy}
      width={600}
      title={editing ? `Edit ${template.name}` : 'Add a shift'}
      description={editing ? DIALOG_LEADS.templateEdit : DIALOG_LEADS.template}
      footer={
        <>
          <span className="mr-auto max-w-[260px] font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Changes apply to future shifts only. Past weeks stay as they were.</span>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" onClick={() => void save()} disabled={busy || blockedReason} title={blockedReason ? 'Say why first.' : undefined}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add shift'}
          </DialogButton>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_130px_130px] items-start gap-3 max-sm:grid-cols-2">
        <FormField label="Name" error={errors.name} className="max-sm:col-span-2">
          {(ids) => <input id={ids.id} autoComplete="off" value={form.name} maxLength={40} aria-invalid={ids.invalid || undefined} aria-describedby={ids.describedBy} onChange={(e) => set({ name: e.target.value })} className={FIELD_CLASS} />}
        </FormField>
        <TimeField label="Starts" value={form.start} onChange={(v) => set({ start: v })} />
        <TimeField label="Ends" value={form.end} onChange={(v) => set({ end: v })} error={errors.end} />
      </div>
      {errors.end ? null : <p className="-mt-3 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Ends must be later on the same day. There are no overnight shifts.</p>}
      <ChoiceChips
        legend="Unpaid break"
        legendStyle="sentence"
        options={BREAK_CHOICES.map((m) => ({ value: String(m), label: breakWords(m) }))}
        value={String(form.breakMinutes)}
        onChange={(v) => set({ breakMinutes: Number(v) })}
        trailing={<span className="ml-auto font-wds-sans text-[13px] leading-4 text-wds-text-ink">Paid hours: {paid === null ? '–' : hoursUnit(paid)}</span>}
      />
      <div className="flex flex-col gap-2.5">
        <span aria-hidden className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">
          Colour on the grid
        </span>
        <ShiftSwatchPicker value={form.tone} onChange={(tone) => set({ tone })} />
      </div>
      <RadioCards
        legend="Who can use it"
        columns={2}
        value={form.scope}
        onChange={(v) => set({ scope: v === 'company' ? 'company' : 'site' })}
        options={[
          { value: 'site', title: `${siteName} only`, description: 'What a Branch Manager can add', disabled: editing },
          { value: 'company', title: 'Every site', description: 'HR or the Director only', disabled: editing || !canCompanyWide },
        ]}
      />
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-2.5 p-0 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">Departments</legend>
        <div className="flex flex-wrap items-center gap-2">
          {form.departmentIds.map((id) => (
            <RemovableChip key={id} label={nameOf(id)} onRemove={() => set({ departmentIds: form.departmentIds.filter((d) => d !== id) })} />
          ))}
          {form.departmentIds.length === 0 ? <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Every department</span> : null}
          {adding ? (
            <Picker aria-label="Add a department" value="" placeholder="Choose a department" chips={false} className="h-8 w-[200px]" options={remaining.map((d) => ({ value: d.id, label: d.name }))} onValueChange={(id) => { set({ departmentIds: [...form.departmentIds, id] }); setAdding(false); }} />
          ) : remaining.length > 0 ? (
            <AddChip onClick={() => setAdding(true)}>+ Department</AddChip>
          ) : null}
        </div>
      </fieldset>
      {moves ? (
        <Callout tone="neutral" bullet size="sm">
          A change to the times moves shifts from today on and tells each person. If past days used the old times, this becomes a new version and the old one is retired, so past weeks keep what was worked.
        </Callout>
      ) : null}
      {editing && !template.retiredAt ? (
        <div className="flex items-center justify-between gap-4 border-t border-wds-border pt-4">
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Retiring hides this shift from the picker. It is refused while upcoming shifts still use it, and past weeks keep it.</span>
          <DialogButton kind="cancel" disabled={busy} onClick={() => void retire(template)}>
            Retire this shift
          </DialogButton>
        </div>
      ) : null}
      {needsReason ? <ReasonChips legend="Why are the times changing?" legendStyle="sentence" hint="required" options={[...NEAR_TERM_REASONS]} value={reason} onChange={setReason} disabled={busy} /> : null}
      {error ? (
        <Callout tone="error" role="alert" size="sm">
          {error}
        </Callout>
      ) : null}
    </KitDialog>
  );
}
