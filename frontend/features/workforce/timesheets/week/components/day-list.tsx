'use client';

import { Callout, DialogButton, StatusText, useAction } from '../../../_shared';
import { timesheetWrites } from '../../_shared/services/timesheet-services';
import { dayShort, hm, hmWords, reasonsLine } from '../../_shared/lib/timesheet-words';
import type { Day, Overtime, PersonPeriod } from '../../_shared/types/timesheet-types';
import { dayHours, dayRange, dayStatus, needsPerson, overtimeOn } from '../lib/week-view';

export interface DayActions {
  /** The period is open and the person may decide days. */
  decide: boolean;
  /** The person may decide overtime. */
  overtime: boolean;
  /** The person may fix a clock time. */
  fix: boolean;
}

/** One approved or off day: the day, the hours and where it stands. A quiet row; the system did the work. */
function QuietRow({ day }: { day: Day }) {
  const status = dayStatus(day);
  const off = day.scheduledMinutes === 0 && day.workedMinutes === 0;
  return (
    <li className="flex items-baseline gap-4 border-b border-wds-neutral-100 py-2.5 last:border-b-0">
      <span className="w-14 shrink-0 font-wds-mono text-[12px] uppercase leading-4 text-wds-text-ink">{dayShort(day.shiftDate)}</span>
      <span className="w-36 shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-ink">{dayRange(day) ?? dayHours(day)}</span>
      {off ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Off</span> : <StatusText tone={status.tone}>{status.text}</StatusText>}
    </li>
  );
}

/** A day that needs a person: the reasons in words, the numbers, and only the buttons this person may use (hidden, never greyed). */
function ExceptionCard({
  day,
  item,
  actions,
  onOvertime,
  onDecision,
  onFix,
  onChanged,
}: {
  day: Day;
  item: Overtime | null;
  actions: DayActions;
  onOvertime: (item: Overtime, day: Day) => void;
  onDecision: (kind: 'EXCUSE' | 'HOLD', day: Day) => void;
  onFix: (day: Day) => void;
  onChanged: () => void;
}) {
  const accept = useAction(() => onChanged());
  const waitingOvertime = item !== null && item.status === 'PENDING';
  const overtimeFirst = day.reasons.includes('OVERTIME') && waitingOvertime;
  const late = day.reasons.includes('LATE') && !day.lateExcused;
  const line = reasonsLine(day.reasons, day.minutesLate);
  return (
    <li>
      <Callout
        tone="warning"
        variant="bar"
        title={`${dayShort(day.shiftDate).toUpperCase()} · ${day.status === 'HELD' ? 'held back' : 'needs you'}`}
        action={
          <div className="flex flex-wrap gap-2">
            {actions.overtime && overtimeFirst && item ? (
              <DialogButton kind="primary" onClick={() => onOvertime(item, day)}>
                Review the overtime
              </DialogButton>
            ) : null}
            {actions.decide && !overtimeFirst ? (
              <DialogButton kind="cancel" disabled={accept.busy} onClick={() => void accept.run(() => timesheetWrites.decideDay(day.id, { outcome: 'ACCEPT' }))}>
                Accept as recorded
              </DialogButton>
            ) : null}
            {actions.decide && late ? (
              <DialogButton kind="cancel" onClick={() => onDecision('EXCUSE', day)}>
                Excuse lateness
              </DialogButton>
            ) : null}
            {actions.decide && day.status === 'NEEDS_LOOK' ? (
              <DialogButton kind="cancel" onClick={() => onDecision('HOLD', day)}>
                Hold
              </DialogButton>
            ) : null}
            {actions.fix ? (
              <DialogButton kind="cancel" onClick={() => onFix(day)}>
                Edit time
              </DialogButton>
            ) : null}
          </div>
        }
      >
        <p className="m-0 font-wds-mono text-[13px] leading-[18px] text-wds-text-ink">
          {dayRange(day) ? `${dayRange(day)} · ` : ''}worked {hm(day.workedMinutes)} of {hm(day.scheduledMinutes)} planned
        </p>
        {line ? <p className="m-0 mt-1 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{line}</p> : null}
        {waitingOvertime && item ? <p className="m-0 mt-1 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">Overtime {hmWords(item.needsMinutes)} is waiting for an answer.</p> : null}
        {day.decisionReason ? <p className="m-0 mt-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Last answer: {day.decisionReason}</p> : null}
        {day.carriedFromPeriodId ? <p className="m-0 mt-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Moved here from the last period.</p> : null}
        {accept.error ? (
          <p role="alert" className="m-0 mt-1 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
            {accept.error}
          </p>
        ) : null}
      </Callout>
    </li>
  );
}

/** The days of one week, in order: quiet rows for what the system approved, a card for each day that needs a person. */
export function DayList({
  person,
  days,
  actions,
  onOvertime,
  onDecision,
  onFix,
  onChanged,
}: {
  person: PersonPeriod;
  days: readonly Day[];
  actions: DayActions;
  onOvertime: (item: Overtime, day: Day) => void;
  onDecision: (kind: 'EXCUSE' | 'HOLD', day: Day) => void;
  onFix: (day: Day) => void;
  onChanged: () => void;
}) {
  return (
    <ul className="m-0 flex list-none flex-col p-0" aria-label="The days">
      {days.map((day) =>
        needsPerson(day) ? (
          <div key={day.id} className="my-2.5">
            <ExceptionCard day={day} item={overtimeOn(person, day)} actions={actions} onOvertime={onOvertime} onDecision={onDecision} onFix={onFix} onChanged={onChanged} />
          </div>
        ) : (
          <QuietRow key={day.id} day={day} />
        )
      )}
    </ul>
  );
}
