'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { SearchInput } from '@/components/ui2/search-input';
import { Topbar } from '@/components/app/shell/topbar';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/shell/shell-states';
import { MobileEmptyState, MobileErrorState, MobileLoadingState } from '@/components/app/shell/mobile-states';
import { LoadMoreRow } from '../purchasing-history-row';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import { useInboundList } from '../../hooks/use-inbound-list';
import { cancelExpectedDelivery } from '../../services/receiving-api-service';
import type { ExpectedDeliverySummary } from '../../types/receiving';
import type { SupplierPaymentTerms } from '../../types';

const PAYMENT_TERMS_LABEL: Record<SupplierPaymentTerms, string> = {
  INVOICE_TO_FOLLOW: 'Invoice',
  PAY_NOW: 'Paid on delivery',
};

function formatEstimate(amount: string | null): string | null {
  if (amount == null) return null;
  return `~KES ${Number(amount).toLocaleString()}`;
}

function rowStatus(row: ExpectedDeliverySummary): { label: string; tone: 'neutral' | 'error' } {
  if (row.isOverdue) return { label: 'Overdue', tone: 'error' };
  return { label: 'Awaiting delivery', tone: 'neutral' };
}

const statusToneDot: Record<string, string> = { neutral: 'bg-wds-neutral-500', error: 'bg-wds-error-fg' };
const statusToneText: Record<string, string> = { neutral: 'text-wds-neutral-600', error: 'text-wds-error-fg' };

/**
 * Dedicated Inbound page (2026-09-17 UI refinement) — the Purchasing hub's
 * "View all" destination for the Inbound band. Same row shape and cursor
 * pagination as the hub's preview, minus the row cap, plus a search box the
 * hub's compact card never had room for.
 */
export function InboundListScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { rows, search, setSearch, hasMore, loadingMore, loadMore, status, error, reload } = useInboundList();

  const handleCancel = async (id: string) => {
    await cancelExpectedDelivery(id);
    void reload();
  };

  if (!hydrated) return null;

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="Inbound"
          subtitle="Expected deliveries and receipts in progress"
          userInitials={user?.name ? user.name.slice(0, 2).toUpperCase() : 'JM'}
          onMenuClick={openMobileNav}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-wds-3 overflow-y-auto p-wds-4">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers"
          />
          {status === 'loading' || status === 'idle' ? (
            <MobileLoadingState />
          ) : status === 'error' ? (
            <MobileErrorState title="Couldn't load inbound" description={error ?? 'Try again.'} onRetry={reload} />
          ) : rows.length === 0 ? (
            <MobileEmptyState title="Nothing here yet" description="No purchases or receipts in progress." />
          ) : (
            <>
              {rows.map((row) => (
                <MobileRow key={row.id} row={row} onCancel={() => handleCancel(row.id)} />
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
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Purchasing', screen: 'Inbound' }}
        actions={<Button onClick={() => router.push('/app/inventory/purchasing/new')}>New purchase</Button>}
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-wds-4 overflow-y-auto px-8 py-7">
        <div className="flex items-center justify-between gap-wds-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Inbound</h1>
            <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
              Expected deliveries and receipts in progress.
            </p>
          </div>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers"
            className="w-[280px]"
          />
        </div>

        {status === 'loading' || status === 'idle' ? (
          <LoadingState />
        ) : status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState title="Couldn't load inbound" description={error ?? 'Try again.'} onRetry={reload} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
            {rows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-10">
                <EmptyState title="Nothing here yet" description="No purchases or receipts in progress." />
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="sticky top-0 z-10 flex h-[30px] w-full shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
                  <span className="w-[220px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Supplier</span>
                  <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Detail</span>
                  <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Est.</span>
                  <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Age</span>
                  <span className="w-[160px] shrink-0 pl-6 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Status</span>
                  <span className="w-[130px] shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {rows.map((row) => (
                    <DesktopRow key={row.id} row={row} onCancel={() => handleCancel(row.id)} />
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

function DesktopRow({ row, onCancel }: { row: ExpectedDeliverySummary; onCancel: () => void }) {
  const status = rowStatus(row);
  const detailText = `${row.itemSummary} · ${row.lineCount} lines`;
  const estimate = formatEstimate(row.estimatedTotal);
  return (
    <div className="flex h-14 items-center border-b border-wds-neutral-100 px-wds-4 transition-colors last:border-b-0 hover:bg-wds-surface-sunken">
      <div className="flex w-[220px] min-w-0 shrink-0 flex-col gap-px">
        <span className="truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink" title={row.supplierName}>
          {row.supplierName}
        </span>
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{PAYMENT_TERMS_LABEL[row.paymentTerms]}</span>
      </div>
      <span className="min-w-0 grow truncate font-wds-sans text-wds-body-sm text-wds-text-ink" title={detailText}>
        {detailText}
      </span>
      <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">{estimate ?? '—'}</span>
      <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">{row.ageLabel}</span>
      <div className="flex w-[160px] shrink-0 items-center gap-wds-1.5 pl-wds-6">
        <span className={`size-1.5 shrink-0 rounded-wds-full ${statusToneDot[status.tone]}`} aria-hidden />
        <span className={`font-wds-sans text-wds-caption ${statusToneText[status.tone]}`}>{status.label}</span>
      </div>
      <div className="flex w-[130px] shrink-0 justify-end gap-wds-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-7 items-center rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 font-wds-sans text-wds-caption text-wds-text-copy-muted outline-none transition-colors hover:bg-wds-neutral-50 hover:text-wds-text-ink focus-visible:shadow-wds-ring active:bg-wds-neutral-100"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled
          title="Goods Receipt entry ships in S6"
          className="flex h-7 items-center rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-3 font-wds-sans text-wds-caption font-medium text-wds-text-ink outline-none transition-colors hover:enabled:bg-wds-neutral-50 focus-visible:shadow-wds-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Receive
        </button>
      </div>
    </div>
  );
}

function MobileRow({ row, onCancel }: { row: ExpectedDeliverySummary; onCancel: () => void }) {
  const status = rowStatus(row);
  const detailText = `${row.itemSummary} · ${row.lineCount} lines`;
  const estimate = formatEstimate(row.estimatedTotal);
  return (
    <div className="flex flex-col gap-wds-2 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3.5">
      <div className="flex min-w-0 items-center justify-between gap-wds-2">
        <span className="min-w-0 truncate font-wds-sans text-wds-body font-medium text-wds-text-ink" title={row.supplierName}>
          {row.supplierName}
        </span>
        <span className={`shrink-0 font-wds-sans text-wds-caption ${statusToneText[status.tone]}`}>{status.label}</span>
      </div>
      <span className="truncate font-wds-sans text-wds-caption text-wds-text-copy-muted" title={detailText + (estimate ? ` · ${estimate}` : '')}>
        {detailText}
        {estimate ? ` · ${estimate}` : ''}
      </span>
      <div className="flex items-center justify-between">
        <span className="font-wds-mono text-wds-caption text-wds-text-faint">expected {row.ageLabel} ago</span>
        <div className="flex items-center gap-wds-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 items-center rounded-wds-sm px-wds-1 font-wds-sans text-wds-caption text-wds-text-copy-muted outline-none transition-colors hover:text-wds-text-ink focus-visible:shadow-wds-ring active:opacity-70"
          >
            Cancel
          </button>
          <Button size="sm" disabled title="Goods Receipt entry ships in S6">
            Receive
          </Button>
        </div>
      </div>
    </div>
  );
}
