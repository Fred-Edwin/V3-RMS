'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

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
import { useReceivingHistoryList } from '../../hooks/use-receiving-history-list';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import { PurchasingHistoryRowView, toReceivingHistoryViewRow } from '../purchasing-history-row';
import type { ExpectedDeliverySummary } from '../../types/receiving';

/** History preview band caps at this many rows — a taste, not the full ledger. "View all" is the only way to see more (Paper `YAM-0`). */
const HISTORY_PREVIEW_ROW_COUNT = 4;

/**
 * Receiving worklist — screen 3 (redesigned `YAM-0` desktop, `YPP-0` mobile,
 * 2026-09-18, S6). "Expected today" moved from a table to a tight
 * architectural list (hairline dividers, a left-rule accent on Overdue rows
 * instead of a full background tint) to visually separate it from the
 * History band below — an action queue reads differently from a record, per
 * the owner's design-review feedback this session. No money columns at all —
 * the backend already omits `estimatedTotal` for this role (serializer-level,
 * plan §3.1), so this screen renders conditionally on the field being present
 * rather than re-implementing a role check the backend already enforces.
 *
 * The History band is a capped preview (`HISTORY_PREVIEW_ROW_COUNT`) of
 * `GET /inventory/receiving/history` — the same Attendant-safe union endpoint
 * the dedicated `/app/inventory/receiving/history` screen pages through in
 * full — with a "View all" link, matching the Purchasing hub's own
 * Inbound/History band pattern (`purchasing-hub-screen.tsx`).
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
  const router = useRouter();
  const { deliveries, hasMore, loadingMore, loadMore, status, error, reload } = useReceivingWorklist();
  const history = useReceivingHistoryList();

  const goToNewReceipt = React.useCallback(
    (expectedDeliveryId?: string) => {
      const qs = expectedDeliveryId ? `?expectedDeliveryId=${expectedDeliveryId}` : '';
      router.push(`/app/inventory/receiving/new${qs}`);
    },
    [router]
  );

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
          <div className="flex items-center gap-wds-2">
            <span className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">Expected today</span>
            <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">{deliveries.length}</span>
          </div>
          {status === 'loading' || status === 'idle' ? (
            <ReceivingWorklistSkeletonMobile />
          ) : status === 'error' ? (
            <MobileErrorState title="Couldn't load receiving" description={error ?? 'Try again.'} onRetry={reload} />
          ) : deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-wds-md border border-wds-border bg-wds-surface px-5 py-10">
              <div className="flex size-10 items-center justify-center rounded-wds-full border border-wds-success-border bg-wds-success-bg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M20 6L9 17l-5-5" stroke="var(--color-success-fg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">All caught up</span>
                <span className="max-w-[260px] text-center font-wds-sans text-wds-caption text-wds-text-copy-muted">
                  Nothing expected right now.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border">
              {deliveries.map((row) => (
                <MobileWorklistCard key={row.id} row={row} onReceive={() => goToNewReceipt(row.id)} />
              ))}
            </div>
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
          <button
            type="button"
            onClick={() => goToNewReceipt()}
            className="flex h-11 items-center justify-center rounded-wds-md border border-dashed border-wds-border-strong font-wds-sans text-wds-caption text-wds-text-copy-muted outline-none transition-colors hover:bg-wds-neutral-50 hover:text-wds-text-ink focus-visible:shadow-wds-ring"
          >
            + Receipt with no expected delivery
          </button>

          <MobileReceivingHistoryBand
            rows={history.rows.slice(0, HISTORY_PREVIEW_ROW_COUNT)}
            status={history.status}
            error={history.error}
            onRetry={history.reload}
            onViewAll={() => router.push('/app/inventory/receiving/history')}
            onRowClick={(id) => router.push(`/app/inventory/receiving/${id}`)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Central Store', screen: 'Receiving' }}
        actions={<Button onClick={() => goToNewReceipt()}>Goods receipt</Button>}
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
              <EmptyExpectedToday />
            ) : (
              <div className="flex flex-col">
                {deliveries.map((row) => (
                  <WorklistRow key={row.id} row={row} onReceive={() => goToNewReceipt(row.id)} />
                ))}
                {hasMore ? (
                  <div className="flex h-11 shrink-0 items-center justify-center border-t border-wds-neutral-100">
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

        <ReceivingHistoryBand
          rows={history.rows.slice(0, HISTORY_PREVIEW_ROW_COUNT)}
          status={history.status}
          error={history.error}
          onRetry={history.reload}
          onViewAll={() => router.push('/app/inventory/receiving/history')}
          navigate={router.push}
        />
      </div>
    </div>
  );
}

/** "All caught up" — a positive empty state, not a generic no-data placeholder (Paper `3 · Receiving worklist · desktop · empty state`). */
function EmptyExpectedToday() {
  return (
    <div className="flex flex-col items-center justify-center gap-3.5 px-5 py-12">
      <div className="flex size-11 items-center justify-center rounded-wds-full border border-wds-success-border bg-wds-success-bg">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M20 6L9 17l-5-5" stroke="var(--color-success-fg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">All caught up</span>
        <span className="max-w-[320px] text-center font-wds-sans text-wds-caption text-wds-text-copy-muted">
          Nothing expected right now — new deliveries will appear here as they&apos;re ordered.
        </span>
      </div>
    </div>
  );
}

function ReceivingHistoryBand({
  rows,
  status,
  error,
  onRetry,
  onViewAll,
  navigate,
}: {
  rows: ReturnType<typeof useReceivingHistoryList>['rows'];
  status: ReturnType<typeof useReceivingHistoryList>['status'];
  error: string | null;
  onRetry: () => void;
  onViewAll: () => void;
  navigate: (path: string) => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-wds-4">
        <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">History</span>
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">goods receipts received here</span>
        <button
          type="button"
          onClick={onViewAll}
          className="ml-auto flex shrink-0 items-center gap-0.5 rounded-wds-sm font-wds-sans text-wds-caption font-medium text-wds-caramel-700 outline-none transition-colors hover:text-wds-caramel-600 focus-visible:shadow-wds-ring"
        >
          View all <span aria-hidden>→</span>
        </button>
      </div>
      {status === 'loading' || status === 'idle' ? (
        <div className="p-wds-4">
          <ReceivingWorklistSkeletonDesktop />
        </div>
      ) : status === 'error' ? (
        <div className="flex items-center justify-center py-10">
          <ErrorState title="Couldn't load history" description={error ?? 'Try again.'} onRetry={onRetry} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <EmptyState title="No history yet" description="Signed goods receipts will show up here." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex h-[30px] w-full min-w-[780px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
            <span className="w-[200px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Ref</span>
            <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Supplier</span>
            <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Age</span>
            <span className="w-[150px] shrink-0 pl-6 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Status</span>
            <span className="w-[150px] shrink-0" />
          </div>
          <div className="min-w-[780px]">
            {rows.map((row) => (
              <PurchasingHistoryRowView key={row.id} row={toReceivingHistoryViewRow(row, navigate)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function worklistStatus(row: ExpectedDeliverySummary): { label: string; tone: 'neutral' | 'error' } {
  if (row.isOverdue) return { label: 'Overdue', tone: 'error' };
  return { label: 'Awaiting delivery', tone: 'neutral' };
}

const toneDot: Record<string, string> = { neutral: 'bg-wds-neutral-500', error: 'bg-wds-error-fg' };
const toneText: Record<string, string> = { neutral: 'text-wds-neutral-600', error: 'text-wds-error-fg' };

/**
 * "Architectural list" row (Paper `YAM-0`, owner-directed redesign this
 * session): a single continuous panel with hairline dividers between rows,
 * not per-row cards — Overdue gets a thin left rule in error color instead
 * of a full background tint, kept restrained rather than loud. Matches the
 * History band's own row rhythm below it while staying visually distinct
 * (no column-header bar, tighter 56px rows) since this is an action queue,
 * not a record.
 */
function WorklistRow({ row, onReceive }: { row: ExpectedDeliverySummary; onReceive: () => void }) {
  const status = worklistStatus(row);
  const detailText = `${row.itemSummary} · ${row.lineCount} lines`;
  const isOverdue = status.tone === 'error';
  return (
    <div
      className={`flex h-14 items-center gap-5 border-b border-wds-neutral-100 px-5 last:border-b-0 ${
        isOverdue ? 'border-l-[3px] border-l-wds-error-fg pl-[17px]' : ''
      }`}
    >
      <div className="flex w-[220px] shrink-0 flex-col gap-1">
        <span className="truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink" title={row.supplierName ?? 'No supplier'}>
          {row.supplierName ?? 'No supplier'}
        </span>
        <span className="font-wds-mono text-[10px] uppercase tracking-wds-label text-wds-text-faint">From purchase list</span>
      </div>
      <span className="min-w-0 grow truncate font-wds-sans text-wds-body-sm text-wds-text-copy-muted" title={detailText}>
        {detailText}
      </span>
      <span className={`w-[100px] shrink-0 text-right font-wds-mono text-wds-caption ${isOverdue ? 'text-wds-error-fg' : 'text-wds-text-faint'}`}>
        {row.ageLabel} ago
      </span>
      <div className="flex w-[150px] shrink-0 items-center gap-1.5">
        <span className={`size-1.5 shrink-0 rounded-wds-full ${toneDot[status.tone]}`} aria-hidden />
        <span className={`font-wds-sans text-wds-caption ${toneText[status.tone]}`}>{status.label}</span>
      </div>
      <div className="flex shrink-0 justify-end">
        <Button size="sm" onClick={onReceive}>
          Receive
        </Button>
      </div>
    </div>
  );
}

/**
 * Two-line stacked row inside the mobile "Expected today" list panel (Paper
 * `YPP-0`) — no per-row card chrome; the panel itself carries the border,
 * rows are hairline-divided by the parent's `divide-y`. Overdue gets the
 * same thin left-rule treatment as the desktop row.
 */
function MobileWorklistCard({ row, onReceive }: { row: ExpectedDeliverySummary; onReceive: () => void }) {
  const status = worklistStatus(row);
  const detailText = `${row.itemSummary} · ${row.lineCount} lines`;
  const isOverdue = status.tone === 'error';
  return (
    <div
      className={`flex flex-col gap-2 border-b border-wds-neutral-100 px-4 py-3.5 last:border-b-0 ${
        isOverdue ? 'border-l-[3px] border-l-wds-error-fg pl-[13px]' : ''
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="min-w-0 truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink" title={row.supplierName ?? 'No supplier'}>
            {row.supplierName ?? 'No supplier'}
          </span>
          <span className="truncate font-wds-sans text-wds-caption text-wds-text-copy-muted" title={detailText}>
            {detailText}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`size-1.5 shrink-0 rounded-wds-full ${toneDot[status.tone]}`} aria-hidden />
          <span className={`font-wds-sans text-wds-caption ${toneText[status.tone]}`}>{status.label}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`font-wds-mono text-wds-label ${isOverdue ? 'text-wds-error-fg' : 'text-wds-text-faint'}`}>
          expected {row.ageLabel} ago
        </span>
        <Button size="sm" onClick={onReceive}>
          Receive →
        </Button>
      </div>
    </div>
  );
}

function MobileReceivingHistoryBand({
  rows,
  status,
  error,
  onRetry,
  onViewAll,
  onRowClick,
}: {
  rows: ReturnType<typeof useReceivingHistoryList>['rows'];
  status: ReturnType<typeof useReceivingHistoryList>['status'];
  error: string | null;
  onRetry: () => void;
  onViewAll: () => void;
  onRowClick: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-wds-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-wds-2">
          <span className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">History</span>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="font-wds-sans text-wds-caption font-medium text-wds-caramel-700 outline-none focus-visible:shadow-wds-ring"
        >
          View all
        </button>
      </div>
      {status === 'loading' || status === 'idle' ? (
        <ReceivingWorklistSkeletonMobile />
      ) : status === 'error' ? (
        <MobileErrorState title="Couldn't load history" description={error ?? 'Try again.'} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <MobileEmptyState title="No history yet" description="Signed goods receipts will show up here." />
      ) : (
        rows.map((row) => {
          const titleLine = row.type === 'expectedDelivery' ? row.supplierName : row.title;
          const isGoodsReceipt = row.type === 'goodsReceipt';
          return (
            <div
              key={row.id}
              role={isGoodsReceipt ? 'button' : undefined}
              tabIndex={isGoodsReceipt ? 0 : undefined}
              onClick={isGoodsReceipt ? () => onRowClick(row.id) : undefined}
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
        })
      )}
    </div>
  );
}
