'use client';

import Link from 'next/link';

import { Callout } from '../../../_shared';
import { PAYSLIP_COPY } from '../lib/payslip-copy';

/** PD12: a person whose branch is not on the new payslips yet gets one card to the old screen, which keeps its own gate. */
export function OldPayslipsCard() {
  return (
    <Callout
      tone="info"
      title={PAYSLIP_COPY.oldCard.title}
      action={
        <Link href="/app/payslips" className="inline-flex min-h-[44px] items-center border border-wds-border-strong bg-wds-surface px-4 font-wds-sans text-[14px] font-medium text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring">
          {PAYSLIP_COPY.oldCard.button}
        </Link>
      }
    />
  );
}
