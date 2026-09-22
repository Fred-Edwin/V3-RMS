'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { useAuthStore } from '@/store/authStore';
import { useRequisitionsForApproval } from '../../hooks/use-requisitions-for-approval';
import { RequisitionsForApprovalListSkeletonMobile } from '../skeletons';

function initials(name: string | undefined): string {
  if (!name) return '—';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

/**
 * M1/M2 — Branch Manager mobile list (Paper `1797-0`/`17B6-0`). A genuine
 * zero-state (M2) when there are no requisitions opened yet today — distinct
 * from the desktop's "nothing selected" empty state, which doesn't apply
 * once mobile splits list and detail into separate routes.
 */
export function RequisitionsForApprovalMobileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { rows, status, error, reload } = useRequisitionsForApproval();

  const kpis = [
    { label: 'Open requisitions', value: rows.length },
    { label: 'Awaiting your approval', value: rows.filter((r) => r.sectionsSubmitted > 0 && r.status !== 'APPROVED').length },
    { label: 'Depts not submitted', value: rows.reduce((sum, r) => sum + (r.sectionsTotal - r.sectionsSubmitted), 0) },
    { label: "Today's volume", value: `${rows.reduce((sum, r) => sum + Number(r.totalUnits), 0)} units` },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
      <MobileStatusBar />
      <div className="flex h-14.5 shrink-0 items-center gap-3 border-b border-wds-border px-4">
        <div className="flex grow flex-col gap-0.5">
          <div className="font-wds-sans text-[17px]/4.75 font-semibold text-wds-text-ink">Requisitions</div>
          <div className="font-wds-sans text-wds-caption/label text-wds-text-faint">
            {user?.organizationName ?? 'Branch'} · today
          </div>
        </div>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-wds-primary font-wds-sans text-wds-caption font-semibold text-wds-surface">
          {initials(user?.name)}
        </div>
      </div>

      {status === 'loading' || status === 'idle' ? (
        <RequisitionsForApprovalListSkeletonMobile />
      ) : status === 'error' ? (
        <div className="flex flex-1 items-center justify-center p-wds-4">
          <ErrorState title="Couldn't load requisitions" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-wds-6 text-center">
          <div className="font-wds-sans text-wds-section text-wds-text-ink">No requisitions yet today</div>
          <div className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            Department heads haven&apos;t opened a requisition yet — check back later.
          </div>
        </div>
      ) : (
        <>
          <div className="grid w-full grid-cols-2 gap-px border-b border-wds-border bg-wds-border">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="flex flex-col gap-1 bg-wds-surface px-4 py-3.5">
                <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{kpi.label}</div>
                <div className="font-wds-sans text-[22px]/6.5 font-semibold text-wds-text-ink">{kpi.value}</div>
              </div>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6">
            <div className="flex items-center justify-between px-4 pb-2 pt-4.5">
              <div className="font-wds-sans text-wds-caption font-medium uppercase tracking-wds-label text-wds-text-faint">Today</div>
            </div>
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => router.push(`/app/branch/requisitions/${row.id}`)}
                className="flex flex-col gap-1.5 border-b border-wds-border px-4 py-3.5 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="font-wds-sans text-[17px]/5.5 font-semibold text-wds-text-ink">{row.type} requisition</div>
                  <div className="font-wds-sans text-wds-body text-wds-text-copy-muted">
                    {row.sectionsSubmitted}/{row.sectionsTotal}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-1.5 shrink-0 rounded-full bg-wds-warning-fg" />
                  <div className="font-wds-sans text-wds-body text-wds-text-copy-muted">Awaiting approval</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
