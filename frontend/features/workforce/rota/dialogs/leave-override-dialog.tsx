'use client';

import * as React from 'react';

import { Callout, DIALOG_LEADS, DialogButton, EMPTY_REASON, KitDialog, ReasonChips, reasonText, type ReasonValue } from '../../_shared';
import { LEAVE_OVERRIDE_REASONS } from '../_shared/lib/rota-copy';
import { reasonProblem } from '../_shared/lib/rota-edits';
import { shortDay, weekdayName } from '../_shared/lib/rota-dates';

const LABELS = Object.fromEntries(LEAVE_OVERRIDE_REASONS.map((r) => [r.key, r.label]));

/** Words for the people and days that are on leave: "Mark Njoroge is on leave on Wednesday" or "2 people are on leave on those days". */
export function leaveHeadline(cells: readonly { name: string; date: string }[]): string {
  const names = Array.from(new Set(cells.map((c) => c.name)));
  if (names.length > 1) return `${names.length} people are on leave on those days`;
  const days = Array.from(new Set(cells.map((c) => c.date)));
  return `${names[0]} is on leave on ${days.length === 1 && days[0] ? weekdayName(days[0]) : days.map(shortDay).join(', ')}`;
}

/**
 * A warning that never blocks (Paper step 4): someone on approved leave can still be given a shift if the manager says why. The reason is
 * kept on the shift and in the audit log. "Leave them off" drops the change and saves nothing.
 */
export function LeaveOverrideDialog({
  cells,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  cells: readonly { name: string; date: string }[];
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const text = reasonText(reason, LABELS);
  const problem = reasonProblem(text);
  const first = cells[0]?.name.split(' ')[0] ?? 'They';
  const one = new Set(cells.map((c) => c.name)).size === 1;
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onCancel()}
      busy={busy}
      width={600}
      title={leaveHeadline(cells)}
      description={DIALOG_LEADS.leaveOverride(Array.from(new Set(cells.map((c) => shortDay(c.date)))).join(', '))}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onCancel} disabled={busy}>
            {one ? 'Leave them off' : 'Leave them all off'}
          </DialogButton>
          <DialogButton kind="primary" size="lg" disabled={busy || problem !== null} title={problem ?? undefined} onClick={() => text && onConfirm(text)}>
            {busy ? 'Saving…' : 'Roster them anyway'}
          </DialogButton>
        </>
      }
    >
      <Callout tone="warning" bullet size="sm">
        You can still give {one ? 'them' : 'these people'} a shift. They will see it, and the leave stays. Use this only if they agreed to come in.
      </Callout>
      <ReasonChips legend="Why are you rostering them?" legendStyle="sentence" hint="required" options={[...LEAVE_OVERRIDE_REASONS]} value={reason} onChange={setReason} disabled={busy} />
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">The reason is saved on the shift and in the audit log, and {one ? first : 'they'} {one ? 'is' : 'are'} told.</p>
      {error ? (
        <Callout tone="error" role="alert" size="sm">
          {error}
        </Callout>
      ) : null}
    </KitDialog>
  );
}
