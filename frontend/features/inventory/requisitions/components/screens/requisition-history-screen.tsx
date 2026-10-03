'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Topbar } from '@/components/app/shell/topbar';
import { Button } from '@/components/ui2/button';
import { StatusDot } from '@/components/ui2/status-dot';
import { ErrorState, EmptyState } from '@/components/app/shell/shell-states';
import { useRequisitionHistory } from '../../hooks/use-requisition-history';
import { RequisitionHistorySkeletonDesktop } from '../skeletons';
import type { RequisitionDisplayStatus } from '../../types';

const STATUS_TABS: { key: RequisitionDisplayStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All statuses' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PENDING_APPROVAL', label: 'Dispatched' },
  { key: 'RETURNED', label: 'Returned' },
];

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

/**
 * Requisition History (desk activity only — no mobile screen, per the
 * Session B handoff's explicit descope: a manager on a phone checks today,
 * not audits last week). Paper `13X2-0`: filter row (date range + status
 * tabs) + a flat 6-column table, sticky header, hairline rows.
 */
export function RequisitionHistoryScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<RequisitionDisplayStatus | 'ALL'>('ALL');
  const { rows, status, error, hasMore, loadingMore, loadMore, reload } = useRequisitionHistory({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  });

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
          <p className="font-wds-sans text-wds-body text-wds-text-copy-muted">
            Every past requisition across all five departments — filter by date range or status.
          </p>
        </div>

        <div className="mx-8 mb-5 flex items-center justify-between border-b border-b-solid border-b-wds-border pb-4">
          <div className="flex items-center gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                disabled={tab.key === 'PENDING_APPROVAL'}
                title={tab.key === 'PENDING_APPROVAL' ? 'Dispatch tracking arrives in Milestone Five' : undefined}
                className={
                  'rounded-wds-sm px-3.5 py-[7px] font-wds-sans text-wds-body-sm font-medium ' +
                  (statusFilter === tab.key
                    ? 'bg-wds-neutral-100 text-wds-text-ink'
                    : tab.key === 'PENDING_APPROVAL'
                      ? 'cursor-not-allowed text-wds-text-faint opacity-55'
                      : 'text-wds-text-copy-muted')
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="font-wds-sans text-wds-caption text-wds-text-faint">{rows.length} requisitions</div>
        </div>

        {status === 'loading' || status === 'idle' ? (
          <RequisitionHistorySkeletonDesktop />
        ) : status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState title="Couldn't load requisition history" description={error ?? 'Try again.'} onRetry={reload} />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <EmptyState title="No requisitions found" description="Try a different date range or status." />
          </div>
        ) : (
          <div className="mx-8 flex flex-col">
            <div className="flex items-center gap-4 border-b border-b-solid border-b-wds-neutral-800 pb-2.5">
              <div className="min-w-0 grow basis-0 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                Requisition
              </div>
              <div className="w-[120px] shrink-0 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                Date
              </div>
              <div className="w-[140px] shrink-0 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                Signed by
              </div>
              <div className="w-[90px] shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                Units
              </div>
              <div className="w-[140px] shrink-0 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
                Status
              </div>
            </div>
            {rows.map((row) => {
              const meta = statusMeta[row.displayStatus];
              return (
                <div key={row.id} className="flex items-center gap-4 border-b border-b-solid border-b-wds-neutral-200 py-3">
                  <div className="min-w-0 grow basis-0 font-wds-sans text-wds-body-sm text-wds-text-ink">{requisitionTypeLabel(row.type)}</div>
                  <div className="w-[120px] shrink-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{formatDate(row.openedAt)}</div>
                  <div className="w-[140px] shrink-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{row.signedByName ?? '—'}</div>
                  <div className="w-[90px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-copy-muted">{row.totalUnits}</div>
                  <div className="w-[140px] shrink-0">
                    <StatusDot tone={meta.tone}>{meta.label}</StatusDot>
                  </div>
                </div>
              );
            })}
            {hasMore ? (
              <div className="flex justify-center py-4">
                <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
