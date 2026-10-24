'use client';

import * as React from 'react';

import { WorkforcePinDialog, type KeyValueRow } from '../../../_shared';
import { useIdempotencyKey } from '../../_shared/lib/idempotency';
import { leaveErrorText } from '../../_shared/lib/leave-copy';
import { daySmall, rangeShort } from '../../_shared/lib/leave-dates';
import { leaveWrites } from '../../_shared/services/leave-services';
import type { ApplicationDetail, ApproveResult, RotaPanel } from '../../_shared/types/leave-types';
import { teamLine } from '../lib/rota-view';

/** Why the dialog may not finish: the request changed under the signer. The screen reloads and the dialog closes. */
const CHANGED = new Set(['ALREADY_DECIDED', 'STALE_REQUEST', 'LEAVE_NOT_FOUND']);

export function approveRows(detail: ApplicationDetail, rota: RotaPanel | null): KeyValueRow[] {
  const a = detail.application;
  const tail = a.unpaidTailDays;
  const team = rota ? teamLine(rota.days) : null;
  const rows: KeyValueRow[] = [
    { label: 'Shifts', value: `${rangeShort(a.start, a.end)} ${a.days === 1 ? 'becomes' : 'become'} Leave` },
  ];
  if (rota && rota.balanceBefore !== null) rows.push({ label: `${a.typeLabel.replace(/ leave$/i, '')} balance`, from: `${rota.balanceBefore} days`, value: `${rota.balanceAfter ?? '–'} days`, mono: true });
  rows.push({ label: 'Pay', value: !a.paid ? 'Not paid for those days' : tail > 0 ? `${a.days - tail} ${a.typeLabel.toLowerCase().replace(/ leave$/, '')} days at normal pay, ${tail} unpaid ${tail === 1 ? 'day' : 'days'} not paid` : 'Normal pay for those days' });
  if (team) rows.push({ label: team.label, value: team.value, tone: team.tight ? 'warning' : 'default' });
  return rows;
}

export function toldLine(detail: ApplicationDetail, extra: string): string {
  const head = detail.person.head;
  const who = `${detail.person.name}, ${detail.person.roleLabel}`;
  return `${head ? `${who}, and ${head}, head of ${detail.person.department ?? 'the department'}, are told.` : `${who}, is told.`} ${extra}`.trim();
}

/** Approve (spec Step 11): says exactly what changes and who is told; the PIN signs the slip. The fourth digit signs, Enter never does. */
export function ApproveDialog({ open, onOpenChange, detail, rota, onApproved, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; detail: ApplicationDetail; rota: RotaPanel | null; onApproved: (result: ApproveResult) => void; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const key = useIdempotencyKey();
  const a = detail.application;
  React.useEffect(() => {
    if (open) {
      key.fresh();
      setError(undefined);
    }
  }, [open, key]);

  const submit = async (pin: string): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await leaveWrites.approve(a.id, { pin, expectedVersion: a.version }, key.current());
      onOpenChange(false);
      onApproved(result);
    } catch (err) {
      const e = leaveErrorText(err, 'Could not approve. Nothing was changed. Try again.');
      if (CHANGED.has(e.code)) {
        onChanged();
        onOpenChange(false);
      } else if (e.code === 'BALANCE_TOO_LOW') setError(`${detail.person.name}, ${detail.person.roleLabel}, has fewer days left than this asks for. Decline it, or ask the person to send a smaller request.`);
      else setError(e.text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkforcePinDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Approve ${detail.person.name}'s leave?`}
      description={`${a.typeLabel} · ${daySmall(a.start)} to ${daySmall(a.end)} · ${a.days} ${a.days === 1 ? 'day' : 'days'}`}
      summaryRows={approveRows(detail, rota)}
      pinLabel="Your PIN, to sign the leave slip"
      caption={toldLine(detail, 'This is recorded in the audit log with your name and the time.')}
      onSubmit={submit}
      submitting={busy}
      error={error}
      confirmLabel="Approve leave"
    />
  );
}
