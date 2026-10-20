'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { Callout, DialogButton, EmptyState, ErrorBlock, FilterChip, ListSkeleton, PageHeader, WorkforceFrame, WorkforceKpiStrip, useWorkforcePermissions, type WorkforceKpiCell } from '../../../_shared';
import { nairobiToday } from '../../../rota';
import { useMonth, usePersonDays } from '../../_shared/hooks/use-month-data';
import { clockHours, monthLabel, plural, pickLimits, rangeWords } from '../../_shared/lib/month-words';
import { plainName, roleName } from '../../_shared/lib/timesheet-words';
import type { PersonDayRow } from '../../_shared/types/month-types';
import { ExportMenu } from '../../exports/components/export-menu';
import { OvertimeDialog } from '../../overtime/components/overtime-dialog';
import { RangeControl } from '../../months/components/range-control';
import { rangeFromUrl } from '../../months/lib/month-pick';
import { rowAction, type DaysChip, type RowAction } from '../lib/days-view';
import { CalendarGlance, GlanceLegend } from './calendar-glance';
import { DayFix } from './day-fix';
import { DaysTable } from './days-table';

/**
 * One person's whole month on its own page (spec S5): the four numbers, the month at a glance, every day with its result, arrows to the
 * previous and next person in the table's order, and a one-person export. The branch, days and chip travel in the address.
 */
export function PersonMonthScreen() {
  const { monthKey, employeeId } = useParams<{ monthKey: string; employeeId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const permissions = useWorkforcePermissions();
  const today = nairobiToday();
  const site = params.get('site') ?? undefined;
  const range = rangeFromUrl(params.get('from'), params.get('to'));
  const chip: DaysChip = params.get('view') === 'needs' ? 'needs' : params.get('view') === 'worked' ? 'worked' : 'all';
  const [refresh, setRefresh] = React.useState(0);
  const [dialog, setDialog] = React.useState<{ kind: 'overtime' | 'fix'; day: PersonDayRow } | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [highlight, setHighlight] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const days = usePersonDays(monthKey, employeeId, site, range?.from, range?.to, chip, 1, 50, refresh);
  const month = useMonth(monthKey, site, range?.from, range?.to, refresh, true);
  const data = days.data;
  const view = month.data;

  const go = (patch: Record<string, string | null>, path = `/app/workforce/timesheets/month/${monthKey}/${employeeId}`): void => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };
  const toPerson = (id: string): void => router.push(`/app/workforce/timesheets/month/${monthKey}/${id}?${params.toString()}`);
  const pick = (date: string): void => {
    document.getElementById(`day-${date}`)?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setHighlight(date);
    window.setTimeout(() => setHighlight((h) => (h === date ? null : h)), 2000);
  };
  const done = (message?: string | null): void => {
    setDialog(null);
    if (message) setSaid(message);
    setRefresh((n) => n + 1);
  };

  const approved = data?.month.state === 'APPROVED';
  const can = { decide: !approved && (view?.capabilities.canDecide ?? false), fix: !approved && (view?.capabilities.canDecide ?? false) && permissions.can('time.fix'), request: permissions.can('time_request.answer') };
  const act = (action: RowAction, day: PersonDayRow): void => {
    if (action.action === 'request') router.push('/app/workforce/requests');
    else setDialog({ kind: action.action, day });
  };
  const back = `/app/workforce/timesheets?${new URLSearchParams({ month: monthKey, ...(site ? { site } : {}), ...(range ? { from: range.from, to: range.to } : {}) }).toString()}`;
  const name = data ? plainName(data.employee.name) : '';
  const siteName = view?.organization.name ?? '';
  const firstNeed = data?.days.find((d) => d.needsLook);
  const t = data?.totals;

  const cells: WorkforceKpiCell[] | null = data && t
    ? [
        { key: 'hours', label: 'HOURS WORKED', value: clockHours(t.workedMinutes), detail: `plan was ${clockHours(t.plannedMinutes)}` },
        { key: 'days', label: 'DAYS', value: `${t.workedDays} worked`, detail: `${t.restDays} rest days · ${t.absentDays} absent · 0 leave` },
        { key: 'late', label: 'LATE, RECORDED', value: t.lateMinutes > 0 ? `${t.lateMinutes} min` : '0', detail: `${plural(t.lateDays, 'day')} · payroll applies the Rules` },
        { key: 'needs', label: 'NEEDS YOU', value: String(data.counts.needs), detail: data.counts.needs > 0 ? `${plural(data.counts.needs, 'day')} to look at` : 'Nothing to decide', ...(data.counts.needs > 0 ? { actionable: true, onSelect: () => go({ view: 'needs' }) } : {}) },
      ]
    : null;

  let body: React.ReactNode;
  if (days.status === 'error' && !data) {
    body = days.error.status === 404 ? <EmptyState kind="nothingFound" title="Not found" line="There is no timesheet for this person here." /> : <ErrorBlock title="This month did not load" line={days.error.message} onRetry={days.reload} />;
  } else if (!data) body = <ListSkeleton rows={10} columns={[100, 'fill', 80]} label="Loading the month" />;
  else if (data.counts.all === 0) body = <EmptyState kind="nothingYet" title="No days" line={`${name} has no days in ${monthLabel(monthKey)}.`} />;
  else {
    const lim = view ? pickLimits(view, today) : { first: data.month.start, last: data.month.end };
    body = (
      <div className="flex flex-col gap-5 lg:flex-row">
        <aside aria-label="The month at a glance" className="flex shrink-0 flex-col gap-3 lg:w-[300px] lg:border-r lg:border-wds-neutral-950 lg:pr-5">
          <h2 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">THE MONTH AT A GLANCE</h2>
          <CalendarGlance days={data.glance} onPick={pick} />
          <GlanceLegend />
          {firstNeed && !approved ? (
            <div className="flex flex-col gap-1.5 border border-wds-warning-border bg-wds-caramel-100 p-3">
              <p className="m-0 font-wds-sans text-[13px] font-semibold leading-[18px] text-wds-text-ink">Something needs you on {firstNeed.date.slice(8)} {monthLabel(monthKey).split(' ')[0]}</p>
              <DialogButton kind="cancel" onClick={() => pick(firstNeed.date)}>Go to the day</DialogButton>
            </div>
          ) : null}
        </aside>
        <section aria-label="Days" className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Filter" className="flex flex-wrap gap-2">
              <FilterChip label="All days" count={data.counts.all} selected={chip === 'all'} onClick={() => go({ view: null })} />
              <FilterChip label="Needs a look" count={data.counts.needs} selected={chip === 'needs'} tone="attention" onClick={() => go({ view: 'needs' })} />
              <FilterChip label="Worked" count={data.counts.worked} selected={chip === 'worked'} onClick={() => go({ view: 'worked' })} />
            </div>
            <div className="ml-auto">
              <RangeControl first={lim.first} last={lim.last} today={today} value={range} onChange={(r) => go({ from: r?.from ?? null, to: r?.to ?? null })} />
            </div>
          </div>
          {data.days.length === 0 ? (
            <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Nothing here.</p>
          ) : (
            <DaysTable days={data.days} highlight={highlight} caption={`${name}, ${monthLabel(monthKey)}`} actions={(d) => rowAction(d, can)} onAction={act} />
          )}
          <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Showing {data.days.length} of {data.total} days</p>
        </section>
      </div>
    );
  }

  return (
    <WorkforceFrame breadcrumb={{ section: 'Workforce', screen: 'Timesheets' }} phoneTitle="Timesheets" label="Timesheets" className="px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-4">
        <Link href={back} className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary hover:text-wds-text-ink">‹ Timesheets · {monthLabel(monthKey)}{siteName ? ` · ${siteName}` : ''}</Link>
        <PageHeader
          size="lg"
          title={name ? `${name} · ${monthLabel(monthKey)}` : 'Timesheet'}
          subtitle={data ? `${[roleName(data.employee.role) || data.employee.department, siteName].filter(Boolean).join(' · ')} · every day from ${rangeWords(range?.from ?? data.month.start, range?.to ?? data.month.end)}` : undefined}
          actions={
            <>
              <DialogButton kind="cancel" size="lg" disabled={!data?.neighbours.prevEmployeeId} title={data?.neighbours.prevEmployeeId ? undefined : 'This is the first person'} onClick={() => data?.neighbours.prevEmployeeId && toPerson(data.neighbours.prevEmployeeId)}>‹ Previous person</DialogButton>
              <DialogButton kind="cancel" size="lg" disabled={!data?.neighbours.nextEmployeeId} title={data?.neighbours.nextEmployeeId ? undefined : 'This is the last person'} onClick={() => data?.neighbours.nextEmployeeId && toPerson(data.neighbours.nextEmployeeId)}>Next person ›</DialogButton>
              {view?.capabilities.canExport ? <DialogButton kind="cancel" size="lg" onClick={() => setExporting(true)}>Export ▾</DialogButton> : null}
            </>
          }
        />
        {said ? <Callout tone="success" size="sm" role="status">{said}</Callout> : null}
        {cells ? <WorkforceKpiStrip aria-label="This person's month" cells={cells} /> : null}
        <div className="border-t border-wds-neutral-950 pt-4">{body}</div>
      </div>
      {exporting && view && data ? <ExportMenu month={view} siteId={site} range={range} person={{ id: data.employee.id, name }} onClose={() => setExporting(false)} /> : null}
      {dialog?.kind === 'overtime' && dialog.day.overtimeItemId ? <OvertimeDialog itemId={dialog.day.overtimeItemId} onClose={() => setDialog(null)} onDone={done} /> : null}
      {dialog?.kind === 'fix' ? <DayFix employeeId={employeeId} date={dialog.day.date} onClose={() => setDialog(null)} onDone={done} /> : null}
    </WorkforceFrame>
  );
}
