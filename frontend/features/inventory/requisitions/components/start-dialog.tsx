'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Textarea } from '@/components/ui2/textarea';
import { cn } from '@/lib/cn';
import { ChoiceChips, DecisionDialog, DialogLabel } from '../../_shared/components/decision-dialog';
import { useAction } from '../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../_shared/hooks/use-idempotency-key';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import { CYCLE_TEXT, REQUISITION_CYCLES, type RequisitionCycle } from '../_shared/types/requisitions-contract';
import { errorWords } from '../_shared/lib/requisitions-words';

const NOTE_MAX = 200;
const CYCLE_BY_TEXT = Object.fromEntries(REQUISITION_CYCLES.map((c) => [CYCLE_TEXT[c], c])) as Record<string, RequisitionCycle>;
const CYCLE_OPTIONS = REQUISITION_CYCLES.map((c) => CYCLE_TEXT[c]);

/** The cycle that suits the time of day in Nairobi: Morning before noon, Afternoon until the evening, then Extra. */
function suggestedCycle(now: Date = new Date()): RequisitionCycle {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', hour12: false }).format(now));
  return hour < 12 ? 'MORNING' : hour < 18 ? 'AFTERNOON' : 'EXTRA';
}

/**
 * Start a requisition from the desktop (Amendment 2; Paper draws no desktop start screen, so this follows the phone's step 18):
 * cycle chips, the Urgent switch with its note. One open requisition per cycle: a second start answers with the existing file.
 */
export function StartDialog({ open, onOpenChange, onStarted }: { open: boolean; onOpenChange: (open: boolean) => void; onStarted: (requisitionId: string) => void }) {
  const [cycle, setCycle] = React.useState<RequisitionCycle>(() => suggestedCycle());
  const [urgent, setUrgent] = React.useState(false);
  const [note, setNote] = React.useState('');
  const idem = useIdempotencyKey();
  const start = useAction((input: Parameters<typeof requisitionsApi.start>[0]) => requisitionsApi.start(input), 'Could not start the requisition. Try again.');
  const failure = start.failure ? errorWords(start.failure.code, 'manager', start.failure.message, start.failure.message) : null;

  React.useEffect(() => {
    if (open) {
      setCycle(suggestedCycle());
      setUrgent(false);
      setNote('');
      start.clear();
      idem.renew();
    }
    // Reset only when the dialog opens; the helpers are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (): Promise<void> => {
    const result = await start.run({ cycle, urgent, urgentNote: urgent && note.trim() ? note.trim() : undefined, idempotencyKey: idem.key() });
    if (result) {
      onOpenChange(false);
      onStarted(result.requisitionId);
    }
  };

  return (
    <DecisionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Start a requisition"
      description="One requisition for the whole branch, one per cycle. Each head fills and sends their own department."
      error={failure}
      busy={start.saving}
      actions={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={start.saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={start.saving}>
            {urgent ? `Start an urgent ${CYCLE_TEXT[cycle]} requisition` : `Start the ${CYCLE_TEXT[cycle]} requisition`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <DialogLabel>Which requisition</DialogLabel>
        <ChoiceChips name="cycle" label="Which requisition" options={CYCLE_OPTIONS} value={CYCLE_TEXT[cycle]} onChange={(text) => setCycle(CYCLE_BY_TEXT[text] ?? cycle)} />
      </div>
      <div className={cn('flex flex-col gap-2 border p-3.5', urgent ? 'border-wds-error-border bg-wds-error-bg' : 'border-wds-border bg-wds-surface')}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span id="start-urgent-label" className={cn('font-wds-sans text-[14px] font-semibold leading-[18px]', urgent ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
              Mark as urgent
            </span>
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-copy-muted">The Director is told if it is not approved within 1 hour and can approve it.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={urgent}
            aria-labelledby="start-urgent-label"
            onClick={() => setUrgent((v) => !v)}
            className={cn('relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:shadow-wds-ring', urgent ? 'bg-wds-error-fg' : 'bg-wds-neutral-300')}
          >
            <span className={cn('absolute top-0.5 size-5 rounded-full bg-wds-surface transition-[left] duration-150', urgent ? 'left-[22px]' : 'left-0.5')} />
          </button>
        </div>
        {urgent ? (
          <>
            <DialogLabel hint="optional" htmlFor="start-urgent-note">
              What is it for
            </DialogLabel>
            <Textarea id="start-urgent-note" value={note} maxLength={NOTE_MAX} rows={2} onChange={(event) => setNote(event.target.value)} placeholder="Deep-clean kit before tomorrow's inspection" />
            <span className="self-end font-wds-mono text-[11px] text-wds-text-faint">
              {note.length} / {NOTE_MAX}
            </span>
          </>
        ) : null}
      </div>
    </DecisionDialog>
  );
}
