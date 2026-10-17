'use client';

import * as React from 'react';

import { ChangeSummary, SingleDateField } from '../../../../../_shared';
import { addDays } from '../../../../_shared/lib/people-dates';
import type { ExitReason, MovePreview } from '../../../../_shared/types/people-types';
import type { Errors } from '../../../lib/dialog-forms';
import { EXIT_REASON_LABELS } from '../../../lib/file-rows';
import { exitLines, longDate, type ExitForm } from '../../../lib/move-forms';
import { DialogPicker, DialogTextArea } from '../dialog-fields';

/** The Exit half of the Move dialog (Paper `127P-0`): last day, reason, the small checklist, and what changes after the last day. */
export function ExitPane({
  form,
  set,
  errors,
  today,
  undoDays,
  preview,
}: {
  form: ExitForm;
  set: (patch: Partial<ExitForm>) => void;
  errors: Errors<ExitForm>;
  today: string;
  undoDays: number;
  preview: MovePreview | null;
}) {
  const reasons = (Object.keys(EXIT_REASON_LABELS) as ExitReason[]).map((r) => ({ value: r, label: EXIT_REASON_LABELS[r] }));
  return (
    <>
      <div className="grid grid-cols-[190px_1fr] gap-3 max-sm:grid-cols-1">
        <SingleDateField plainLabel label="Last day" value={form.lastDay} onChange={(d) => set({ lastDay: d })} minDate={addDays(today, -7)} maxDate={addDays(today, 365)} error={errors.lastDay} />
        <DialogPicker label="Reason" value={form.reason} onChange={(v) => set({ reason: v as ExitReason })} options={reasons} error={errors.reason} />
      </div>
      {form.reason === 'OTHER' ? <DialogTextArea label="What is the reason?" value={form.note} onChange={(v) => set({ note: v })} rows={2} error={errors.note} /> : null}
      <label className="flex cursor-pointer items-center gap-2.5 border border-wds-border px-3.5 py-2.5 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink has-[:focus-visible]:shadow-wds-ring">
        <input type="checkbox" autoComplete="off" checked={form.uniformReturned} onChange={(e) => set({ uniformReturned: e.target.checked })} className="h-4 w-4 accent-[var(--wds-primary)]" />
        Uniform and keys returned
      </label>
      <ChangeSummary caption={`WHAT CHANGES AFTER ${form.lastDay ? longDate(form.lastDay).toUpperCase() : 'THE LAST DAY'}`} lines={exitLines(form.lastDay, undoDays, preview)} />
    </>
  );
}
