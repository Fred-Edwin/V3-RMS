'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Callout, PhoneButton, SegmentedControl } from '../../../_shared';
import { Amount, HiddenNote } from '../../_shared/components/amount';
import { DownloadPdfButton } from '../../_shared/components/pdf-buttons';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { dayMonth } from '../../_shared/lib/pay-words';
import { payslipDocumentHref, payslipHref } from '../../_shared/lib/routes';
import { payslipReads } from '../../_shared/services/payslip-services';
import type { PayslipDetail } from '../../_shared/types/payslip-types';
import { SectionTable } from './section-table';

export type PayslipView = 'month' | 'year';

const VIEWS = [
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'Year to date' },
] as const;

/** A link to another version of the same payslip. In the drawer it changes the version in place (`onVersion`); on a page it is a real link. */
function VersionLink({ id, version, onVersion, children }: { id: string; version: number; onVersion?: ((version: number) => void) | undefined; children: React.ReactNode }) {
  const cls = 'inline-flex min-h-[44px] items-center font-wds-sans text-[13px] font-medium text-wds-primary';
  if (onVersion) return <button type="button" onClick={() => onVersion(version)} className={`${cls} border-0 bg-transparent p-0 text-left`}>{children}</button>;
  return <Link href={payslipHref(id, version)} className={cls}>{children}</Link>;
}

/**
 * What one payslip says (spec S3 and S11), shared by the phone's page and the desktop's drawer: this month or year to date, each line
 * with its working, View document and Download PDF. A corrected payslip is version 2 with the changed lines marked; version 1 stays
 * readable and says it was replaced. Amounts are in the markup only while `shown`.
 */
export function PayslipBody({ d, shown, view, onView, onVersion, wide = false }: { d: PayslipDetail; shown: boolean; view: PayslipView; onView: (v: PayslipView) => void; onVersion?: (version: number) => void; wide?: boolean }) {
  const router = useRouter();
  const section = view === 'month' ? d.thisMonth : d.ytd;
  const replaced = d.replacedBy;
  return (
    <>
      {replaced ? (
        <Callout tone="warning" size="sm" title={`Replaced by version ${replaced.versionNumber} on ${dayMonth(replaced.correctedAt)}`} action={<VersionLink id={d.id} version={replaced.versionNumber} onVersion={onVersion}>See the current payslip</VersionLink>} />
      ) : null}
      <SegmentedControl label="Show" items={VIEWS} value={view} onChange={(v) => onView(v === 'year' ? 'year' : 'month')} className="[&>button]:flex-1" />
      <SectionTable caption={view === 'month' ? 'Earned this month' : 'Earned this year'} heading="EARNED" lines={section.earnings} totalLabel="Gross pay" total={section.gross} shown={shown} zeroKeys={['BASIC']} />
      <SectionTable caption={view === 'month' ? 'Taken off this month' : 'Taken off this year'} heading="TAKEN OFF" lines={section.deductions} totalLabel="Total taken off" total={section.totalDeductions} shown={shown} />
      <div className="flex items-center justify-between gap-3 bg-wds-sidebar-top px-3.5 py-3 text-wds-sidebar-fg-active">
        <span className="font-wds-sans text-[14px] font-semibold leading-[18px]">Net pay to you</span>
        <Amount value={section.net} shown={shown} dots={5} className="text-[18px] font-semibold leading-[22px]" />
      </div>
      <HiddenNote shown={shown} />
      <div className={wide ? 'flex gap-3 [&>*]:flex-1' : 'flex flex-col gap-2.5'}>
        <PhoneButton size="sm" onClick={() => router.push(payslipDocumentHref(d.id, d.versionNumber))}>
          View document
        </PhoneButton>
        <DownloadPdfButton load={() => payslipReads.document(d.id, d.versionNumber, 'download')} />
      </div>
      {d.versionNumber > 1 && d.versions.some((v) => v.versionNumber < d.versionNumber) ? (
        <VersionLink id={d.id} version={d.versionNumber - 1} onVersion={onVersion}>Earlier version (replaced)</VersionLink>
      ) : null}
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        {d.hrContact ? (
          <>
            Questions? Call HR on{' '}
            <a href={`tel:${d.hrContact.phone.replace(/\s/g, '')}`} className="font-medium text-wds-primary underline">
              {d.hrContact.phone}
            </a>
            {d.hrContact.hoursText ? `. ${d.hrContact.hoursText}` : '.'}
          </>
        ) : (
          PAYSLIP_COPY.questionsAsk
        )}
      </p>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Opened by you just now.</p>
    </>
  );
}
