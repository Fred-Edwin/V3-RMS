'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';

import { PdfViewer, PhoneScreen, useRemote } from '../../../_shared';
import { DownloadPdfButton, SharePdfButton } from '../../_shared/components/pdf-buttons';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { monthLong } from '../../_shared/lib/pay-words';
import { payslipHref } from '../../_shared/lib/routes';
import { payslipReads } from '../../_shared/services/payslip-services';

/**
 * The payslip as the signed A4 file (spec S5, S6): the same stored bytes for the view, the download and the share. The page's spoken name
 * carries the month and version but no amount. "Read as text" opens the detail screen, which obeys the hidden-amounts state.
 */
export function PayslipDocumentScreen({ id, kind = 'payslip', year }: { id?: string; kind?: 'payslip' | 'p9'; year?: number }) {
  const search = useSearchParams();
  const version = Number(search.get('v')) || null;
  // The month and version are only for the spoken name. They come from the list, which is not an opening and is not audited.
  const meta = useRemote(async () => (kind === 'payslip' ? (await payslipReads.list()).items.find((i) => i.id === id) ?? null : null), `doc-meta:${id ?? year}`);
  const name = kind === 'p9' ? `Tax card P9 for ${year}` : meta.data ? `Payslip, ${monthLong(meta.data.month)}, version ${version ?? meta.data.versionNumber}` : 'Payslip';
  const loader = React.useCallback(async () => (kind === 'p9' && year ? payslipReads.p9Document(year) : payslipReads.document(id ?? '', version, 'view')), [kind, id, year, version]);
  const fileFor = (purpose: 'download' | 'share') => () => (kind === 'p9' && year ? payslipReads.p9Document(year) : payslipReads.document(id ?? '', version, purpose));

  return (
    <PhoneScreen screen={PAYSLIP_COPY.screen} kicker={kind === 'p9' ? `TAX CARD · P9 ${year}` : 'PAYSLIP'} back={kind === 'p9' ? '/app/workforce/my-payslips/history' : payslipHref(id ?? '', version)} desktopTitle={kind === 'p9' ? `Tax card for ${year}` : 'Payslip document'}>
      <div className="flex h-[72dvh] min-h-[420px] flex-col">
        <PdfViewer
          name={name}
          load={async () => (await loader()).blob}
          footer={
            <>
              <DownloadPdfButton kind="primary" className="min-[400px]:flex-1" load={fileFor('download')} failure={kind === 'p9' ? PAYSLIP_COPY.p9Failed : PAYSLIP_COPY.downloadFailed} />
              <SharePdfButton className="min-[400px]:flex-1" load={fileFor('share')} title={name} />
            </>
          }
        />
      </div>
      {kind === 'payslip' && id ? (
        <Link href={payslipHref(id, version)} className="inline-flex min-h-[44px] items-center font-wds-sans text-[13px] font-medium text-wds-primary focus-visible:outline-none focus-visible:shadow-wds-ring">
          Read as text
        </Link>
      ) : null}
    </PhoneScreen>
  );
}
