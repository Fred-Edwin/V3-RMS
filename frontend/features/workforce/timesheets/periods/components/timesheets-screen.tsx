'use client';

import * as React from 'react';
import Link from 'next/link';

import { ChoiceChips, DialogButton, EmptyState, ErrorBlock, ListSkeleton, PageHeader, PeriodStepper, WorkforceFrame, WorkforceKpiStrip, Callout, useWorkforcePermissions } from '../../../_shared';
import { nairobiToday } from '../../../rota';
import { PersonDrawer } from '../../week/components/person-drawer';
import { useBranchChoice } from '../../_shared/hooks/use-branch-choice';
import { usePeriods } from '../../_shared/hooks/use-timesheet-data';
import { closedWhen, monthOf, periodLine } from '../../_shared/lib/timesheet-words';
import type { PeriodView, PersonRow } from '../../_shared/types/timesheet-types';
import { canCloseNow, kpiCells } from '../lib/period-view';
import { useDepartments } from '../hooks/use-departments';
import { useExport } from '../hooks/use-export';
import { CloseDialog } from './close-dialog';
import { PeopleTable } from './people-table';
import { ReopenDialog } from './reopen-dialog';

/**
 * Timesheets (Paper Chapter 8): the month at a glance. The system approves days that match the rota, so you see only what needs you.
 * The Branch and Store Manager read and decide for their branch; HR and the Director read every branch with a chooser; the Accountant
 * reads and decides nothing; a department head sees their department. Buttons follow the server's capability table, never a role name.
 */
export function TimesheetsScreen() {
  const permissions = useWorkforcePermissions();
  const branch = useBranchChoice('timesheet.read');
  const periods = usePeriods(branch.siteId, branch.ready && permissions.can('timesheet.read'));
  const [index, setIndex] = React.useState(0);
  const [view, setView] = React.useState<PeriodView | null>(null);
  const [refresh, setRefresh] = React.useState(0);
  const [open, setOpen] = React.useState<PersonRow | null>(null);
  const [dialog, setDialog] = React.useState<'close' | 'reopen' | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const list = periods.data?.periods ?? [];
  const period = view && view.period.id === list[index]?.id ? view.period : (list[index] ?? null);
  const departments = useDepartments(period?.organizationId ?? null);
  const exporter = useExport();
  const today = nairobiToday();

  const changed = (): void => {
    setRefresh((n) => n + 1);
    periods.reload();
  };
  const done = (message: string): void => {
    setDialog(null);
    setSaid(message);
    changed();
  };

  const closing = period !== null && permissions.can('timesheet.close') && period.state === 'OPEN';
  const closeNow = period !== null && canCloseNow(period, today);
  const actions = period ? (
    <>
      <DialogButton kind="cancel" disabled={exporter.busy} onClick={() => void exporter.run(period.id)}>
        {exporter.busy ? 'Preparing…' : 'Export'}
      </DialogButton>
      {closing ? (
        <DialogButton kind={closeNow ? 'primary' : 'cancel'} disabled={!closeNow} title={closeNow ? undefined : 'You can close the month from its last day. It closes by itself at the cut-off.'} onClick={() => setDialog('close')}>
          {closeNow ? 'Close the period' : 'Close early'}
        </DialogButton>
      ) : null}
    </>
  ) : undefined;

  let body: React.ReactNode;
  if (!permissions.ready || !branch.ready || periods.status === 'loading') body = <ListSkeleton rows={6} columns={[200, 'fill', 120]} label="Loading the timesheets" />;
  else if (periods.status === 'error' && !periods.data) body = <ErrorBlock title="The timesheets did not load" line={periods.error.message} onRetry={periods.reload} />;
  else if (!periods.data?.enabled || !period) {
    body = <EmptyState kind="nothingYet" title="This branch still uses the old clock" line="Timesheets appear here once the System Admin switches the new clock on for the branch." />;
  } else {
    body = (
      <>
        {view ? <WorkforceKpiStrip aria-label="The month at a glance" cells={kpiCells(view)} /> : null}
        {period.state !== 'OPEN' ? (
          <Callout
            tone={period.state === 'CLOSED' ? 'neutral' : 'warning'}
            kicker={period.state === 'CLOSED' ? 'CLOSED' : 'CLOSING'}
            title={period.state === 'CLOSED' ? `${monthOf(period)} is closed` : 'This month is closing'}
            size="sm"
            action={
              period.state === 'CLOSED' ? (
                <div className="flex flex-wrap gap-2">
                  <Link href={`/app/workforce/timesheets/report?period=${period.id}`} className="inline-flex h-[34px] items-center border border-wds-border-strong px-4 font-wds-sans text-[13px] text-wds-text-ink hover:bg-wds-neutral-50">
                    Open the report
                  </Link>
                  {permissions.can('timesheet.reopen') ? (
                    <DialogButton kind="cancel" onClick={() => setDialog('reopen')}>
                      Reopen with a reason
                    </DialogButton>
                  ) : null}
                </div>
              ) : undefined
            }
          >
            {period.state === 'CLOSED' ? `Closed ${closedWhen(period)}. Every day and every clock time is read-only. Only HR can reopen it, with a reason.` : 'It is being closed. Refresh in a moment.'}
          </Callout>
        ) : null}
        {view && view.carriedInDays > 0 ? (
          <Callout tone="info" size="sm">
            {view.carriedInDays} {view.carriedInDays === 1 ? 'day' : 'days'} moved here from last month and are still waiting for a decision.
          </Callout>
        ) : null}
        {said ? (
          <Callout tone="success" size="sm" role="status">
            {said}
          </Callout>
        ) : null}
        {exporter.error ? (
          <Callout tone="error" size="sm" role="alert">
            {exporter.error}
          </Callout>
        ) : null}
        <PeopleTable key={period.id} periodId={period.id} view={view} departments={departments} refreshToken={refresh} onView={setView} onOpen={setOpen} />
      </>
    );
  }

  return (
    <WorkforceFrame breadcrumb={{ section: 'Workforce', screen: 'Timesheets' }} phoneTitle="Timesheets" label="Timesheets" actions={actions} className="px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-5">
        <PageHeader
          title={`Timesheets${branch.name ? ` · ${branch.name}` : ''}`}
          subtitle={period ? periodLine(period) : undefined}
          actions={
            list.length > 1 && period ? (
              <PeriodStepper label={monthOf(period)} previousLabel="Earlier month" nextLabel="Later month" previousDisabled={index >= list.length - 1} nextDisabled={index === 0} onPrevious={() => { setView(null); setIndex(index + 1); }} onNext={() => { setView(null); setIndex(index - 1); }} />
            ) : undefined
          }
        />
        {branch.branches.length > 1 ? <ChoiceChips legend="Branch" legendStyle="caps" size="sm" value={branch.siteId ?? null} onChange={(id) => { setIndex(0); setView(null); branch.choose(id); }} options={branch.branches.map((b) => ({ value: b.id, label: b.name }))} /> : null}
        {body}
      </div>
      {open && period ? (
        <PersonDrawer
          period={period}
          employeeId={open.employeeId}
          name={open.name}
          permissions={{ approve: permissions.can('timesheet.approve'), overtime: permissions.can('overtime.approve'), fix: permissions.can('time.fix') }}
          onClose={() => setOpen(null)}
          onChanged={changed}
        />
      ) : null}
      {dialog === 'close' && view ? <CloseDialog view={view} branch={branch.name} onClose={() => setDialog(null)} onDone={done} /> : null}
      {dialog === 'reopen' && period ? <ReopenDialog period={period} onClose={() => setDialog(null)} onDone={done} /> : null}
    </WorkforceFrame>
  );
}
