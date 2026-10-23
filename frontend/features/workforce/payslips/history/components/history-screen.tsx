'use client';

import Link from 'next/link';
import * as React from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';

import { ChoiceChips, EmptyState, ErrorBlock, ListSkeleton, PhoneScreen, useRemote } from '../../../_shared';
import { EyeButton, HiddenNote } from '../../_shared/components/amount';
import { OldPayslipsCard } from '../../_shared/components/old-payslips-card';
import { PayslipRow } from '../../_shared/components/payslip-row';
import { useAmountsShown } from '../../_shared/lib/amount-pref';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { monthName } from '../../_shared/lib/pay-words';
import { payslipReads } from '../../_shared/services/payslip-services';
import { PayslipsDesktop } from '../../desktop/components/payslips-desktop';
import { P9CardBlock } from './p9-card';

/** Months shown before "Earlier in {year}" folds the rest (spec S4). */
const SHOWN_MONTHS = 7;

/** History by year (spec S4): the year's payslips, "Earlier in {year}" expands in place, and the year's P9 card. */
export function HistoryScreen() {
  const { matches: desktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  if (!hydrated) return null;
  // A desktop has the history in My payslips itself (frame 13.9).
  return desktop ? <PayslipsDesktop /> : <PhoneHistory />;
}

function PhoneHistory() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { shown, toggle } = useAmountsShown(userId);
  const [year, setYear] = React.useState<number | undefined>(undefined);
  const [open, setOpen] = React.useState(false);
  const history = useRemote(() => payslipReads.history(year), `history:${year ?? 'newest'}`);
  const d = history.data;
  const rows = d?.items ?? [];
  const head = open ? rows : rows.slice(0, SHOWN_MONTHS);
  const folded = rows.slice(SHOWN_MONTHS);
  const chosenYear = d?.p9?.year ?? d?.years[0];

  let body: React.ReactNode;
  if (history.status === 'loading') body = <ListSkeleton rows={5} columns={['fill', 60]} label="Opening your payslips" />;
  else if (history.status === 'error' && !d) body = <ErrorBlock title="Your payslips did not load" line={history.error.code === 'NETWORK' ? PAYSLIP_COPY.offline : PAYSLIP_COPY.loadError} onRetry={history.reload} />;
  else if (d) {
    body = (
      <>
        {d.legacy.card ? <OldPayslipsCard /> : null}
        {d.years.length === 0 && !d.legacy.card ? <EmptyState kind="nothingYet" {...(d.legacy.emptyReason === 'BRANCH_NOT_MOVED' ? PAYSLIP_COPY.emptyBranchNotMoved : PAYSLIP_COPY.empty)} /> : null}
        {d.years.length > 1 ? (
          <ChoiceChips legend="Year" legendStyle="caps" options={d.years.map((y) => ({ value: String(y), label: String(y) }))} value={String(chosenYear)} onChange={(v) => { setYear(Number(v)); setOpen(false); }} />
        ) : null}
        {rows.length > 0 ? (
          <>
            <ul className="m-0 list-none border border-wds-border bg-wds-surface p-0">
              {head.map((p) => (
                <PayslipRow key={p.id} item={p} shown={shown} />
              ))}
              {!open && folded.length > 0 ? (
                <li>
                  <button type="button" onClick={() => setOpen(true)} className="flex min-h-[44px] w-full items-center justify-between px-3.5 py-3 text-left font-wds-sans text-[13px] text-wds-text-secondary focus-visible:outline-none focus-visible:shadow-wds-ring">
                    <span>
                      Earlier in {chosenYear}: {folded.map((p) => monthName(p.month)).join(', ')}
                    </span>
                    <span aria-hidden>›</span>
                  </button>
                </li>
              ) : null}
            </ul>
            <HiddenNote shown={shown} />
          </>
        ) : null}
        {d.p9 ? <P9CardBlock p9={d.p9} /> : null}
        {d.legacy.historyRow ? (
          <Link href="/app/payslips" className="inline-flex min-h-[44px] items-center border border-wds-border bg-wds-surface px-3.5 font-wds-sans text-[14px] text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring">
            {PAYSLIP_COPY.oldRow} ›
          </Link>
        ) : null}
      </>
    );
  }

  const count = rows.length;
  return (
    <PhoneScreen
      screen={PAYSLIP_COPY.screen}
      kicker="PAYSLIPS · HISTORY"
      back="/app/workforce/my-payslips"
      title="All your payslips"
      subtitle={d && chosenYear ? `${chosenYear} · ${count} ${count === 1 ? 'payslip' : 'payslips'} · amounts ${shown ? 'shown' : 'hidden'}` : undefined}
      trailing={<EyeButton shown={shown} onToggle={toggle} />}
      desktopTitle="All your payslips"
      desktopActions={<EyeButton shown={shown} onToggle={toggle} onDark={false} />}
    >
      {body}
    </PhoneScreen>
  );
}
