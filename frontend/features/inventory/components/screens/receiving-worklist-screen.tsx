'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { Topbar } from '@/components/app/shell/topbar';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { MobileEmptyState, MobileErrorState } from '@/components/app/shell/mobile-states';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { ReceivingWorklistSkeletonDesktop, ReceivingWorklistSkeletonMobile } from '../skeletons';
import { useReceivingWorklist } from '../../hooks/use-receiving-worklist';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import type { ExpectedDeliverySummary } from '../../types/receiving';

function formatEstimate(amount: string | null): string | null {
  if (amount == null) return null;
  return `~KES ${Number(amount).toLocaleString()}`;
}

/**
 * Receiving worklist — screen 3 (`UMS-0` desktop, `WSO-0` mobile),
 * Attendant-only. No money columns at all — the backend already omits
 * `estimatedTotal` for this role (serializer-level, plan §3.1), so this
 * screen renders conditionally on the field being present rather than
 * re-implementing a role check the backend already enforces.
 *
 * Table/list quality bar (`04-components.md`, 2026-09-16): pages past its
 * first batch via `useReceivingWorklist`'s real cursor pagination (same
 * `GET /inventory/expected-deliveries` endpoint the Purchasing hub's
 * Inbound band pages), fixed-width columns, horizontal scroll on narrow
 * desktop widths instead of squashing, and truncation with a hover title on
 * the Supplier/Expected columns.
 */
export function ReceivingWorklistScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const { deliveries, hasMore, loadingMore, loadMore, status, error, reload } = useReceivingWorklist();

  if (!hydrated) return null;

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="Receiving"
          subtitle="What's expected — receive it as it arrives"
          userInitials={user?.name ? user.name.slice(0, 2).toUpperCase() : 'AY'}
          onMenuClick={openMobileNav}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-wds-4 overflow-y-auto p-wds-4">
          {status === 'loading' || status === 'idle' ? (
            <ReceivingWorklistSkeletonMobile />
          ) : status === 'error' ? (
            <MobileErrorState title="Couldn't load receiving" description={error ?? 'Try again.'} onRetry={reload} />
          ) : deliveries.length === 0 ? (
            <MobileEmptyState title="Nothing expected today" description="No deliveries are expected right now." />
          ) : (
            <>
              <div className="flex items-center gap-wds-2">
                <span className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">Expected today</span>
                <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">{deliveries.length}</span>
              </div>
              {deliveries.map((row) => (
                <MobileWorklistCard key={row.id} row={row} />
              ))}
              {hasMore ? (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex h-9 items-center justify-center rounded-wds-sm font-wds-sans text-wds-caption font-medium text-wds-caramel-600 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              ) : null}
              <button
                type="button"
                className="flex h-11 items-center justify-center rounded-wds-md border border-dashed border-wds-border-strong font-wds-sans text-wds-caption text-wds-text-copy-muted outline-none transition-colors hover:bg-wds-neutral-50 hover:text-wds-text-ink focus-visible:shadow-wds-ring"
              >
                + Receipt with no expected delivery
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Central Store', screen: 'Receiving' }}
        actions={<Button>Goods receipt</Button>}
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Receiving</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            {user?.name ?? 'Store Attendant'} · Store Attendant · {today}. What&apos;s expected — receive it as it arrives.
          </p>
        </div>

        {status === 'loading' || status === 'idle' ? (
          <ReceivingWorklistSkeletonDesktop />
        ) : status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState title="Couldn't load receiving" description={error ?? 'Try again.'} onRetry={reload} />
          </div>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-wds-4">
              <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">Expected today</span>
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-wds-sm bg-wds-neutral-100 px-1.25">
                <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">{deliveries.length}</span>
              </span>
            </div>
            {deliveries.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <EmptyState title="Nothing expected today" description="No deliveries are expected right now." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex h-[30px] w-full min-w-[780px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
                  <span className="w-[220px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Supplier</span>
                  <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Expected</span>
                  <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Est.</span>
                  <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Age</span>
                  <span className="w-[160px] shrink-0 pl-6 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Status</span>
                  <span className="w-[110px] shrink-0" />
                </div>
                <div className="min-w-[780px]">
                  {deliveries.map((row) => (
                    <WorklistRow key={row.id} row={row} />
                  ))}
                </div>
                {hasMore ? (
                  <div className="flex h-11 shrink-0 items-center justify-center border-t border-wds-border">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="rounded-wds-sm px-wds-2 py-wds-1 font-wds-sans text-wds-caption font-medium text-wds-caramel-600 outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-60"
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function worklistStatus(row: ExpectedDeliverySummary): { label: string; tone: 'neutral' | 'error' } {
  if (row.isOverdue) return { label: 'Overdue', tone: 'error' };
  return { label: 'Awaiting delivery', tone: 'neutral' };
}

const toneDot: Record<string, string> = { neutral: 'bg-wds-neutral-500', error: 'bg-wds-error-fg' };
const toneText: Record<string, string> = { neutral: 'text-wds-neutral-600', error: 'text-wds-error-fg' };

function WorklistRow({ row }: { row: ExpectedDeliverySummary }) {
  const status = worklistStatus(row);
  const estimate = formatEstimate(row.estimatedTotal);
  const detailText = `${row.itemSummary} · ${row.lineCount} lines`;
  return (
    <div className="flex h-14 items-center border-b border-wds-neutral-100 px-wds-4 transition-colors last:border-b-0 hover:bg-wds-surface-sunken">
      <span className="w-[220px] min-w-0 shrink-0 truncate font-wds-sans text-wds-body font-medium text-wds-text-ink" title={row.supplierName ?? 'No supplier'}>
        {row.supplierName ?? 'No supplier'}
      </span>
      <span className="min-w-0 grow truncate font-wds-sans text-wds-body-sm text-wds-text-ink" title={detailText}>
        {detailText}
      </span>
      <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">{estimate ?? '—'}</span>
      <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">{row.ageLabel}</span>
      <div className="flex w-[160px] shrink-0 items-center gap-wds-1.5 pl-wds-6">
        <span className={`size-1.5 shrink-0 rounded-wds-full ${toneDot[status.tone]}`} aria-hidden />
        <span className={`font-wds-sans text-wds-caption ${toneText[status.tone]}`}>{status.label}</span>
      </div>
      <div className="flex w-[110px] shrink-0 justify-end">
        <Button size="sm" disabled title="Goods Receipt entry ships in S6">
          Receive
        </Button>
      </div>
    </div>
  );
}

function MobileWorklistCard({ row }: { row: ExpectedDeliverySummary }) {
  const status = worklistStatus(row);
  const estimate = formatEstimate(row.estimatedTotal);
  const detailText = `${row.itemSummary} · ${row.lineCount} lines`;
  return (
    <div
      className={`flex flex-col gap-wds-2 rounded-wds-md border p-wds-3.5 ${status.tone === 'error' ? 'border-wds-error-fg' : 'border-wds-border'}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-wds-2">
        <span className="min-w-0 truncate font-wds-sans text-wds-body font-medium text-wds-text-ink" title={row.supplierName ?? 'No supplier'}>
          {row.supplierName ?? 'No supplier'}
        </span>
        <span className={`shrink-0 font-wds-sans text-wds-caption ${toneText[status.tone]}`}>{status.label}</span>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-wds-2">
        <span className="min-w-0 truncate font-wds-sans text-wds-caption text-wds-text-copy-muted" title={detailText}>
          {detailText}
        </span>
        {estimate ? (
          <span className="shrink-0 font-wds-mono text-wds-caption text-wds-text-copy-muted">{estimate}</span>
        ) : null}
      </div>
      <div className="flex items-center justify-between">
        <span className={`font-wds-mono text-wds-caption ${status.tone === 'error' ? 'text-wds-error-fg' : 'text-wds-text-faint'}`}>
          expected {row.ageLabel} ago
        </span>
        <Button size="sm" disabled title="Goods Receipt entry ships in S6">
          Receive →
        </Button>
      </div>
    </div>
  );
}
