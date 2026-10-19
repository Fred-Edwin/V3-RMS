'use client';

import * as React from 'react';

import { DataTable, type TableColumn, type TableCopy } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

import { NumberCell } from '../../../_shared';
import { clockHours, statusWords } from '../../_shared/lib/month-words';
import { monthReads } from '../../_shared/services/month-services';
import { plainName } from '../../_shared/lib/timesheet-words';
import type { MonthPeople, MonthPerson, PeopleChip } from '../../_shared/types/month-types';

const COPY: TableCopy = {
  emptyTitle: 'Nobody worked in this range',
  emptyDescription: 'No one worked on these days.',
  filteredEmptyTitle: 'No one matches',
  filteredEmptyDescription: 'Try another word or clear the filters.',
  errorTitle: 'The people did not load',
  errorDescription: 'Check your connection and try again.',
};

const KEYS = { view: 'view', dept: 'dept' } as const;
/** Department and Leave give way first on a narrower desktop (D23). */
const WIDE_ONLY = 'hidden min-[1100px]:table-cell';

export function buildFilters(departments: readonly { id: string; name: string }[]): TableFilter[] {
  const filters: TableFilter[] = [
    {
      kind: 'chips',
      key: KEYS.view,
      // The clean address is "All" (the default chip), so its value is the empty one.
      options: [
        { value: 'needs', label: 'Needs you' },
        { value: 'late', label: 'Late' },
        { value: '', label: 'All' },
      ],
    },
  ];
  if (departments.length > 1) filters.push({ kind: 'dropdown', key: KEYS.dept, label: 'Department', options: [{ value: '', label: 'All' }, ...departments.map((d) => ({ value: d.id, label: d.name }))] });
  return filters;
}

const viewOf = (value: string | undefined): PeopleChip => (value === 'needs' || value === 'late' ? value : 'all');

const Zero = ({ value, children }: { value: number; children: React.ReactNode }) => (
  <NumberCell tone={value === 0 ? 'muted' : 'default'} className="whitespace-nowrap">
    {children}
  </NumberCell>
);

function Status({ person }: { person: MonthPerson }) {
  const { text, tone } = statusWords(person.status);
  return <span className={cn('font-wds-sans text-[13px] leading-4', tone === 'warning' ? 'font-medium text-wds-warning-fg' : tone === 'success' ? 'text-wds-success-fg' : 'text-wds-text-secondary')}>{text}</span>;
}

/**
 * The people of one month (spec S1). Search (type-ahead), the Needs you / Late / All chips with counts, the Department dropdown, the
 * numbered pager and rows per page come from the shared table; the answer's chip counts feed the chips. A row opens the drawer.
 * Below 768 px each person is a card.
 */
export function PeopleTable({
  monthKey,
  site,
  from,
  to,
  departments,
  counts,
  refreshToken,
  caption,
  onCounts,
  onOpen,
  trailing,
}: {
  monthKey: string;
  site: string | undefined;
  from: string | undefined;
  to: string | undefined;
  departments: readonly { id: string; name: string }[];
  counts: MonthPeople['counts'] | null;
  refreshToken: number;
  caption: string;
  onCounts: (counts: MonthPeople['counts']) => void;
  onOpen: (person: MonthPerson) => void;
  /** The date range, drawn in the same toolbar row as search, the chips and Department. */
  trailing?: React.ReactNode;
}) {
  const filters = React.useMemo(() => buildFilters(departments), [departments]);
  const narrow = useMediaQuery('(max-width: 767px)').matches;
  const columns = React.useMemo<TableColumn<MonthPerson>[]>(
    () => [
      {
        id: 'person',
        header: 'PERSON',
        width: '150px',
        cell: (row, { term }) => (
          <span title={plainName(row.name)} className="block max-w-[140px] truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">
            <HighlightMatch text={plainName(row.name)} term={term} />
          </span>
        ),
      },
      { id: 'department', header: 'DEPT', width: '84px', className: WIDE_ONLY, cell: (row) => <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{row.department ?? ''}</span> },
      { id: 'planned', header: 'PLANNED', width: '76px', align: 'right', cell: (row) => <Zero value={row.plannedMinutes}>{clockHours(row.plannedMinutes)}</Zero> },
      { id: 'worked', header: 'WORKED', width: '76px', align: 'right', cell: (row) => <Zero value={row.workedMinutes}>{clockHours(row.workedMinutes)}</Zero> },
      { id: 'overtime', header: 'OVERTIME', width: '84px', align: 'right', cell: (row) => <Zero value={row.overtimeMinutes}>{clockHours(row.overtimeMinutes)}</Zero> },
      { id: 'late', header: 'LATE', width: '76px', align: 'right', cell: (row) => <Zero value={row.lateMinutes}>{row.lateMinutes > 0 ? `${row.lateMinutes} min` : '0'}</Zero> },
      { id: 'absent', header: 'ABSENT', width: '64px', align: 'right', cell: (row) => <Zero value={row.absentDays}>{row.absentDays}</Zero> },
      { id: 'leave', header: 'LEAVE', width: '56px', align: 'right', className: 'hidden min-[1600px]:table-cell', cell: (row) => <Zero value={row.leaveDays}>{row.leaveDays}</Zero> },
      { id: 'status', header: 'STATUS', cell: (row) => <Status person={row} /> },
    ],
    []
  );
  return (
    <DataTable<MonthPerson>
      label={caption}
      columns={columns}
      getRowId={(r) => r.employeeId}
      filters={filters}
      counts={counts ? { [KEYS.view]: { needs: counts.needs, late: counts.late, '': counts.all } } : undefined}
      copy={COPY}
      searchPlaceholder="Search a name"
      searchParam="q"
      tableLook="workforce"
      toolbarTrailing={trailing}
      rowSize="compact"
      className="border-0 bg-transparent"
      refreshToken={refreshToken}
      onRowActivate={onOpen}
      layout={narrow ? 'cards' : 'table'}
      renderCard={(row) => (
        <button type="button" onClick={() => onOpen(row)} className="flex w-full flex-col gap-1 border-b border-wds-neutral-100 px-1 py-3 text-left">
          <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{plainName(row.name)}</span>
          <Status person={row} />
          <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">
            Worked {clockHours(row.workedMinutes)} · Overtime {clockHours(row.overtimeMinutes)}
          </span>
        </button>
      )}
      fetchRows={async (q) => {
        const result = await monthReads.people(monthKey, site, { from, to, q: q.search || undefined, dept: q.filters[KEYS.dept] || undefined, view: viewOf(q.filters[KEYS.view]), page: q.page, rows: q.perPage });
        onCounts(result.counts);
        return { rows: result.rows, total: result.total };
      }}
    />
  );
}
