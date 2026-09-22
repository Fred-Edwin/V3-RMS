'use client';

import * as React from 'react';

import { Topbar } from '@/components/app/shell/topbar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { useDiscrepancyResolve } from '../../hooks/use-discrepancy-resolve';

const DEPARTMENT_LABEL: Record<string, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

const OUTCOME_LABEL: Record<string, string> = {
  FOUND_REDELIVERED: 'Found & re-delivered',
  TRANSIT_LOSS_WRITEOFF: 'Transit loss — write-off',
  MISCOUNT_CORRECTED: 'Miscount corrected',
};

export interface DiscrepancyDetailScreenProps {
  discrepancyId: string;
}

/**
 * Branch Manager desktop — read-only discrepancy detail (`16DM-0`). Deliberate
 * separate component from `DiscrepancyResolutionScreen` (not a shared
 * component branching on a `readOnly` prop) — this viewer never resolves,
 * so it has no outcome selection, sign sheet, or note field at all, per
 * vercel-composition-patterns' avoid-boolean-props guidance. Reuses
 * `useDiscrepancyResolve` only for its `detail`/`status` load shape (never
 * calls `resolve`).
 */
export function DiscrepancyDetailScreen({ discrepancyId }: DiscrepancyDetailScreenProps) {
  const { detail, status, error, reload } = useDiscrepancyResolve(discrepancyId);

  if (status === 'loading' || !detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Deliveries', screen: 'Discrepancy' }} className="shrink-0" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Deliveries', screen: 'Discrepancy' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <ErrorState title="Couldn't load this discrepancy" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      </div>
    );
  }

  const departmentLabel = DEPARTMENT_LABEL[detail.departmentTag] ?? detail.departmentTag;
  const isResolved = detail.status === 'RESOLVED';
  const valueAtCost = Math.abs(Number(detail.gapQty)) * Number(detail.costAtDispatch);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Deliveries', screen: `Discrepancy ${detail.referenceNumber}` }} className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pb-8 pt-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">
              {departmentLabel} transit discrepancy
            </div>
            <div className="font-wds-sans text-wds-body text-wds-text-copy-muted">
              {detail.dispatchSequenceLabel} · confirmed {detail.confirmedQty ?? '—'} of {detail.dispatchedQty} units.{' '}
              {isResolved ? `Resolved by the Store Manager — ${OUTCOME_LABEL[detail.outcome ?? ''] ?? detail.outcome}.` : 'Under review by the Store Manager — resolution happens on their side.'}
            </div>
          </div>
          <div className="rounded-wds-sm border border-wds-border-strong px-3 py-1.5">
            <div className="font-wds-sans text-wds-caption font-semibold text-wds-text-copy-muted">
              {isResolved ? 'Resolved · read only' : 'View only — Store Manager resolves'}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-wds-sm border border-wds-border">
          <div className="flex items-baseline gap-2 border-b border-wds-border px-5 py-3">
            <div className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">The gap</div>
            <div className="font-wds-sans text-wds-caption text-wds-text-faint">
              confirmed by {detail.confirmedByName ?? '—'} · {formatDateTime(detail.confirmedAt)}
            </div>
          </div>
          <div className="flex">
            <div className="flex grow flex-col gap-1.5 border-r border-wds-border px-5 py-4">
              <div className="font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">Dispatched</div>
              <div className="font-wds-sans text-wds-kpi font-semibold tracking-tight text-wds-text-ink">{detail.dispatchedQty}</div>
              <div className="font-wds-sans text-wds-caption text-wds-text-faint">
                {detail.itemName} · {detail.usageUnit}
              </div>
            </div>
            <div className="flex grow flex-col gap-1.5 border-r border-wds-border px-5 py-4">
              <div className="font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">Confirmed</div>
              <div className="font-wds-sans text-wds-kpi font-semibold tracking-tight text-wds-text-ink">{detail.confirmedQty ?? '—'}</div>
              <div className="font-wds-sans text-wds-caption text-wds-text-faint">at {detail.branchName} · {departmentLabel}</div>
            </div>
            <div className="flex grow flex-col gap-1.5 border-r border-wds-border bg-wds-error-bg px-5 py-4">
              <div className="font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-error-fg">Gap</div>
              <div className="font-wds-sans text-wds-kpi font-semibold tracking-tight text-wds-error-fg">{detail.gapQty}</div>
              <div className="font-wds-sans text-wds-caption text-wds-error-fg">{detail.usageUnit} missing</div>
            </div>
            <div className="flex grow flex-col gap-1.5 px-5 py-4">
              <div className="font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">Value at risk</div>
              <div className="font-wds-mono text-wds-kpi font-semibold tracking-tight text-wds-text-ink">KES {valueAtCost.toFixed(0)}</div>
              <div className="font-wds-sans text-wds-caption text-wds-text-faint">
                KES {Number(detail.costAtDispatch).toFixed(0)} / {detail.usageUnit}, at frozen cost
              </div>
            </div>
          </div>
        </div>

        {isResolved ? (
          <div className="flex items-start gap-2 pt-1">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-wds-success-fg" />
            <div className="font-wds-sans text-wds-body-sm text-wds-success-fg">
              Resolved {formatDateTime(detail.resolvedAt)} by {detail.resolvedByName ?? 'the Store Manager'}.
              {detail.resolutionNote ? ` ${detail.resolutionNote}` : ''}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 pt-1">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-wds-warning-fg" />
            <div className="font-wds-sans text-wds-body-sm text-wds-warning-fg">
              No one is auto-attributed. The Store Manager and {departmentLabel} head will confirm what happened — if it isn&apos;t clear, a
              director adjudicates. You&apos;ll be notified once it&apos;s resolved and the ledger is written.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
