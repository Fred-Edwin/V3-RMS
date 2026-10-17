'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';

import { ErrorBlock, PageHeader, WorkforceKpiStrip, useWorkforcePermissions } from '../../../_shared';
import { PeopleFrame } from '../../_shared/components/people-frame';
import { useLookups, usePeopleSummary } from '../../_shared/hooks/use-people-data';
import type { EmployeeListRow } from '../../_shared/types/people-types';
import { employeesKpiCells, employeesSubtitle } from '../lib/summary-copy';
import { EmployeesTable } from './employees-table';

/**
 * Employees (Paper Chapter 4, R1 and R2; the Chapter 2 entry): the title, the four numbers, then the table. "Add employee" is the one
 * brown button and appears only for someone who may write basics (the server's `employee.write_basic`).
 */
export function EmployeesScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const permissions = useWorkforcePermissions();
  const lookups = useLookups(permissions.ready);
  const summary = usePeopleSummary(permissions.ready);

  const chooseFilter = React.useCallback(
    (filter: string) => {
      const next = new URLSearchParams(params.toString());
      next.set('filter', filter);
      next.delete('page');
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );
  const open = React.useCallback((row: EmployeeListRow) => router.push(`/app/workforce/employees/${row.id}`), [router]);

  const canAdd = permissions.can('employee.write_basic');
  const add = canAdd ? (
    <Button size="default" onClick={() => router.push('/app/workforce/employees/new')}>
      Add employee
    </Button>
  ) : null;
  const scoped = permissions.ready && !permissions.can('payprofile.read');
  // The Central Store is a company unit, not a site people are counted "across" (Paper says "3 sites" for 2 branches and the store).
  const siteCount = lookups.data?.organizations.length ?? 0;

  return (
    <PeopleFrame breadcrumb={{ section: 'People', screen: 'Employees' }} phoneTitle="Employees" label="Employees" actions={add}>
      <div className="flex w-full flex-col gap-5 px-wds-8 py-7 max-md:px-4">
        <PageHeader title="Employees" subtitle={employeesSubtitle(summary.data, siteCount)} actions={add ? <span className="lg:hidden">{add}</span> : undefined} />
        {permissions.failed ? (
          <ErrorBlock title="Your access did not load" line="Try again in a moment." onRetry={permissions.retry} />
        ) : summary.data ? (
          <WorkforceKpiStrip aria-label="Employee numbers" cells={employeesKpiCells(summary.data, chooseFilter)} />
        ) : null}
        <EmployeesTable lookups={lookups.data} summary={summary.data} onOpen={open} />
        {scoped ? <p className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">You see only your own site, and never the pay columns.</p> : null}
      </div>
    </PeopleFrame>
  );
}
