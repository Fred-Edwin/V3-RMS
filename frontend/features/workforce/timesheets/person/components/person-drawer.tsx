'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Callout, DialogButton, DrawerSection, ErrorBlock, ListSkeleton, StatBoxes, WorkforceDrawer, initialsOf, useWorkforcePermissions } from '../../../_shared';
import { usePersonDrawer } from '../../_shared/hooks/use-month-data';
import { approvedStamp, clockHours, monthLabel, plural, rangeWords, spanOf } from '../../_shared/lib/month-words';
import { plainName } from '../../_shared/lib/timesheet-words';
import type { MonthView, NeedLookItem } from '../../_shared/types/month-types';
import { OvertimeDialog } from '../../overtime/components/overtime-dialog';
import { decisionLine, type NeedAction } from '../lib/person-view';
import { DayFix } from './day-fix';
import { LastDays } from './last-days';
import { NeedLookCard } from './need-look-card';

/**
 * A person's month in a drawer (spec S4): the four numbers, the days that need the manager (one button each, only the ones the viewer
 * may use), and the last 7 days. On an approved month the cards become quiet decision rows and nothing can change. The person is in the
 * address (`person`), so the view can be linked; closing returns focus to the row that opened it.
 */
export function PersonDrawer({
  monthKey,
  site,
  employeeId,
  month,
  range,
  onClose,
  onChanged,
  onOpenFull,
}: {
  monthKey: string;
  site: string | undefined;
  employeeId: string;
  month: MonthView;
  range: { from: string; to: string } | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenFull: () => void;
}) {
  const permissions = useWorkforcePermissions();
  const router = useRouter();
  const [refresh, setRefresh] = React.useState(0);
  const person = usePersonDrawer(monthKey, employeeId, site, range?.from, range?.to, refresh);
  const [overtime, setOvertime] = React.useState<string | null>(null);
  const [fixing, setFixing] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const data = person.data;
  const approved = month.state === 'APPROVED';
  const allowed: Record<NeedAction, boolean> = {
    overtime: month.capabilities.canDecide,
    fix: month.capabilities.canDecide && permissions.can('time.fix'),
    request: permissions.can('time_request.answer'),
    day: true,
  };

  const act = (action: NeedAction, item: NeedLookItem): void => {
    if (action === 'overtime' && item.overtimeItemId) setOvertime(item.overtimeItemId);
    else if (action === 'fix') setFixing(item.date);
    else if (action === 'request') router.push('/app/workforce/requests');
    else onOpenFull();
  };
  const done = (message?: string | null): void => {
    setOvertime(null);
    setFixing(null);
    if (message) setSaid(message);
    setRefresh((n) => n + 1);
    onChanged();
  };

  const name = data ? plainName(data.employee.name) : '';
  const subtitle = data ? [monthLabel(monthKey), data.employee.role ?? data.employee.department, month.organization.name].filter(Boolean).join(' · ') : monthLabel(monthKey);
  return (
    <>
      <WorkforceDrawer open onOpenChange={(o) => !o && onClose()} title={name || 'Loading…'} subtitle={subtitle} {...(name ? { initials: initialsOf(name) } : {})}>
        {person.status === 'loading' && !data ? <ListSkeleton rows={6} columns={[56, 'fill', 100]} label="Loading this person's month" /> : null}
        {person.status === 'error' && !data ? (
          <ErrorBlock title="This person's month could not be loaded." line={person.error.status === 404 ? 'They are not in this month, or you cannot see them.' : person.error.message} onRetry={person.reload} />
        ) : null}
        {data ? (
          <>
            <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
              {rangeWords(data.range.from, data.range.to)} · {plural(data.workingDays, 'working day')}
            </p>
            {said ? (
              <Callout tone="success" size="sm" role="status">
                {said}
              </Callout>
            ) : null}
            <StatBoxes
              variant="times"
              cells={[
                { label: 'PLANNED', value: clockHours(data.totals.plannedMinutes) },
                { label: 'WORKED', value: clockHours(data.totals.workedMinutes) },
                { label: 'OVERTIME', value: clockHours(data.totals.overtimeMinutes), tone: data.totals.overtimeMinutes > 0 && !approved ? 'warning' : 'default' },
                { label: 'LATE', value: data.totals.lateMinutes > 0 ? `${data.totals.lateMinutes} min` : '0' },
              ]}
            />
            {approved ? (
              <DrawerSection caption={`DECISIONS · ${data.decisions.length}`}>
                {data.decisions.length === 0 ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Nothing was decided.</p> : null}
                <ul className="m-0 flex list-none flex-col p-0">
                  {data.decisions.map((d) => (
                    <li key={`${d.date}-${d.status}`} className="border-b border-wds-neutral-100 py-2 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
                      {decisionLine(d.status, d.authorisedMinutes, d.extraMinutes)}
                      {d.at ? <span className="text-wds-text-secondary"> · {approvedStamp(d.at)}</span> : null}
                    </li>
                  ))}
                </ul>
              </DrawerSection>
            ) : (
              <DrawerSection caption={`DAYS THAT NEED A LOOK · ${data.needLook.length}`}>
                {data.needLook.length === 0 ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Nothing needs a look.</p> : null}
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {data.needLook.map((item) => (
                    <NeedLookCard key={`${item.kind}-${item.date}-${item.overtimeItemId ?? item.requestId ?? ''}`} item={item} day={data.lastDays.find((d) => d.date === item.date)} allowed={allowed} onAction={act} />
                  ))}
                </ul>
              </DrawerSection>
            )}
            <DrawerSection caption="THE LAST 7 DAYS">
              {data.lastDays.length === 0 ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No days in this range.</p> : <LastDays days={data.lastDays} />}
            </DrawerSection>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Showing the last {data.lastDays.length} of {spanOf(data.range.from, data.range.to)} days</span>
              <DialogButton kind="cancel" onClick={onOpenFull} className="border-wds-text-ink font-semibold">
                Open the full month ↗
              </DialogButton>
            </div>
            <p className="m-0 border-t border-wds-border pt-3.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              Overtime is only decided here as authorised or not. Payroll applies the Rules to decide pay.
            </p>
          </>
        ) : null}
      </WorkforceDrawer>
      {overtime ? <OvertimeDialog itemId={overtime} onClose={() => setOvertime(null)} onDone={done} /> : null}
      {fixing ? <DayFix employeeId={employeeId} date={fixing} onClose={() => setFixing(null)} onDone={done} /> : null}
    </>
  );
}
