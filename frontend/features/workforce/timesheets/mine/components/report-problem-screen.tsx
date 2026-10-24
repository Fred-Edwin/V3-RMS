'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Callout, ChoiceChips, EmptyState, FIELD_CLASS, FormField, OptionList, PhoneButton, PhoneScreen, PurposeLine, StatBoxes, TimeField, purposeOf, useAction, useWorkforcePermissions } from '../../../_shared';
import { hmOf } from '../../../attendance';
import { addDays, nairobiToday } from '../../../rota';
import { useMyTime } from '../../_shared/hooks/use-timesheet-data';
import { timesheetWrites } from '../../_shared/services/timesheet-services';
import { dayLong, dayShort } from '../../_shared/lib/timesheet-words';
import { EMPTY_FORM, KIND_OPTIONS, bodyOf, goesToHr, problemOf, recordedWords, shouldBeWords, type ReportForm } from '../lib/report-form';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RECENT_DAYS = 14;

/**
 * Report a problem (Paper Chapter 9, step 2): say what went wrong, the day, and what it should be, in two taps and one line. Pay
 * questions go to HR and everything else to the Branch Manager. Nothing changes until someone answers; the person follows it in My
 * requests. A refusal (a request already open for that day, a day too old) shows in the server's words.
 */
export function ReportProblemScreen() {
  const router = useRouter();
  const asked = useSearchParams().get('date');
  const permissions = useWorkforcePermissions();
  const today = nairobiToday();
  const [form, setForm] = React.useState<ReportForm>({ ...EMPTY_FORM, date: asked && DAY.test(asked) && asked <= today ? asked : null });
  const [step, setStep] = React.useState<'kind' | 'detail'>(form.kind ? 'detail' : 'kind');
  const [periodId, setPeriodId] = React.useState<string | undefined>(undefined);
  const time = useMyTime(periodId, permissions.ready && permissions.can('time.own'));
  const action = useAction(() => router.push('/app/workforce/my-time/requests'));
  const set = (patch: Partial<ReportForm>): void => setForm((f) => ({ ...f, ...patch }));

  // The recorded time sits in the month the day belongs to; ask for that month when the day is not in the one on screen.
  const covering = time.data?.periods.find((p) => form.date !== null && p.start <= form.date && form.date <= p.end);
  React.useEffect(() => {
    if (covering && time.data?.period && covering.id !== time.data.period.id) setPeriodId(covering.id);
  }, [covering, time.data?.period]);
  const day = time.data?.days.find((d) => d.shiftDate === form.date);
  const problem = problemOf(form);
  // A day in an approved month is locked: the request goes straight to HR (spec section 9 and D29).
  const locked = covering?.state === 'APPROVED' || (time.data?.period?.state === 'APPROVED' && covering === undefined && form.date !== null && time.data.period.start <= form.date && form.date <= time.data.period.end);
  const first = form.kind === 'CLOCK_TIME_WRONG' || form.kind === 'CLOCKED_OUT_BY_MISTAKE';

  if (permissions.ready && !permissions.can('time.own')) {
    return (
      <PhoneScreen screen="Report a problem" kicker="REPORT A PROBLEM" back="/app/workforce/my-time">
        <EmptyState kind="nothingYet" title="You do not clock in" line="There is nothing to report here." />
      </PhoneScreen>
    );
  }

  const recent = Array.from({ length: RECENT_DAYS }, (_, i) => addDays(today, -i)).map((d) => ({ value: d, label: dayShort(d) }));
  const recorded = recordedWords(form, { in: day?.clockIn ? hmOf(day.clockIn) : null, out: day?.clockOut ? hmOf(day.clockOut) : null });
  const dayFromLink = asked !== null && DAY.test(asked);

  if (step === 'kind') {
    return (
      <PhoneScreen screen="Report a problem" kicker="REPORT A PROBLEM" heading="What went wrong?" back="/app/workforce/my-time">
        <PurposeLine>{purposeOf('/app/workforce/my-time/report')}</PurposeLine>
        <OptionList legend="What went wrong?" tick options={KIND_OPTIONS} value={form.kind} onChange={(kind) => { set({ kind: kind as ReportForm['kind'] }); setStep('detail'); }} name="report-kind" />
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Pay questions about deductions go to HR. Everything else goes to your manager, who will answer.</p>
      </PhoneScreen>
    );
  }

  return (
    <PhoneScreen screen="Report a problem" kicker="REPORT A PROBLEM" heading={form.date ? dayLong(form.date) : 'Which day?'} back="/app/workforce/my-time">
      <button type="button" onClick={() => setStep('kind')} className="self-start font-wds-sans text-[13px] text-wds-text-secondary underline underline-offset-2">
        {KIND_OPTIONS.find((o) => o.value === form.kind)?.label} · change
      </button>
      {dayFromLink ? null : <ChoiceChips legend="Which day?" legendStyle="sentence" size="sm" options={recent} value={form.date} onChange={(date) => set({ date })} name="report-day" />}
      {recorded ? <StatBoxes variant="compare" row cells={[{ label: 'RECORDED', value: recorded, tone: 'error' }, { label: 'I SAY IT SHOULD BE', value: shouldBeWords(form), tone: 'success' }]} /> : null}
      {form.kind === 'CLOCK_TIME_WRONG' ? <ChoiceChips legend="Which time is wrong?" legendStyle="sentence" size="sm" options={[{ value: 'IN', label: 'Clock in' }, { value: 'OUT', label: 'Clock out' }]} value={form.type} onChange={(type) => set({ type: type as 'IN' | 'OUT' })} name="report-type" /> : null}
      {form.kind === 'CLOCK_TIME_WRONG' ? <TimeField label="It should be" value={form.time} onChange={(time) => set({ time })} /> : null}
      {form.kind === 'CLOCKED_OUT_BY_MISTAKE' ? <TimeField label="I really finished at" hint="optional" helper="Leave it empty if you are still on shift." value={form.time} onChange={(time) => set({ time })} /> : null}
      {form.kind === 'WORKED_NOT_RECORDED' ? (
        <div className="grid grid-cols-2 gap-3">
          <TimeField label="I started at" value={form.from} onChange={(from) => set({ from })} />
          <TimeField label="I finished at" value={form.to} onChange={(to) => set({ to })} />
        </div>
      ) : null}
      <FormField label="What happened? (one line)">
        {(ids) => <input id={ids.id} type="text" autoComplete="off" maxLength={300} value={form.note} onChange={(e) => set({ note: e.target.value })} aria-describedby={ids.describedBy} className={FIELD_CLASS} placeholder={first ? 'I tapped Clock out by accident' : 'Say it in one line'} />}
      </FormField>
      {action.error ? (
        <Callout tone="error" size="sm" role="alert">
          {action.error}
        </Callout>
      ) : null}
      <PhoneButton size="lg" disabled={problem !== null || action.busy} onClick={() => form.kind && void action.run(() => timesheetWrites.createRequest(bodyOf(form)))}>
        {action.busy ? 'Sending…' : goesToHr(form.kind) || locked ? 'Send to HR' : 'Send to your manager'}
      </PhoneButton>
      {locked ? (
        <Callout tone="neutral" size="sm" role="status">
          This month is approved. Tell HR.
        </Callout>
      ) : null}
      <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{problem ?? (locked ? 'Your request goes straight to HR. You will be told, and you can follow it in My requests.' : 'Your time stays as recorded until your manager answers. You will be told, and you can follow it in My requests.')}</p>
    </PhoneScreen>
  );
}
