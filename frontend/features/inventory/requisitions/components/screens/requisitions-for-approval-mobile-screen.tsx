'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { useAuthStore } from '@/store/authStore';
import { useRequisitionsForApproval } from '../../hooks/use-requisitions-for-approval';
import { RequisitionsForApprovalListSkeletonMobile } from '../skeletons';

const TYPE_LABEL: Record<string, string> = {
  MORNING: 'Morning requisition',
  AFTERNOON: 'Afternoon requisition',
  EVENING: 'Evening requisition',
  AD_HOC: 'Ad-hoc requisition',
};

function requisitionTypeLabel(type: string): string {
  return TYPE_LABEL[type] ?? `${type.charAt(0)}${type.slice(1).toLowerCase()} requisition`;
}

/** "06:12" from an ISO timestamp — matches Paper's HH:mm row captions. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

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
  const { rows, status, reload } = useRequisitionsForApproval();

  const kpis = [
    { label: 'Open requisitions', value: rows.length },
    { label: 'Awaiting your approval', value: rows.filter((r) => r.sectionsSubmitted > 0 && r.status !== 'APPROVED').length },
    { label: 'Depts not submitted', value: rows.reduce((sum, r) => sum + (r.sectionsTotal - r.sectionsSubmitted), 0) },
    { label: "Today's volume", value: `${rows.reduce((sum, r) => sum + Number(r.totalUnits), 0)} units` },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
      <MobileStatusBar />
      <div className="flex h-[58px] shrink-0 items-center gap-3 border-b border-wds-border px-4">
        <div className="flex grow flex-col gap-0.5">
          <div className="font-wds-sans text-[17px]/[19px] font-semibold text-wds-text-ink">Requisitions</div>
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
        <div className="flex flex-col items-center gap-3 px-10 pt-24">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wds-error-bg">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 5.5V10M9 12.5H9.01" stroke="var(--wds-error-fg)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="9" cy="9" r="7" stroke="var(--wds-error-fg)" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">Couldn&apos;t load requisitions</div>
          <div className="max-w-[280px] text-center font-wds-sans text-wds-body text-wds-text-copy-muted">
            Check your connection and try again. Nothing has been changed.
          </div>
          <Button variant="secondary" className="mt-1.5 h-10 px-5" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="grid w-full grid-cols-2 gap-px border-b border-wds-border bg-wds-border">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="flex flex-col gap-1 bg-wds-surface px-4 py-3.5">
                <div className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{kpi.label}</div>
                <div className="font-wds-sans text-[22px]/[26px] font-semibold text-wds-text-ink">
                  {rows.length === 0 && kpi.label === 'Depts not submitted' ? '—' : kpi.value}
                </div>
              </div>
            ))}
          </div>
          {rows.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10 py-16 text-center">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wds-neutral-100">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9L15 9M9 3L9 15" stroke="var(--wds-text-copy-muted)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">No requisitions yet today</div>
              <div className="max-w-[280px] font-wds-sans text-wds-body text-wds-text-copy-muted">
                Once a department head opens or submits a section, it will show up here for your approval.
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6">
              <div className="flex items-center justify-between px-4 pb-2 pt-[18px]">
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
                    <div className="font-wds-sans text-[17px]/[22px] font-semibold text-wds-text-ink">{requisitionTypeLabel(row.type)}</div>
                    <div className="font-wds-sans text-wds-body text-wds-text-copy-muted">
                      {row.sectionsSubmitted}/{row.sectionsTotal}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={'size-1.5 shrink-0 rounded-full ' + (row.status === 'APPROVED' ? 'bg-wds-success-fg' : 'bg-wds-warning-fg')} />
                    <div className="font-wds-sans text-wds-body text-wds-text-copy-muted">
                      {row.status === 'APPROVED' ? `Approved · opened ${formatTime(row.openedAt)}` : `Awaiting approval · opened ${formatTime(row.openedAt)}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
