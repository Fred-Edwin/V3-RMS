'use client';

import { useSearchParams } from 'next/navigation';
import * as React from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';

import { ErrorBlock, ListSkeleton, PhoneScreen, nameAndRole, useRemote } from '../../../_shared';
import { EyeButton } from '../../_shared/components/amount';
import { useAmountsShown } from '../../_shared/lib/amount-pref';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { monthLong, money, payLine } from '../../_shared/lib/pay-words';
import { payslipReads } from '../../_shared/services/payslip-services';
import { PayslipsDesktop } from '../../desktop/components/payslips-desktop';
import { PayslipBody, type PayslipView } from './payslip-body';

/**
 * One payslip on a phone, a full page (Paper Payroll chapter, step 31): the dark band, then `PayslipBody`. A desktop does not get a page:
 * it gets My payslips with this payslip open in a right drawer (frame 13.10), so the address still works there.
 */
export function PayslipDetailScreen({ id }: { id: string }) {
  const { matches: desktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const search = useSearchParams();
  const version = Number(search.get('v')) || null;
  // Opening a payslip is written to the audit trail, so the wrong layout must never mount (and fetch) for one frame.
  if (!hydrated) return null;
  if (desktop) return <PayslipsDesktop openId={id} openVersion={version} />;
  return <PayslipPage id={id} version={version} />;
}

function PayslipPage({ id, version }: { id: string; version: number | null }) {
  const user = useAuthStore((s) => s.user);
  const { shown, toggle } = useAmountsShown(user?.id ?? null);
  const [view, setView] = React.useState<PayslipView>('month');
  // Every payslip and every version opens on "This month"; the toggle is a choice for the screen in front of the person.
  React.useEffect(() => setView('month'), [id, version]);
  const slip = useRemote(() => payslipReads.detail(id, version), `${id}:${version ?? 'latest'}`);
  const d = slip.data;

  let body: React.ReactNode;
  if (slip.status === 'loading') body = <ListSkeleton rows={6} columns={['fill', 70]} label="Opening your payslip" />;
  else if (slip.status === 'error' && !d) {
    body = <ErrorBlock title={slip.error.status === 404 ? PAYSLIP_COPY.notFound : 'Your payslip did not load'} line={slip.error.code === 'NETWORK' ? PAYSLIP_COPY.offline : slip.error.status === 404 ? 'It may have been removed.' : PAYSLIP_COPY.loadError} onRetry={slip.error.status === 404 ? undefined : slip.reload} />;
  } else if (d) body = <PayslipBody d={d} shown={shown} view={view} onView={setView} />;

  const headSub = d ? `${d.employeeSummary.role ? `${d.employeeSummary.role}, ` : ''}${d.employeeSummary.organization} · ${payLine(d).text.replace(/^\w/, (c) => c.toLowerCase())}` : undefined;
  return (
    <PhoneScreen
      screen={PAYSLIP_COPY.screen}
      kicker={d ? `${monthLong(d.month).toUpperCase()}${d.number ? ` · ${d.number}` : ''}${d.versionNumber > 1 ? ` · VERSION ${d.versionNumber}` : ''}` : 'PAYSLIP'}
      back="/app/workforce/my-payslips"
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
