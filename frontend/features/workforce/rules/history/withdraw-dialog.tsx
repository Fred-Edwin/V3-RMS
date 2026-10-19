'use client';

import * as React from 'react';

import { WhyField } from '../change/change-parts';
import { WorkforcePinDialog } from '../../_shared';
import { ruleFailure } from '../lib/error-words';
import { longDay } from '../lib/rules-words';
import { rulesWrites } from '../services/rules-services';

/** Withdraw a scheduled version: a reason and the PIN. The version stays in the history as "Withdrawn"; the same people are told. */
export function WithdrawDialog({ versionId, version, startsOn, onClose, onDone }: { versionId: string; version: number; startsOn: string | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  const submit = async (pin: string): Promise<void> => {
    if (reason.trim().length === 0) {
      setError('Say why before you sign.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await rulesWrites.withdraw(versionId, reason.trim(), pin);
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
      title={`Withdraw version ${version}`}
      summaryRows={[
        { label: 'Version', value: `Version ${version}`, mono: true },
        ...(startsOn ? [{ label: 'Starts', value: longDay(startsOn), mono: true }] : []),
      ]}
      summary={<WhyField value={reason} onChange={setReason} disabled={busy} />}
      caption="The version stays in the history as Withdrawn. The same people are told, and the withdrawal is kept in the audit log."
      confirmLabel={`Withdraw version ${version}`}
      onSubmit={submit}
      submitting={busy}
      error={error}
    />
  );
}
