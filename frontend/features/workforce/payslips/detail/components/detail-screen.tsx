'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { Callout, ErrorBlock, ListSkeleton, PhoneButton, PhoneScreen, SegmentedControl, nameAndRole, useRemote } from '../../../_shared';
import { Amount, EyeButton, HiddenNote } from '../../_shared/components/amount';
import { DownloadPdfButton } from '../../_shared/components/pdf-buttons';
import { useAmountsShown } from '../../_shared/lib/amount-pref';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { dayMonth, monthLong, money, payLine } from '../../_shared/lib/pay-words';
import { payslipDocumentHref, payslipHref } from '../../_shared/lib/routes';
import { payslipReads } from '../../_shared/services/payslip-services';
import { SectionTable } from './section-table';

const VIEWS = [
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'Year to date' },
] as const;

/**
 * One payslip (spec S3 and S11): this month or year to date, each line with its working, View document and Download PDF. A corrected
 * payslip is version 2 with the changed lines marked; version 1 stays readable and says it was replaced. The questions line uses the HR
 * phone from the response, or "Ask HR" when none is set.
 */
export function PayslipDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const version = Number(search.get('v')) || null;
  const user = useAuthStore((s) => s.user);
  const { shown, toggle } = useAmountsShown(user?.id ?? null);
  const [view, setView] = React.useState<'month' | 'year'>('month');
  const slip = useRemote(() => payslipReads.detail(id, version), `${id}:${version ?? 'latest'}`);
  const d = slip.data;

  let body: React.ReactNode;
  if (slip.status === 'loading') body = <ListSkeleton rows={6} columns={['fill', 70]} label="Opening your payslip" />;
  else if (slip.status === 'error' && !d) {
    body = <ErrorBlock title={slip.error.status === 404 ? PAYSLIP_COPY.notFound : 'Your payslip did not load'} line={slip.error.code === 'NETWORK' ? PAYSLIP_COPY.offline : slip.error.status === 404 ? 'It may have been removed.' : PAYSLIP_COPY.loadError} onRetry={slip.error.status === 404 ? undefined : slip.reload} />;
  } else if (d) {
    const section = view === 'month' ? d.thisMonth : d.ytd;
    const replaced = d.replacedBy;
    body = (
      <>
        {replaced ? (
          <Callout tone="warning" size="sm" title={`Replaced by version ${replaced.versionNumber} on ${dayMonth(replaced.correctedAt)}`} action={<Link href={payslipHref(d.id, replaced.versionNumber)} className="inline-flex min-h-[44px] items-center font-wds-sans text-[13px] font-medium text-wds-primary">See the current payslip</Link>} />
        ) : null}
        <SegmentedControl label="Show" items={VIEWS} value={view} onChange={(v) => setView(v === 'year' ? 'year' : 'month')} className="[&>button]:flex-1" />
        <SectionTable caption={view === 'month' ? 'Earned this month' : 'Earned this year'} heading="EARNED" lines={section.earnings} totalLabel="Gross pay" total={section.gross} shown={shown} zeroKeys={['BASIC']} />
        <SectionTable caption={view === 'month' ? 'Taken off this month' : 'Taken off this year'} heading="TAKEN OFF" lines={section.deductions} totalLabel="Total taken off" total={section.totalDeductions} shown={shown} />
        <div className="flex items-center justify-between gap-3 bg-wds-sidebar-top px-3.5 py-3 text-wds-sidebar-fg-active">
          <span className="font-wds-sans text-[14px] font-semibold leading-[18px]">Net pay to you</span>
          <Amount value={section.net} shown={shown} dots={5} className="text-[18px] font-semibold leading-[22px]" />
        </div>
        <HiddenNote shown={shown} />
        <div className="flex flex-col gap-2.5">
          <PhoneButton size="sm" onClick={() => router.push(payslipDocumentHref(d.id, d.versionNumber))}>
            View document
          </PhoneButton>
          <DownloadPdfButton load={() => payslipReads.document(d.id, d.versionNumber, 'download')} />
        </div>
        {d.versionNumber > 1 && d.versions.some((v) => v.versionNumber < d.versionNumber) ? (
          <Link href={payslipHref(d.id, d.versionNumber - 1)} className="inline-flex min-h-[44px] items-center font-wds-sans text-[13px] font-medium text-wds-primary">
            Earlier version (replaced)
          </Link>
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

  const headSub = d ? `${d.employeeSummary.role ? `${d.employeeSummary.role}, ` : ''}${d.employeeSummary.organization} · ${payLine(d).text.replace(/^\w/, (c) => c.toLowerCase())}` : undefined;
  return (
    <PhoneScreen
      screen={PAYSLIP_COPY.screen}
      kicker={d ? `${monthLong(d.month).toUpperCase()}${d.number ? ` · ${d.number}` : ''}${d.versionNumber > 1 ? ` · VERSION ${d.versionNumber}` : ''}` : 'PAYSLIP'}
      back={d ? '/app/workforce/my-payslips' : '/app/workforce/my-payslips'}
      figure={d ? (shown ? money(view === 'month' ? d.thisMonth.net : d.ytd.net) : <span aria-hidden className="tracking-[0.12em]">••••••</span>) : undefined}
      title={d ? undefined : 'Payslip'}
      subtitle={d ? (view === 'year' ? `January to ${monthLong(d.ytd.toMonth).split(' ')[0]} ${d.ytd.toMonth.slice(0, 4)}` : headSub) : undefined}
      trailing={d ? <EyeButton shown={shown} onToggle={toggle} /> : undefined}
      desktopTitle={d ? `${monthLong(d.month)}${d.versionNumber > 1 ? ` · version ${d.versionNumber}` : ''}` : 'Payslip'}
      desktopActions={d ? <EyeButton shown={shown} onToggle={toggle} onDark={false} /> : undefined}
    >
      {body}
      {d && !shown ? <span className="sr-only">{nameAndRole(user?.name ?? '', user?.role)} payslip, amounts hidden.</span> : null}
    </PhoneScreen>
  );
}
