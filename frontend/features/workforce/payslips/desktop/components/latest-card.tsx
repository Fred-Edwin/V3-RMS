'use client';

import * as React from 'react';

import { PhoneButton, StatusTag } from '../../../_shared';
import { EyeButton, HiddenNote } from '../../_shared/components/amount';
import { DownloadPdfButton } from '../../_shared/components/pdf-buttons';
import { bankLine, dayShort, money, monthLong } from '../../_shared/lib/pay-words';
import { payslipReads } from '../../_shared/services/payslip-services';
import type { HomeData } from '../../_shared/types/payslip-types';

/** The dark card of My payslips on a desktop (frame 13.9): month and pay day, six dots until shown, the bank line with its tag, the eye, then the two buttons. */
export function LatestCard({ latest, shown, onToggle, onOpen }: { latest: NonNullable<HomeData['latest']>; shown: boolean; onToggle: () => void; onOpen: () => void }) {
  const corrected = latest.versionNumber > 1;
  return (
    <div className="flex flex-col gap-3">
      <section aria-label={`${monthLong(latest.month)} payslip`} className="flex items-start justify-between gap-4 bg-wds-sidebar-top px-6 py-6 text-wds-sidebar-fg-active">
        <div className="flex min-w-0 flex-col gap-3.5">
          <span className="font-wds-mono text-[11px] leading-[14px] tracking-[0.08em] text-wds-sidebar-fg-item">
            {monthLong(latest.month).toUpperCase()}
            {latest.payDay ? ` · PAY DAY ${dayShort(latest.payDay).toUpperCase()}` : ''}
          </span>
          {shown ? (
            <span className="font-wds-mono text-[34px] font-semibold leading-[40px] tabular-nums">{money(latest.net)}</span>
          ) : (
            <>
              <span aria-hidden className="flex gap-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="size-3 rounded-full bg-wds-sidebar-fg-active" />
                ))}
              </span>
              <HiddenNote shown={false} />
            </>
          )}
          <span className="flex flex-wrap items-center gap-3 font-wds-sans text-[13px] leading-4 text-wds-sidebar-fg-item">
            {bankLine(latest.bank)}
            <StatusTag tone={corrected ? 'info' : 'success'}>{corrected ? 'Corrected' : latest.status === 'PAID' ? 'Paid' : 'Published'}</StatusTag>
          </span>
        </div>
        <EyeButton shown={shown} onToggle={onToggle} />
      </section>
      <div className="grid grid-cols-2 gap-3">
        <PhoneButton size="sm" onClick={onOpen}>
          View payslip
        </PhoneButton>
        <DownloadPdfButton load={() => payslipReads.document(latest.id, latest.versionNumber, 'download')} />
      </div>
    </div>
  );
}
