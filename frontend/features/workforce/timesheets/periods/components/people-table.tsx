'use client';

import * as React from 'react';

import { DataTable, type TableColumn, type TableCopy } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';

import { NeedsYouLine, NumberCell } from '../../../_shared';
import { timesheetReads } from '../../_shared/services/timesheet-services';
import { hm } from '../../_shared/lib/timesheet-words';
import type { PeriodView, PersonRow } from '../../_shared/types/timesheet-types';
import { rangeQuery, type DayRange } from '../lib/period-range';
import { apiFilterOf, filterCounts, needsLine } from '../lib/period-view';

const COPY: TableCopy = {
  // The page opens on "Needs a look", so an empty list is good news, not a missing month.
  emptyTitle: 'Nobody needs you here',
  emptyDescription: 'Everything matched the rota, or was decided. Choose All to see everyone.',
  filteredEmptyTitle: 'Nobody matches',
  filteredEmptyDescription: 'Try another name or filter, or choose All to see everyone.',
  errorTitle: 'The timesheets did not load',
  errorDescription: 'Check your connection and try again.',
};

const FILTER_KEYS = { chips: 'filter', department: 'departmentId' } as const;

export function buildFilters(departments: readonly { id: string; name: string }[]): TableFilter[] {
  const filters: TableFilter[] = [
    {
      kind: 'chips',
      key: FILTER_KEYS.chips,
      // The clean address is "Needs a look" (Paper's chosen chip), so its value is the empty one.
      options: [
        { value: '', label: 'Needs a look' },
        { value: 'LATE', label: 'Late' },
        { value: 'ALL', label: 'All' },
      ],
    },
  ];
  if (departments.length > 1) filters.push({ kind: 'dropdown', key: FILTER_KEYS.department, label: 'Department', options: [{ value: '', label: 'All' }, ...departments.map((d) => ({ value: d.id, label: d.name }))] });
  return filters;
}

/**
 * The people of the month, exceptions first (Paper Chapter 8, step 1). Search, chips, the Department dropdown, the numbered pager and
 * URL state come from the shared table. Every fetch hands the whole answer to the page (`onView`) so the numbers above the table are
 * the numbers of the same moment.
 */
export function PeopleTable({
  periodId,
  view,
  range,
  departments,
  refreshToken,
  onView,
  onOpen,
}: {
  periodId: string;
  view: PeriodView | null;
  /** The days chosen with the week picker; null is the whole month. */
  range: DayRange | null;
  departments: readonly { id: string; name: string }[];
  refreshToken: number;
  onView: (view: PeriodView) => void;
  onOpen: (row: PersonRow) => void;
}) {
  const filters = React.useMemo(() => buildFilters(departments), [departments]);
  const columns = React.useMemo<TableColumn<PersonRow>[]>(
    () => [
      { id: 'person', header: 'PERSON', width: '230px', cell: (row, { term }) => <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink"><HighlightMatch text={row.name} term={term} /></span> },
      { id: 'department', header: 'DEPARTMENT', width: '160px', cell: (row) => <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{row.departmentName ?? ''}</span> },
      { id: 'planned', header: 'PLANNED', width: '110px', align: 'right', cell: (row) => <NumberCell>{hm(row.plannedMinutes)}</NumberCell> },
      { id: 'worked', header: 'WORKED', width: '110px', align: 'right', cell: (row) => <NumberCell>{hm(row.workedMinutes)}</NumberCell> },
      { id: 'late', header: 'LATE', width: '90px', align: 'right', cell: (row) => <NumberCell tone={row.lateMinutes > 0 ? 'muted' : 'default'}>{row.lateMinutes > 0 ? `${row.lateMinutes} min` : '0'}</NumberCell> },
      {
        id: 'needs',
        header: 'WHAT NEEDS YOU',
        cell: (row) => {
          const line = needsLine(row);
          return line.needs ? <NeedsYouLine>{line.text}</NeedsYouLine> : <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{line.text}</span>;
        },
      },
    ],
    []
  );
  return (
    <DataTable<PersonRow>
      label="People this month"
      columns={columns}
      getRowId={(r) => r.employeeId}
      filters={filters}
      counts={filterCounts(view)}
      copy={COPY}
      searchPlaceholder="Search a name"
      tableLook="workforce"
      rowSize="compact"
      className="border-0 bg-transparent"
      refreshToken={refreshToken}
      onRowActivate={onOpen}
      fetchRows={async (q) => {
        const result = await timesheetReads.period(periodId, { search: q.search || undefined, departmentId: q.filters[FILTER_KEYS.department] || undefined, filter: apiFilterOf(q.filters[FILTER_KEYS.chips]), ...rangeQuery(range), page: q.page, pageSize: q.perPage });
        onView(result);
        return { rows: result.people.rows, total: result.people.total };
      }}
    />
  );
}
