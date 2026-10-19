'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Callout, ChoiceChips, EmptyState, ErrorBlock, ListSkeleton, WorkforceFrame, useWorkforcePermissions } from '../../../_shared';
import { nairobiToday } from '../../../rota';
import { useMonth, useMonthList } from '../../_shared/hooks/use-month-data';
import { useBranchChoice } from '../../_shared/hooks/use-branch-choice';
import { monthLabel, pickLimits } from '../../_shared/lib/month-words';
import type { MonthPeople, MonthPerson } from '../../_shared/types/month-types';
import { ApproveDialog } from '../../approve/components/approve-dialog';
import { ExportMenu } from '../../exports/components/export-menu';
import { PersonDrawer } from '../../person/components/person-drawer';
import { useDepartments } from '../hooks/use-departments';
import { useMonthUrl } from '../hooks/use-month-url';
import { useRefreshOnFocus } from '../hooks/use-refresh-on-focus';
import { defaultMonth, rangeFromUrl } from '../lib/month-pick';
import { MonthHead } from './month-head';
import { MonthsList } from './months-list';
import { PeopleTable } from './people-table';
import { RangeControl } from './range-control';

/**
 * Timesheets (spec S1, S2, S3, S7, S8): one branch's timesheet by month. Pick a month on the left, check its hours on the right, decide
 * what needs the manager, approve. Buttons follow the server's answer (`capabilities`), never a role name. A branch whose new clock is off
 * shows nothing new; another branch answers "not found". The address holds the branch, month, days and open person.
 */
export function MonthsScreen() {
  const permissions = useWorkforcePermissions();
  const branch = useBranchChoice('timesheet.read');
  const url = useMonthUrl();
  const router = useRouter();
  const today = nairobiToday();
  const siteId = url.get('site') ?? branch.siteId;
  const readable = permissions.ready && branch.ready && permissions.can('timesheet.read');
  const [listPage, setListPage] = React.useState(1);
  const list = useMonthList(siteId, listPage, readable);
  const monthKey = url.get('month') ?? (list.data ? defaultMonth(list.data.months) : null);
  const range = rangeFromUrl(url.get('from'), url.get('to'));
  const [refresh, setRefresh] = React.useState(0);
  const month = useMonth(monthKey, siteId, range?.from, range?.to, refresh, readable && list.data?.enabled === true);
  const [counts, setCounts] = React.useState<MonthPeople['counts'] | null>(null);
  const [dialog, setDialog] = React.useState<'approve' | 'export' | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const departments = useDepartments(month.data?.organization.id ?? null);
  const person = url.get('person');
  const view = month.data;

  useRefreshOnFocus(60_000, () => {
    setRefresh((n) => n + 1);
    list.reload();
  });
  const changed = (): void => {
    setRefresh((n) => n + 1);
    list.reload();
  };
  const chooseMonth = (key: string): void => url.set({ month: key, from: null, to: null, q: null, page: null, view: null, person: null });
  const showNeeds = (): void => url.set({ view: 'needs', page: null });
  const open = (p: MonthPerson): void => url.set({ person: p.employeeId });
  const limits = view ? pickLimits(view, today) : null;
  const siteName = view?.organization.name ?? branch.name;

  let body: React.ReactNode;
  if (!permissions.ready || !branch.ready || (list.status === 'loading' && !list.data)) body = <ListSkeleton rows={6} columns={[200, 'fill', 120]} label="Loading the timesheets" />;
  else if (!permissions.can('timesheet.read')) body = <EmptyState kind="nothingFound" title="No access" line="Your role does not read timesheets." />;
  else if (list.status === 'error' && !list.data) {
    body =
      list.error.status === 404 ? (
        <EmptyState kind="nothingFound" title="Not found" line="There is no timesheet here." />
      ) : (
        <ErrorBlock title="The timesheets did not load" line={list.error.message} onRetry={list.reload} />
      );
  } else if (list.data && !list.data.enabled) {
    body = <EmptyState kind="nothingYet" title="This branch still uses the old clock" line="This branch still uses the old clock. Timesheets start when it is switched on." />;
  } else {
    body = (
      <>
        {said ? (
          <Callout tone="success" size="sm" role="status">
            {said}
          </Callout>
        ) : null}
        <MonthHead
          title="Timesheets"
          siteName={siteName}
          month={view}
          onExport={() => setDialog('export')}
          onApprove={() => setDialog('approve')}
          onShowNeeds={showNeeds}
        />
        <div className="flex flex-col border-t border-wds-neutral-950 lg:h-[max(520px,calc(100dvh-340px))] lg:flex-row">
          <MonthsList
            siteName={siteName}
            status={list.status === 'error' ? 'error' : list.status}
            data={list.data}
            selected={monthKey}
            page={listPage}
            onSelect={chooseMonth}
            onPage={setListPage}
            onRetry={list.reload}
          />
          <section aria-label={monthKey ? `${monthLabel(monthKey)}, the people` : 'The people'} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto pt-4 lg:pl-6">
            {month.status === 'error' && !view ? <ErrorBlock title="This month did not load" line={month.error.message} onRetry={month.reload} /> : null}
            {view && limits && monthKey ? (
              <>
                <RangeControl first={limits.first} last={limits.last} today={today} value={range} onChange={(r) => url.set({ from: r?.from ?? null, to: r?.to ?? null, page: null })} />
                <PeopleTable
                  key={`${siteId ?? ''}:${monthKey}:${range?.from ?? ''}:${range?.to ?? ''}`}
                  monthKey={monthKey}
                  site={siteId}
                  from={range?.from}
                  to={range?.to}
                  departments={departments}
                  counts={counts}
                  refreshToken={refresh}
                  caption={`Timesheet, ${siteName}, ${monthLabel(monthKey)}${range ? `, ${range.from} to ${range.to}` : ''}`}
                  onCounts={setCounts}
                  onOpen={open}
                />
              </>
            ) : month.status === 'loading' ? (
              <ListSkeleton rows={8} columns={[160, 'fill', 80, 80]} label="Loading the month" />
            ) : null}
          </section>
        </div>
      </>
    );
  }

  return (
    <WorkforceFrame breadcrumb={{ section: 'Workforce', screen: 'Timesheets' }} phoneTitle="Timesheets" label="Timesheets" className="px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-4">
        {branch.branches.length > 1 ? (
          <ChoiceChips
            legend="Branch"
            legendStyle="caps"
            size="sm"
            value={siteId ?? null}
            onChange={(id) => {
              setListPage(1);
              setCounts(null);
              url.set({ site: id, month: null, from: null, to: null, q: null, page: null, view: null, person: null });
            }}
            options={branch.branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        ) : null}
        {body}
      </div>
      {person && view && monthKey ? (
        <PersonDrawer
          monthKey={monthKey}
          site={siteId}
          employeeId={person}
          month={view}
          range={range}
          onClose={() => url.set({ person: null })}
          onChanged={changed}
          onOpenFull={() => router.push(`/app/workforce/timesheets/month/${monthKey}/${person}?${new URLSearchParams({ ...(siteId ? { site: siteId } : {}), ...(range ? { from: range.from, to: range.to } : {}) }).toString()}`)}
        />
      ) : null}
      {dialog === 'export' && view ? <ExportMenu month={view} siteId={siteId} range={range} onClose={() => setDialog(null)} /> : null}
      {dialog === 'approve' && monthKey ? (
        <ApproveDialog
          monthKey={monthKey}
          siteId={siteId}
          onClose={() => setDialog(null)}
          onShowNeeds={showNeeds}
          onDone={(message) => {
            setDialog(null);
            setSaid(message);
            changed();
          }}
        />
      ) : null}
    </WorkforceFrame>
  );
}
