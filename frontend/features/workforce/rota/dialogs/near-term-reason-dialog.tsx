'use client';

import * as React from 'react';

import { Callout, DIALOG_LEADS, DialogButton, EMPTY_REASON, KitDialog, ReasonChips, reasonText, type ReasonValue } from '../../_shared';
import { NEAR_TERM_REASONS } from '../_shared/lib/rota-copy';
import { peopleToldCount, reasonProblem, toldWords, type ChangeLine } from '../_shared/lib/rota-edits';

const LABELS = Object.fromEntries(NEAR_TERM_REASONS.map((r) => [r.key, r.label]));

/**
 * A change for today or tomorrow asks for a light confirmation (Paper step 5); the reason is optional and Save is always on. Staff are about to work these shifts. The summary names each change and
 * who is told; "Keep editing" saves nothing. The server's own words show here if it refuses (for example a day that has just passed).
 */
export function NearTermReasonDialog({
  lines,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  lines: readonly ChangeLine[];
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const text = reasonText(reason, LABELS);
  // The reason is optional (owner, 24 Oct 2026): Save is always on; only a reason that is too long is held back.
  const problem = text ? reasonProblem(text) : null;
  const told = peopleToldCount(lines);
  const count = lines.length;
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onCancel()}
      busy={busy}
      width={620}
      title={`Change ${count} ${count === 1 ? 'shift' : 'shifts'} for the next two days?`}
      description={DIALOG_LEADS.nearTerm}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onCancel} disabled={busy}>
            Keep editing
          </DialogButton>
          <DialogButton kind="primary" size="lg" disabled={busy || problem !== null} title={problem ?? undefined} onClick={() => onConfirm(text ?? '')}>
            {busy ? 'Saving…' : `Save and tell ${told} ${told === 1 ? 'person' : 'people'}`}
          </DialogButton>
        </>
      }
    >
      <section aria-label="What changes, and who is told" className="flex flex-col gap-2.5">
        <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">WHAT CHANGES, AND WHO IS TOLD</h3>
        <ul className="m-0 max-h-[220px] list-none overflow-y-auto border border-wds-border p-0">
          {lines.map((l) => (
            <li key={l.text} className="flex items-baseline justify-between gap-4 border-b border-wds-neutral-100 px-3.5 py-2.5 last:border-b-0">
              <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{l.text}</span>
              <span className="shrink-0 font-wds-sans text-[12px] leading-4 text-wds-info-fg">{toldWords([l.told])}</span>
            </li>
          ))}
        </ul>
      </section>
      <ReasonChips legend="Reason" legendStyle="sentence" hint="optional" options={[...NEAR_TERM_REASONS]} value={reason} onChange={setReason} disabled={busy} />
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Staff get a notice with the old and new shift a few minutes after you stop editing. The reason is kept in the audit log.</p>
      {problem ? (
        <p role="status" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {problem}
        </p>
      ) : null}
      {error ? (
        <Callout tone="error" role="alert" size="sm">
          {error}
        </Callout>
      ) : null}
    </KitDialog>
  );
}
