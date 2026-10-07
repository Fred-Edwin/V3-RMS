'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useSearchParams } from 'next/navigation';

import { roleLabel } from '@/components/app/shell/role-label';
import { useAuthStore } from '@/store/authStore';
import type { AppRole } from '@/types/auth';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePurchasing } from '../../hooks/use-purchasing';
import { amountInWords } from '../../lib/amount-in-words';
import { dayMonth, fullDate, kes2 } from '../../lib/format';
import type { SupplierStatement } from '../../types';

const bal = (v: string): string => {
  const n = Number.parseFloat(v);
  return n < 0 ? `(${kes2(Math.abs(n))})` : kes2(n);
};

/**
 * Printed supplier statement (Paper `27`, A4): the supplier's name and what Wendo owes them at the closing date, the lines with a
 * running balance, totals, the amount in words, the ageing and a "Prepared by" signature. Opened from the supplier's Statement
 * tab with the chosen period. Standalone page.
 */
export function StatementPrintScreen({ supplierId }: { supplierId: string }) {
  const { service, ready, role } = usePurchasing();
  const userName = useAuthStore((s) => s.user?.name);
  const params = useSearchParams();
  const from = params.get('from') ?? undefined;
  const to = params.get('to') ?? undefined;
  const { data, status, error } = useLoader<SupplierStatement>(ready ? `statement-print:${supplierId}:${from}:${to}` : null, () => service.getSupplierStatement(supplierId, { from, to }), 'We could not load this statement.');

  if (status === 'error') return <p className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-secondary">{error} Close this tab and try again.</p>;
  if (!data) return <p className="flex min-h-screen items-center justify-center bg-white font-wds-sans text-wds-body-sm text-wds-text-secondary">Loading…</p>;

  const d = data;
  const owed = Number.parseFloat(d.closingBalance);
  const total = Object.values(d.ageing).reduce((t, v) => t + Number.parseFloat(v), 0);
  const cols: Array<[string, string]> = [
    ['CURRENT', d.ageing.current],
    ['1-30', d.ageing.days1to30],
    ['31-60', d.ageing.days31to60],
    ['61-90', d.ageing.days61to90],
    ['90+', d.ageing.days90plus],
  ];
  const first = d.supplier.name.split(' ')[0];
  const who = `${userName ?? 'Signed-in user'} · ${roleLabel(role as AppRole | undefined)}`;

  return (
    <div className="min-h-screen bg-wds-neutral-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex w-[794px] max-w-full items-center justify-end px-1 print:hidden">
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
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.14em] text-[#55626F]">STATEMENT OF ACCOUNT</span>
            <span className="text-[22px] font-semibold leading-7">{d.supplier.name}</span>
            <span className="text-[12px] leading-4 text-[#55626F]">
              {fullDate(d.from)} to {fullDate(d.to)}
            </span>
          </div>
        </header>

        <section className="flex items-start justify-between gap-8 py-5">
          <div className="flex flex-col gap-1">
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.1em] text-[#55626F]">SUPPLIER</span>
            <span className="text-[15px] font-semibold leading-[18px]">{d.supplier.name}</span>
            <span className="text-[12px] leading-4">{d.supplier.address}</span>
          </div>
          <div className="flex w-[300px] shrink-0 flex-col gap-2 border-t-2 border-[#C9CED3]">
            <span className="pt-2 font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">BALANCE OWED AT {fullDate(d.to).toUpperCase()}</span>
            <span className="border-b-[3px] border-[#C9CED3] pb-3 text-right font-wds-mono text-[26px] font-semibold leading-8">KES {bal(d.closingBalance)}</span>
          </div>
        </section>

        <section className="flex flex-col">
          <div className="flex h-8 items-center border-b-2 border-[#0B2A4A]">
            <span className="w-[60px] font-wds-mono text-[10px] tracking-[0.08em]">DATE</span>
            <span className="w-[100px] font-wds-mono text-[10px] tracking-[0.08em]">REFERENCE</span>
            <span className="grow font-wds-mono text-[10px] tracking-[0.08em]">DESCRIPTION</span>
            <span className="w-[100px] text-right font-wds-mono text-[10px] tracking-[0.08em]">DEBIT</span>
            <span className="w-[100px] text-right font-wds-mono text-[10px] tracking-[0.08em]">CREDIT</span>
            <span className="w-[100px] text-right font-wds-mono text-[10px] tracking-[0.08em]">BALANCE</span>
          </div>
          <div className="flex h-10 items-center border-b border-[#E3E8EE] text-[#55626F]">
            <span className="w-[60px] font-wds-mono text-[12px]">{dayMonth(d.from)}</span>
            <span className="w-[100px]" />
            <span className="grow text-[12px]">Opening balance</span>
            <span className="w-[300px] text-right font-wds-mono text-[12px] text-[#111111]">{bal(d.openingBalance)}</span>
          </div>
          {d.lines.map((l, i) => (
            <div key={`${l.reference}-${i}`} className="flex min-h-10 items-center border-b border-[#E3E8EE] py-1.5">
              <span className="w-[60px] font-wds-mono text-[12px]">{dayMonth(l.date)}</span>
              <span className={`w-[100px] font-wds-mono text-[12px] ${l.superseded ? 'line-through' : ''}`}>{l.reference}</span>
              <span className={`grow text-[12px] ${l.superseded ? 'text-[#8D8982] line-through' : ''}`}>{l.description}</span>
              <span className="w-[100px] text-right font-wds-mono text-[12px]">{l.debit ? kes2(l.debit) : ''}</span>
              <span className="w-[100px] text-right font-wds-mono text-[12px]">{l.credit ? kes2(l.credit) : ''}</span>
              <span className="w-[100px] text-right font-wds-mono text-[12px]">{bal(l.balance)}</span>
            </div>
          ))}
          <div className="flex h-10 items-center border-b-2 border-[#C9CED3]">
            <span className="grow pl-[160px] font-wds-mono text-[10px] tracking-[0.08em]">TOTALS FOR THE PERIOD</span>
            <span className="w-[100px] text-right font-wds-mono text-[12px] font-semibold">{kes2(d.totalDebit)}</span>
            <span className="w-[100px] text-right font-wds-mono text-[12px] font-semibold">{kes2(d.totalCredit)}</span>
            <span className="w-[100px]" />
          </div>
        </section>

        <section className="flex items-center justify-between gap-8 py-4">
          <div className="flex flex-col gap-1">
            <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">AMOUNT IN WORDS</span>
            <span className="max-w-[330px] text-[12px] leading-[17px]">{owed > 0 ? amountInWords(owed) : owed < 0 ? `Credit held with ${first}: ${amountInWords(Math.abs(owed))}` : 'Nothing owed.'}</span>
          </div>
          <div className="flex w-[300px] shrink-0 items-center justify-between border-y-[3px] border-[#C9CED3] py-3">
            <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">CLOSING BALANCE</span>
            <span className="font-wds-mono text-[22px] font-semibold leading-7">KES {bal(d.closingBalance)}</span>
          </div>
        </section>

        <section className="flex flex-col gap-2 pb-4">
          <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">AGEING AT {fullDate(d.to).toUpperCase()} · DAYS PAST DUE</span>
          <div className="flex border-t-2 border-[#0B2A4A] border-b border-b-[#D5DCE4]">
            {cols.map(([label, v]) => (
              <div key={label} className="flex grow basis-0 flex-col gap-1 px-2 py-2.5">
                <span className="font-wds-mono text-[10px] tracking-[0.08em] text-[#55626F]">{label}</span>
                <span className="font-wds-mono text-[13px] font-medium">{kes2(v)}</span>
              </div>
            ))}
            <div className="flex grow basis-0 flex-col gap-1 border-l border-[#0B2A4A] px-2 py-2.5">
              <span className="font-wds-mono text-[10px] tracking-[0.08em] text-[#55626F]">TOTAL</span>
              <span className="font-wds-mono text-[13px] font-semibold">{kes2(total)}</span>
            </div>
          </div>
          <p className="text-[11px] leading-[16px] text-[#55626F]">Credit adds to the balance owed; debit reduces it. A bracketed balance means an advance held with {first} before its invoice arrived. Amounts in Kenya shillings.</p>
        </section>

        <div className="grow" />

        <section className="flex items-end gap-8 py-5">
          <div className="flex w-[300px] flex-col gap-1">
            <span className="font-wds-mono text-[10px] tracking-[0.1em] text-[#55626F]">PREPARED BY</span>
            <div className="flex h-[50px] items-end border-b border-[#111111] pb-0.5">
              <span className="font-wds-signature text-[36px] leading-10">{who.split(' ·')[0]}</span>
            </div>
            <span className="text-[12px] leading-4">
              {who} · {fullDate(d.generatedAt)}
            </span>
          </div>
          <div className="ml-auto flex flex-col items-center gap-1">
            <QRCodeSVG value={typeof window === 'undefined' ? d.supplier.code : `${window.location.origin}/app/inventory/suppliers`} size={64} marginSize={0} aria-label={`QR code for the ${d.supplier.name} statement`} />
            <span className="text-[10px] leading-3 text-[#55626F]">Scan to open this statement</span>
          </div>
        </section>

        <footer className="flex items-end justify-between border-t border-[#D5DCE4] pt-3 text-[10px] leading-3 text-[#55626F]">
          <div className="flex flex-col gap-0.5">
            <span>Generated by Wendo RMS · Designed and developed by Lobster Technologies</span>
            <span className="font-wds-mono">Statement · Generated {fullDate(d.generatedAt)} · Page 1 of 1</span>
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
