'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { StatusDot, type StatusTone } from '@/components/ui2/status-dot';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { Topbar } from '@/components/app/shell/topbar';
import { ErrorState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { MobileErrorState, MobilePermissionDeniedState } from '@/components/app/shell/mobile-states';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AgingBucketPanel, type AgingBucketPanelCell } from '../aging-bucket-panel';
import { SupplierDetailSkeletonDesktop, SupplierDetailSkeletonMobile } from '../skeletons';
import { useMobileNavDrawer } from '../../hooks/use-mobile-nav-drawer';
import { useSupplierApDetail } from '../../hooks/use-supplier-ap-detail';
import { SupplierFormDrawer } from './supplier-form-screen';
import { RecordSupplierPaymentDrawer } from './record-supplier-payment-drawer';
import { RecordSupplierInvoiceDrawer } from './record-supplier-invoice-drawer';
import type { GoodsReceiptDetail, SupplierInvoice, SupplierPayment } from '../../types/receiving';
import type { SupplierPaymentTerms } from '../../types';

const PAYMENT_TERMS_LABEL: Record<SupplierPaymentTerms, string> = {
  INVOICE_TO_FOLLOW: 'Invoice',
  PAY_NOW: 'Paid on delivery',
};

function formatPlainAmount(amount: string): string {
  const n = Number(amount);
  return Number.isFinite(n) ? n.toLocaleString() : amount;
}

function formatDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
}

/** Dispute takes visual precedence over payment status, per plan §1.3's UI-render rule. */
function invoiceStatusView(invoice: SupplierInvoice): { label: string; tone: StatusTone } {
  if (invoice.dispute?.status === 'OPEN') return { label: `Disputed — KES ${formatPlainAmount(invoice.dispute.ourFigure)}`, tone: 'error' };
  if (invoice.status === 'PAID') return { label: 'Paid', tone: 'success' };
  if (invoice.status === 'PARTIALLY_PAID') return { label: 'Partly paid', tone: 'info' };
  return { label: 'Unpaid', tone: 'neutral' };
}

const RECEIPT_STATUS_VIEW: Record<GoodsReceiptDetail['status'], { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  RECEIVED_INVOICE_PENDING: { label: 'Received — invoice pending', tone: 'neutral' },
  RECEIVED_PAID: { label: 'Received — paid', tone: 'success' },
  INVOICE_RECORDED: { label: 'Invoice recorded', tone: 'info' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

/** Merges the last two buckets into "60+ days" for display only — plan §7 Q4. */
function toBucketPanelCells(buckets: {
  current: string;
  days1To30: string;
  days31To60: string;
  days61To90: string;
  days90Plus: string;
}): { current: AgingBucketPanelCell; oneToThirty: AgingBucketPanelCell; thirtyOneToSixty: AgingBucketPanelCell; sixtyPlus: AgingBucketPanelCell } {
  const cell = (label: string, amount: string, tone: AgingBucketPanelCell['tone']): AgingBucketPanelCell => ({
    label,
    amountLabel: Number(amount) > 0 ? formatPlainAmount(amount) : '–',
    tone,
  });
  const sixtyPlus = (Number(buckets.days61To90) + Number(buckets.days90Plus)).toString();
  return {
    current: cell('CURRENT', buckets.current, 'neutral'),
    oneToThirty: cell('1-30 DAYS', buckets.days1To30, 'warning'),
    thirtyOneToSixty: cell('31-60 DAYS', buckets.days31To60, 'warning'),
    sixtyPlus: cell('60+ DAYS', sixtyPlus, 'error'),
  };
}

/**
 * Supplier detail — "what we owe" panel (`VND-0` desktop, `WZF-0` mobile).
 * Milestone Two S8. Profile fields (phone/email/paymentDays) and purchase
 * history both come from the 2026-09-18 backend amendment to
 * `GET /inventory/ap/suppliers/:id` — see `receiving-validators.ts`'s header
 * for the amendment record.
 *
 * Confirms the §1.5 three-way reconciliation invariant by construction: this
 * screen's `row` and the Suppliers screen's row for the same supplier come
 * from the identical `buildSupplierApRow` derivation server-side — never a
 * separate calculation here.
 *
 * "Reconcile statement" stays inert — Flow 17's reconciliation workspace is
 * out of scope this milestone (plan §7 Q6).
 */
export function SupplierDetailScreen({ id }: { id: string }) {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const { open: openMobileNav } = useMobileNavDrawer();
  const [editDrawerOpen, setEditDrawerOpen] = React.useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = React.useState(false);
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = React.useState(false);

  const { detail, status, error, isForbidden, reload } = useSupplierApDetail(id);

  if (!hydrated) return null;

  if (isForbidden) {
    const description = 'What we owe is visible to Store Managers, the Accountant, and Directors only.';
    return isDesktop ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <PermissionDeniedState description={description} />
        </div>
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader title="Supplier" subtitle="What we owe" userInitials="JM" onMenuClick={openMobileNav} />
        <div className="flex flex-1 items-center justify-center p-4">
          <MobilePermissionDeniedState description={description} />
        </div>
      </div>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return isDesktop ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }} className="shrink-0" />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-7">
          <SupplierDetailSkeletonDesktop />
        </div>
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader title="Supplier" subtitle="" userInitials="JM" onMenuClick={openMobileNav} />
        <div className="flex-1 p-4">
          <SupplierDetailSkeletonMobile />
        </div>
      </div>
    );
  }

  if (status === 'error' || !detail) {
    return isDesktop ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={{ section: 'Central Store', screen: 'Suppliers' }} className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <ErrorState title="Couldn't load this supplier" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader title="Supplier" subtitle="" userInitials="JM" onMenuClick={openMobileNav} />
        <div className="flex flex-1 items-center justify-center p-4">
          <MobileErrorState title="Couldn't load this supplier" description={error ?? 'Try again.'} onRetry={reload} />
        </div>
      </div>
    );
  }

  const { supplier, row, invoices, payments, purchaseHistory } = detail;
  const bucketCells = toBucketPanelCells(row.buckets);

  const profileRows: { label: string; value: string }[] = [
    { label: 'CONTACT', value: supplier.contactName ?? '—' },
    { label: 'PHONE', value: supplier.phone ?? '—' },
    { label: 'EMAIL', value: supplier.email ?? '—' },
    { label: 'CATEGORY', value: supplier.category?.name ?? '—' },
    { label: 'LOCATION', value: supplier.location ?? '—' },
  ];

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
        <MobileStatusBar />
        <div className="flex flex-col gap-4 bg-wds-sidebar-mid px-5 pb-4.5 pt-3.5">
          <div className="flex items-center">
            <button type="button" onClick={() => router.push('/app/inventory/suppliers')} className="rounded-wds-sm p-1 transition-colors hover:bg-white/10 active:bg-white/15" aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#B5AEA5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" onClick={() => setEditDrawerOpen(true)} className="ml-auto font-wds-sans text-wds-body-sm font-medium text-wds-caramel-500 transition-opacity hover:opacity-80 active:opacity-70">
              Edit
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-wds-sans text-[22px] font-semibold leading-7 text-wds-surface">{supplier.name}</span>
            <span className="flex items-center gap-1.5 font-wds-sans text-wds-body-sm text-[#B5AEA5]">
              <span className="size-1.5 shrink-0 rounded-wds-full bg-wds-caramel-500" aria-hidden />
              Default terms — {PAYMENT_TERMS_LABEL[supplier.defaultPaymentTerms]}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-6 p-5">
          <div className="flex flex-col rounded-wds-md border border-wds-border">
            {profileRows.map((r, i) => (
              <div key={r.label} className={`flex justify-between px-wds-3.5 py-3 ${i < profileRows.length - 1 ? 'border-b border-wds-neutral-100' : ''}`}>
                <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">{r.label}</span>
                <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">{r.value}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">What we owe</span>
              <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">Store Manager, Accountant & Directors only</span>
            </div>
            <AgingBucketPanel
              current={bucketCells.current}
              oneToThirty={bucketCells.oneToThirty}
              thirtyOneToSixty={bucketCells.thirtyOneToSixty}
              sixtyPlus={bucketCells.sixtyPlus}
              outstanding={{ label: 'OUTSTANDING', amountLabel: formatPlainAmount(row.outstanding), tone: 'neutral', emphasized: true }}
              className="flex-wrap [&>div]:basis-1/2 [&>div]:border-b [&>div]:border-wds-border [&>div:nth-child(2n)]:border-r-0 [&>div:nth-last-child(-n+2)]:border-b-0"
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled title="Statement reconciliation is a later milestone">
                Reconcile
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setInvoiceDrawerOpen(true)}>
                Record invoice
              </Button>
              <Button className="flex-1" onClick={() => setPaymentDrawerOpen(true)}>
                Record payment
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-wds-mono text-wds-label text-wds-text-ink">INVOICES</span>
            {invoices.length === 0 ? (
              <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">No invoices yet.</p>
            ) : (
              <div className="flex flex-col rounded-wds-md border border-wds-border">
                {invoices.map((inv, i) => {
                  const v = invoiceStatusView(inv);
                  return (
                    <div key={inv.id} className={`flex items-center justify-between px-wds-3.5 py-3 ${i < invoices.length - 1 ? 'border-b border-wds-neutral-100' : ''}`}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">{inv.invoiceNumber}</span>
                        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{formatDate(inv.invoiceDate)} · billed KES {formatPlainAmount(inv.amountBilled)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-wds-mono text-wds-body-sm text-wds-text-ink">{formatPlainAmount(inv.outstanding)}</span>
                        <StatusDot tone={v.tone} className="text-wds-label">{v.label}</StatusDot>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-wds-sans text-wds-section font-semibold text-wds-text-ink">Purchase history</span>
            {purchaseHistory.length === 0 ? (
              <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">No receipts yet.</p>
            ) : (
              <div className="flex flex-col rounded-wds-md border border-wds-border">
                {purchaseHistory.map((receipt, i) => (
                  <div key={receipt.id} className={`flex items-center justify-between px-wds-3.5 py-3 ${i < purchaseHistory.length - 1 ? 'border-b border-wds-neutral-100' : ''}`}>
                    <span className="font-wds-mono text-wds-caption text-wds-text-ink">{receipt.reference}</span>
                    <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
                      {receipt.lines.length} line{receipt.lines.length === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <SupplierFormDrawer
          supplierId={id}
          open={editDrawerOpen}
          onOpenChange={setEditDrawerOpen}
          onSaved={reload}
          variant="mobile"
        />
        <RecordSupplierInvoiceDrawer
          supplierId={id}
          supplierName={supplier.name}
          open={invoiceDrawerOpen}
          onOpenChange={setInvoiceDrawerOpen}
          onRecorded={reload}
          variant="mobile"
        />
        <RecordSupplierPaymentDrawer
          supplierId={id}
          supplierName={supplier.name}
          open={paymentDrawerOpen}
          onOpenChange={setPaymentDrawerOpen}
          onRecorded={reload}
          variant="mobile"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Central Store', screen: `Suppliers / ${supplier.name}`, sectionHref: '/app/inventory/suppliers' }}
        actions={<Button variant="secondary" onClick={() => setEditDrawerOpen(true)}>Edit supplier</Button>}
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">{supplier.name}</h1>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-wds-full bg-wds-info-fg" aria-hidden />
              <span className="font-wds-sans text-wds-caption text-wds-info-fg">
                Default terms — {PAYMENT_TERMS_LABEL[supplier.defaultPaymentTerms]}
              </span>
            </span>
          </div>
          <div className="flex gap-10 rounded-wds-md border border-wds-border bg-wds-neutral-50 px-wds-4 py-3.5">
            {profileRows.map((r) => (
              <div key={r.label} className="flex flex-col gap-0.75">
                <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">{r.label}</span>
                <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3.5 rounded-wds-md border border-wds-border bg-wds-surface p-wds-4.5">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2.5">
              <span className="font-wds-sans text-wds-body font-semibold text-wds-text-ink">What we owe</span>
              <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Store Manager, Accountant &amp; Directors only</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled title="Statement reconciliation is a later milestone">
                Reconcile statement
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setInvoiceDrawerOpen(true)}>
                Record invoice
              </Button>
              <Button size="sm" onClick={() => setPaymentDrawerOpen(true)}>
                Record payment
              </Button>
            </div>
          </div>
          <AgingBucketPanel
            current={bucketCells.current}
            oneToThirty={bucketCells.oneToThirty}
            thirtyOneToSixty={bucketCells.thirtyOneToSixty}
            sixtyPlus={bucketCells.sixtyPlus}
            outstanding={{ label: 'OUTSTANDING', amountLabel: formatPlainAmount(row.outstanding), tone: 'neutral', emphasized: true }}
          />
          <div className="flex gap-4">
            <div className="flex grow flex-col overflow-hidden rounded-wds-md border border-wds-border">
              <div className="flex h-8 shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-3">
                <span className="grow font-wds-mono text-wds-label font-semibold text-wds-text-ink">INVOICE</span>
                <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-label font-semibold text-wds-text-ink">OUTSTANDING</span>
                <span className="w-[130px] shrink-0 pl-5 font-wds-mono text-wds-label font-semibold text-wds-text-ink">STATUS</span>
              </div>
              {invoices.length === 0 ? (
                <p className="p-wds-3.5 font-wds-sans text-wds-caption text-wds-text-copy-muted">No invoices yet.</p>
              ) : (
                invoices.map((inv, i) => {
                  const v = invoiceStatusView(inv);
                  return (
                    <div key={inv.id} className={`flex h-11 shrink-0 items-center px-wds-3 ${i < invoices.length - 1 ? 'border-b border-wds-neutral-100' : ''}`}>
                      <div className="flex grow flex-col gap-px">
                        <span className="font-wds-mono text-wds-caption text-wds-text-ink">{inv.invoiceNumber}</span>
                        <span className="font-wds-sans text-wds-label text-wds-text-copy-muted">{formatDate(inv.invoiceDate)} · billed KES {formatPlainAmount(inv.amountBilled)}</span>
                      </div>
                      <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-ink">{formatPlainAmount(inv.outstanding)}</span>
                      <div className="flex w-[130px] shrink-0 items-center pl-5">
                        <StatusDot tone={v.tone} className="text-wds-caption">{v.label}</StatusDot>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex grow flex-col overflow-hidden rounded-wds-md border border-wds-border">
              <div className="flex h-8 shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-3">
                <span className="grow font-wds-mono text-wds-label font-semibold text-wds-text-ink">PAYMENT</span>
                <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-label font-semibold text-wds-text-ink">AMOUNT</span>
              </div>
              {payments.length === 0 ? (
                <p className="p-wds-3.5 font-wds-sans text-wds-caption text-wds-text-copy-muted">No payments yet.</p>
              ) : (
                payments.map((pay: SupplierPayment, i) => (
                  <div key={pay.id} className={`flex h-11 shrink-0 items-center px-wds-3 ${i < payments.length - 1 ? 'border-b border-wds-neutral-100' : ''}`}>
                    <div className="flex grow flex-col gap-px">
                      <span className="font-wds-sans text-wds-caption text-wds-text-ink">{formatDate(pay.paidAt)} · {pay.method === 'BANK' ? 'Bank transfer' : pay.method === 'MPESA' ? 'M-Pesa' : 'Cash'}</span>
                      <span className="font-wds-mono text-wds-label text-wds-text-copy-muted">
                        {pay.reference ? `ref ${pay.reference} · ` : ''}
                        {pay.allocations.map((a) => a.invoiceNumber).join(', ') || 'unallocated'}
                      </span>
                    </div>
                    <span className="w-[100px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-ink">{formatPlainAmount(pay.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-wds-4">
            <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">Purchase history</span>
            <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">receipts from this supplier</span>
          </div>
          <div className="flex h-7.5 shrink-0 items-center border-b border-wds-text-ink bg-wds-table-header-bg px-wds-4">
            <span className="w-[130px] shrink-0 font-wds-mono text-wds-label font-semibold text-wds-text-ink">REF</span>
            <span className="grow font-wds-mono text-wds-label font-semibold text-wds-text-ink">LINES</span>
            <span className="w-[90px] shrink-0 font-wds-mono text-wds-label font-semibold text-wds-text-ink">DATE</span>
            <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-label font-semibold text-wds-text-ink">VALUE</span>
            <span className="w-[200px] shrink-0 pl-7 font-wds-mono text-wds-label font-semibold text-wds-text-ink">STATUS</span>
          </div>
          {purchaseHistory.length === 0 ? (
            <p className="p-wds-4 font-wds-sans text-wds-caption text-wds-text-copy-muted">No receipts yet.</p>
          ) : (
            purchaseHistory.map((receipt, i) => {
              const v = RECEIPT_STATUS_VIEW[receipt.status];
              return (
                <div key={receipt.id} className={`flex h-11 shrink-0 items-center px-wds-4 ${i < purchaseHistory.length - 1 ? 'border-b border-wds-neutral-100' : ''}`}>
                  <span className="w-[130px] shrink-0 font-wds-mono text-wds-caption text-wds-text-ink">{receipt.reference}</span>
                  <span className="grow font-wds-sans text-wds-body-sm text-wds-text-ink">
                    {receipt.lines.length} line{receipt.lines.length === 1 ? '' : 's'}
                  </span>
                  <span className="w-[90px] shrink-0 font-wds-mono text-wds-caption text-wds-text-copy-muted">{formatDate(receipt.createdAt)}</span>
                  <span className="w-[110px] shrink-0 text-right font-wds-mono text-wds-body-sm text-wds-text-ink">KES {formatPlainAmount(receipt.receiptTotal)}</span>
                  <div className="flex w-[200px] shrink-0 items-center pl-7">
                    <StatusDot tone={v.tone} className="text-wds-caption">{v.label}</StatusDot>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <SupplierFormDrawer
        supplierId={id}
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        onSaved={reload}
        variant="desktop"
      />
      <RecordSupplierInvoiceDrawer
        supplierId={id}
        supplierName={supplier.name}
        open={invoiceDrawerOpen}
        onOpenChange={setInvoiceDrawerOpen}
        onRecorded={reload}
        variant="desktop"
      />
      <RecordSupplierPaymentDrawer
        supplierId={id}
        supplierName={supplier.name}
        open={paymentDrawerOpen}
        onOpenChange={setPaymentDrawerOpen}
        onRecorded={reload}
        variant="desktop"
      />
    </div>
  );
}
