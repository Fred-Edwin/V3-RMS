'use client';

import * as React from 'react';

import { DialogButton, KitDialog, SingleDateField } from '../../../../_shared';
import { useLookups } from '../../../_shared/hooks/use-people-data';
import { nairobiDay } from '../../../_shared/lib/people-dates';
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
        <SingleDateField label="Starts on" value={form.startsOn} onChange={(d) => setForm((f) => ({ ...f, startsOn: d }))} maxDate={`${Number(today.slice(0, 4)) + 1}-12-31`} minDate="2020-01-01" error={shown ? errors.startsOn : undefined} />
        {form.contractTypeId === '' && !endsRequired ? null : <SingleDateField label="Ends on" value={form.endsOn || null} onChange={(d) => setForm((f) => ({ ...f, endsOn: d }))} maxDate={`${Number(today.slice(0, 4)) + 10}-12-31`} minDate={form.startsOn} error={shown ? errors.endsOn : undefined} />}
      </div>
      <DialogError message={action.error} />
    </KitDialog>
  );
}
