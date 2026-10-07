'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Topbar } from '@/components/app/shell/topbar';
import { Button } from '@/components/ui2/button';
import { DataTable, type TableColumn, type TableCopy, type TableResult } from '@/components/ui2/data-table/data-table';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { StatusDot } from '@/components/ui2/status-dot';
import { listRequisitionHistoryPage } from '../../services';
import type { RequisitionDisplayStatus, RequisitionHistoryRow } from '../../types';

/** Chips: the first, empty one is "All statuses". */
const STATUS_FILTER: TableFilter = {
  kind: 'chips',
  key: 'status',
  options: [
    { value: '', label: 'All statuses' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'RETURNED', label: 'Returned' },
  ],
};
const FILTERS: TableFilter[] = [STATUS_FILTER];

const COPY: TableCopy = {
  emptyTitle: 'No requisitions yet',
  emptyDescription: 'Requisitions your departments raise show up here once they are opened.',
  filteredEmptyTitle: 'No requisitions found',
  filteredEmptyDescription: 'Try a different status.',
  errorTitle: "Couldn't load requisition history",
  errorDescription: 'Try again.',
};

const statusMeta: Record<RequisitionDisplayStatus, { tone: 'success' | 'info' | 'error'; label: string }> = {
  APPROVED: { tone: 'success', label: 'Approved' },
  PENDING_APPROVAL: { tone: 'info', label: 'Awaiting approval' },
  RETURNED: { tone: 'error', label: 'Returned' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TYPE_LABEL: Record<string, string> = {
  MORNING: 'Morning requisition',
  AFTERNOON: 'Afternoon requisition',
  EVENING: 'Evening requisition',
  AD_HOC: 'Ad-hoc requisition',
};

function requisitionTypeLabel(type: string): string {
  return TYPE_LABEL[type] ?? `${type.charAt(0)}${type.slice(1).toLowerCase()} requisition`;
}

const STATUS_VALUES: readonly RequisitionDisplayStatus[] = ['APPROVED', 'PENDING_APPROVAL', 'RETURNED'];

const COLUMNS: TableColumn<RequisitionHistoryRow>[] = [
  { id: 'requisition', header: 'Requisition', cell: (row) => <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">{requisitionTypeLabel(row.type)}</span> },
  { id: 'date', header: 'Date', width: '130px', cell: (row) => <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{formatDate(row.openedAt)}</span> },
  { id: 'signedBy', header: 'Signed by', width: '160px', cell: (row) => <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{row.signedByName ?? '—'}</span> },
  { id: 'units', header: 'Units', width: '90px', align: 'right', cell: (row) => <span className="font-wds-mono text-wds-body-sm text-wds-text-copy-muted">{row.totalUnits}</span> },
  {
    id: 'status',
    header: 'Status',
    width: '170px',
    cell: (row) => {
      const meta = statusMeta[row.displayStatus];
      return <StatusDot tone={meta.tone}>{meta.label}</StatusDot>;
    },
  },
];

/**
 * Requisition History (desk activity only — no mobile screen, per the
 * Session B handoff's explicit descope: a manager on a phone checks today,
 * not audits last week). Paper `13X2-0` on the shared table (UI_BUILD_RULES
 * §4a): status chips and a numbered pager in place of "Load more". There is
 * no text search: a requisition has no name to look for.
 */
export function RequisitionHistoryScreen() {
  const router = useRouter();

  const fetchRows = React.useCallback(
    async (q: { page: number; perPage: number; filters: Record<string, string> }): Promise<TableResult<RequisitionHistoryRow>> => {
      const status = STATUS_VALUES.find((s) => s === q.filters.status);
      const out = await listRequisitionHistoryPage({ status, page: q.page, perPage: q.perPage });
      return { rows: out.rows, total: out.total };
    },
    []
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Requisitions', screen: 'History', sectionHref: '/app/branch/requisitions' }}
        actions={
          <Button variant="secondary" onClick={() => router.push('/app/branch/requisitions')}>
            ← Back to Requisitions
          </Button>
        }
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-1 px-8 pb-5 pt-7">
          <h1 className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">Requisition History</h1>
          <p className="font-wds-sans text-wds-body text-wds-text-copy-muted">Every past requisition across all five departments — filter by status.</p>
        </div>
        <div className="mx-8 mb-8">
          <DataTable<RequisitionHistoryRow>
            label="Requisition history"
            columns={COLUMNS}
            getRowId={(r) => r.id}
            fetchRows={fetchRows}
            filters={FILTERS}
            copy={COPY}
            searchable={false}
          />
        </div>
      </div>
    </div>
  );
}
