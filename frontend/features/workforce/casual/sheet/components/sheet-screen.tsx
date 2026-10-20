'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Callout, ErrorBlock, ListSkeleton, PhoneButton, PhoneScreen, StatusTag, useRemote, useWorkforcePermissions } from '../../../_shared';
import { CASUAL_COPY, STATUS_WORDS, clockOf, dayLong, dayShort, kes } from '../../_shared/lib/casual-words';
import { casualReads } from '../../_shared/services/casual-services';
import type { Sheet, SheetLine } from '../../_shared/types/casual-types';
import { VoidButton } from '../../approve/components/void-button';
import { ReceiptDialog } from './receipt-dialog';

/**
 * One pay sheet (spec S7 to S10): who worked, the pay, who approved, and after approval the cash step. The cash holder pays each worker;
 * then the worker types their name on the head's phone (PD25). Only the person who records (`casual.record`) sees the receipt button.
 * Everyone who may read the sheet sees the rest with no buttons.
 */
export function SheetScreen({ id }: { id: string }) {
  const router = useRouter();
  const permissions = useWorkforcePermissions();
  const remote = useRemote(() => casualReads.sheet(id), `sheet:${id}`);
  const [override, setOverride] = React.useState<Sheet | null>(null);
  const [signing, setSigning] = React.useState<SheetLine | null>(null);
  const sheet = override ?? remote.data;
  const canSign = permissions.can('casual.record');

  let body: React.ReactNode;
  if (remote.status === 'loading' && !sheet) body = <ListSkeleton rows={4} columns={['fill', 60]} label="Opening the pay sheet" />;
  else if (!sheet) body = <ErrorBlock title={remote.error?.status === 404 ? 'We could not find that pay sheet.' : 'The pay sheet did not load'} line="Nothing was changed." onRetry={remote.error?.status === 404 ? undefined : remote.reload} />;
  else {
    const approved = sheet.status === 'APPROVED';
    body = (
      <>
        <div className="flex items-center gap-2">
          <StatusTag tone={approved ? 'success' : sheet.status === 'VOID' ? 'error' : 'info'}>{STATUS_WORDS[sheet.status]}</StatusTag>
          {sheet.number ? <span className="font-wds-mono text-[12px] text-wds-text-secondary">{sheet.number}</span> : null}
        </div>
        {sheet.status === 'VOID' && sheet.voidReason ? <Callout tone="error">{sheet.voidReason}</Callout> : null}
        {approved ? (
          <Callout tone="info" title="Pay the cash, then each worker signs">
            {sheet.cashHolder ? `The cash comes from the petty cash held by ${sheet.cashHolder.name}.` : 'The cash comes from the petty cash.'}
            {sheet.approvedBy && sheet.approvedAt ? ` Approved by ${sheet.approvedBy.name} at ${clockOf(sheet.approvedAt)}.` : ''}
          </Callout>
        ) : null}
        <ul aria-label="Workers" className="m-0 flex list-none flex-col gap-2.5 p-0">
          {sheet.lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border border-wds-border bg-wds-surface px-3.5 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{l.name}</span>
                <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">
                  {l.start} to {l.end}{l.endsNextDay ? ' +1' : ''} · ID {l.idMasked}
                </span>
                {approved ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{l.receivedAt ? `Signed ${l.receivedName ?? ''} at ${clockOf(l.receivedAt)}` : 'Waiting for the cash'}</span> : null}
              </span>
              <span className="flex items-center gap-3">
                <span className="font-wds-mono text-[14px] text-wds-text-ink">{kes(l.amount)}</span>
                {approved && !l.receivedAt && canSign ? (
                  <button type="button" onClick={() => setSigning(l)} className="min-h-[44px] border border-wds-border-strong px-3 font-wds-sans text-[13px] font-medium text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring">
                    Paid, sign
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between border-t border-wds-text-ink pt-3">
          <span className="font-wds-sans text-[14px] font-semibold text-wds-text-ink">Total {approved ? 'paid in cash' : 'for the day'}</span>
          <span className="font-wds-mono text-[15px] font-semibold text-wds-text-ink">KES {kes(sheet.total)}</span>
        </div>
        <PhoneButton size="sm" onClick={() => router.push(`/app/workforce/casuals/${sheet.id}/document${approved ? '' : '?preview=1'}`)}>
          {approved ? 'Open the pay sheet' : 'Preview the pay sheet'}
        </PhoneButton>
        {permissions.can('casual.approve') ? <VoidButton sheet={sheet} onVoided={(next) => setOverride(next)} onStale={remote.reload} /> : null}
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{CASUAL_COPY.footer}</p>
        <ReceiptDialog sheet={sheet} line={signing} onClose={() => setSigning(null)} onSaved={(next) => { setOverride(next); setSigning(null); }} />
      </>
    );
  }
  return (
    <PhoneScreen screen={CASUAL_COPY.screen} kicker={sheet ? `CASUAL PAY · ${dayShort(sheet.date).toUpperCase()}` : 'CASUAL PAY'} back="/app/workforce/casuals" title={sheet ? `${sheet.departmentName}, ${dayLong(sheet.date)}` : 'Pay sheet'} subtitle={sheet?.siteName}>
      {body}
    </PhoneScreen>
  );
}
