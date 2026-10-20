'use client';

import * as React from 'react';

import { DataTable, type TableColumn, type TableCopy, type TableResult } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableQuery } from '@/components/ui2/data-table/table-query';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';

import { AvatarCell, NumberCell, StatusText } from '../../../_shared';
import { dayMonth } from '../../_shared/lib/conduct-dates';
import { deskTone } from '../../_shared/lib/conduct-words';
import { conductReads } from '../../_shared/services/conduct-services';
import type { DeskList, DeskRow } from '../../_shared/types/conduct-types';
import { chipCounts, filterOf } from '../lib/desk-model';

const COPY: TableCopy = {
  emptyTitle: 'No active notices',
  emptyDescription: 'Issue a warning when one is needed.',
  filteredEmptyTitle: 'No one matches',
  filteredEmptyDescription: 'Try a different name, or clear the filters.',
  errorTitle: 'The notices did not load',
  errorDescription: 'Check your connection and try again.',
  permissionDescription: 'Your role does not open the Conduct list.',
};

export function buildDeskFilters(sites: { id: string; name: string }[] | null): TableFilter[] {
  const filters: TableFilter[] = [
    {
      kind: 'chips',
      key: 'status',
      options: [
        { value: '', label: 'Active' },
        { value: 'appealed', label: 'Appealed' },
        { value: 'ended', label: 'Ended' },
      ],
    },
  ];
  if (sites && sites.length > 1) filters.push({ kind: 'dropdown', key: 'site', label: 'Site', options: [{ value: '', label: 'All sites' }, ...sites.map((s) => ({ value: s.id, label: s.name }))] });
  return filters;
}

/**
 * The Conduct table (spec S8; Paper 1GB0-0 left): PERSON, LEVEL, ISSUED, STATUS in the Workforce look. Search, the three chips, the optional
 * Site select for HR and the Director, the numbered pager and the URL state all come from the shared table. The row shown in the panel
 * beside it is marked selected. Chip counts come from the same list call that feeds the strip above.
 */
export function DeskTable({
  selectedId,
  onSelect,
  filters,
  counts,
  onLoaded,
  refreshToken,
}: {
  selectedId: string | null;
  onSelect: (row: DeskRow) => void;
  filters: TableFilter[];
  counts: DeskList['counts'] | null;
  onLoaded: (list: DeskList) => void;
  refreshToken: number;
}) {
  const columns = React.useMemo<TableColumn<DeskRow>[]>(
    () => [
      {
        id: 'person',
        header: 'PERSON',
        cell: (row, { term }) => (
          <AvatarCell name={row.personName} sub={`${row.jobLabel} · ${row.aboutLabel.toLowerCase()}${row.issuedAtSite ? ` · issued at ${row.issuedAtSite}` : ''}`}>
            <HighlightMatch text={row.personName} term={term} />
          </AvatarCell>
        ),
      },
      { id: 'level', header: 'LEVEL', width: '150px', cell: (row) => <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">{row.levelLabel}</span> },
      { id: 'issued', header: 'ISSUED', width: '72px', cell: (row) => <NumberCell className="text-left">{dayMonth(row.issuedAt)}</NumberCell> },
      { id: 'status', header: 'STATUS', width: '130px', cell: (row) => <StatusText tone={deskTone(row.status)}>{row.statusWord}</StatusText> },
    ],
    []
  );

  const fetchRows = React.useCallback(
    async (q: TableQuery): Promise<TableResult<DeskRow>> => {
      const list = await conductReads.desk({ status: filterOf(q.filters.status), q: q.search, site: q.filters.site ?? '', page: q.page, pageSize: q.perPage });
      onLoaded(list);
      return { rows: list.items, total: list.total, counts: chipCounts(list.counts) };
    },
    [onLoaded]
  );

  return (
    <DataTable<DeskRow>
      label="Conduct notices"
      tableLook="workforce"
      columns={columns}
      getRowId={(row) => row.id}
      filters={filters}
      searchPlaceholder="Search a name"
      copy={COPY}
      fetchRows={fetchRows}
      counts={counts ? chipCounts(counts) : undefined}
      onRowActivate={onSelect}
      isRowSelected={(row) => row.id === selectedId}
      refreshToken={refreshToken}
      className="min-w-0"
    />
  );
}
