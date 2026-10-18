'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';

import { Callout, ErrorBlock, ListSkeleton, PageHeader, WorkforceKpiStrip, useWorkforcePermissions } from '../../../../_shared';
import { PeopleFrame } from '../../../_shared/components/people-frame';
import { Notice, useNotice } from '../../_shared/components/org-notice';
import { useDepartment } from '../../_shared/hooks/use-org-data';
import { AssignHeadDialog } from '../../heads/components/assign-head-dialog';
import { EndHeadDialog } from '../../heads/components/end-head-dialog';
import { HeadCard } from '../../heads/components/head-card';
import { PEOPLE_PER_PAGE, departmentKpis, departmentSubtitle } from '../lib/department-copy';
import { CasualPoolPanel, PeoplePanel } from './department-people';
import { EditDepartmentDialog } from './edit-department-dialog';
import { RetireDepartmentDialog } from './retire-department-dialog';

type Dialog = { kind: 'edit' } | { kind: 'retire' } | { kind: 'assign'; mode: 'REPLACE' | 'ACTING' } | { kind: 'end'; which: 'HEAD' | 'ACTING' };

/**
 * One department (Paper Chapter 3 step 02; O2): the head card, the people, the casual pool. What each button may do comes from the
 * server (`can.edit`, `can.assignHead`) and the capability table, never from a role name. Retired departments open too, so they can be
 * brought back.
 */
export function DepartmentScreen({ id }: { id: string }) {
  const router = useRouter();
  const permissions = useWorkforcePermissions();
  const remote = useDepartment(id, PEOPLE_PER_PAGE, permissions.ready);
  const { notice, announce } = useNotice();
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const reload = remote.reload;
  const d = remote.data;

  const closeAndTell = React.useCallback(
    (message: string) => {
      setDialog(null);
      announce(message);
      reload();
    },
    [announce, reload]
  );
  const canAddPeople = permissions.can('employee.write_basic') && d?.isActive === true;
  const crumbs = { root: 'People', section: 'Organisation', sectionHref: '/app/workforce/organisation', screen: d?.name ?? 'Department' };
  const actions = d ? (
    <>
      {d.can.edit ? <Button variant="flat" size="default" onClick={() => setDialog({ kind: 'edit' })}>Edit department</Button> : null}
      {d.can.edit ? <Button variant="flat" size="default" onClick={() => setDialog({ kind: 'retire' })}>{d.isActive ? 'Retire' : 'Bring back'}</Button> : null}
      {canAddPeople ? <Button size="default" onClick={() => router.push('/app/workforce/employees/new')}>Add employee here</Button> : null}
    </>
  ) : null;

  const body = (): React.ReactNode => {
    if (permissions.failed) return <ErrorBlock title="Your access did not load" line="Try again in a moment." onRetry={permissions.retry} />;
    if (remote.status === 'error' && !d) {
      if (remote.error.status === 404) return <ErrorBlock title="That department is not on your list" line="It may be retired, or at a site you do not look after." />;
      if (remote.error.status === 403) return <ErrorBlock title="Your role does not open this department" line="Ask HR if you need to see it." />;
      return <ErrorBlock title="The department did not load" line="Check your connection and try again." onRetry={remote.reload} />;
    }
    if (!d) return <ListSkeleton rows={5} label="Loading the department" />;
    const positionOf = (employeeId: string): string | null => d.peoplePage.items.find((p) => p.employeeId === employeeId)?.positionName ?? null;
    return (
      <>
        {!d.isActive ? <Callout tone="warning" size="sm" title="Retired">This department is retired. It is off the rota and the hiring form until it is brought back.</Callout> : null}
        <WorkforceKpiStrip aria-label={`${d.name} numbers`} cells={departmentKpis(d)} />
        <div className="grid grid-cols-[minmax(0,1fr)_356px] items-start gap-6 max-lg:grid-cols-1">
          <PeoplePanel department={d} />
          <div className="flex flex-col gap-5">
            <HeadCard
              department={d}
              positionOf={positionOf}
              onReplace={() => setDialog({ kind: 'assign', mode: 'REPLACE' })}
              onActing={() => setDialog({ kind: 'assign', mode: 'ACTING' })}
              onEnd={(which) => setDialog({ kind: 'end', which })}
            />
            <CasualPoolPanel department={d} onAdd={canAddPeople ? () => router.push('/app/workforce/employees/new') : null} />
          </div>
        </div>
      </>
    );
  };

  return (
    <PeopleFrame breadcrumb={crumbs} phoneTitle={d?.name ?? 'Department'} label={d ? `${d.name}, department` : 'Department'} actions={actions}>
      <div className="flex w-full flex-col gap-5 px-wds-8 py-7 max-md:px-4">
        <PageHeader title={d?.name ?? 'Department'} subtitle={d ? departmentSubtitle(d) : undefined} actions={actions ? <div className="flex gap-2 lg:hidden">{actions}</div> : undefined} />
        <Notice message={notice} />
        {body()}
      </div>
      {d && dialog?.kind === 'edit' ? <EditDepartmentDialog department={d} canCreatePositions={permissions.can('org.write')} onClose={() => setDialog(null)} done={closeAndTell} /> : null}
      {d && dialog?.kind === 'retire' ? <RetireDepartmentDialog id={d.id} name={d.name} restore={!d.isActive} onClose={() => setDialog(null)} done={closeAndTell} /> : null}
      {d && dialog?.kind === 'assign' ? (
        <AssignHeadDialog
          target={{ id: d.id, name: d.name, organizationName: d.organizationName, people: d.people, approver: d.head?.name ?? 'the Branch Manager', hasHead: d.head !== null, hasActingHead: d.actingHead !== null }}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          done={closeAndTell}
        />
      ) : null}
      {d && dialog?.kind === 'end' && (dialog.which === 'ACTING' ? d.actingHead : d.head) ? (
        <EndHeadDialog departmentId={d.id} departmentName={d.name} personName={(dialog.which === 'ACTING' ? d.actingHead : d.head)?.name ?? ''} which={dialog.which} onClose={() => setDialog(null)} done={closeAndTell} />
      ) : null}
    </PeopleFrame>
  );
}
