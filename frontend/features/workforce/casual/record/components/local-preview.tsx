'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { EmptyState, PhoneButton, PhoneScreen, useWorkforcePermissions } from '../../../_shared';
import { dayPay, shiftMinutes, timeRange } from '../../_shared/lib/casual-pay';
import { dayLong, kes } from '../../_shared/lib/casual-words';
import { draftKey, readDraft, readRate } from '../../_shared/lib/draft-store';

/**
 * The pay sheet preview drawn on the phone from the lines it holds (spec S9, PD28): used while the lines are saved on the phone and not
 * yet on the server, so a head with no signal can still check the sheet. The number is "CPS-draft" and the stamp says it is not approved.
 */
export function LocalPreview() {
  const router = useRouter();
  const search = useSearchParams();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const permissions = useWorkforcePermissions();
  const departmentId = search.get('d') ?? '';
  const date = search.get('date') ?? '';
  const siteId = permissions.siteId ?? '';
  const [rate, setRate] = React.useState<string | null>(null);
  const draft = React.useMemo(() => (permissions.ready ? readDraft(draftKey(userId, siteId, departmentId, date)) : null), [permissions.ready, userId, siteId, departmentId, date]);

  React.useEffect(() => {
    // The day rate was kept when the day opened, so the preview works with no signal.
    setRate(readRate(siteId, departmentId));
  }, [siteId, departmentId]);

  const lines = draft?.lines ?? [];
  const total = rate ? lines.reduce((s, l) => s + dayPay(rate, Math.max(0, shiftMinutes(l.start, l.end, l.endsNextDay))), 0) : null;
  return (
    <PhoneScreen screen="Casuals" kicker="CASUAL PAY SHEET · PREVIEW" back="/app/workforce/casuals" desktopTitle="Casual pay sheet preview">
      {lines.length === 0 ? (
        <EmptyState kind="nothingYet" title="Nothing to preview" line="Add the casuals who worked first." />
      ) : (
        <article aria-label="Draft casual pay sheet" className="flex flex-col gap-3 bg-white p-4 font-serif text-[#111111] shadow-sm">
          <header className="flex items-start justify-between gap-3 border-b-2 border-[#14284B] pb-2">
            <div className="flex flex-col">
              <strong className="text-[#14284B]">Wendo Coffee Bistro</strong>
              <span className="text-[12px]">Casual workers · {date ? dayLong(date) : ''}</span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] tracking-[0.14em]">CASUAL PAY SHEET</span>
              <strong className="text-[#14284B]">CPS-draft</strong>
            </div>
          </header>
          <span className="self-start border border-[#8A5A16] px-2 py-0.5 text-[10px] font-bold tracking-[0.1em] text-[#8A5A16]">DRAFT · NOT APPROVED</span>
          <table className="w-full border-collapse text-left text-[13px]">
            <caption className="sr-only">Workers and their pay</caption>
            <thead>
              <tr className="border-y-2 border-[#14284B] text-[11px] text-[#14284B]">
                <th scope="col" className="py-1">WORKER</th>
                <th scope="col">WORKED</th>
                <th scope="col" className="text-right">KES</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.casualId} className="border-b border-[#E4E2DE]">
                  <th scope="row" className="py-1.5 font-normal">{l.name}</th>
                  <td>{timeRange(l.start, l.end, l.endsNextDay)}</td>
                  <td className="text-right">{rate ? dayPay(rate, Math.max(0, shiftMinutes(l.start, l.end, l.endsNextDay))) : '…'}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <th scope="row" colSpan={2} className="py-1.5 text-left">Total to be paid in cash</th>
                <td className="text-right">{total === null ? '…' : kes(`${total}.00`)}</td>
              </tr>
            </tbody>
          </table>
          <p className="m-0 text-[11px]">{rate ? `Rate: KES ${kes(rate)} for a day of 8 hours, set in Rules. No statutory deductions apply to this amount.` : ''}</p>
        </article>
      )}
      <PhoneButton kind="outlined" size="sm" onClick={() => router.back()}>
        Back to edit
      </PhoneButton>
      <button type="button" disabled className="h-[46px] w-full bg-wds-border-strong font-wds-sans text-[14px] font-semibold text-wds-text-secondary">
        Print after approval
      </button>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">The head checks the sheet here before it goes to the Branch Manager. After approval it can be printed and the workers sign.</p>
    </PhoneScreen>
  );
}
