'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { Topbar } from '@/components/app/shell/topbar';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { SignedBySignature } from '@/components/app/shell/sign-sheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { StockErrorCard, StockMobileHeader, formatClock, formatCountDateLong, formatCountDateShort, formatDayMonthClock } from '@/features/inventory';
import { formatNetKes } from '../lib/branch-day-format';
import { useDayDocument } from '../hooks/use-branch-day';
import type { DayDocument } from '../types/branch-day';

const yearOf = (dateOnly: string): string => dateOnly.slice(0, 4);
const shortWithYear = (dateOnly: string): string => `${formatCountDateShort(dateOnly)} ${yearOf(dateOnly)}`;

/** The signed day-close document (`19S2-0`): one summary per department, one signature covering the branch. Sizes are Paper's (`get_computed_styles`). */
function DocumentCard({ doc }: { doc: DayDocument }) {
  const monoLabel = 'font-wds-mono text-[10px]/3 tracking-[0.06em] text-wds-text-copy-muted';
  return (
    <div className="flex w-full max-w-[720px] shrink-0 flex-col overflow-hidden rounded-[4px] border border-wds-border bg-wds-surface">
      <div className="flex items-start justify-between gap-4 border-b-2 border-wds-text-ink px-8 pb-5 pt-7">
        <div className="flex min-w-0 flex-col">
          <span className="font-wds-sans text-[16px]/5 font-semibold text-wds-text-ink">Wendo Coffee Bistro — {doc.branchName} Branch</span>
          <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
            {doc.branchAddress}
            {doc.branchPhone ? ` · ${doc.branchPhone}` : ''}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-wds-mono text-[13px]/4 font-semibold tracking-[0.06em] text-wds-text-ink">DAY CLOSE</span>
          <span className="font-wds-mono text-[12px]/4 text-wds-text-copy-muted">
            {doc.branchName} · {shortWithYear(doc.date)}
          </span>
        </div>
      </div>
      <div className="flex items-start justify-between gap-10 border-b border-wds-border px-8 py-5">
        <div className="flex flex-col gap-1">
          <span className={monoLabel}>BRANCH</span>
          <span className="font-wds-sans text-[13px]/4 font-medium text-wds-text-ink">
            {doc.branchName} — all {doc.departments.length} departments
          </span>
          <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
            Day opened {formatClock(doc.openedAt)}, closed {formatClock(doc.closedAt)}
            {doc.reopenCount > 0 ? ` · reopened ${doc.reopenCount} ${doc.reopenCount === 1 ? 'time' : 'times'}` : ''}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={monoLabel}>CLOSED</span>
          <span className="font-wds-mono text-[13px]/4 text-wds-text-ink">
            {shortWithYear(doc.date)} · {formatClock(doc.closedAt)}
          </span>
        </div>
      </div>
      <div className="flex flex-col px-8 pt-1">
        <div className="flex items-center gap-4 border-b border-wds-text-ink pb-2">
          {[
            ['DEPARTMENT', 'grow-[2] basis-0'],
            ['ITEMS', 'grow basis-0 text-right'],
            ['GAPS', 'grow basis-0 text-right'],
            ['STATUS', 'grow-[1.4] basis-0 text-right'],
          ].map(([label, cls]) => (
            <span key={label} className={`font-wds-mono text-[10px]/3 font-semibold tracking-[0.06em] text-wds-text-ink ${cls}`}>
              {label}
            </span>
          ))}
        </div>
        {doc.departments.map((d) => (
          <div key={d.tag} className="flex items-center gap-4 border-b border-wds-neutral-100 py-2.5">
            <span className="grow-[2] basis-0 font-wds-sans text-[13px]/4 text-wds-text-ink">{d.name}</span>
            <span className="grow basis-0 text-right font-wds-mono text-[13px]/4 text-wds-text-copy-muted">{d.items}</span>
            <span className="grow basis-0 text-right font-wds-mono text-[13px]/4 text-wds-text-copy-muted">{d.gaps}</span>
            <span className="grow-[1.4] basis-0 text-right font-wds-sans text-[13px]/4 text-wds-text-copy-muted">{d.status}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 border-b border-wds-border bg-wds-neutral-50 px-8 py-3.5">
        <span className={monoLabel}>NOTES</span>
        <p className="font-wds-sans text-[12px]/[17px] text-wds-text-copy-muted">
          Per-department gaps above threshold carry a reason, recorded in-app. Net adjustment posted at close: {formatNetKes(doc.totals.netAdjustmentValue)}.
          This copy is a summary; drill into the branch&apos;s Day screen for the full per-item breakdown.
        </p>
      </div>
      <div className="flex gap-12 px-8 pb-7 pt-6">
        <SignedBySignature label="CLOSED BY" name={doc.closedBy.name} roleLine={`Branch Manager · PIN verified ${formatDayMonthClock(doc.closedAt)}`} />
        <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
          <span className={monoLabel}>COVERAGE</span>
          <span className="h-8 shrink-0 font-wds-sans text-[13px]/4 text-wds-text-faint">One signature — {doc.departments.map((d) => d.name).join(', ')}</span>
          <div className="h-px bg-wds-border-strong" />
          <span className="font-wds-sans text-[11px]/[14px] text-wds-text-copy-muted">
            All {doc.departments.length} departments · {doc.branchName}
          </span>
        </div>
      </div>
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-4 rounded-wds-sm border border-wds-border bg-wds-surface p-8" role="status" aria-live="polite">
      <span className="sr-only">Loading the signed document</span>
      <Skeleton className="h-6 w-72" />
      <Skeleton className="h-4 w-48" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

export function DayDocumentScreen({ dayId }: { dayId: string }) {
  const router = useRouter();
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { doc, status, reload } = useDayDocument(dayId);
  if (!hydrated) return null;

  const dateLong = doc ? formatCountDateLong(doc.date) : '';
  const printHref = `/app/branch/day-print/${dayId}`;
  const body =
    status === 'error' && !doc ? (
      <StockErrorCard
        title="Couldn't load the signed document"
        description="Check your connection and try again. The day itself is unchanged."
        onRetry={reload}
      />
    ) : doc ? (
      <DocumentCard doc={doc} />
    ) : (
      <DocumentSkeleton />
    );

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar className="bg-wds-sidebar-top" />
        <StockMobileHeader
          title={`Day close · ${dateLong}`}
          subtitle={doc ? `${doc.branchName} · signed ${formatClock(doc.closedAt)}` : 'Loading…'}
          onBack={() => router.push('/app/branch/day')}
          trailingLabel="Print"
          onTrailing={() => window.open(printHref, '_blank')}
        />
        <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-4">{body}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{
          root: 'Day',
          section: doc?.branchName ?? 'Branch',
          screen: `Day close · ${dateLong}`,
        }}
        actions={
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={() => router.push('/app/branch/day')}>
              Back to Day
            </Button>
            <Button variant="secondary" disabled={!doc} onClick={() => window.open(printHref, '_blank')}>
              Print
            </Button>
          </div>
        }
        className="shrink-0"
      />
      <div className="flex flex-1 items-start justify-center overflow-y-auto px-8 pb-10 pt-8">{body}</div>
    </div>
  );
}

/** A4 print (`19S2-0` print variant) — Times New Roman like the delivery note and count verification. */
export function PrintableDayDocument({ doc }: { doc: DayDocument }) {
  const label = 'text-[11px] font-bold uppercase leading-[14px] tracking-[0.06em] text-[#777777]';
  return (
    <div className="mx-auto flex min-h-[1123px] w-[794px] flex-col bg-white font-['Times_New_Roman',serif] text-[#111111] print:w-full">
      <div className="flex flex-col gap-5 px-12 pt-10">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="text-[30px] font-bold leading-9 tracking-[0.01em]">Wendo Coffee Bistro</div>
            <div className="text-[12px] leading-4 tracking-[0.02em] text-[#555555]">
              {doc.branchName} Branch · {doc.branchAddress}
              {doc.branchPhone ? ` · ${doc.branchPhone}` : ''}
            </div>
          </div>
          <div className="flex flex-col items-end gap-[3px]">
            <div className="text-[18px] font-bold leading-6 tracking-[0.08em]">DAY CLOSE</div>
            <div className="text-[12px] leading-4 text-[#555555]">{doc.reference}</div>
            <div className="text-[12px] leading-4 text-[#555555]">{shortWithYear(doc.date)}</div>
          </div>
        </div>
        <div className="h-[2px] bg-[#111111]" />
        <div className="flex justify-between">
          <div className="flex flex-col gap-1">
            <div className={label}>Branch</div>
            <div className="text-[14px] leading-5">
              {doc.branchName} — all {doc.departments.length} departments
            </div>
            <div className="text-[12px] leading-4 text-[#555555]">
              Day opened {formatClock(doc.openedAt)}, closed {formatClock(doc.closedAt)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={label}>Closed</div>
            <div className="text-[14px] leading-5">
              {shortWithYear(doc.date)} · {formatClock(doc.closedAt)}
            </div>
          </div>
        </div>
        <table className="w-full border-collapse text-[13px] leading-5">
          <thead>
            <tr className="border-b-2 border-[#111111] text-left">
              <th className={`${label} py-2`}>Department</th>
              <th className={`${label} py-2 text-right`}>Items</th>
              <th className={`${label} py-2 text-right`}>Gaps</th>
              <th className={`${label} py-2 text-right`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {doc.departments.map((d) => (
              <tr key={d.tag} className="border-b border-[#dddddd]">
                <td className="py-2">{d.name}</td>
                <td className="py-2 text-right">{d.items}</td>
                <td className="py-2 text-right">{d.gaps}</td>
                <td className="py-2 text-right">{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="bg-[#f4f4f4] px-4 py-3 text-[12px] leading-[17px] text-[#555555]">
          Per-department gaps above threshold carry a reason, recorded in-app. Net adjustment posted at close: {formatNetKes(doc.totals.netAdjustmentValue)}.
          This copy is a summary; the full per-item breakdown is in the branch&apos;s Day screen.
        </div>
        <div className="mt-6 flex justify-between gap-10">
          <div className="flex flex-col gap-1">
            <div className={label}>Closed by</div>
            <div className="font-wds-signature text-[30px] leading-8">{doc.closedBy.name}</div>
            <div className="h-px w-[220px] bg-[#111111]" />
            <div className="text-[12px] leading-4 text-[#555555]">Branch Manager · PIN verified {formatDayMonthClock(doc.closedAt)}</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className={label}>Coverage</div>
            <div className="text-[13px] leading-5 text-[#555555]">One signature — {doc.departments.map((d) => d.name).join(', ')}</div>
            <div className="h-px w-[260px] bg-[#111111]" />
            <div className="text-[12px] leading-4 text-[#555555]">
              All {doc.departments.length} departments · {doc.branchName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
