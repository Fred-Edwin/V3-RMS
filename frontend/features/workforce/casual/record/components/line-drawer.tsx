'use client';

import * as React from 'react';

import { PhoneButton, TimeField, WorkforceDrawer } from '../../../_shared';
import { PROBLEM_WORDS, lineProblem, payWorking, shiftMinutes } from '../../_shared/lib/casual-pay';
import type { CachedWorker } from '../../_shared/lib/draft-store';
import type { DraftLine, Worker } from '../../_shared/types/casual-types';
import { NewCasualForm } from './new-casual-form';
import { WorkerPicker } from './worker-picker';

type Step = 'pick' | 'new' | 'times';
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * One drawer for the head's three jobs: pick a worker, add a new one, set the times (also used to edit or remove a line). Pay is
 * worked out on the phone with the day rate, so it also works with no signal.
 */
export function LineDrawer({
  open,
  onOpenChange,
  siteId,
  departmentId,
  rate,
  taken,
  editing,
  onSave,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  departmentId: string;
  rate: string;
  /** Worker ids already on the sheet. */
  taken: ReadonlySet<string>;
  /** The line being changed; null when adding. */
  editing: DraftLine | null;
  onSave: (line: DraftLine) => void;
  onRemove: (casualId: string) => void;
}) {
  const [step, setStep] = React.useState<Step>('pick');
  const [who, setWho] = React.useState<{ id: string; name: string; idMasked: string } | null>(null);
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [past, setPast] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setWho({ id: editing.casualId, name: editing.name, idMasked: editing.idMasked });
      setStart(editing.start);
      setEnd(editing.end);
      setPast(editing.endsNextDay);
      setStep('times');
    } else {
      setWho(null);
      setStart('');
      setEnd('');
      setPast(false);
      setStep('pick');
    }
  }, [open, editing]);

  const pick = (w: CachedWorker | Worker) => {
    setWho({ id: w.id, name: w.fullName, idMasked: w.idMasked });
    setStep('times');
  };
  const valid = CLOCK.test(start) && CLOCK.test(end);
  const problem = valid ? lineProblem(start, end, past) : null;
  const minutes = valid && !problem ? shiftMinutes(start, end, past) : 0;
  const canSave = who !== null && valid && !problem;

  return (
    <WorkforceDrawer open={open} onOpenChange={onOpenChange} title={step === 'times' && who ? who.name : step === 'new' ? 'New casual' : 'Add a casual'} subtitle={step === 'times' && who ? `ID ${who.idMasked}` : undefined}>
      {step === 'pick' ? <WorkerPicker siteId={siteId} departmentId={departmentId} taken={taken} onPick={pick} onNew={() => setStep('new')} /> : null}
      {step === 'new' ? <NewCasualForm onAdded={pick} onExisting={(w) => (taken.has(w.id) ? setStep('pick') : pick(w))} /> : null}
      {step === 'times' && who ? (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <TimeField label="Start" value={start} onChange={setStart} />
            <TimeField label="End" value={end} onChange={setEnd} error={problem ? PROBLEM_WORDS[problem] : undefined} />
          </div>
          <label className="flex min-h-[44px] items-center gap-2.5 font-wds-sans text-[13px] leading-4 text-wds-text-ink">
            <input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} className="size-4 accent-[var(--wds-primary)]" />
            The shift ends after midnight (+1)
          </label>
          <div className="flex flex-col gap-1 border border-wds-border bg-wds-neutral-50 px-3.5 py-3">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">PAY</span>
            <span className="font-wds-mono text-[14px] leading-[18px] text-wds-text-ink" aria-live="polite">
              {minutes > 0 ? payWorking(rate, minutes) : 'Set the start and end times'}
            </span>
          </div>
          <PhoneButton size="sm" disabled={!canSave} onClick={() => who && onSave({ casualId: who.id, name: who.name, idMasked: who.idMasked, start, end, endsNextDay: past })}>
            {editing ? 'Save times' : 'Add to today'}
          </PhoneButton>
          {editing ? (
            <PhoneButton kind="outlined" size="sm" onClick={() => onRemove(editing.casualId)}>
              Remove from today
            </PhoneButton>
          ) : null}
        </div>
      ) : null}
    </WorkforceDrawer>
  );
}
