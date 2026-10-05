'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { useLoader } from '../../../_shared/hooks/use-async';
import { usePurchasing } from '../../hooks/use-purchasing';
import { fullDate, kes2, METHOD_LABEL, whenLabel } from '../../lib/format';
import type { PaymentAdvice } from '../../types';

const money = (v: string): string => kes2(v);

/**
 * Printed payment advice (Paper `21`, and `21b` when paid by cheque; A4 794 x 1123). It tells the supplier what was paid, how, and
 * which invoice it settles, with what was paid earlier and the balance left. Signed "Prepared by" the Accountant; no approval block
 * (owner decision, 5 Oct 2026: payments need no approval, only a reversal does). Standalone page, never a required step.
 */
export function PaymentAdvicePrintScreen({ paymentId }: { paymentId: string }) {
  const { service, ready } = usePurchasing();
  const { data, status, error } = useLoader<PaymentAdvice>(ready ? `advice:${paymentId}` : null, () => service.getPaymentAdvice(paymentId), 'We could not load this payment advice.');

  if (status === 'error') return <p className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-secondary">{error} Close this tab and try again.</p>;
  if (!data) return <p className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-secondary">Loading…</p>;

  const d = data;
  const isCheque = d.method === 'CHEQUE';
  const earlierNote = d.earlier.length
    ? `Earlier ${d.earlier.length === 1 ? 'payment' : 'payments'}: ${d.earlier
        .map((e) => `${e.kind === 'ADVANCE' ? 'advance ' : ''}${e.reference}, KES ${money(e.amount)}, paid ${fullDate(e.paidOn)} by ${METHOD_LABEL[e.method]}${e.methodRef ? ` (${e.methodRef})` : ''}`)
        .join('; ')}. `
    : '';
  const balanceNil = Number.parseFloat(d.balanceAfter) === 0;
  const time = new Date(d.preparedBy.signedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-wds-neutral-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-between px-1 print:hidden">
        <span className="rounded-[2px] border border-wds-warning-border bg-wds-warning-bg px-2 py-1 font-wds-sans text-[11px] text-wds-warning-fg">Demo data</span>
        <button type="button" onClick={() => window.print()} className="h-8 rounded-wds-sm bg-wds-primary px-4 font-wds-sans text-wds-body-sm font-medium text-white outline-none focus-visible:shadow-wds-ring">
          Print
        </button>
      </div>
      <article className="relative mx-auto flex min-h-[1123px] w-[794px] max-w-full flex-col bg-white px-12 pb-9 font-wds-sans text-[#111111] shadow-wds-md print:shadow-none">
        <div className="absolute inset-x-0 top-0 h-2.5 bg-[#0B2A4A]" aria-hidden />
        <header className="flex items-start justify-between border-b border-[#D5DCE4] pb-[22px] pt-10">
          <div className="flex items-center gap-3">
            <div className="size-[46px] rounded-full bg-cover bg-center" style={{ backgroundImage: 'url(/images/wendo-logo.jpg)' }} aria-hidden />
            <div className="flex flex-col">
              <span className="text-[20px] font-semibold leading-6 tracking-[-0.01em]">Wendo Coffee Bistro</span>
              <span className="text-[12px] leading-4 text-[#55626F]">Central Store · Nyeri, Kenya</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.14em] text-[#55626F]">PAYMENT ADVICE</span>
            <span className="font-wds-mono text-[26px] font-semibold leading-8">{d.reference}</span>
            <span className="text-[12px] leading-4 text-[#55626F]">{fullDate(d.date)}</span>
          </div>
        </header>

        <section className="flex gap-8 py-5">
          <div className="flex w-1/2 flex-col gap-1">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.1em] text-[#55626F]">PAID BY</span>
            <span className="text-[15px] font-semibold leading-[18px]">Wendo Coffee Bistro</span>
            <span className="text-[12px] leading-4">Central Store, Nyeri</span>
          </div>
          <div className="w-px bg-[#D5DCE4]" />
          <div className="flex grow flex-col gap-1">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.1em] text-[#55626F]">PAID TO</span>
            <span className="text-[15px] font-semibold leading-[18px]">{d.supplier.name}</span>
            <span className="text-[12px] leading-4">{d.supplier.address}</span>
            {d.supplier.kraPin ? <span className="text-[12px] leading-4">KRA PIN {d.supplier.kraPin}</span> : null}
          </div>
        </section>

        <section className="flex items-start justify-between gap-8 pb-4">
          <div className="flex gap-12">
            <div className="flex flex-col gap-1">
              <span className="font-wds-mono text-[10px] leading-3 tracking-[0.1em] text-[#55626F]">METHOD</span>
              <span className="text-[15px] leading-[18px]">{METHOD_LABEL[d.method]}</span>
              {d.methodDetail ? <span className="text-[12px] leading-4 text-[#55626F]">{d.methodDetail}</span> : null}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-wds-mono text-[10px] leading-3 tracking-[0.1em] text-[#55626F]">{isCheque ? 'CHEQUE NUMBER' : 'REFERENCE'}</span>
              <span className="font-wds-mono text-[15px] leading-[18px]">{(isCheque ? d.chequeNo : d.methodRef) || '—'}</span>
            </div>
          </div>
          <div className="flex w-[300px] shrink-0 items-center justify-between border-y-[3px] border-[#C9CED3] py-3">
            <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">AMOUNT PAID</span>
            <span className="font-wds-mono text-[24px] font-semibold leading-7">KES {money(d.amountPaid)}</span>
          </div>
        </section>

        <section className="flex flex-col gap-1 pb-5">
          <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">AMOUNT IN WORDS</span>
          <span className="text-[13px] leading-[18px]">{d.amountInWords}</span>
        </section>

        <section className="flex flex-col pb-3">
          <span className="pb-2 font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">INVOICES SETTLED</span>
          <div className="flex h-8 items-center border-b-2 border-[#0B2A4A]">
            <span className="w-[110px] font-wds-mono text-[10px] tracking-[0.08em]">INVOICE</span>
            <span className="w-[110px] font-wds-mono text-[10px] tracking-[0.08em]">ORDER</span>
            <span className="grow text-right font-wds-mono text-[10px] tracking-[0.08em]">INVOICE TOTAL</span>
            <span className="w-[110px] text-right font-wds-mono text-[10px] tracking-[0.08em]">PAID EARLIER</span>
            <span className="w-[110px] text-right font-wds-mono text-[10px] tracking-[0.08em]">APPLIED NOW</span>
            <span className="w-[80px] text-right font-wds-mono text-[10px] tracking-[0.08em]">BALANCE</span>
          </div>
          <div className="flex h-11 items-center border-b border-[#E3E8EE]">
            <span className="w-[110px] font-wds-mono text-[13px]">{d.invoiceNumber}</span>
            <span className="w-[110px] font-wds-mono text-[13px]">{d.orderReference}</span>
            <span className="grow text-right font-wds-mono text-[13px]">{money(d.invoiceAmount)}</span>
            <span className="w-[110px] text-right font-wds-mono text-[13px]">{money(d.paidBefore)}</span>
            <span className="w-[110px] text-right font-wds-mono text-[13px] font-semibold">{money(d.amountPaid)}</span>
            <span className="w-[80px] text-right font-wds-mono text-[13px]">{money(d.balanceAfter)}</span>
          </div>
          <p className="pt-3 text-[11px] leading-[16px] text-[#55626F]">
            {earlierNote}Balance on this invoice after this payment: {balanceNil ? 'nil' : `KES ${money(d.balanceAfter)}`}.
          </p>
        </section>

        <div className="grow" />

        <section className="flex items-end gap-8 py-5">
          <div className="flex w-[300px] flex-col gap-1">
            <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">PREPARED BY</span>
            <div className="flex h-[50px] items-end border-b border-[#111111] pb-0.5">
              <span className="font-wds-signature text-[36px] leading-10">{d.preparedBy.name}</span>
            </div>
            <span className="text-[12px] leading-4">
              {d.preparedBy.name} · {d.preparedBy.role}
            </span>
            <span className="text-[10px] leading-3 text-[#55626F]">
              Signed with PIN · {fullDate(d.preparedBy.signedAt)}, {time}
            </span>
          </div>
          <div className="ml-auto flex flex-col items-center gap-1">
            <QRCodeSVG value={typeof window === 'undefined' ? d.reference : `${window.location.origin}/app/inventory/purchasing`} size={64} marginSize={0} aria-label={`QR code for ${d.reference}`} />
            <span className="text-[10px] leading-3 text-[#55626F]">Scan to verify {d.reference}</span>
          </div>
        </section>

        <section className="flex flex-col gap-2 border border-[#D5DCE4] p-4">
          <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">SUPPLIER RECEIPT</span>
          <p className="text-[12px] leading-4">
            We confirm receipt of KES {money(d.amountPaid)} against {d.invoiceNumber}.
          </p>
          <div className="mt-4 flex gap-8">
            <div className="flex grow flex-col gap-1">
              <div className="h-[14px] border-b border-[#111111]" />
              <span className="text-[10px] text-[#55626F]">Name, signature and stamp</span>
            </div>
            <div className="flex w-[150px] flex-col gap-1">
              <div className="h-[14px] border-b border-[#111111]" />
              <span className="text-[10px] text-[#55626F]">Date</span>
            </div>
          </div>
        </section>

        <footer className="mt-5 flex items-end justify-between pt-3 text-[10px] leading-3 text-[#55626F]">
          <div className="flex flex-col gap-0.5">
            <span>Generated by Wendo RMS · Designed and developed by Lobster Technologies</span>
            <span className="font-wds-mono">
              {d.reference} · Generated {fullDate(d.generatedAt)}, {whenLabel(d.generatedAt).replace(/^.* (\d\d:\d\d)$/, '$1')} · Page 1 of 1
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[#111111]">lobstertechnologies.co.ke</span>
            <span>+254 113 176 613</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
