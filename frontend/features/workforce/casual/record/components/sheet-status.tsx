'use client';

import Link from 'next/link';

import { Callout, PhoneButton } from '../../../_shared';
import { clockOf, dayShort } from '../../_shared/lib/casual-words';
import type { Sheet } from '../../_shared/types/casual-types';

/** Where a sent day stands, in words (spec S7): waiting, sent back with the reason, approved, void. */
export function SheetStatusBlock({ sheet, busy, onTakeBack }: { sheet: Sheet; busy: boolean; onTakeBack: () => void }) {
  if (sheet.status === 'SENT') {
    return (
      <Callout tone="info" title="Sent to the Branch Manager, waiting" action={<PhoneButton kind="outlined" size="sm" disabled={busy} onClick={onTakeBack}>Take it back</PhoneButton>}>
        You can take it back to change it until it is approved.
      </Callout>
    );
  }
  if (sheet.status === 'SENT_BACK') {
    return (
      <Callout tone="warning" role="alert" title="Sent back by the Branch Manager">
        {sheet.sentBackReason ?? 'Please check the sheet and send it again.'}
      </Callout>
    );
  }
  if (sheet.status === 'APPROVED') {
    return (
      <Callout
        tone="success"
        title={`Approved, ${sheet.number ?? ''}`.trim()}
        action={
          sheet.id ? (
            <Link href={`/app/workforce/casuals/${sheet.id}`} className="inline-flex min-h-[44px] items-center border border-wds-border-strong bg-wds-surface px-4 font-wds-sans text-[14px] font-medium text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring">
              {sheet.waitingForCash > 0 ? 'Waiting for the cash' : 'Open the pay sheet'}
            </Link>
          ) : null
        }
      >
        {sheet.approvedAt ? `Approved ${dayShort(sheet.date)} at ${clockOf(sheet.approvedAt)}. ` : ''}
        {sheet.waitingForCash > 0 ? `${sheet.waitingForCash} of ${sheet.lines.length} still to sign for their cash.` : 'Everyone has signed for their cash.'}
      </Callout>
    );
  }
  if (sheet.status === 'VOID') {
    return (
      <Callout tone="error" title={`Void${sheet.number ? `, ${sheet.number}` : ''}`}>
        {sheet.voidReason ?? 'This sheet was cancelled. Record the day again.'}
      </Callout>
    );
  }
  return null;
}
