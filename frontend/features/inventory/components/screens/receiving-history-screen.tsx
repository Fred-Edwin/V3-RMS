'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { SearchInput } from '@/components/ui2/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import { Topbar } from '@/components/app/shell/topbar';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/shell/shell-states';
import { MobileEmptyState, MobileErrorState, MobileLoadingState } from '@/components/app/shell/mobile-states';
import { PurchasingHistoryRowView, toReceivingHistoryViewRow } from '../purchasing-history-row';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import { useReceivingHistoryList } from '../../hooks/use-receiving-history-list';

/**
 * Statuses across both row types the union can emit — an Attendant only ever
 * sees `AWAITING`/`FULFILLED`/`CANCELLED`/`RECEIVED_INVOICE_PENDING`-flavoured
 * "Received" labels (money/AP status is server-omitted, receiving-service.ts's
 * `toGoodsReceiptHistoryRow`), but the filter still offers the full set — the
 * backend simply returns fewer distinct `statusLabel`s for that role, it
 * doesn't need a role check here to decide which options to show.
 */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'AWAITING', label: 'Awaiting delivery' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'RECEIVED_INVOICE_PENDING', label: 'Invoice pending' },
  { value: 'RECEIVED_PAID', label: 'Paid on delivery' },
  { value: 'INVOICE_RECORDED', label: 'Invoice recorded' },
];

/**
 * Dedicated Receiving History screen (`3b · Receiving History · desktop` /
 * `3bm · Receiving History · mobile`, 2026-09-18, S6). The "View all"
 * destination for the Receiving worklist's History band — full filters
 * (search, status, date range) the compact band can't fit, and infinite
 * scroll rather than a "Load more" button (owner direction this session: the
 * worklist's own History band is the capped preview, this page is the full
 * archive and should just keep loading as the user scrolls).
 */
export function ReceivingHistoryScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { rows, filters, setFilters, hasMore, loadingMore, loadMore, status, error, reload } = useReceivingHistoryList();

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, loadingMore, status);

  const statusValue = filters.status ?? 'all';
  const hasActiveFilters = Boolean(filters.search || filters.status || filters.from || filters.to);

  const clearFilters = () => setFilters({ search: '' });

  if (!hydrated) return null;

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="History"
          subtitle="All goods receipts and expected deliveries"
          userInitials={user?.name ? user.name.slice(0, 2).toUpperCase() : 'AY'}
          onMenuClick={openMobileNav}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-wds-3 overflow-y-auto p-wds-4">
          <SearchInput
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search ref, supplier…"
          />
          <div className="flex items-center gap-wds-2 overflow-x-auto">
            <Select value={statusValue} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : v }))}>
              <SelectTrigger className="h-8 w-fit shrink-0 gap-wds-1.5 px-wds-3">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="date"
              value={filters.from?.slice(0, 10) ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined }))}
              className="h-8 shrink-0 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2 font-wds-mono text-wds-caption text-wds-text-ink outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
            />
            <input
              type="date"
              value={filters.to?.slice(0, 10) ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined }))}
              className="h-8 shrink-0 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2 font-wds-mono text-wds-caption text-wds-text-ink outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
            />
          </div>
          {status === 'loading' || status === 'idle' ? (
            <MobileLoadingState />
          ) : status === 'error' ? (
            <MobileErrorState title="Couldn't load history" description={error ?? 'Try again.'} onRetry={reload} />
          ) : rows.length === 0 ? (
            <MobileEmptyState
              title="Nothing here yet"
              description={hasActiveFilters ? 'No rows match these filters.' : 'No purchase history yet.'}
            />
          ) : (
            <>
              {rows.map((row) => {
                const titleLine = row.type === 'expectedDelivery' ? row.supplierName : row.title;
                const isGoodsReceipt = row.type === 'goodsReceipt';
                return (
                  <div
                    key={row.id}
                    role={isGoodsReceipt ? 'button' : undefined}
                    tabIndex={isGoodsReceipt ? 0 : undefined}
                    onClick={isGoodsReceipt ? () => router.push(`/app/inventory/receiving/${row.id}`) : undefined}
                    className="flex items-center justify-between gap-wds-3 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3"
                  >
                    <div className="flex min-w-0 flex-col gap-px">
                      <span className="truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink" title={titleLine}>
                        {titleLine}
                      </span>
                      <span className="truncate font-wds-sans text-wds-caption text-wds-text-copy-muted" title={row.detailLabel}>
                        {row.detailLabel}
                      </span>
                    </div>
                    <span className="shrink-0 font-wds-sans text-wds-caption text-wds-text-copy-muted">{row.statusLabel}</span>
                  </div>
                );
              })}
              <div ref={sentinelRef} className="h-1" aria-hidden />
              {loadingMore ? (
                <div className="flex h-9 items-center justify-center font-wds-sans text-wds-caption text-wds-text-copy-muted">Loading…</div>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Receiving', screen: 'History', sectionHref: '/app/inventory/receiving' }} className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-wds-4 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Receiving History</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            All goods receipts and expected deliveries — filter by date, supplier or status.
          </p>
        </div>

        {status === 'loading' || status === 'idle' ? (
          <LoadingState />
        ) : status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState title="Couldn't load history" description={error ?? 'Try again.'} onRetry={reload} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
            <div className="flex h-14 shrink-0 items-center gap-wds-2 border-b border-wds-border px-wds-4">
              <SearchInput
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search ref, supplier…"
                className="w-[220px]"
              />
              <Select value={statusValue} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : v }))}>
                <SelectTrigger className="h-8 w-fit gap-wds-1.5 px-wds-3">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-wds-1.5 rounded-wds-sm border border-wds-border-strong px-wds-2">
                <input
                  type="date"
                  value={filters.from?.slice(0, 10) ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined }))}
                  className="h-8 border-none bg-transparent font-wds-mono text-wds-caption text-wds-text-ink outline-none"
                />
                <span className="font-wds-sans text-wds-caption text-wds-text-faint">–</span>
                <input
                  type="date"
                  value={filters.to?.slice(0, 10) ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined }))}
                  className="h-8 border-none bg-transparent font-wds-mono text-wds-caption text-wds-text-ink outline-none"
                />
              </div>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto shrink-0 font-wds-sans text-wds-caption font-medium text-wds-caramel-700 outline-none hover:text-wds-caramel-600 focus-visible:shadow-wds-ring"
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-10">
                <EmptyState
                  title="Nothing here yet"
                  description={hasActiveFilters ? 'No rows match these filters.' : 'No purchase history yet.'}
                />
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="sticky top-0 z-10 flex h-[30px] w-full shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
                  <span className="w-[200px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Ref</span>
                  <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Supplier</span>
                  <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Age</span>
                  <span className="w-[150px] shrink-0 pl-6 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Status</span>
                  <span className="w-[150px] shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {rows.map((row) => (
                    <PurchasingHistoryRowView key={row.id} row={toReceivingHistoryViewRow(row, router.push)} />
                  ))}
                  <div ref={sentinelRef} className="h-1" aria-hidden />
                  {loadingMore ? (
                    <div className="flex h-11 items-center justify-center font-wds-sans text-wds-caption text-wds-text-copy-muted">
                      Loading…
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Fires `loadMore` when the sentinel scrolls into view — infinite scroll
 * instead of a "Load more" button (owner direction this session: the
 * dedicated History page should just keep loading as the user scrolls, the
 * click-to-load pattern stays on the worklist's capped preview band only).
 */
function useInfiniteScroll(
  loadMore: () => void,
  hasMore: boolean,
  loadingMore: boolean,
  status: 'idle' | 'loading' | 'error' | 'ready',
): React.RefObject<HTMLDivElement> {
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (status !== 'ready' || !hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loadingMore, status]);

  return sentinelRef;
}
