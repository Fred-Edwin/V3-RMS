'use client';

import * as React from 'react';

import { ChangeSummary, DialogButton, KitDialog, SegmentedControl, SingleDateField } from '../../../../../_shared';
import { useLookups } from '../../../../_shared/hooks/use-people-data';
import { nairobiDay } from '../../../../_shared/lib/people-dates';
import { peopleWrites } from '../../../../_shared/services/people-writes';
import { useFileAction } from '../../../hooks/use-file-action';
import { hasErrors } from '../../../lib/dialog-forms';
import { firstName } from '../../../lib/file-model';
import { loanLines, toLoanBody, validateLoan, type LoanForm, type LoanMode } from '../../../lib/move-forms';
import { DialogError, DialogPicker, FooterNote } from '../dialog-fields';
import type { FileDialogProps } from '../file-dialogs';

/** Send to another site (Paper `11YA-0`): for a day, until a date, or until you bring them back. The home department does not change. */
export function LoanDialog({ file, onClose, done }: FileDialogProps) {
  const today = React.useMemo(() => nairobiDay(), []);
  const lookups = useLookups();
  const first = firstName(file.name);
  const [form, setForm] = React.useState<LoanForm>({ toSiteId: '', mode: 'today', until: '' });
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Sent.'));
  const errors = validateLoan(form, today);
  const sites = (lookups.data?.organizations ?? []).filter((o) => o.id !== file.organization.id && o.type === 'BRANCH').map((o) => ({ value: o.id, label: o.name }));
  const siteName = sites.find((s) => s.value === form.toSiteId)?.label ?? '';

  const send = (): void => {
    setShown(true);
    if (hasErrors(errors)) return;
    void action.run(() => peopleWrites.loan(file.id, toLoanBody(form, today)), `${first} works at ${siteName} from now.`);
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Send ${file.name} to another site`}
      description={`For a day or a few days. ${first}'s home department does not change.`}
      busy={action.busy}
      footer={
        <>
          <FooterNote>Both Branch Managers are told. Logged.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={send} disabled={action.busy}>{action.busy ? 'Sending…' : `Send ${first} now`}</DialogButton>
        </>
      }
    >
      <DialogPicker label="Works at" value={form.toSiteId} onChange={(v) => setForm((f) => ({ ...f, toSiteId: v }))} options={sites} error={shown ? errors.toSiteId : undefined} />
      <SegmentedControl
        label="For how long"
        value={form.mode}
        onChange={(v) => setForm((f) => ({ ...f, mode: v as LoanMode }))}
        items={[{ value: 'today', label: 'Today only' }, { value: 'until', label: 'Until a date' }, { value: 'back', label: `Until I bring ${first} back` }]}
        className="flex-wrap self-start"
      />
      {form.mode === 'until' ? <SingleDateField label="Until" value={form.until || null} onChange={(d) => setForm((f) => ({ ...f, until: d }))} minDate={today} maxDate={`${Number(today.slice(0, 4)) + 1}-12-31`} error={shown ? errors.until : undefined} /> : null}
      <ChangeSummary caption="WHAT HAPPENS" lines={loanLines(form, siteName, file.organization.name, first, today)} />
      <DialogError message={action.error} />
    </KitDialog>
  );
}
