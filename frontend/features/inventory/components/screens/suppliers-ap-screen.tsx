'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { Topbar } from '@/components/app/shell/topbar';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { MobileEmptyState, MobileErrorState, MobilePermissionDeniedState } from '@/components/app/shell/mobile-states';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { KpiStrip, KpiRow, type KpiCellData } from '../kpi-strip';
import { AgingBucketTable, type AgingBucketTableRow } from '../aging-bucket-table';
import { SuppliersKpiSkeletonDesktop, SuppliersListSkeletonDesktop, SuppliersListSkeletonMobile } from '../skeletons';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import { useSupplierApList } from '../../hooks/use-supplier-ap-list';
import { SupplierFormDrawer } from './supplier-form-screen';
import type { SupplierApRow } from '../../types/receiving';
import type { SupplierPaymentTerms } from '../../types';

const PAYMENT_TERMS_LABEL: Record<SupplierPaymentTerms, string> = {
  INVOICE_TO_FOLLOW: 'Invoice',
  PAY_NOW: 'Paid on delivery',
};

function formatMoney(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return `KES ${n.toLocaleString()}`;
}

function formatPlainAmount(amount: string): string {
  const n = Number(amount);
  return Number.isFinite(n) ? n.toLocaleString() : amount;
}

function formatLastActivityDate(dateIso: string | null): string {
  if (!dateIso) return 'no activity';
  return new Date(dateIso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
}

/** For the mobile card, which has no built-in "last " prefix of its own. */
function formatLastActivity(dateIso: string | null): string {
  return dateIso ? `last ${formatLastActivityDate(dateIso)}` : 'no activity';
}

/** Buckets keyed by AgingBucketCell's convention — see aging-bucket-cell.tsx. */
function toBucketCellMap(row: SupplierApRow): Record<string, string> {
  const nonZero = (v: string) => (Number(v) > 0 ? formatPlainAmount(v) : '–');
  return {
    current: nonZero(row.buckets.current),
    '1-30': nonZero(row.buckets.days1To30),
    '31-60': nonZero(row.buckets.days31To60),
    '61-90': nonZero(row.buckets.days61To90),
    '90+': nonZero(row.buckets.days90Plus),
  };
}

/** The single oldest non-empty bucket, for the mobile card's one-line summary. */
function oldestOverdueBucket(row: SupplierApRow): { label: string; amount: string } | null {
  const buckets: { key: keyof SupplierApRow['buckets']; label: string }[] = [
    { key: 'days90Plus', label: '90+ d' },
    { key: 'days61To90', label: '61–90 d' },
    { key: 'days31To60', label: '31–60 d' },
    { key: 'days1To30', label: '1–30 d' },
  ];
  for (const b of buckets) {
    if (Number(row.buckets[b.key]) > 0) return { label: b.label, amount: formatPlainAmount(row.buckets[b.key]) };
  }
  return null;
}

/**
 * Suppliers screen — "what we owe" (`VGE-0` desktop, `WXO-0` mobile).
 * Milestone Two S8. Replaces the Milestone-One profile-only stub that
 * `suppliers-screen.tsx` was (kept for the New/edit supplier drawer's host
 * list until this session). Terminology: "what we owe" / "how overdue"
 * throughout — never "AP"/"aging" (owner decision 2026-09-16).
 *
 * This is the one screen in the milestone where permission-denied is real,
 * not theoretical — `STORE_ATTENDANT` gets a genuine 403 from
 * `GET /inventory/ap/summary`/`/ap/suppliers`, not a client-side-only role
 * check (plan §3a row 8). `useSupplierApList` surfaces that as
 * `isForbidden`, driven by the actual `ApiError.statusCode === 403`.
 *
 * Table/list quality bar: real `limit`/`cursor` via `useSupplierApList`
 * (2026-09-18 backend amendment closed the prior dead-params gap), fixed
 * money-column widths (`AgingBucketTable`), horizontal scroll on narrow
 * desktop viewports via the table's own overflow handling.
 */
export function SuppliersApScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { open: openMobileNav } = useMobileNavDrawer();

  const [search, setSearch] = React.useState('');
  const [terms, setTerms] = React.useState<SupplierPaymentTerms | undefined>(undefined);
  const [hasBalance, setHasBalance] = React.useState<boolean | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const canWrite = role === 'STORE_MANAGER';

  const { summary, rows, status, isRefetching, error, isForbidden, hasMore, loadingMore, loadMore, reload } = useSupplierApList({
    search: search || undefined,
    terms,
    hasBalance,
  });

  if (!hydrated) return null;

  if (isForbidden) {
    const denied = (
      <PermissionDeniedState description="What we owe is visible to Store Managers, the Accountant, and Directors only." />
    );
    return isDesktop ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">{denied}</div>
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader title="Suppliers" subtitle="What we owe" userInitials="JM" onMenuClick={openMobileNav} />
        <div className="flex flex-1 items-center justify-center p-4">
          <MobilePermissionDeniedState description="What we owe is visible to Store Managers, the Accountant, and Directors only." />
        </div>
      </div>
    );
  }

  const goToDetail = (supplierId: string) => router.push(`/app/inventory/suppliers/${supplierId}`);

  const kpiCells: KpiCellData[] = [
    { key: 'invoiced', label: 'Total invoiced (90d)', value: summary ? formatMoney(summary.totalInvoiced) : '—', detail: summary ? `${summary.supplierCount} suppliers with activity` : undefined },
    { key: 'paid', label: 'Paid', value: summary ? formatMoney(summary.totalPaid) : '—' },
    { key: 'outstanding', label: 'Outstanding', value: summary ? formatMoney(summary.totalOutstanding) : '—', detail: summary ? `${summary.suppliersWithBalance} suppliers with a balance` : undefined },
    { key: 'suppliers', label: 'Suppliers', value: summary ? String(summary.supplierCount) : '—', detail: summary ? `${summary.suppliersWithBalance} with a balance` : undefined },
  ];

  const tableRows: AgingBucketTableRow[] = rows.map((row) => ({
    id: row.supplierId,
    supplierName: row.supplierName,
    disputedCount: row.disputedCount,
    termsLabel: PAYMENT_TERMS_LABEL[row.paymentTerms],
    lastActivityLabel: formatLastActivityDate(row.lastInvoiceDate),
    invoiced: formatPlainAmount(row.invoiced),
    paid: formatPlainAmount(row.paid),
    buckets: toBucketCellMap(row),
    outstanding: formatPlainAmount(row.outstanding),
  }));

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="Suppliers"
          subtitle="Who we buy from — payment terms and what we owe."
          userInitials={user?.name ? user.name.slice(0, 2).toUpperCase() : 'JM'}
          onMenuClick={openMobileNav}
        />
        <div className="flex flex-1 flex-col gap-wds-4 p-wds-4">
          {status === 'loading' || status === 'idle' ? (
            <SuppliersListSkeletonMobile />
          ) : status === 'error' ? (
            <MobileErrorState title="Couldn't load suppliers" description={error ?? 'Try again.'} onRetry={reload} />
          ) : (
            <>
              <KpiRow
                cells={[
                  { key: 'invoiced', label: 'Invoiced (90d)', value: summary ? formatMoney(summary.totalInvoiced) : '—' },
                  { key: 'paid', label: 'Paid', value: summary ? formatMoney(summary.totalPaid) : '—' },
                  { key: 'outstanding', label: 'Outstanding', value: summary ? formatMoney(summary.totalOutstanding) : '—' },
                  { key: 'suppliers', label: 'Suppliers', value: summary ? String(summary.supplierCount) : '—' },
                ]}
              />
              {canWrite ? (
                <Button className="w-full" onClick={() => setDrawerOpen(true)}>
                  + New supplier
                </Button>
              ) : null}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search suppliers"
                className="h-9 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 font-wds-sans text-wds-body-sm text-wds-text-ink placeholder:text-wds-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary"
              />
              {rows.length === 0 ? (
                <MobileEmptyState title="Nothing here yet" description="No suppliers with what-we-owe activity yet." />
              ) : (
                rows.map((row) => {
                  const oldest = oldestOverdueBucket(row);
                  return (
                    <button
                      key={row.supplierId}
                      type="button"
                      onClick={() => goToDetail(row.supplierId)}
                      className="flex flex-col gap-wds-1.5 rounded-wds-md border border-wds-border p-wds-3.5 text-left transition-colors hover:bg-wds-neutral-50 active:bg-wds-neutral-100"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-wds-sans text-wds-body font-medium text-wds-text-ink">{row.supplierName}</span>
                        <span className="font-wds-mono text-wds-body font-medium text-wds-text-ink">{formatPlainAmount(row.outstanding)}</span>
                      </div>
                      <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
                        {PAYMENT_TERMS_LABEL[row.paymentTerms]} · {formatLastActivity(row.lastInvoiceDate)}
                      </span>
                      {row.disputedCount > 0 || oldest ? (
                        <div className="mt-wds-0.5 flex items-center gap-wds-2">
                          {row.disputedCount > 0 ? (
                            <span className="rounded-wds-sm bg-wds-error-bg px-wds-1.5 py-0.5 font-wds-mono text-wds-label text-wds-error-fg">
                              {row.disputedCount} disputed
                            </span>
                          ) : null}
                          {oldest ? (
                            <span className="font-wds-mono text-wds-caption text-wds-caramel-600">
                              {oldest.label}: {oldest.amount}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
              {hasMore ? (
                <Button variant="secondary" className="w-full" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              ) : null}
            </>
          )}
        </div>
        <SupplierFormDrawer
          supplierId={null}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onSaved={reload}
          variant="mobile"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }}
        actions={canWrite ? <Button onClick={() => setDrawerOpen(true)}>New supplier</Button> : null}
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Suppliers</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            Who we buy from — payment terms and what we owe, how old the debt is.
          </p>
        </div>

        {status === 'loading' || status === 'idle' ? (
          <>
            <SuppliersKpiSkeletonDesktop />
            <SuppliersListSkeletonDesktop />
          </>
        ) : status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState title="Couldn't load suppliers" description={error ?? 'Try again.'} onRetry={reload} />
          </div>
        ) : (
          <>
            <KpiStrip cells={kpiCells} />

            <div className="mt-wds-4 flex items-center gap-2">
              <div className="flex h-8 min-w-60 items-center gap-2 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search suppliers"
                  className="w-full bg-transparent font-wds-sans text-wds-caption text-wds-text-ink placeholder:text-wds-text-faint focus-visible:outline-none"
                />
              </div>
              <select
                value={terms ?? ''}
                onChange={(e) => setTerms(e.target.value === '' ? undefined : (e.target.value as SupplierPaymentTerms))}
                className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 font-wds-sans text-wds-caption text-wds-text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary"
              >
                <option value="">All terms</option>
                <option value="INVOICE_TO_FOLLOW">Invoice</option>
                <option value="PAY_NOW">Paid on delivery</option>
              </select>
              <select
                value={hasBalance === undefined ? '' : String(hasBalance)}
                onChange={(e) => setHasBalance(e.target.value === '' ? undefined : e.target.value === 'true')}
                className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2.5 font-wds-sans text-wds-caption text-wds-text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wds-primary"
              >
                <option value="">Has balance: any</option>
                <option value="true">Has balance</option>
                <option value="false">No balance</option>
              </select>
              <span className="ml-auto font-wds-mono text-wds-label uppercase text-wds-text-copy-muted">
                {isRefetching ? 'Refreshing…' : `${rows.length} supplier${rows.length === 1 ? '' : 's'}`}
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState title="Nothing here yet" description="No suppliers with a what-we-owe balance yet." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <AgingBucketTable rows={tableRows} onRowClick={goToDetail} />
              </div>
            )}

            {hasMore ? (
              <div className="flex justify-center pb-4">
                <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <SupplierFormDrawer
        supplierId={null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSaved={reload}
        variant="desktop"
      />
    </div>
  );
}

