'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { useLoader } from '../../../_shared/hooks/use-async';
import { usePurchasing } from '../../hooks/use-purchasing';
import { fullDate, qty as fmtQty, whenLabel } from '../../lib/format';
import type { LpoPrint } from '../../types';

/**
 * Printed LPO (Paper `09`, A4 794 x 1123): the supplier's own item names and codes first, ours second; signed Raised by and
 * Authorised by in the signature font; a QR to the order; a block for the supplier to sign back. Standalone page (no sidebar),
 * opened from the file. Printing is never a required step.
 */
export function LpoPrintScreen({ orderId }: { orderId: string }) {
  const { service, ready } = usePurchasing();
  const { data, status, error } = useLoader<LpoPrint>(ready ? `lpo:${orderId}` : null, () => service.getLpo(orderId), 'We could not load this LPO.');

  if (status === 'error') return <p className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-secondary">{error} Close this tab and try again.</p>;
  if (!data) return <p className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-secondary">Loading…</p>;

  const d = data;
  return (
    <div className="min-h-screen bg-wds-neutral-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-between px-1 print:hidden">
        <span className="rounded-[2px] border border-wds-warning-border bg-wds-warning-bg px-2 py-1 font-wds-sans text-[11px] text-wds-warning-fg">Demo data</span>
        <button type="button" onClick={() => window.print()} className="h-8 rounded-wds-sm bg-wds-primary px-4 font-wds-sans text-wds-body-sm font-medium text-white outline-none focus-visible:shadow-wds-ring">
          Print
        </button>
      </div>
      <article className="relative mx-auto flex min-h-[1123px] w-[794px] max-w-full flex-col bg-white px-12 pb-9 font-wds-sans text-[#111111] shadow-wds-md print:shadow-none">
        <header className="flex items-start justify-between border-b border-[#D5DCE4] pb-[22px] pt-10">
          <div className="flex items-center gap-3">
            <div className="size-[46px] rounded-full bg-cover bg-center" style={{ backgroundImage: 'url(/images/wendo-logo.jpg)' }} aria-hidden />
            <div className="flex flex-col">
              <span className="text-[20px] font-semibold leading-6 tracking-[-0.01em]">Wendo Coffee Bistro</span>
              <span className="text-[12px] leading-4 text-[#55626F]">Central Store · Nyeri, Kenya</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.14em] text-[#55626F]">LOCAL PURCHASE ORDER</span>
            <span className="font-wds-mono text-[26px] font-semibold leading-8">{d.reference}</span>
            <span className="text-[12px] leading-4 text-[#55626F]">{fullDate(d.date)}</span>
          </div>
        </header>

        <section className="flex gap-8 border-b border-[#D5DCE4] py-5">
          <div className="flex w-1/2 flex-col gap-1">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.1em] text-[#55626F]">SUPPLIER</span>
            <span className="text-[15px] font-semibold leading-[18px]">{d.supplier.name}</span>
            <span className="text-[12px] leading-4 text-[#55626F]">{d.supplier.address}</span>
            <span className="text-[12px] leading-4">{[d.supplier.contact, d.supplier.phone].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="w-px bg-[#D5DCE4]" />
          <dl className="grid grow grid-cols-2 gap-x-6 gap-y-3">
            {[
              ['Expected delivery', d.expectedDate ? fullDate(d.expectedDate) : '—'],
              ['Payment terms', d.termsLabel],
              ['Deliver to', d.deliverTo],
              ['Raised by', d.raisedByName],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="text-[11px] leading-[14px] text-[#55626F]">{k}</dt>
                <dd className="text-[13px] leading-4">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col py-4">
          <div className="flex h-8 items-center gap-0 border-b-2 border-[#0B2A4A] px-2.5">
            <span className="w-7 font-wds-mono text-[10px] tracking-[0.08em]">#</span>
            <span className="grow font-wds-mono text-[10px] tracking-[0.08em]">ITEM</span>
            <span className="w-14 text-right font-wds-mono text-[10px] tracking-[0.08em]">QTY</span>
            <span className="w-20 pl-3 font-wds-mono text-[10px] tracking-[0.08em]">UNIT</span>
          </div>
          {d.lines.map((l) => (
            <div key={l.n} className="flex min-h-12 items-center border-b border-[#E3E8EE] px-2.5 py-1.5">
              <span className="w-7 text-[13px]">{l.n}</span>
              <div className="flex grow flex-col gap-0.5">
                <span className="flex items-baseline gap-2">
                  <span className="text-[13px] leading-4 text-black">{l.supplierItemName}</span>
                  {l.supplierItemCode ? <span className="font-wds-mono text-[11px] text-[#555555]">{l.supplierItemCode}</span> : null}
                </span>
                <span className="text-[11px] leading-[14px] text-[#555555]">Our item: {l.ourItemName}</span>
              </div>
              <span className="w-14 text-right font-wds-mono text-[13px]">{fmtQty(l.qty)}</span>
              <span className="w-20 pl-3 text-[13px]">{l.unit}</span>
            </div>
          ))}
        </section>

        {d.note ? (
          <section className="flex flex-col gap-1 border-t border-[#D5DCE4] py-3">
            <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">NOTES TO THE SUPPLIER</span>
            <p className="max-w-[560px] text-[12px] leading-[17px]">{d.note}</p>
          </section>
        ) : null}

        <section className="flex items-end gap-8 border-t border-[#D5DCE4] py-5">
          {[
            ['RAISED BY', d.raisedBy],
            ['AUTHORISED BY', d.authorisedBy],
          ].map(([label, who]) => {
            const s = who as LpoPrint['raisedBy'];
            return (
              <div key={label as string} className="flex w-[220px] flex-col gap-1">
                <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">{label as string}</span>
                <div className="flex h-[50px] items-end border-b border-[#111111] pb-0.5">
                  {s ? <span className="font-wds-signature text-[36px] leading-10">{s.name}</span> : null}
                </div>
                <span className="text-[12px] leading-4">{s ? `${s.name} · ${s.role}` : 'Waiting for approval'}</span>
                {s ? <span className="text-[10px] leading-3 text-[#55626F]">Signed with PIN · {whenLabel(s.signedAt).replace('Today ', '')} · {fullDate(s.signedAt)}</span> : null}
              </div>
            );
          })}
          <div className="ml-auto flex flex-col items-center gap-1">
            <QRCodeSVG value={typeof window === 'undefined' ? d.reference : `${window.location.origin}/app/inventory/purchasing`} size={64} marginSize={0} aria-label={`QR code for ${d.reference}`} />
            <span className="text-[10px] leading-3 text-[#55626F]">Scan to open {d.reference}</span>
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-[#D5DCE4] py-4">
          <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">SUPPLIER ACKNOWLEDGEMENT</span>
          <p className="text-[11px] leading-[14px]">We accept this order and will deliver on the date shown, quoting {d.reference} on our delivery note.</p>
          <div className="mt-3 flex gap-8">
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

        <footer className="mt-auto flex items-end justify-between border-t border-[#D5DCE4] pt-3 text-[10px] leading-3 text-[#55626F]">
          <div className="flex flex-col gap-0.5">
            <span>Generated by Wendo RMS · Designed and developed by Lobster Technologies</span>
            <span>
              {d.reference} · Generated {fullDate(d.generatedAt)}, {new Date(d.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · Page 1 of 1
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span>lobstertechnologies.co.ke</span>
            <span>+254 113 176 613</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
