'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';

import { EmptyState, ErrorBlock, ListSkeleton, PhoneButton, PhoneScreen, StatusTag, useRemote } from '../../../_shared';
import { EyeButton, HiddenNote } from '../../_shared/components/amount';
import { DownloadPdfButton } from '../../_shared/components/pdf-buttons';
import { OldPayslipsCard } from '../../_shared/components/old-payslips-card';
import { PayslipRow } from '../../_shared/components/payslip-row';
import { useAmountsShown } from '../../_shared/lib/amount-pref';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { bankLine, monthLong, money, rowLine } from '../../_shared/lib/pay-words';
import { PAYSLIP_HISTORY, payslipHref } from '../../_shared/lib/routes';
import { payslipReads } from '../../_shared/services/payslip-services';
import { PayslipsDesktop } from '../../desktop/components/payslips-desktop';
import { YearCard } from './year-card';

/**
 * My payslips home (spec S2): the newest net as the headline (dots until the eye is pressed), the year so far, recent payslips. The
 * eye is one preference per device and person; no figure is in the page while hidden.
 */
export function PayslipsHome() {
  const { matches: desktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  if (!hydrated) return null;
  return desktop ? <PayslipsDesktop /> : <PayslipsPhoneHome />;
}

function PayslipsPhoneHome() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { shown, toggle } = useAmountsShown(userId);
  const home = useRemote(payslipReads.home, 'home');
  const data = home.data;
  const latest = data?.latest ?? null;
  const eye = <EyeButton shown={shown} onToggle={toggle} />;

  let body: React.ReactNode;
  if (home.status === 'loading') body = <ListSkeleton rows={4} columns={['fill', 60]} label="Opening your payslips" />;
  else if (home.status === 'error' && !data) {
    body = <ErrorBlock title="Your payslips did not load" line={home.error.code === 'NETWORK' ? PAYSLIP_COPY.offline : PAYSLIP_COPY.loadError} onRetry={home.reload} />;
  } else if (data) {
    body = (
      <>
        {data.legacy.card ? <OldPayslipsCard /> : null}
        {!latest && !data.legacy.card ? <EmptyState kind="nothingYet" {...(data.legacy.emptyReason === 'BRANCH_NOT_MOVED' ? PAYSLIP_COPY.emptyBranchNotMoved : PAYSLIP_COPY.empty)} /> : null}
        {latest ? (
          <>
            <div className="flex flex-col gap-2.5 min-[400px]:flex-row">
              <PhoneButton size="sm" onClick={() => router.push(payslipHref(latest.id))}>
                View payslip
              </PhoneButton>
              <DownloadPdfButton className="min-[400px]:flex-1" load={() => payslipReads.document(latest.id, latest.versionNumber, 'download')} />
            </div>
            {data.ytd && data.recent.length > 1 ? <YearCard ytd={data.ytd} shown={shown} /> : null}
            <div className="mt-1 flex items-baseline justify-between">
              <h2 className="m-0 font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">Recent payslips</h2>
              <Link href={PAYSLIP_HISTORY} className="inline-flex min-h-[44px] items-center font-wds-sans text-[13px] font-medium text-wds-primary focus-visible:outline-none focus-visible:shadow-wds-ring">
                See all
              </Link>
            </div>
            <ul className="m-0 list-none border border-wds-border bg-wds-surface p-0">
              {data.recent.map((p) => (
                <PayslipRow key={p.id} item={p} shown={shown} />
              ))}
            </ul>
            <HiddenNote shown={shown} />
            {data.legacy.historyRow ? (
              <Link href="/app/payslips" className="inline-flex min-h-[44px] items-center font-wds-sans text-[13px] font-medium text-wds-primary">
                {PAYSLIP_COPY.oldRow}
              </Link>
            ) : null}
            <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{PAYSLIP_COPY.footer}</p>
          </>
        ) : null}
      </>
    );
  }

  const headLine = latest ? `${monthLong(latest.month)} · ${rowLine(latest).text.replace(/^\w/, (c) => (latest.versionNumber > 1 ? c : c.toLowerCase()))}` : undefined;
  return (
    <PhoneScreen
      screen={PAYSLIP_COPY.screen}
      kicker="MY PAYSLIPS"
      back="/app/workforce"
      figureSize="lg"
      figure={latest ? (shown ? money(latest.net) : <HiddenFigure />) : undefined}
      title={latest ? undefined : 'My payslips'}
      subtitle={headLine}
      aside={
        latest ? (
          <div className="flex flex-col items-start gap-2">
            <span className="font-wds-sans text-[13px] leading-4 text-wds-sidebar-fg-item">{bankLine(latest.bank)}</span>
            <StatusTag tone={latest.versionNumber > 1 ? 'info' : 'success'}>{latest.versionNumber > 1 ? 'Corrected' : latest.status === 'PAID' ? 'Paid' : 'Published'}</StatusTag>
          </div>
        ) : undefined
      }
      trailing={latest ? eye : undefined}
      desktopTitle="My payslips"
      desktopActions={latest ? <EyeButton shown={shown} onToggle={toggle} onDark={false} /> : undefined}
    >
      {body}
    </PhoneScreen>
  );
}

/** Six white dots in place of the net. Decoration only; the reader hears "Amount hidden" once. */
function HiddenFigure() {
  return (
    <>
      <span aria-hidden className="tracking-[0.12em]">
        ••••••
      </span>
      <span className="sr-only">Amount hidden</span>
    </>
  );
}
