'use client';

import * as React from 'react';

import { DialogButton, KitDialog, SingleDateField } from '../../../../_shared';
import { useLookups } from '../../../_shared/hooks/use-people-data';
import { formatDayMonthYear, nairobiDay } from '../../../_shared/lib/people-dates';
import { peopleWrites } from '../../../_shared/services/people-writes';
import { addMonths } from '../../../hire/lib/hire-figures';
import { useFileAction } from '../../hooks/use-file-action';
import { hasErrors, toContractBody, validateContract, type ContractForm } from '../../lib/dialog-forms';
import { firstName } from '../../lib/file-model';
import { DialogError, DialogPicker, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

/** Create the contract (W12): the record only. Signing with a PIN comes with the documents slice (decision 16). */
export function ContractDialog({ file, onClose, done }: FileDialogProps) {
  const today = React.useMemo(() => nairobiDay(), []);
  const lookups = useLookups();
  const [form, setForm] = React.useState<ContractForm>({ contractTypeId: '', startsOn: file.probation?.confirmedOn ? today : file.startDate > today ? file.startDate : today, endsOn: '' });
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Contract recorded.'));
  const types = lookups.data?.contractTypes ?? [];
  const chosen = types.find((t) => t.id === form.contractTypeId);
  const endsRequired = chosen?.durationMonths != null;
  const errors = validateContract(form, endsRequired);
  const first = firstName(file.name);

  const pick = (id: string): void => {
    const t = types.find((x) => x.id === id);
    setForm((f) => ({ ...f, contractTypeId: id, endsOn: t?.durationMonths != null ? addMonths(f.startsOn, t.durationMonths) : '' }));
  };
  const save = (): void => {
    setShown(true);
    if (hasErrors(errors)) return;
    void action.run(() => peopleWrites.createContract(file.id, toContractBody(form)), `Contract recorded for ${first}.`);
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Contract for ${file.name}`}
      description="Records the contract and its dates. A recorded contract completes the file's contract step."
      width={720}
      busy={action.busy}
      footer={
        <>
          <FooterNote>Logged, with your name.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={save} disabled={action.busy}>{action.busy ? 'Saving…' : 'Record contract'}</DialogButton>
        </>
      }
    >
      {types.length > 0 ? <DialogPicker label="Kind of contract" hint="optional" value={form.contractTypeId} onChange={pick} options={[{ value: '', label: 'Open-ended' }, ...types.map((t) => ({ value: t.id, label: t.name }))]} /> : null}
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <SingleDateField plainLabel label="Starts on" value={form.startsOn} onChange={(d) => setForm((f) => ({ ...f, startsOn: d }))} maxDate={`${Number(today.slice(0, 4)) + 1}-12-31`} minDate="2020-01-01" error={shown ? errors.startsOn : undefined} />
        {form.contractTypeId === '' && !endsRequired ? null : <SingleDateField plainLabel label="Ends on" value={form.endsOn || null} onChange={(d) => setForm((f) => ({ ...f, endsOn: d }))} maxDate={`${Number(today.slice(0, 4)) + 10}-12-31`} minDate={form.startsOn} error={shown ? errors.endsOn : undefined} />}
      </div>
      <section aria-label="The contract" className="border border-wds-border">
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">Wendo Coffee Bistro</span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Contract of employment · monthly</span>
          </div>
          <span className="font-wds-mono text-[11px] leading-4 text-wds-text-secondary">{file.employeeNumber}</span>
        </div>
        <div className="grid grid-cols-2 border-t border-wds-border max-sm:grid-cols-1">
          <ContractCell label="EMPLOYEE" value={[file.name, file.position?.name, file.organization.name].filter(Boolean).join(' · ')} />
          <ContractCell label="STARTS" value={formatDayMonthYear(form.startsOn)} divided />
        </div>
        <div className="border-t border-wds-border">
          <ContractCell label="LATENESS AND OVERTIME" value="Company standard, set by the Director in Rules" />
        </div>
        <div className="grid grid-cols-2 border-t border-wds-border max-sm:grid-cols-1">
          <ContractCell label="SIGNED FOR WENDO" value="Signing with a PIN arrives with Documents" muted />
          <ContractCell label="SIGNED BY THE EMPLOYEE" value="Signing arrives with Documents" muted divided />
        </div>
      </section>
      <DialogError message={action.error} />
    </KitDialog>
  );
}

function ContractCell({ label, value, muted, divided }: { label: string; value: string; muted?: boolean; divided?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 px-5 py-3 ${divided ? 'border-l border-wds-border max-sm:border-l-0 max-sm:border-t' : ''}`}>
      <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{label}</span>
      <span className={`font-wds-sans text-[14px] leading-[18px] ${muted ? 'text-wds-text-secondary' : 'text-wds-text-ink'}`}>{value}</span>
    </div>
  );
}
