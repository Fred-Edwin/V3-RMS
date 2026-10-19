'use client';

import * as React from 'react';

import { WorkforcePinDialog } from '../../_shared';
import { ruleFailure } from '../lib/error-words';
import { longDay } from '../lib/rules-words';
import { rulesWrites } from '../services/rules-services';
import type { PendingConfirmation } from '../types/rules-types';

/** What each confirmation scope is called in a sentence. */
export const SCOPE_NOUN: Record<string, string> = {
  'overtime.multipliers': 'overtime multiplier',
  statutory: 'statutory rates',
  'holidays.dates': 'holiday list',
  'holidays.pay_rate': 'holiday pay rate',
};

export const nounOf = (scope: string): string => SCOPE_NOUN[scope] ?? 'new value';

/** "Confirm the new multiplier": the person who confirms signs with their PIN. Nothing here shows a figure (D1). */
export function ConfirmDialog({ pending, onClose, onDone }: { pending: PendingConfirmation; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const noun = nounOf(pending.scope);

  const submit = async (pin: string): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      await rulesWrites.confirm(pending.versionId, pending.scope, pin);
      onDone();
      onClose();
    } catch (err) {
      setError(ruleFailure(err).text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkforcePinDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Confirm the new ${noun}`}
      summaryRows={[
        { label: 'What', value: `New ${noun}` },
        { label: 'Version', value: `Version ${pending.version}`, mono: true },
        { label: pending.inForce ? 'In force' : 'Starts', value: longDay(pending.effectiveFrom), mono: true },
      ]}
      caption="Until you confirm, the old value stays in use. Your confirmation, with your name, is kept in the audit log."
      confirmLabel="Confirm"
      onSubmit={submit}
      submitting={busy}
      error={error}
    />
  );
}
