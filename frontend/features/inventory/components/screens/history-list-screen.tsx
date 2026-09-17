'use client';

import * as React from 'react';

import { SearchInput } from '@/components/ui2/search-input';
import { Topbar } from '@/components/app/shell/topbar';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/shell/shell-states';
import { MobileEmptyState, MobileErrorState, MobileLoadingState } from '@/components/app/shell/mobile-states';
import { LoadMoreRow, PurchasingHistoryRowView, type PurchasingHistoryRow as ViewHistoryRow } from '../purchasing-history-row';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import { usePurchasingHistoryList } from '../../hooks/use-purchasing-history-list';
import type { PurchasingHistoryRow as ServerHistoryRow } from '../../types/receiving';

/** Same structural adapter `purchasing-hub-screen.tsx` uses — the server's row has no click handlers, the view component needs them. Row actions aren't wired yet (View/Cancel land with S4/S9). */
function toViewRow(row: ServerHistoryRow): ViewHistoryRow {
  const actions: [{ label: string; emphasized?: boolean; onClick: () => void }, { label: string; emphasized?: boolean; onClick: () => void }] = [
    { ...row.actions[0], onClick: () => undefined },
    { ...row.actions[1], onClick: () => undefined },
  ];
  return { ...row, actions };
}

/**
 * Dedicated History page (2026-09-17 UI refinement) — the Purchasing hub's
 * "View all" destination for the History band. Same union row renderer and
 * limit-bump pagination as the hub's preview (see
 * `use-purchasing-history-list.ts` for why this can't be real cursor
 * pagination yet), plus a search box.
 */
export function HistoryListScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const { rows, search, setSearch, hasMore, loadingMore, loadMore, status, error, reload } = usePurchasingHistoryList();

  if (!hydrated) return null;

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="History"
          subtitle="All purchases and receipts"
          userInitials={user?.name ? user.name.slice(0, 2).toUpperCase() : 'JM'}
          onMenuClick={openMobileNav}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-wds-3 overflow-y-auto p-wds-4">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers" />
          {status === 'loading' || status === 'idle' ? (
            <MobileLoadingState />
          ) : status === 'error' ? (
            <MobileErrorState title="Couldn't load history" description={error ?? 'Try again.'} onRetry={reload} />
          ) : rows.length === 0 ? (
            <MobileEmptyState title="Nothing here yet" description="No purchase history yet." />
          ) : (
            <>
              {rows.map((row) =>
                row.type === 'expectedDelivery' ? (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-wds-3 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3"
                  >
                    <div className="flex min-w-0 flex-col gap-px">
                      <span className="truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink" title={row.supplierName}>
                        {row.supplierName}
                      </span>
                      <span className="truncate font-wds-sans text-wds-caption text-wds-text-copy-muted" title={row.detailLabel}>
                        {row.detailLabel}
                      </span>
                    </div>
                    <span className="shrink-0 font-wds-sans text-wds-caption text-wds-text-copy-muted">{row.statusLabel}</span>
                  </div>
                ) : null
              )}
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
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Purchasing', screen: 'History' }} className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-wds-4 overflow-y-auto px-8 py-7">
        <div className="flex items-center justify-between gap-wds-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">History</h1>
            <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">All purchases and receipts.</p>
          </div>
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers" className="w-[280px]" />
        </div>

        {status === 'loading' || status === 'idle' ? (
          <LoadingState />
        ) : status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState title="Couldn't load history" description={error ?? 'Try again.'} onRetry={reload} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
            {rows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-10">
                <EmptyState title="Nothing here yet" description="No purchase history yet." />
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="sticky top-0 z-10 flex h-[30px] w-full shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
                  <span className="w-[200px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Supplier</span>
                  <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Detail</span>
                  <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Age</span>
                  <span className="w-[150px] shrink-0 pl-6 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Status</span>
                  <span className="w-[150px] shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {rows.map((row) => (
                    <PurchasingHistoryRowView key={row.id} row={toViewRow(row)} />
                  ))}
                  {hasMore ? <LoadMoreRow loading={loadingMore} onClick={loadMore} /> : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
