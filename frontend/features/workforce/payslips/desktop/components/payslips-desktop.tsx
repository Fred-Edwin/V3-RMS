'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { EmptyState, ErrorBlock, ListSkeleton, PageHeader, WorkforceFrame, useRemote } from '../../../_shared';
import { useAmountsShown } from '../../_shared/lib/amount-pref';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { PAYSLIP_HOME } from '../../_shared/lib/routes';
import { payslipReads } from '../../_shared/services/payslip-services';
import { YearCard } from '../../home/components/year-card';
import { AllPayslipsPanel } from './all-payslips-panel';
import { LatestCard } from './latest-card';
import { PayslipDrawer } from './payslip-drawer';

/**
 * My payslips on a desktop (frames 13.9 and 13.10): the latest payslip as a dark card with its two buttons and the year so far at the
 * left, all payslips by year and the tax card at the right. One payslip opens in a right drawer over this page, so its address
 * (`openId`) still works: closing the drawer there goes back to My payslips. The eye is one preference per device and person.
 */
export function PayslipsDesktop({ openId = null, openVersion = null }: { openId?: string | null; openVersion?: number | null }) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { shown, toggle } = useAmountsShown(userId);
  const home = useRemote(payslipReads.home, 'home');
  const [open, setOpen] = React.useState<{ id: string; version: number | null } | null>(openId ? { id: openId, version: openVersion } : null);
  // A route that names a payslip opens it; a route that does not leaves the drawer to the page's own state.
  React.useEffect(() => {
    if (openId) setOpen({ id: openId, version: openVersion });
  }, [openId, openVersion]);
  const close = React.useCallback(() => {
    setOpen(null);
    if (openId) router.replace(PAYSLIP_HOME);
  }, [openId, router]);
  const data = home.data;
  const latest = data?.latest ?? null;

  let left: React.ReactNode = null;
  if (home.status === 'loading') left = <ListSkeleton rows={4} columns={['fill', 60]} label="Opening your payslips" />;
  else if (home.status === 'error' && !data) left = <ErrorBlock title="Your payslips did not load" line={home.error.code === 'NETWORK' ? PAYSLIP_COPY.offline : PAYSLIP_COPY.loadError} onRetry={home.reload} />;
  else if (latest) {
    left = (
      <>
        <LatestCard latest={latest} shown={shown} onToggle={toggle} onOpen={() => setOpen({ id: latest.id, version: latest.versionNumber })} />
        {data?.ytd && data.recent.length > 1 ? <YearCard ytd={data.ytd} shown={shown} /> : null}
      </>
    );
  } else if (data && !data.legacy.card) left = <EmptyState kind="nothingYet" {...(data.legacy.emptyReason === 'BRANCH_NOT_MOVED' ? PAYSLIP_COPY.emptyBranchNotMoved : PAYSLIP_COPY.empty)} />;

  return (
    <WorkforceFrame breadcrumb={{ section: 'My account', screen: PAYSLIP_COPY.screen }} phoneTitle={PAYSLIP_COPY.screen} label={PAYSLIP_COPY.screen}>
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-5 px-6 py-7">
        <PageHeader size="lg" title="My payslips" subtitle="Amounts stay hidden until you show them. Your own code opens each payslip. Nobody else can open it." />
        <div className="grid grid-cols-[460px_minmax(0,1fr)] items-start gap-5">
          <div className="flex flex-col gap-4">{left}</div>
          {home.status === 'loading' ? null : <AllPayslipsPanel shown={shown} openId={open?.id ?? null} onOpen={(id, version) => setOpen({ id, version })} />}
        </div>
      </div>
      <PayslipDrawer id={open?.id ?? null} version={open?.version ?? null} shown={shown} onToggle={toggle} onClose={close} onVersion={(v) => setOpen((o) => (o ? { ...o, version: v } : o))} />
    </WorkforceFrame>
  );
}
