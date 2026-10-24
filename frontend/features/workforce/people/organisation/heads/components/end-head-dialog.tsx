'use client';

import * as React from 'react';

import { Callout, ChangeDialog, EMPTY_REASON, ReasonChips, isReasonComplete, reasonText, type ReasonValue } from '../../../../_shared';
import { useAction } from '../../../_shared/hooks/use-action';
import { firstName } from '../../_shared/lib/org-copy';
import { orgWrites } from '../../_shared/services/org-services';
import { END_REASONS, toEndBody } from '../lib/head-copy';

/** End a head, or end an acting head early (O9). A reason is required; the server's refusal (`NO_HEAD_TO_END`) shows in the dialog. */
export function EndHeadDialog({
  departmentId,
  departmentName,
  personName,
  which,
  onClose,
  done,
}: {
  departmentId: string;
  departmentName: string;
  personName: string;
  which: 'HEAD' | 'ACTING';
  onClose: () => void;
  done: (message: string) => void;
}) {
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const action = useAction((m) => done(m ?? 'Saved.'));
  const first = firstName(personName);
  const role = which === 'ACTING' ? 'acting head' : 'head';
  const labels = Object.fromEntries(END_REASONS.map((r) => [r.key, r.label]));
  const text = reasonText(reason, labels);
  return (
    <ChangeDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`End ${first}'s time as ${role} of ${departmentName}?`}
      description="Their job and pay do not change."
      summaryCaption="WHAT CHANGES"
      summaryLines={[
        which === 'ACTING' ? `Approvals go back to the head of ${departmentName}.` : `Approvals for ${departmentName} go to the Branch Manager until a new head is named.`,
        `${first} no longer sees Team today, Shifts or Casuals for ${departmentName}.`,
        `${first} and the Branch Manager are told. This is written to the audit log with your name and the time.`,
      ]}
      confirmLabel={`End ${role}`}
      destructive
      busy={action.busy}
      confirmDisabledReason={isReasonComplete(reason) ? undefined : 'Say why first.'}
      onConfirm={() => text && void action.run(() => orgWrites.endHead(departmentId, toEndBody(which, text)), `${first} is no longer ${role} of ${departmentName}.`)}
    >
      <ReasonChips legend="Why is it ending?" legendStyle="sentence" hint="required" options={[...END_REASONS]} value={reason} onChange={setReason} disabled={action.busy} />
      {action.error ? <Callout tone="error" role="alert" size="sm">{action.error}</Callout> : null}
    </ChangeDialog>
  );
}
