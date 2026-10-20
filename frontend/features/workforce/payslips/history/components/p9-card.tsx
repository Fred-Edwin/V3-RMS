'use client';

import { useRouter } from 'next/navigation';

import { PhoneButton } from '../../../_shared';
import { DownloadPdfButton } from '../../_shared/components/pdf-buttons';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { monthLong } from '../../_shared/lib/pay-words';
import { p9Href } from '../../_shared/lib/routes';
import { payslipReads } from '../../_shared/services/payslip-services';
import type { P9Card } from '../../_shared/types/payslip-types';

/** The year's tax card (spec S4, S12): not yet, waiting for the Accountant's format check, or ready. A disabled button always carries its reason as text. */
export function P9CardBlock({ p9 }: { p9: P9Card }) {
  const router = useRouter();
  const ready = p9.status === 'READY';
  const from = p9.availableFrom ? monthLong(p9.availableFrom.slice(0, 7)) : `January ${p9.year + 1}`;
  const reason = p9.status === 'WAITING_FORMAT' ? PAYSLIP_COPY.p9Waiting : `Ready from ${from}.`;
  return (
    <section aria-label={`Tax card (P9) for ${p9.year}`} className="flex flex-col gap-2.5 border border-wds-border bg-wds-surface p-3.5">
      <h2 className="m-0 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">Tax card (P9) for {p9.year}</h2>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        {ready ? "Your year's pay and tax on one page, for your KRA return." : `The year's pay and tax on one page, for your KRA return. It is ready in ${from}, when the year closes.`}
      </p>
      {ready ? (
        <>
          <DownloadPdfButton kind="primary" label={`Download P9 for ${p9.year}`} failure={PAYSLIP_COPY.p9Failed} load={() => payslipReads.p9Document(p9.year)} />
          <PhoneButton kind="outlined" size="sm" onClick={() => router.push(p9Href(p9.year))}>
            View document
          </PhoneButton>
        </>
      ) : (
        <>
          <button type="button" disabled className="h-[46px] w-full bg-wds-border-strong font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-secondary">
            Download P9 for {p9.year}
          </button>
          <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{reason}</p>
        </>
      )}
    </section>
  );
}
