'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Topbar } from '@/components/app/shell/topbar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { useAuthStore } from '@/store/authStore';
import { useDiscrepancies } from '../../hooks/use-discrepancies';
import type { DiscrepancyRow } from '../../types';

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

interface DiscrepancyTableRowProps {
  row: DiscrepancyRow;
  isStoreManager: boolean;
  onOpen: () => void;
}

function DiscrepancyTableRow({ row, isStoreManager, onOpen }: DiscrepancyTableRowProps) {
  const open = row.status === 'OPEN';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 border-t border-wds-neutral-200 py-3 text-left transition-colors hover:bg-wds-neutral-50"
    >
      <div className={'w-[90px] shrink-0 font-wds-mono text-wds-body-sm ' + (open ? 'text-wds-text-ink' : 'text-wds-text-copy-muted')}>{row.referenceNumber}</div>
      <div className="min-w-0 grow basis-0 truncate font-wds-sans text-wds-body-sm text-wds-text-ink">
        {isStoreManager ? `${row.branchName} · ${DEPARTMENT_LABEL[row.departmentTag] ?? row.departmentTag}` : DEPARTMENT_LABEL[row.departmentTag] ?? row.departmentTag}
      </div>
      <div className="w-[140px] shrink-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{row.itemName}</div>
      <div className={'w-[80px] shrink-0 text-right font-wds-mono text-wds-body-sm ' + (open ? 'font-semibold text-wds-error-fg' : 'text-wds-text-copy-muted')}>
        {row.gapQty} {row.usageUnit}
      </div>
      <div className="w-[100px] shrink-0 text-right font-wds-sans text-wds-caption text-wds-text-faint">{formatRaised(row.createdAt)}</div>
      <div className="flex w-[180px] shrink-0 items-center justify-end gap-1.5">
        <span className={'size-1.5 shrink-0 rounded-full ' + (open ? 'bg-wds-error-fg' : 'bg-wds-success-fg')} />
        <span className={'font-wds-sans text-wds-caption ' + (open ? 'font-semibold text-wds-error-fg' : 'text-wds-text-copy-muted')}>
          {statusLabel(row, isStoreManager)}
        </span>
      </div>
    </button>
  );
}

/**
 * Discrepancies list (`16Q7-0` Store Manager all-branches / `16UG-0` Branch
 * Manager own-branch, read-only) — one component branching on role for the
 * two scopes, per session-b-plan.md decision #7 (the backend already
 * returns a role-scoped row set from the same endpoint). "Open only" filter
 * defaults on, matching Paper.
 */
export function DiscrepanciesListScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isStoreManager = user?.role === 'STORE_MANAGER';
  const { rows, status, error, reload } = useDiscrepancies();
  const [openOnly, setOpenOnly] = React.useState(searchParams?.get('open') !== 'false');

  const toggleOpenOnly = () => {
    const next = !openOnly;
    setOpenOnly(next);
    const params = new URLSearchParams(searchParams?.toString());
    if (next) params.delete('open');
    else params.set('open', 'false');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  };

  const visibleRows = openOnly ? rows.filter((r) => r.status === 'OPEN') : rows;
  const breadcrumbSection = isStoreManager ? 'Dispatch' : 'Deliveries';

  const openRow = (row: DiscrepancyRow) => {
    if (isStoreManager) {
      router.push(`/app/inventory/discrepancies/${row.id}`);
    } else {
      router.push(`/app/branch/deliveries/discrepancies/${row.id}`);
    }
  };

  if (status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: breadcrumbSection, screen: 'Discrepancies' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <ErrorState title="Couldn't load discrepancies" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: breadcrumbSection, screen: 'Discrepancies' }} className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-8 pb-8 pt-6">
        <div className="flex flex-col gap-1">
          <div className="font-wds-sans text-wds-h1 font-semibold tracking-tight text-wds-text-ink">Discrepancies</div>
          <div className="font-wds-sans text-wds-body text-wds-text-copy-muted">
            {isStoreManager
              ? 'Every transit discrepancy raised across branches — open ones need your resolution.'
              : `Transit discrepancies for ${rows[0]?.branchName ?? 'your branch'} — read only, the Store Manager resolves.`}
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-wds-sm border border-wds-border px-3.5 py-2.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={openOnly}
            onClick={toggleOpenOnly}
            className={
              'flex items-center gap-1.5 rounded-wds-sm px-2.5 py-1 transition-colors ' +
              (openOnly ? 'bg-wds-primary' : 'border border-wds-border')
            }
          >
            {openOnly ? (
              <svg width="13" height="13" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <rect x="2" y="2" width="20" height="20" rx="2" fill="#FCFCFC" />
                <path d="M7 12l3.5 3.5L17 8" fill="none" stroke="var(--wds-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="h-[13px] w-[13px] shrink-0 rounded-[2px] border border-wds-border" />
            )}
            <span className={'font-wds-sans text-wds-body-sm ' + (openOnly ? 'font-medium text-white' : 'text-wds-text-ink')}>Open only</span>
          </button>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-4 border-b border-wds-neutral-800 py-2.5">
            <div className="w-[90px] shrink-0 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">ID</div>
            <div className="grow basis-0 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">
              {isStoreManager ? 'Branch · Department' : 'Department'}
            </div>
            <div className="w-[140px] shrink-0 font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">Item</div>
            <div className="w-[80px] shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">Gap</div>
            <div className="w-[100px] shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">Raised</div>
            <div className="w-[180px] shrink-0 text-right font-wds-sans text-wds-label font-semibold uppercase tracking-wds-label text-wds-text-copy-muted">Status</div>
          </div>
          {status === 'loading' ? (
            <div className="flex flex-col gap-2 py-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded-wds-sm bg-wds-neutral-100" />
              ))}
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
                {openOnly ? 'No open discrepancies.' : 'No discrepancies recorded.'}
              </div>
            </div>
          ) : (
            visibleRows.map((row) => <DiscrepancyTableRow key={row.id} row={row} isStoreManager={isStoreManager} onOpen={() => openRow(row)} />)
          )}
        </div>
      </div>
    </div>
  );
}
