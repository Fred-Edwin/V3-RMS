'use client';

import * as React from 'react';

import { DataTable, type TableColumn, type TableCopy } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableQuery } from '@/components/ui2/data-table/table-query';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';

import { AvatarCell, StatusTag } from '../../../_shared';
import { peopleReads } from '../../_shared/services/people-reads';
import type { EmployeeListQuery, EmployeeListRow, Lookups } from '../../_shared/types/people-types';
import { employmentLine, fileCellOf, siteDepartmentLine } from '../lib/employee-row-copy';
import { employeeChipCounts } from '../lib/summary-copy';
import type { PeopleSummary } from '../../_shared/types/people-types';

/**
 * The Employees table (Paper R1). Search, chips, the Site and Department dropdowns, the numbered pager and the URL state all come
 * from the shared table; this file only says what the columns are and how a page is fetched. The Site dropdown is left out for
 * someone who sees one site (a Branch Manager), because there is nothing to choose.
 */
const COPY: TableCopy = {
  emptyTitle: 'No employees yet',
  emptyDescription: 'Add the first person and their file appears here.',
  filteredEmptyTitle: 'Nobody matches',
  filteredEmptyDescription: 'Try a different name, or clear the filters to see everyone on file.',
  errorTitle: 'The employees did not load',
  errorDescription: 'Check your connection and try again.',
  permissionDescription: 'Your role does not open the employee list.',
};

const FILTER_VALUES: ReadonlySet<string> = new Set(['needs_finishing', 'no_contract', 'casual_pool', 'on_probation', 'exited']);

export function buildFilters(lookups: Lookups | null): TableFilter[] {
  const sites = lookups?.organizations ?? [];
  const departments = lookups?.departments.filter((d) => d.isActive) ?? [];
  const multiSite = sites.length > 1;
  const filters: TableFilter[] = [
    {
      kind: 'chips',
      key: 'filter',
      options: [
        { value: '', label: 'All' },
        { value: 'needs_finishing', label: 'Needs finishing' },
        { value: 'no_contract', label: 'No contract yet' },
        { value: 'casual_pool', label: 'Casual pool' },
        { value: 'exited', label: 'Exited' },
      ],
    },
  ];
  if (multiSite) filters.push({ kind: 'dropdown', key: 'siteId', label: 'Site', options: [{ value: '', label: 'All' }, ...sites.map((s) => ({ value: s.id, label: s.name }))] });
  if (departments.length > 0) {
    const siteName = (id: string): string => sites.find((s) => s.id === id)?.name ?? '';
    filters.push({
      kind: 'dropdown',
      key: 'departmentId',
      label: 'Department',
      options: [{ value: '', label: 'All' }, ...departments.map((d) => ({ value: d.id, label: multiSite ? `${d.name} · ${siteName(d.organizationId)}` : d.name }))],
    });
  }
  return filters;
}

export function toListQuery(q: TableQuery): EmployeeListQuery {
  const filter = q.filters.filter ?? '';
  return {
    page: q.page,
    perPage: q.perPage,
    q: q.search || undefined,
    siteId: q.filters.siteId || undefined,
    departmentId: q.filters.departmentId || undefined,
    filter: FILTER_VALUES.has(filter) ? (filter as EmployeeListQuery['filter']) : 'all',
  };
}

export interface EmployeesTableProps {
  lookups: Lookups | null;
  summary: PeopleSummary | null;
  /** Bumped by the screen after something changes elsewhere on it. */
  refreshToken?: number;
  onOpen: (row: EmployeeListRow) => void;
}

export function EmployeesTable({ lookups, summary, refreshToken, onOpen }: EmployeesTableProps) {
  const filters = React.useMemo(() => buildFilters(lookups), [lookups]);
  const counts = React.useMemo(() => (summary ? employeeChipCounts(summary) : undefined), [summary]);

  const columns = React.useMemo<TableColumn<EmployeeListRow>[]>(
    () => [
      {
        id: 'employee',
        header: 'EMPLOYEE',
        width: '280px',
        cell: (row, { term }) => (
          <AvatarCell name={row.name} sub={row.positionName ?? undefined} photoUrl={row.photoUrl}>
            <HighlightMatch text={row.name} term={term} />
          </AvatarCell>
        ),
      },
      { id: 'site', header: 'SITE · DEPARTMENT', width: '220px', cell: (row) => <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{siteDepartmentLine(row)}</span> },
      { id: 'employment', header: 'EMPLOYMENT', width: '200px', cell: (row) => <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{employmentLine(row)}</span> },
      {
        id: 'file',
        header: 'FILE',
        width: '200px',
        cell: (row) => {
          const file = fileCellOf(row);
          return <StatusTag tone={file.tone}>{file.label}</StatusTag>;
        },
      },
      { id: 'reports', header: 'REPORTS TO', cell: (row) => <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{row.reportsToName ?? ''}</span> },
    ],
    []
  );

  return (
    <DataTable<EmployeeListRow>
      label="Employees"
      columns={columns}
      getRowId={(r) => r.id}
      filters={filters}
      counts={counts}
      copy={COPY}
      searchPlaceholder="Find a person"
      tableLook="workforce"
      className="border-0 bg-transparent"
      refreshToken={refreshToken}
      enabled={lookups !== null}
      onRowActivate={onOpen}
      fetchRows={async (q) => {
        const page = await peopleReads.list(toListQuery(q));
        return { rows: page.rows, total: page.pagination.total };
      }}
    />
  );
}
