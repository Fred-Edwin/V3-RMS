'use client';

import * as React from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui2/button';
import type { TableColumn } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { CountStatusChip } from '../../_shared/components/count-chips';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import type { CountRow } from '../../_shared/types/counting-contract';

export const COUNTS = '/app/inventory/stock/counts';

/** Paper step 56: "Date: Last 30 days" is the starting range; the date is when the count started. */
export const COUNTS_DATE_FILTER = {
  kind: 'dateRange',
  fromKey: 'from',
  toKey: 'to',
  label: 'Date',
  defaultPreset: 'last30',
  note: 'Later dates can’t be picked. Counts are listed by the day they were started. Counts waiting for approval always show.',
} as const satisfies TableFilter;

export const COUNTS_FILTERS: TableFilter[] = [
  COUNTS_DATE_FILTER,
  {
    kind: 'chips',
    key: 'status',
    options: [
      { value: '', label: 'All' },
      { value: 'waiting', label: 'Waiting for you' },
      { value: 'inProgress', label: 'In progress' },
      { value: 'approved', label: 'Approved' },
    ],
  },
];

export const COUNTS_COPY = {
  emptyTitle: 'No counts yet',
  emptyDescription: COUNTING_STATES_COPY.countsList.empty,
  filteredEmptyTitle: 'No counts match',
  filteredEmptyDescription: 'No count matches this search or filter. Clear the filters to see every count.',
  errorTitle: 'Could not load counts',
  errorDescription: 'Try again. Nothing was changed.',
  permissionDescription: COUNTING_STATES_COPY.countsList.permission,
};

/** The Counts table columns (Paper steps 8 and 48): the same table for the Manager's list and the Director's "All counts". */
export function makeCountColumns(navigate: (href: string) => void): TableColumn<CountRow>[] {
  return [
    { id: 'reference', header: 'Reference', width: '140px', cell: (r, { term }) => <span className="font-wds-mono text-[12px] leading-4 text-wds-text-ink"><HighlightMatch text={r.reference} term={term} /></span> },
    { id: 'sections', header: 'Sections', width: '170px', cell: (r, { term }) => <span className="text-wds-text-ink"><HighlightMatch text={r.sectionsText} term={term} /></span> },
    { id: 'counter', header: 'Counted by', width: '150px', cell: (r, { term }) => <span className="text-wds-text-ink"><HighlightMatch text={r.counter.name} term={term} /></span> },
    { id: 'signed', header: 'Signed', width: '170px', cell: (r) => <span className={r.signedAt ? 'font-wds-mono text-[12px] leading-4 text-wds-text-ink' : 'text-wds-text-secondary'}>{r.signedText}</span> },
    { id: 'items', header: 'Items', width: '90px', align: 'right', cell: (r) => <span className={r.status === 'OPEN' ? 'font-wds-mono text-wds-text-secondary' : 'font-wds-mono text-wds-text-ink'}>{r.itemsText}</span> },
    {
      id: 'differences',
      header: 'Differences',
      width: '210px',
      className: 'pl-6',
      cell: (r) =>
        r.recountOf ? (
          <Link href={`${COUNTS}/${r.recountOf.id}`} onClick={(e) => e.stopPropagation()} className="text-wds-info-fg underline-offset-2 outline-none hover:underline focus-visible:shadow-wds-ring">
            Recount of {r.recountOf.reference}
          </Link>
        ) : (
          <span className={r.differencesText === 'Not signed yet' ? 'text-wds-text-faint' : 'text-wds-text-secondary'}>{r.differencesText ?? ''}</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <span className="flex items-center justify-between gap-3">
          <CountStatusChip status={r.status} text={r.statusText} />
          {r.can.review ? (
            <Button
              size="sm"
              className="h-[30px] px-3.5 font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`${COUNTS}/${r.id}`);
              }}
            >
              Review
            </Button>
          ) : null}
        </span>
      ),
    },
  ];
}
