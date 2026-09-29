'use client';

import * as React from 'react';

import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { MobileErrorState, MobileLoadingState } from '@/components/app/shell/mobile-states';
import { cn } from '@/lib/cn';
import type { SupplierPaymentTerms } from '../../types';
import type { GoodsReceiptDetail, GoodsReceiptLine } from '../../types/receiving';

/**
 * Goods Receipt detail (signed) — phone layout. Paper "Pre-Demo · Phone
 * screens" artboard 1. Read-only, immutable record; the Store Attendant lands
 * here right after signing. No Print action on a phone by design. The retired
 * damaged-goods/supplier-claim note is intentionally not drawn here (see the
 * desktop screen's header) — only persisted price alerts and the linked
 * invoice appear under Notes.
 */
export interface GoodsReceiptDetailMobileProps {
  status: 'idle' | 'loading' | 'error' | 'ready';
  error: string | null;
  receipt: GoodsReceiptDetail | null;
  statusLabel: string;
  onRetry: () => void;
  onBack: () => void;
}

const TERMS_LABEL: Record<SupplierPaymentTerms, string> = {
  INVOICE_TO_FOLLOW: 'Invoice',
  PAY_NOW: 'Paid on delivery',
};

function formatDay(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatStamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${formatDay(iso)}, ${parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

const roleLabel = (role: string) => role.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const formatKes = (value: string) => `KES ${Number(value).toLocaleString('en-KE')}`;

function priceAlertText(line: GoodsReceiptLine): string | null {
  const alert = line.priceAlert;
  if (!alert) return null;
  const pct = Number(alert.percentAboveLast);
  const pctLabel = Number.isFinite(pct) ? `${pct}%` : alert.percentAboveLast;
  const base = `Price alert — ${line.itemName} entered at KES ${line.unitPrice}, ${pctLabel} above last price (KES ${alert.previousPrice}).`;
  return alert.acceptedByName ? `${base} Accepted by ${alert.acceptedByName}.` : base;
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-[calc(50%-12px)] flex-col gap-0.5">
      <span className="font-wds-mono text-[10px] leading-[14px] tracking-[0.04em] text-wds-text-faint">{label}</span>
      <span className="break-words font-wds-sans text-wds-body text-wds-text-ink">{value}</span>
    </div>
  );
}

export function GoodsReceiptDetailMobile({ status, error, receipt, statusLabel, onRetry, onBack }: GoodsReceiptDetailMobileProps) {
  const signed = receipt?.signature ? receipt : null;
  const alerts = signed ? signed.lines.map(priceAlertText).filter((text): text is string => text !== null) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
      <MobileStatusBar />
      <MobileTaskHeader
        title={receipt?.reference ?? 'Goods receipt'}
        subtitle="Central Store — Goods Receipt"
        trailingAction="Done"
        onBack={onBack}
        onTrailingAction={onBack}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8 pt-5">
        {status === 'loading' || status === 'idle' ? (
          <MobileLoadingState rows={3} />
        ) : status === 'error' ? (
          <MobileErrorState title="Couldn't load this receipt" description={error ?? 'Try again.'} onRetry={onRetry} />
        ) : !signed || !signed.signature ? (
          <MobileErrorState title="This receipt isn't signed yet" description="A signed record isn't available for this receipt." onRetry={onRetry} />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-0.75">
                <span className="inline-flex items-center gap-1.5 font-wds-sans text-wds-body-sm font-medium text-wds-info-fg">
                  <span className="size-1.5 shrink-0 rounded-wds-full bg-wds-info-fg" aria-hidden />
                  {statusLabel}
                </span>
                <span className="font-wds-sans text-wds-caption text-wds-text-faint">Immutable record — corrections are a new adjustment</span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3.5 border-b-2 border-wds-text-ink pb-4">
                <MetaCell label="SUPPLIER" value={signed.supplierName} />
                <MetaCell label="DELIVERY NOTE" value={signed.supplierDocNumber ?? '—'} />
                <MetaCell label="TERMS" value={TERMS_LABEL[signed.paymentTerms] ?? signed.paymentTerms} />
                <MetaCell label="RECEIVED" value={formatDay(signed.signature.signedAt)} />
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex justify-between border-b border-wds-text-ink pb-2">
                <span className="font-wds-mono text-[10px] leading-[14px] tracking-[0.04em] text-wds-neutral-700">ITEM</span>
                <span className="font-wds-mono text-[10px] leading-[14px] tracking-[0.04em] text-wds-neutral-700">AMOUNT</span>
              </div>
              {signed.lines.map((line, index) => (
                <div
                  key={line.id}
                  className={cn(
                    'flex items-start justify-between gap-3 py-3',
                    index === signed.lines.length - 1 ? 'border-b border-wds-text-ink' : 'border-b border-wds-border',
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-wds-sans text-wds-body text-wds-text-ink">{line.itemName}</span>
                    <span className="font-wds-mono text-wds-caption text-wds-text-copy-muted">
                      {line.quantityBuyUnit} {line.buyUnit} · @ {line.unitPrice}
                    </span>
                  </div>
                  <span className="w-[96px] shrink-0 text-right font-wds-mono text-wds-body text-wds-text-ink">{formatKes(line.lineTotal)}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-3.5">
                <span className="font-wds-mono text-wds-label tracking-[0.04em] text-wds-text-copy-muted">RECEIPT TOTAL</span>
                <span className="font-wds-sans text-[22px] font-semibold leading-7 text-wds-text-ink">{formatKes(signed.receiptTotal)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="font-wds-mono text-[10px] leading-[14px] tracking-[0.04em] text-wds-text-faint">NOTES</span>
                <div className="h-px flex-1 bg-wds-border" />
              </div>
              {alerts.map((text) => (
                <p key={text} className="border-l-2 border-wds-border-strong pl-3 font-wds-sans text-wds-body-sm text-wds-neutral-700">
                  {text}
                </p>
              ))}
              <div className="flex justify-between gap-3 border-l-2 border-wds-border-strong pl-3">
                <span className="font-wds-sans text-wds-body-sm text-wds-neutral-700">Linked supplier invoice</span>
                <span className={cn('font-wds-sans text-wds-body-sm', signed.linkedInvoice ? 'text-wds-text-ink' : 'text-wds-text-faint')}>
                  {signed.linkedInvoice ? signed.linkedInvoice.invoiceNumber : 'Not recorded yet'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-t border-wds-border pt-4">
              <span className="font-wds-signature text-[34px] leading-10 text-wds-text-ink">{signed.signature.signedByName}</span>
              <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
                Signed by {roleLabel(signed.signature.signedByRole)} · {formatStamp(signed.signature.signedAt)}
              </span>
              <span className="font-wds-sans text-wds-caption text-wds-text-faint">
                This is the signed record. Corrections require a separate adjustment.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
