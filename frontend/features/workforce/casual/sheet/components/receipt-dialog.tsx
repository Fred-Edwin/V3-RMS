'use client';

import * as React from 'react';

import { formatApiErrorMessage } from '@/types/api';

import { FIELD_CLASS, FormField, KitDialog, DialogButton } from '../../../_shared';
import { newKey } from '../../_shared/lib/draft-store';
import { kes } from '../../_shared/lib/casual-words';
import { casualWrites } from '../../_shared/services/casual-services';
import type { Sheet, SheetLine } from '../../_shared/types/casual-types';

/**
 * The worker's receipt, typed on the head's phone after the cash holder has paid (PD25). The worker types their full name and taps
 * "I received KES 900"; the printed sheet shows it in the script font. Enter does not submit.
 */
export function ReceiptDialog({ sheet, line, onClose, onSaved }: { sheet: Sheet; line: SheetLine | null; onClose: () => void; onSaved: (next: Sheet) => void }) {
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = React.useRef(newKey());
  React.useEffect(() => {
    setName('');
    setError(null);
    key.current = newKey();
  }, [line?.id]);

  const ready = name.trim().split(/\s+/).length >= 2 && name.trim().length >= 3;
  const save = async () => {
    if (!line || !sheet.id) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await casualWrites.receive(sheet.id, line.id, { name: name.trim(), idempotencyKey: key.current }));
    } catch (e) {
      setError(formatApiErrorMessage(e, 'That did not go through.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KitDialog
      open={line !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
      title={line ? `${line.name}, sign for your cash` : ''}
      description="Type your full name to say you received your pay."
      busy={busy}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" onClick={() => void save()} disabled={!ready || busy}>
            {busy ? 'Saving…' : `I received KES ${line ? kes(line.amount) : ''}`}
          </DialogButton>
        </>
      }
    >
      <FormField label="Your full name" error={error ?? undefined}>
        {({ id, describedBy, invalid }) => <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} className={FIELD_CLASS} />}
      </FormField>
    </KitDialog>
  );
}
