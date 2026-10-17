'use client';

import * as React from 'react';

import { ChangeSummary, SingleDateField } from '../../../../../_shared';
import { useLookups } from '../../../../_shared/hooks/use-people-data';
import type { EmployeeFile, MovePreview } from '../../../../_shared/types/people-types';
import type { Errors } from '../../../lib/dialog-forms';
import { firstName } from '../../../lib/file-model';
import { longDate, transferLines, transferSites, type TransferForm } from '../../../lib/move-forms';
import { DialogPicker } from '../dialog-fields';

/** The Transfer half of the Move dialog (Paper `ZJ7-0`): where to, from when, and the list of what changes before anything is saved. */
export function TransferPane({
  file,
  form,
  set,
  errors,
  today,
  preview,
  loading,
  previewError,
}: {
  file: EmployeeFile;
  form: TransferForm;
  set: (patch: Partial<TransferForm>) => void;
  errors: Errors<TransferForm>;
  today: string;
  preview: MovePreview | null;
  loading: boolean;
  previewError: string | null;
}) {
  const lookups = useLookups();
  const first = firstName(file.name);
  const departments = (lookups.data?.departments ?? []).filter((d) => d.isActive && d.organizationId === form.toSiteId).map((d) => ({ value: d.id, label: d.name }));
  const positions = (lookups.data?.positions ?? [])
    .filter((p) => p.isActive && (p.departmentIds.length === 0 || p.departmentIds.includes(form.toDepartmentId)))
    .map((p) => ({ value: p.id, label: p.name }));
  const sites = lookups.data ? transferSites(lookups.data, file.organization.id) : [];
  const complete = form.toSiteId !== '' && form.toDepartmentId !== '' && !errors.toDepartmentId && !errors.startsOn;
  return (
    <>
      <div className="grid grid-cols-[1fr_190px] gap-3 max-sm:grid-cols-1">
        <DialogPicker label="Moves to" value={form.toSiteId} onChange={(v) => set({ toSiteId: v, toDepartmentId: '', toPositionId: '' })} options={sites} error={errors.toSiteId} />
        <SingleDateField plainLabel label="Starts on" value={form.startsOn} onChange={(d) => set({ startsOn: d })} minDate={today} maxDate={`${Number(today.slice(0, 4)) + 1}-12-31`} error={errors.startsOn} />
      </div>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <DialogPicker label="Department" value={form.toDepartmentId} onChange={(v) => set({ toDepartmentId: v, toPositionId: '' })} options={departments} disabled={!form.toSiteId} error={errors.toDepartmentId} />
        <DialogPicker label="Position" value={form.toPositionId} onChange={(v) => set({ toPositionId: v })} options={[{ value: '', label: `${file.position?.name ?? 'Position'} (unchanged)` }, ...positions]} disabled={!form.toDepartmentId} />
      </div>
      {complete ? (
        preview ? (
          <ChangeSummary caption={`WHAT CHANGES ON ${longDate(form.startsOn).toUpperCase()}`} lines={transferLines(preview, first)} />
        ) : (
          <p role="status" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{previewError ?? (loading ? 'Working out what changes…' : '')}</p>
        )
      ) : (
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Choose where {first} moves to and the list of what changes appears here before anything is saved.</p>
      )}
    </>
  );
}
