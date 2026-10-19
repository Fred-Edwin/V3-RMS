'use client';

import * as React from 'react';

import { ApiError } from '@/types/api';
import { cn } from '@/lib/cn';

import { Callout, ChoiceChips, DialogButton, ErrorBlock, FIELD_CLASS, FOCUS_RING, FormField, KitDialog, ListSkeleton, MOTION, PinField, StatBoxes } from '../../../_shared';
import { useOvertimeDetail } from '../../_shared/hooks/use-month-data';
import { hmWords, dayLong, plainName } from '../../_shared/lib/timesheet-words';
import { monthWrites } from '../../_shared/services/month-services';
import type { OvertimeChoice, OvertimeDetail } from '../../_shared/types/month-types';
import { REASON_MAX, answerBody, choiceOf, evidenceLines, limitLines, overtimeWords, partStart, plannedText, saveProblem, stepPart, workedText } from '../lib/overtime-view';

function Lines({ caption, lines }: { caption: string; lines: string[] }) {
  return (
    <section aria-label={caption} className="flex min-w-0 flex-col gap-2">
      <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">{caption}</h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {lines.map((line) => (
          <li key={line} className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

const stepper = cn('flex h-9 w-9 items-center justify-center border border-wds-border-strong font-wds-sans text-[16px] leading-none text-wds-text-ink disabled:opacity-40', MOTION, FOCUS_RING);

/** The form half of the dialog; it is only drawn once the evidence has loaded, so every hook has its data. */
function Decision({ detail, onClose, onDone, onStale }: { detail: OvertimeDetail; onClose: () => void; onDone: (message: string) => void; onStale: () => void }) {
  const [choice, setChoice] = React.useState<OvertimeChoice>(choiceOf(detail.status));
  const [part, setPart] = React.useState(detail.part ? partStart(detail.part, detail.extraMinutes) : 0);
  const [reason, setReason] = React.useState(detail.decision?.reason ?? '');
  const [pin, setPin] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const first = plainName(detail.person.name).split(/\s+/)[0] ?? '';
  const problem = saveProblem(choice, reason, pin);
  const decided = detail.status !== 'PENDING' && detail.decision !== null;
  const approvedMonth = detail.month.state === 'APPROVED';

  const options = [
    { value: 'APPROVE_ALL', label: `Approve all ${hmWords(detail.extraMinutes)}` },
    ...(detail.part ? [{ value: 'APPROVE_PART', label: `Approve part: ${hmWords(part)}` }] : []),
    { value: 'DECLINE', label: 'Decline' },
  ];

  const save = async (): Promise<void> => {
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await monthWrites.decideOvertime(detail.id, answerBody(choice, part, reason, pin, detail.version));
      onDone(choice === 'DECLINE' ? `Not approved. ${first} is told why.` : `Authorised ${hmWords(choice === 'APPROVE_PART' ? part : detail.extraMinutes)}. ${first} is told.`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setPin('');
      setError(overtimeWords(code, err instanceof Error ? err.message : ''));
      if (code === 'CHANGED_UNDERNEATH') onStale();
    } finally {
      setBusy(false);
    }
  };

  const readOnly = approvedMonth || !detail.canDecide;
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      busy={busy}
      width={780}
      title={`Overtime · ${plainName(detail.person.name)} · ${hmWords(detail.extraMinutes)}`}
      description={`${dayLong(detail.shiftDate)} · ${[detail.person.role, detail.organization.name].filter(Boolean).join(' · ')}`}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
            {readOnly ? 'Close' : 'Cancel'}
          </DialogButton>
          {readOnly ? null : (
            <DialogButton kind="primary" size="lg" onClick={() => void save()} disabled={busy || problem !== null}>
              {busy ? 'Saving…' : decided ? 'Change my answer' : 'Save my answer'}
            </DialogButton>
          )}
        </>
      }
    >
      <StatBoxes
        variant="times"
        cells={[
          { label: 'PLANNED', value: plannedText(detail) },
          { label: 'WORKED', value: workedText(detail) },
          { label: 'EXTRA', value: `${hmWords(detail.extraMinutes)} after shift end`, tone: 'warning' },
        ]}
      />
      <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
        <Lines caption="WHY, FROM THE RECORD" lines={evidenceLines(detail)} />
        <Lines caption="THE LIMITS" lines={limitLines(detail)} />
      </div>
      {approvedMonth ? (
        <Callout tone="neutral" size="sm">
          This month is approved. Tell HR if the overtime needs to change.
        </Callout>
      ) : !detail.canDecide ? (
        <Callout tone="neutral" size="sm">
          You can read this overtime. Someone else decides it.
        </Callout>
      ) : (
        <>
          {decided && detail.decision ? (
            <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
              Your earlier answer: {detail.status === 'DECLINED' ? 'not approved' : `${hmWords(detail.authorisedMinutes - detail.autoMinutes)} approved`}. You can change it until the month is approved.
            </p>
          ) : null}
          <ChoiceChips legend="Your decision" legendStyle="sentence" options={options} value={choice} onChange={(v) => setChoice(v as OvertimeChoice)} name="overtime-decision" disabled={busy} />
          {choice === 'APPROVE_PART' && detail.part ? (
            <div className="flex items-center gap-3" role="group" aria-label="How much to approve">
              <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">How much to approve</span>
              <button type="button" aria-label="Approve 5 minutes less" className={stepper} disabled={busy || part <= detail.part.min} onClick={() => setPart((p) => stepPart(detail.part!, p, -1))}>
                −
              </button>
              <output aria-live="polite" className="min-w-[64px] text-center font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{hmWords(part)}</output>
              <button type="button" aria-label="Approve 5 minutes more" className={stepper} disabled={busy || part >= detail.part.max} onClick={() => setPart((p) => stepPart(detail.part!, p, 1))}>
                +
              </button>
            </div>
          ) : null}
          <FormField label="Reason" helper="Needed to approve part or decline. It is recorded." hint={choice === 'APPROVE_ALL' ? 'optional' : undefined}>
            {({ id, describedBy, invalid }) => (
              <input id={id} aria-describedby={describedBy} aria-invalid={invalid} className={FIELD_CLASS} maxLength={REASON_MAX} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
            )}
          </FormField>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <div className="flex w-[240px] flex-col gap-1.5">
              <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">Your PIN</span>
              <PinField value={pin} onChange={setPin} label="Your PIN" disabled={busy} invalid={error !== null} />
            </div>
            <p className="m-0 min-w-[240px] flex-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              You are only saying whether this extra time was authorised. Whether it is paid at an overtime rate, or counted another way, is decided by payroll from the Rules. {first} is told your answer.
            </p>
          </div>
          {problem ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{problem}</p> : null}
          {error ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{error}</p> : null}
        </>
      )}
    </KitDialog>
  );
}

/**
 * Decide one overtime item with the evidence beside it (spec S6). Approve all, part (5-minute steps) or none; a reason for part or none;
 * the manager's own PIN; the version the screen showed, so a second manager or a double tap gets "This changed while you were looking".
 * Approving authorises the time only; no money appears anywhere.
 */
export function OvertimeDialog({ itemId, onClose, onDone }: { itemId: string; onClose: () => void; onDone: (message: string) => void }) {
  const detail = useOvertimeDetail(itemId);
  if (detail.data) return <Decision key={detail.data.version} detail={detail.data} onClose={onClose} onDone={onDone} onStale={detail.reload} />;
  return (
    <KitDialog open onOpenChange={(o) => !o && onClose()} width={780} title="Overtime" footer={<DialogButton kind="cancel" size="lg" onClick={onClose}>Close</DialogButton>}>
      {detail.status === 'error' ? <ErrorBlock title="We could not read the record for this day." line={detail.error.message} onRetry={detail.reload} /> : <ListSkeleton rows={5} columns={['fill', 120]} label="Loading the overtime" />}
    </KitDialog>
  );
}
