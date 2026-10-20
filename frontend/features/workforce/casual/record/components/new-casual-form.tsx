'use client';

import * as React from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';

import { FIELD_CLASS, FormField, PhoneButton } from '../../../_shared';
import { newKey } from '../../_shared/lib/draft-store';
import { casualWrites } from '../../_shared/services/casual-services';
import type { Worker } from '../../_shared/types/casual-types';

/**
 * "New casual": full name, the national ID number twice, an optional phone. The ID number is unique across the company, so a worker who is
 * already on file is offered as a pick instead of a second record (PD20). Needs a signal: the ID check is the server's.
 */
export function NewCasualForm({ onAdded, onExisting }: { onAdded: (worker: Worker) => void; onExisting: (worker: Worker) => void }) {
  const [name, setName] = React.useState('');
  const [id, setId] = React.useState('');
  const [again, setAgain] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = React.useRef(newKey());

  const nameError = name.trim() !== '' && name.trim().split(/\s+/).length < 2 ? "Add the worker's full name." : undefined;
  const mismatch = again !== '' && id.trim().toUpperCase() !== again.trim().toUpperCase() ? 'The two ID numbers are different.' : undefined;
  const ready = name.trim().split(/\s+/).length >= 2 && id.trim().length >= 5 && !mismatch && again.trim() !== '';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      onAdded(await casualWrites.addPerson({ fullName: name.trim(), nationalId: id.trim(), nationalIdConfirm: again.trim(), phone: phone.trim() || undefined, idempotencyKey: key.current }));
    } catch (e) {
      const existing = e instanceof ApiError && e.code === 'CASUAL_EXISTS' ? (e.details as { worker?: Worker } | undefined)?.worker : undefined;
      if (existing) onExisting(existing);
      else setError(e instanceof ApiError && e.code === 'NETWORK' ? 'No signal. A new casual needs a connection. Pick from My casuals instead.' : formatApiErrorMessage(e, 'That did not go through.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <FormField label="Full name" error={nameError}>
        {({ id: fid, describedBy, invalid }) => <input id={fid} aria-describedby={describedBy} aria-invalid={invalid || undefined} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} />}
      </FormField>
      <FormField label="National ID number">
        {({ id: fid }) => <input id={fid} autoComplete="off" value={id} onChange={(e) => setId(e.target.value)} className={FIELD_CLASS} />}
      </FormField>
      <FormField label="Type it again" error={mismatch}>
        {({ id: fid, describedBy, invalid }) => <input id={fid} aria-describedby={describedBy} aria-invalid={invalid || undefined} autoComplete="off" value={again} onChange={(e) => setAgain(e.target.value)} className={FIELD_CLASS} />}
      </FormField>
      <FormField label="Phone" hint="optional">
        {({ id: fid }) => <input id={fid} type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD_CLASS} />}
      </FormField>
      {error ? (
        <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {error}
        </p>
      ) : null}
      <PhoneButton size="sm" disabled={!ready || busy} onClick={() => void submit()}>
        {busy ? 'Adding…' : 'Add casual'}
      </PhoneButton>
    </div>
  );
}
