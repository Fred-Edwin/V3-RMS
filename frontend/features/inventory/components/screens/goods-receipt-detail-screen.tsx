'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Topbar } from '@/components/app/shell/topbar';
import { ErrorState } from '@/components/app/shell/shell-states';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DesktopOnlyNotice } from '../desktop-only-notice';
import { ReceiptLineListReadonly } from '../receipt-line-list-readonly';
import { SignedBySignature } from '../sign-sheet';
import { useGoodsReceiptDetail } from '../../hooks/use-goods-receipt-detail';

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  RECEIVED_INVOICE_PENDING: 'Received — invoice pending',
  RECEIVED_PAID: 'Received — paid',
  INVOICE_RECORDED: 'Invoice recorded',
  CANCELLED: 'Cancelled',
};

/**
 * Goods Receipt detail (signed) + print — screen 5 (`UVN-0`), desktop-only.
 * Read-only, immutable record. Deliberately omits any damaged-goods/
 * supplier-claim UI — that flow was retired 2026-09-15 (milestone-2-plan.md
 * §7 Q2); the artboard this screen is built from is stale on that point.
 */
export function GoodsReceiptDetailScreen({ id }: { id: string }) {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { receipt, status, error, reload } = useGoodsReceiptDetail(id);

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  if (!hydrated) return null;
  if (!isDesktop) return <DesktopOnlyNotice screen="Goods Receipt detail" hint="On mobile, use the Receiving worklist to start a receipt." />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden print:overflow-visible">
      <Topbar
        breadcrumb={{ section: 'Receiving', sectionHref: '/app/inventory/receiving', screen: 'Goods Receipt' }}
        actions={<Button onClick={handlePrint}>Print</Button>}
        className="shrink-0 print:hidden"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7 print:overflow-visible print:px-0 print:py-0">
        {status === 'loading' || status === 'idle' ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">Loading…</span>
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState title="Couldn't load this receipt" description={error ?? 'Try again.'} onRetry={reload} />
          </div>
        ) : !receipt || !receipt.signature ? (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState title="This receipt isn't signed yet" description="A signed record isn't available for this receipt." onRetry={reload} />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">{receipt.reference}</h1>
              <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
                {receipt.supplierName} · {statusLabels[receipt.status] ?? receipt.status} ·{' '}
                {receipt.supplierDocNumber ? `Doc ${receipt.supplierDocNumber}` : 'No document number recorded'}
              </p>
            </div>

            <ReceiptLineListReadonly lines={receipt.lines} />

            <div className="flex items-center justify-end gap-wds-2 border-t border-wds-border pt-wds-3">
              <span className="font-wds-mono text-wds-body font-semibold text-wds-text-ink">
                Total: KES {Number(receipt.receiptTotal).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-wds-1.5 rounded-wds-md border border-wds-border bg-wds-surface p-wds-4">
                <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Linked invoice</span>
                {receipt.linkedInvoice ? (
                  <span className="font-wds-sans text-wds-body-sm text-wds-text-ink">{receipt.linkedInvoice.invoiceNumber}</span>
                ) : (
                  <span className="font-wds-sans text-wds-body-sm text-wds-text-faint">Not recorded yet</span>
                )}
              </div>
              <div className="flex flex-col gap-wds-1.5 rounded-wds-md border border-wds-border bg-wds-surface p-wds-4">
                <SignedBySignature
                  label="RECEIVED & SIGNED BY"
                  name={receipt.signature.signedByName}
                  roleLine={`${receipt.signature.signedByRole} · ${formatDate(receipt.signature.signedAt)}`}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
