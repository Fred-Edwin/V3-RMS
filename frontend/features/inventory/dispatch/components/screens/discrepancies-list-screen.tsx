'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Topbar } from '@/components/app/shell/topbar';
import { DataTable, type TableColumn, type TableCopy, type TableResult } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { useAuthStore } from '@/store/authStore';
import { listDiscrepancyPage } from '../../services';
import type { DiscrepancyRow, DiscrepancyStatus } from '../../types';

const DEPARTMENT_LABEL: Record<string, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

const OUTCOME_LABEL: Record<string, string> = {
  FOUND_REDELIVERED: 'found & re-delivered',
  TRANSIT_LOSS_WRITEOFF: 'write-off',
  MISCOUNT_CORRECTED: 'miscount corrected',
};

/** Open is the starting view (the address with no `show`), as "Open only" was before; the chips switch to All or Resolved. */
const SHOW_FILTER: TableFilter = {
  kind: 'chips',
  key: 'show',
  options: [
    { value: '', label: 'Open' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'all', label: 'All' },
  ],
};
const FILTERS: TableFilter[] = [SHOW_FILTER];

const COPY: TableCopy = {
  emptyTitle: 'No open discrepancies',
  emptyDescription: 'Nothing is waiting for a decision. Pick All to see the ones already resolved.',
  filteredEmptyTitle: 'No discrepancies match',
  filteredEmptyDescription: 'Try another search, or clear the filters to go back to the open ones.',
  errorTitle: "Couldn't load discrepancies",
  errorDescription: 'Try again.',
};

function statusFor(show: string | undefined): DiscrepancyStatus | undefined {
  if (show === 'all') return undefined;
  return show === 'resolved' ? 'RESOLVED' : 'OPEN';
}

/** "Today 10:40" / "4h 02m ago" / "Yesterday" / "2 days ago" from an ISO timestamp — matches Paper's `16Q7-0`/`16UG-0` mixed formats. */
function formatRaised(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - then.getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const isToday = then.toDateString() === now.toDateString();
  if (isToday) {
    if (totalMinutes < 60) return `Today ${then.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ago`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (then.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const days = Math.floor(totalMinutes / 1440);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function statusLabel(row: DiscrepancyRow, isStoreManager: boolean): string {
  if (row.status === 'OPEN') return isStoreManager ? 'Open — resolve' : 'Open · with Store Manager';
  return `Resolved · ${OUTCOME_LABEL[row.outcome ?? ''] ?? 'resolved'}`;
}

/**
 * Discrepancies list (`16Q7-0` Store Manager all-branches / `16UG-0` Branch
 * Manager own-branch, read-only) — one component branching on role for the
 * two scopes, per session-b-plan.md decision #7 (the backend already
 * returns a role-scoped row set from the same endpoint). On the shared table
 * (UI_BUILD_RULES §4a): status chips (Open is the start), search, numbered
 * pager. Status, search and paging are the server's, so an open discrepancy
 * is never hidden by a cap.
 */
export function DiscrepanciesListScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isStoreManager = user?.role === 'STORE_MANAGER';

  const breadcrumbSection = isStoreManager ? 'Dispatch' : 'Deliveries';
  const breadcrumbSectionHref = isStoreManager ? '/app/inventory/dispatch' : '/app/branch/deliveries';

  const openRow = React.useCallback(
    (row: DiscrepancyRow) => {
      router.push(isStoreManager ? `/app/inventory/discrepancies/${row.id}` : `/app/branch/deliveries/discrepancies/${row.id}`);
    },
    [router, isStoreManager]
  );

  const fetchRows = React.useCallback(
    async (q: { page: number; perPage: number; search: string; filters: Record<string, string> }): Promise<TableResult<DiscrepancyRow>> => {
      const page = await listDiscrepancyPage({ status: statusFor(q.filters.show), search: q.search || undefined, page: q.page, perPage: q.perPage });
      return { rows: page.rows, total: page.total };
    },
    []
  );

  const columns = React.useMemo<TableColumn<DiscrepancyRow>[]>(
    () => [
      {
        id: 'id',
        header: 'ID',
        width: '90px',
        cell: (row, { term }) => (
          <span className={'font-wds-mono text-wds-body-sm ' + (row.status === 'OPEN' ? 'text-wds-text-ink' : 'text-wds-text-copy-muted')}>
            <HighlightMatch text={row.referenceNumber} term={term} />
          </span>
        ),
      },
      {
        id: 'where',
        header: isStoreManager ? 'Branch · Department' : 'Department',
        cell: (row) => (
          <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">
            {isStoreManager ? `${row.branchName} · ${DEPARTMENT_LABEL[row.departmentTag] ?? row.departmentTag}` : (DEPARTMENT_LABEL[row.departmentTag] ?? row.departmentTag)}
          </span>
        ),
      },
      {
        id: 'item',
        header: 'Item',
        width: '160px',
        cell: (row, { term }) => (
          <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            <HighlightMatch text={row.itemName} term={term} />
          </span>
        ),
      },
      {
        id: 'gap',
        header: 'Gap',
        width: '100px',
        align: 'right',
        cell: (row) => (
          <span className={'font-wds-mono text-wds-body-sm ' + (row.status === 'OPEN' ? 'font-semibold text-wds-error-fg' : 'text-wds-text-copy-muted')}>
            {row.gapQty} {row.usageUnit}
          </span>
        ),
      },
      {
        id: 'raised',
        header: 'Raised',
        width: '110px',
        align: 'right',
        cell: (row) => <span className="font-wds-sans text-wds-caption text-wds-text-faint">{formatRaised(row.createdAt)}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        width: '210px',
        align: 'right',
        cell: (row) => {
          const open = row.status === 'OPEN';
          return (
            <span className="inline-flex items-center justify-end gap-1.5">
              <span className={'size-1.5 shrink-0 rounded-full ' + (open ? 'bg-wds-error-fg' : 'bg-wds-success-fg')} />
              <span className={'font-wds-sans text-wds-caption ' + (open ? 'font-semibold text-wds-error-fg' : 'text-wds-text-copy-muted')}>{statusLabel(row, isStoreManager)}</span>
            </span>
          );
        },
      },
    ],
    [isStoreManager]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: breadcrumbSection, screen: 'Discrepancies', sectionHref: breadcrumbSectionHref }} className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-8 pb-8 pt-6">
        <div className="flex flex-col gap-1">
          <div className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">Discrepancies</div>
          <div className="font-wds-sans text-wds-body text-wds-text-copy-muted">
            {isStoreManager
              ? 'Every transit discrepancy raised across branches — open ones need your resolution.'
              : 'Transit discrepancies for your branch — read only, the Store Manager resolves.'}
          </div>
        </div>

        <DataTable<DiscrepancyRow>
          label="Discrepancies"
          columns={columns}
          getRowId={(r) => r.id}
          fetchRows={fetchRows}
          filters={FILTERS}
          copy={COPY}
          searchPlaceholder="Find an ID, item or dispatch"
          onRowActivate={openRow}
        />
      </div>
    </div>
  );
}
