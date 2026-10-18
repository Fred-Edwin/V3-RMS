'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { cn } from '@/lib/cn';

import { EmptyState, ErrorBlock, ListRow, ListSkeleton, PageHeader, WorkforceKpiStrip, useWorkforcePermissions } from '../../../../_shared';
import { PeopleFrame } from '../../../_shared/components/people-frame';
import { usePeopleSummary } from '../../../_shared/hooks/use-people-data';
import { Notice, useNotice } from '../../_shared/components/org-notice';
import { OrgTabs } from '../../_shared/components/org-tabs';
import { useOrgOverview } from '../../_shared/hooks/use-org-data';
import { firstSiteToShow, overviewKpis, sitePeople, siteStatus, siteSubline, siteWithGap } from '../../_shared/lib/org-copy';
import type { DepartmentSummary } from '../../_shared/types/org-types';
import { AddDepartmentDialog } from '../../departments/components/add-department-dialog';
import { AssignHeadDialog } from '../../heads/components/assign-head-dialog';
import { DepartmentsTable } from './departments-table';

/**
 * Organisation, Sites and departments (Paper Chapter 3 step 01; O1): the four numbers, the sites on the left, the chosen site's
 * departments on the right. "Add department" and "Assign head" appear only for someone the server lets write (`org.write`,
 * `org.write_heads`). Heads on leave arrives with Leave, so that cell is a dash.
 */
export function SitesTab() {
  const router = useRouter();
  const permissions = useWorkforcePermissions();
  const [showRetired, setShowRetired] = React.useState(false);
  const overview = useOrgOverview(showRetired, permissions.ready);
  const summary = usePeopleSummary(permissions.ready);
  const { notice, announce } = useNotice();
  const [siteId, setSiteId] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<{ kind: 'add' } | { kind: 'assign'; department: DepartmentSummary } | null>(null);
  const reload = overview.reload;

  const canWrite = permissions.can('org.write');
  const canAssignHeads = permissions.can('org.write_heads');
  const data = overview.data;
  const site = data ? firstSiteToShow(data, siteId) : undefined;
  const open = (d: DepartmentSummary): void => router.push(`/app/workforce/organisation/${d.id}`);
  const addButton = canWrite ? <Button size="default" onClick={() => setDialog({ kind: 'add' })}>Add department</Button> : null;
  const closeAndTell = React.useCallback(
    (message: string) => {
      setDialog(null);
      announce(message);
      reload();
    },
    [announce, reload]
  );

  const body = (): React.ReactNode => {
    if (permissions.failed) return <ErrorBlock title="Your access did not load" line="Try again in a moment." onRetry={permissions.retry} />;
    if (overview.status === 'error' && !data) {
      return overview.error.status === 403 ? (
        <ErrorBlock title="Your role does not open Organisation" line="Ask HR if you need to see how the departments are run." />
      ) : (
        <ErrorBlock title="The organisation did not load" line="Check your connection and try again." onRetry={overview.reload} />
      );
    }
    if (!data) return <ListSkeleton rows={5} label="Loading the organisation" />;
    if (data.organizations.length === 0) return <EmptyState kind="nothingYet" title="No sites yet" line="Sites and their departments appear here." />;
    return (
      <>
        <WorkforceKpiStrip aria-label="Organisation numbers" cells={overviewKpis(data, summary.data?.casualPool ?? null, () => { const gap = siteWithGap(data); if (gap) setSiteId(gap.id); })} />
        <OrgTabs value="sites" />
        <div className="-mt-5 flex min-h-[430px] w-full border-t border-wds-text-ink bg-wds-neutral-0 max-md:flex-col">
          <div className="flex w-[330px] shrink-0 flex-col border-r border-wds-text-ink max-md:w-full max-md:border-b max-md:border-r-0">
            <div className="flex h-9 items-center justify-between px-4">
              <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Sites</span>
              <span className="font-wds-sans text-[12px] text-wds-text-muted">{data.organizations.length}</span>
            </div>
            {data.organizations.map((s) => {
              const status = siteStatus(s);
              return (
                <ListRow key={s.id} selected={s.id === site?.id} onSelect={() => setSiteId(s.id)} className="flex-col items-stretch gap-0.5 border-b-0 py-3">
                  <span className="flex justify-between gap-2">
                    <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{s.name}</span>
                    <span className={cn('font-wds-sans text-[12px] leading-4', status.tone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-success-fg')}>{status.text}</span>
                  </span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{siteSubline(s)}</span>
                </ListRow>
              );
            })}
          </div>
          {site ? (
            <section aria-label={site.name} className="flex min-w-0 flex-1 flex-col gap-3.5 pb-6 pl-7 pt-3.5 max-md:pl-0">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="m-0 font-wds-sans text-[20px] font-semibold leading-6 tracking-[-0.02em] text-wds-text-ink">{site.name}</h2>
                  <p className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{sitePeople(site)} people · {site.departments.length} departments{site.headsAllowed ? '' : ' · no heads here'}</p>
                </div>
                {canWrite ? <Button variant="flat" size="sm" onClick={() => setDialog({ kind: 'add' })}>Add department here</Button> : null}
              </div>
              <DepartmentsTable site={site} canAssignHeads={canAssignHeads} onOpen={open} onAssign={(department) => setDialog({ kind: 'assign', department })} />
              <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Click a department to open it. A head approves its overtime, leave and Reports.</p>
              <button type="button" onClick={() => setShowRetired((v) => !v)} className="self-start border-0 bg-transparent p-0 font-wds-sans text-[12px] leading-4 text-wds-primary underline-offset-2 hover:underline focus-visible:shadow-wds-ring focus-visible:outline-none">
                {showRetired ? 'Hide retired departments' : 'Show retired departments'}
              </button>
            </section>
          ) : null}
        </div>
      </>
    );
  };

  return (
    <PeopleFrame breadcrumb={{ section: 'People', screen: 'Organisation' }} phoneTitle="Organisation" label="Organisation" actions={addButton}>
      <div className="flex w-full flex-col gap-[18px] px-wds-8 py-7 max-md:px-4">
        <PageHeader title="Organisation" subtitle="Every department has a head, or a gap this page shows you first." actions={addButton ? <span className="lg:hidden">{addButton}</span> : undefined} />
        <Notice message={notice} />
        {body()}
      </div>
      {dialog?.kind === 'add' && data ? (
        <AddDepartmentDialog
          sites={data.organizations.map((s) => ({ id: s.id, name: s.name }))}
          defaultSiteId={site?.id ?? null}
          canCreatePositions={canWrite}
          onClose={() => setDialog(null)}
          done={closeAndTell}
        />
      ) : null}
      {dialog?.kind === 'assign' && site ? (
        <AssignHeadDialog
          target={{
            id: dialog.department.id,
            name: dialog.department.name,
            organizationName: site.name,
            people: dialog.department.people,
            approver: dialog.department.head?.name ?? 'the Branch Manager',
            hasHead: dialog.department.head !== null,
            hasActingHead: dialog.department.actingHead !== null,
          }}
          mode="REPLACE"
          onClose={() => setDialog(null)}
          done={closeAndTell}
        />
      ) : null}
    </PeopleFrame>
  );
}
