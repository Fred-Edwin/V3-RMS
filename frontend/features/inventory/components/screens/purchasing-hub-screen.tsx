'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { Topbar } from '@/components/app/shell/topbar';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { MobileEmptyState, MobileErrorState } from '@/components/app/shell/mobile-states';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { KpiStrip, type KpiCellData } from '../kpi-strip';
import {
  PurchasingHubHistorySkeletonDesktop,
  PurchasingHubInboundSkeletonDesktop,
  PurchasingHubKpiSkeletonDesktop,
  PurchasingHubSkeletonMobile,
} from '../skeletons';
import { usePurchasingHub } from '../../hooks/use-purchasing-hub';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import type { ExpectedDeliverySummary, PurchasingHistoryRow as ServerHistoryRow } from '../../types/receiving';
import type { SupplierPaymentTerms } from '../../types';
import { cancelExpectedDelivery } from '../../services/receiving-api-service';
import { PurchasingHistoryRowView, type PurchasingHistoryRow as ViewHistoryRow } from '../purchasing-history-row';

/**
 * Compact preview row count for the hub's Inbound/History bands (2026-09-17
 * UI refinement). The hub is a dashboard, not a worklist — showing every row
 * inline made the page mostly a scroll box on small desktop viewports with
 * no room to actually browse. Each band now shows a handful of rows with a
 * "View all" link to its own dedicated full page
 * (`/purchasing/inbound`, `/purchasing/history`), which gets sticky headers,
 * real search/filters, and full pagination.
 */
const HUB_PREVIEW_ROW_COUNT = 6;

/** Adapts the server's history-row shape (plain `emphasized?` actions) to `PurchasingHistoryRowView`'s props (actions need an `onClick`) — no view-level fields, so it's a pure structural map, not a reformat. */
function toViewRow(row: ServerHistoryRow): ViewHistoryRow {
  const actions: [{ label: string; emphasized?: boolean; onClick: () => void }, { label: string; emphasized?: boolean; onClick: () => void }] = [
    { ...row.actions[0], onClick: () => undefined },
    { ...row.actions[1], onClick: () => undefined },
  ];
  return { ...row, actions };
}

const PAYMENT_TERMS_LABEL: Record<SupplierPaymentTerms, string> = {
  INVOICE_TO_FOLLOW: 'Invoice',
  PAY_NOW: 'Paid on delivery',
};

function formatMoney(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  if (n >= 1000) return `KES ${Math.round(n / 1000)}K`;
  return `KES ${n.toLocaleString()}`;
}

function formatEstimate(amount: string | null): string | null {
  if (amount == null) return null;
  return `~KES ${Number(amount).toLocaleString()}`;
}

/**
 * Purchasing hub — screen 1 of S5 (`U7V-0` desktop, `WUL-0` mobile).
 * KPI strip is 3 tiles (Expected / Awaiting invoice / Owed), `IN TRANSIT`
 * dropped per plan §7 Q1. The Inbound band only renders `ExpectedDelivery`
 * rows for real this session — S4's `GoodsReceipt` rows aren't live yet, so
 * the band renders whatever `usePurchasingHub` actually returns rather than
 * fabricating receipt rows to fill the layout.
 *
 * Table/list quality bar (`04-components.md`, 2026-09-16): both bands page
 * past their first batch via `usePurchasingHub`'s load-more (see that hook
 * for the Inbound-vs-History cursor-support gap), the Detail/money columns
 * are fixed-width and never share a reflowing string, both bands scroll
 * horizontally on narrow viewports instead of squashing, and long
 * supplier/item text truncates with the full value on hover.
 */
export function PurchasingHubScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const {
    summary,
    inbound,
    history,
    status,
    error,
    reload,
  } = usePurchasingHub();

  const inboundPreview = inbound.slice(0, HUB_PREVIEW_ROW_COUNT);
  const historyPreview = history.slice(0, HUB_PREVIEW_ROW_COUNT);

  const handleCancel = async (id: string) => {
    await cancelExpectedDelivery(id);
    void reload();
  };

  const kpiCells: KpiCellData[] = [
    {
      key: 'expected',
      label: 'Expected deliveries',
      value: summary ? String(summary.expected.count) : '—',
      detail: summary ? `Orders on the way · ${summary.expected.overdue} overdue` : undefined,
    },
    {
      key: 'awaitingInvoice',
      label: 'Awaiting invoice',
      value: summary ? String(summary.awaitingInvoice.count) : '—',
      tone: 'accent',
      detail:
        summary?.awaitingInvoice.oldestDays != null
          ? `Received, not yet billed · oldest ${summary.awaitingInvoice.oldestDays} days`
          : 'Received, not yet billed',
    },
    {
      key: 'owed',
      label: 'What we owe',
      value: summary ? formatMoney(summary.owed.amount) : '—',
      detail: summary ? `Unpaid supplier invoices · ${summary.owed.over30Count} over 30 days` : undefined,
    },
  ];

  if (!hydrated) return null;

  const goToNewPurchase = () => router.push('/app/inventory/purchasing/new');
  const newPurchaseButton = <Button onClick={goToNewPurchase}>New purchase</Button>;

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="Purchasing"
          subtitle="Everything supplier-inbound — ordered, arrived, owed."
          userInitials={user?.name ? user.name.slice(0, 2).toUpperCase() : 'JM'}
          onMenuClick={openMobileNav}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-wds-4 overflow-y-auto p-wds-4">
          {status === 'loading' || status === 'idle' ? (
            <PurchasingHubSkeletonMobile />
          ) : status === 'error' ? (
            <MobileErrorState title="Couldn't load purchasing" description={error ?? 'Try again.'} onRetry={reload} />
          ) : (
            <>
              <MobilePurchasingKpiGrid cells={kpiCells} />
              <Button className="w-full" onClick={goToNewPurchase}>
                + New purchase
              </Button>
              <div className="flex flex-col gap-wds-2.5">
                <div className="flex items-center justify-between gap-wds-2">
                  <div className="flex items-center gap-wds-2">
                    <span className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">Inbound</span>
                    <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">{inbound.length}</span>
                  </div>
                  <Link
                    href="/app/inventory/purchasing/inbound"
                    className="font-wds-sans text-wds-caption font-medium text-wds-caramel-600 outline-none transition-colors hover:text-wds-caramel-700 focus-visible:shadow-wds-ring"
                  >
                    View all →
                  </Link>
                </div>
                {inboundPreview.length === 0 ? (
                  <MobileEmptyState title="Nothing here yet" description="No purchases or receipts in progress." />
                ) : (
                  inboundPreview.map((row) => (
                    <MobileInboundCard key={row.id} row={row} onCancel={() => handleCancel(row.id)} />
                  ))
                )}
              </div>
              <div className="flex flex-col gap-wds-2.5">
                <div className="flex items-center justify-between gap-wds-2">
                  <span className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">History</span>
                  <Link
                    href="/app/inventory/purchasing/history"
                    className="font-wds-sans text-wds-caption font-medium text-wds-caramel-600 outline-none transition-colors hover:text-wds-caramel-700 focus-visible:shadow-wds-ring"
                  >
                    View all →
                  </Link>
                </div>
                {historyPreview.map((row) =>
                  row.type === 'expectedDelivery' ? (
                    <div key={row.id} className="flex items-center justify-between gap-wds-3 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3">
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
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Central Store', screen: 'Purchasing' }}
        searchProps={{ placeholder: 'Search items, suppliers, receipts' }}
        actions={newPurchaseButton}
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Purchasing</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            Everything supplier-inbound — what&apos;s ordered, what&apos;s arrived, what&apos;s owed.
          </p>
        </div>

        {status === 'loading' || status === 'idle' ? (
          <>
            <PurchasingHubKpiSkeletonDesktop />
            <PurchasingHubInboundSkeletonDesktop />
            <PurchasingHubHistorySkeletonDesktop />
          </>
        ) : status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState
              title="Couldn't load purchasing"
              description={error ?? 'Something went wrong fetching inbound purchases and receipts. Check your connection and try again.'}
              onRetry={reload}
            />
          </div>
        ) : (
          <>
            <KpiStrip cells={kpiCells} />

            <div className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
              <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-wds-border px-wds-4">
                <div className="flex items-center gap-2">
                  <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">Inbound</span>
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-wds-sm bg-wds-neutral-100 px-1.25">
                    <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">{inbound.length}</span>
                  </span>
                  <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
                    open right now — expected, awaiting invoice
                  </span>
                </div>
                <Link
                  href="/app/inventory/purchasing/inbound"
                  className="font-wds-sans text-wds-caption font-medium text-wds-caramel-600 outline-none transition-colors hover:text-wds-caramel-700 focus-visible:shadow-wds-ring"
                >
                  View all →
                </Link>
              </div>
              {inboundPreview.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <EmptyState title="Nothing here yet" description="No purchases or receipts in progress." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex h-[30px] w-full min-w-[720px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
                    <span className="w-[200px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Supplier</span>
                    <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Detail</span>
                    <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Est.</span>
                    <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Age</span>
                    <span className="w-[160px] shrink-0 pl-6 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Status</span>
                    <span className="w-[130px] shrink-0" />
                  </div>
                  <div className="min-w-[720px]">
                    {inboundPreview.map((row) => (
                      <InboundRow key={row.id} row={row} onCancel={() => handleCancel(row.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
              <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-wds-border px-wds-4">
                <div className="flex items-center gap-2">
                  <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">History</span>
                  <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">all purchases &amp; receipts</span>
                </div>
                <Link
                  href="/app/inventory/purchasing/history"
                  className="font-wds-sans text-wds-caption font-medium text-wds-caramel-600 outline-none transition-colors hover:text-wds-caramel-700 focus-visible:shadow-wds-ring"
                >
                  View all →
                </Link>
              </div>
              {historyPreview.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <EmptyState title="Nothing here yet" description="No purchase history yet." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex h-[30px] w-full min-w-[680px] shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
                    <span className="w-[200px] shrink-0 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Supplier</span>
                    <span className="grow font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Detail</span>
                    <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Age</span>
                    <span className="w-[150px] shrink-0 pl-6 font-wds-mono text-wds-label font-semibold uppercase text-wds-text-ink">Status</span>
                    <span className="w-[150px] shrink-0" />
                  </div>
                  <div className="min-w-[680px]">
                    {historyPreview.map((row) => (
                      <PurchasingHistoryRowView key={row.id} row={toViewRow(row)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Mobile KPI grid — `WUL-0` draws a 2×2 wrapping grid (joined hairline
 * cells, `flex-wrap` + `basis-[45%]`), not the shared `KpiRow` composite's
 * single non-wrapping row (confirmed via `get_jsx`, not assumed to resize
 * the same as the 4-tile version). 3 cells still wrap 2-then-1 in the same
 * grid, so this is a screen-local variant rather than a change to the
 * shared composite other screens depend on.
 */
function MobilePurchasingKpiGrid({ cells }: { cells: KpiCellData[] }) {
  return (
    <div className="flex flex-wrap gap-px rounded-wds-md border border-wds-border bg-wds-border">
      {cells.map((cell, i) => (
        <div
          key={cell.key}
          className={cn(
            'flex min-w-[150px] grow basis-[45%] flex-col gap-1.5 bg-wds-surface px-wds-4 py-wds-3.5',
            i === 0 && 'rounded-tl-wds-md',
            i === 1 && 'rounded-tr-wds-md',
            i === cells.length - 1 && 'rounded-b-wds-md'
          )}
        >
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">{cell.label}</span>
          <span className={cn('font-wds-mono text-wds-kpi-sm', toneClass[cell.tone ?? 'ink'])}>{cell.value}</span>
          {cell.detail ? <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{cell.detail}</span> : null}
        </div>
      ))}
    </div>
  );
}

const toneClass: Record<string, string> = {
  ink: 'text-wds-text-ink',
  accent: 'text-wds-accent-strong',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
};

const statusToneDot: Record<string, string> = {
  neutral: 'bg-wds-neutral-500',
  error: 'bg-wds-error-fg',
  info: 'bg-wds-info-fg',
};
const statusToneText: Record<string, string> = {
  neutral: 'text-wds-neutral-600',
  error: 'text-wds-error-fg',
  info: 'text-wds-info-fg',
};

function inboundRowStatus(row: ExpectedDeliverySummary): { label: string; tone: 'neutral' | 'error' } {
  if (row.isOverdue) return { label: 'Overdue', tone: 'error' };
  return { label: 'Awaiting delivery', tone: 'neutral' };
}

function InboundRow({ row, onCancel }: { row: ExpectedDeliverySummary; onCancel: () => void }) {
  const status = inboundRowStatus(row);
  const detailText = `${row.itemSummary} · ${row.lineCount} lines`;
  const estimate = formatEstimate(row.estimatedTotal);
  return (
    <div className="flex h-14 items-center border-b border-wds-neutral-100 px-wds-4 transition-colors last:border-b-0 hover:bg-wds-surface-sunken">
      <div className="flex w-[200px] min-w-0 shrink-0 flex-col gap-px">
        <span className="truncate font-wds-sans text-wds-body-sm font-medium text-wds-text-ink" title={row.supplierName ?? 'No supplier'}>
          {row.supplierName ?? 'No supplier'}
        </span>
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
          {row.paymentTerms ? PAYMENT_TERMS_LABEL[row.paymentTerms] : '—'}
        </span>
      </div>
      <span className="min-w-0 grow truncate font-wds-sans text-wds-body-sm text-wds-text-ink" title={detailText}>
        {detailText}
      </span>
      <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-copy-muted">
        {estimate ?? '—'}
      </span>
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

function MobileInboundCard({ row, onCancel }: { row: ExpectedDeliverySummary; onCancel: () => void }) {
  const status = inboundRowStatus(row);
  const detailText = `${row.itemSummary} · ${row.lineCount} lines`;
  const estimate = formatEstimate(row.estimatedTotal);
  return (
    <div className="flex flex-col gap-wds-2 rounded-wds-md border border-wds-border bg-wds-surface p-wds-3.5">
      <div className="flex min-w-0 items-center justify-between gap-wds-2">
        <span className="min-w-0 truncate font-wds-sans text-wds-body font-medium text-wds-text-ink" title={row.supplierName ?? 'No supplier'}>
          {row.supplierName ?? 'No supplier'}
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
