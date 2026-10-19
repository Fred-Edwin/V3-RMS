'use client';

import * as React from 'react';
import { Callout, DrawerSection, ErrorBlock, ListSkeleton, PeriodStepper, WorkforceDrawer, initialsOf } from '../../../_shared';
import { EditTimeDialog, useDayHistory } from '../../../attendance';
import { nairobiToday } from '../../../rota';
import { OvertimeDialog } from '../../overtime/components/overtime-dialog';
import { usePersonPeriod } from '../../_shared/hooks/use-timesheet-data';
import { closedWhen, hm, weekLabel } from '../../_shared/lib/timesheet-words';
import type { Day, Overtime, Period } from '../../_shared/types/timesheet-types';
import { defaultWeekIndex, systemLine, weeksWithDays } from '../lib/week-view';
import { DayDecisionDialog } from './day-decision-dialog';
import { DayList, type DayActions } from './day-list';

/** Opens Attendance's Edit time for one day: loads the day's clock events, then shows the same dialog the Today board uses. */
function DayFix({ employeeId, day, onClose, onDone }: { employeeId: string; day: Day; onClose: () => void; onDone: (message: string) => void }) {
  const history = useDayHistory(employeeId, day.shiftDate, true);
  if (!history.data) return history.status === 'error' ? <ErrorBlock title="This day did not load" line={history.error.message} onRetry={history.reload} /> : null;
  return <EditTimeDialog history={history.data} entryId={history.data.entries[0]?.entryId ?? null} onClose={onClose} onDone={onDone} />;
}

export interface DrawerPermissions {
  approve: boolean;
  overtime: boolean;
  fix: boolean;
}

/**
 * One person's month, a week at a time (Paper Chapter 8, step 2). Matching days were approved by the system and sit as quiet rows;
 * a day that needs a person is a card with only the buttons this person may use. A closed period shows everything read-only and says
 * why. A week that runs into the next or last month is labelled a part week and shows only this month's days.
 */
export function PersonDrawer({ period, employeeId, name, permissions, onClose, onChanged }: { period: Period; employeeId: string; name: string; permissions: DrawerPermissions; onClose: () => void; onChanged: () => void }) {
  const person = usePersonPeriod(period.id, employeeId, true);
  const weeks = React.useMemo(() => (person.data ? weeksWithDays(person.data) : []), [person.data]);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [overtime, setOvertime] = React.useState<{ item: Overtime; day: Day } | null>(null);
  const [decision, setDecision] = React.useState<{ kind: 'EXCUSE' | 'HOLD'; day: Day } | null>(null);
  const [fixing, setFixing] = React.useState<Day | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);

  const index = Math.min(picked ?? defaultWeekIndex(weeks, nairobiToday()), Math.max(0, weeks.length - 1));
  const current = weeks[index];
  const open = period.state === 'OPEN';
  const actions: DayActions = { decide: open && permissions.approve, overtime: open && permissions.overtime, fix: open && permissions.fix };
  const dept = person.data?.person.departmentName ?? '';
  const reload = (message?: string | null): void => {
    setOvertime(null);
    setDecision(null);
    setFixing(null);
    if (message) setSaid(message);
    person.reload();
    onChanged();
  };

  const systemText = current ? systemLine(current.days) : null;
  return (
    <>
      <WorkforceDrawer
        open
        onOpenChange={(o) => !o && onClose()}
        title={name}
        initials={initialsOf(name)}
        subtitle={current ? [dept, weekLabel(current.week.weekStart, current.week.partWeek, period.start, period.end), `${hm(current.week.workedMinutes)} worked`].filter(Boolean).join(' · ') : dept}
      >
        {person.status === 'loading' ? <ListSkeleton rows={5} columns={[56, 'fill', 100]} label="Loading this person's month" /> : null}
        {person.status === 'error' && !person.data ? <ErrorBlock title="This person's month did not load" line={person.error.message} onRetry={person.reload} /> : null}
        {person.data && current ? (
          <>
            {weeks.length > 1 ? (
              <PeriodStepper
                label={weekLabel(current.week.weekStart, current.week.partWeek, period.start, period.end)}
                previousLabel="Earlier week"
                nextLabel="Later week"
                previousDisabled={index === 0}
                nextDisabled={index >= weeks.length - 1}
                onPrevious={() => setPicked(index - 1)}
                onNext={() => setPicked(index + 1)}
              />
            ) : null}
            {!open ? (
              <Callout tone="neutral" kicker="CLOSED" size="sm">
                This month is closed ({closedWhen(period)}). Nothing here can change. Only HR can reopen it, with a reason.
              </Callout>
            ) : null}
            {said ? (
              <Callout tone="success" size="sm" role="status">
                {said}
              </Callout>
            ) : null}
            {systemText ? (
              <Callout tone="success" size="sm">
                {systemText}
              </Callout>
            ) : null}
            <DrawerSection caption="THE DAYS">
              <DayList
                person={person.data}
                days={current.days}
                actions={actions}
                onOvertime={(item, day) => setOvertime({ item, day })}
                onDecision={(kind, day) => setDecision({ kind, day })}
                onFix={setFixing}
                onChanged={reload}
              />
            </DrawerSection>
            {person.data.requests.some((r) => r.state === 'WAITING') ? (
              <Callout tone="info" size="sm" title="A request is waiting">
                {name.split(/\s+/)[0]} has reported a problem with a day. It is answered from Requests.
              </Callout>
            ) : null}
            <p className="m-0 border-t border-wds-border pt-3.5 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No week sign-off needed. Once every day is decided, this week is done.</p>
          </>
        ) : null}
      </WorkforceDrawer>
      {overtime ? <OvertimeDialog item={overtime.item} day={overtime.day} personName={name} onClose={() => setOvertime(null)} onDone={reload} /> : null}
      {decision ? <DayDecisionDialog day={decision.day} kind={decision.kind} personName={name} onClose={() => setDecision(null)} onDone={reload} /> : null}
      {fixing ? <DayFix employeeId={employeeId} day={fixing} onClose={() => setFixing(null)} onDone={reload} /> : null}
    </>
  );
}
