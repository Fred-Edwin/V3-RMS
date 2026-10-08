'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { Topbar } from '@/components/app/shell/topbar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { SkeletonRows, StockEmptyCard, StockErrorCard, TableRowSkeleton } from '@/features/inventory';
import { useDayHistory } from '../hooks/use-branch-day';
import {
  formatHistoryDate,
  formatNetKes,
  HISTORY_RANGE_LABEL,
  historyRange,
  historyStatus,
  openDayNote,
  todayNairobi,
  TONE_DOT,
  type HistoryRangeKey,
} from '../lib/branch-day-format';
import type { HistoryRow } from '../types/branch-day';

/* ------------------------------------------------------------ URL state */

const RANGE_KEYS: HistoryRangeKey[] = ['day', 'week', 'month', 'custom'];
const isRange = (v: string | null): v is HistoryRangeKey => v !== null && (RANGE_KEYS as string[]).includes(v);
const isDateOnly = (v: string | null): v is string => v !== null && /^\d{4}-\d{2}-\d{2}$/.test(v);

interface HistoryState {
  range: HistoryRangeKey;
  from: string;
  to: string;
}

/** The range lives in the URL (`?range=week`, `?range=custom&from=…&to=…`) so a filtered view is linkable. */
function useHistoryState(): [HistoryState, (next: { range: HistoryRangeKey; from?: string; to?: string }) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rangeParam = params.get('range');
  const range: HistoryRangeKey = isRange(rangeParam) ? rangeParam : 'day';
  const fromParam = params.get('from');
  const toParam = params.get('to');

  const state = React.useMemo<HistoryState>(() => {
    if (range === 'custom' && isDateOnly(fromParam) && isDateOnly(toParam) && fromParam <= toParam) return { range, from: fromParam, to: toParam };
    const preset = historyRange(range === 'custom' ? 'week' : range);
    return { range: range === 'custom' ? 'week' : range, ...preset };
  }, [range, fromParam, toParam]);

  const update = React.useCallback(
    (next: { range: HistoryRangeKey; from?: string; to?: string }) => {
      const q = new URLSearchParams();
      q.set('range', next.range);
      if (next.range === 'custom' && next.from && next.to) {
        q.set('from', next.from);
        q.set('to', next.to);
      }
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [router, pathname],
  );
  return [state, update];
}

/* --------------------------------------------------------- range control */

function RangeToggle({ value, onChange, mobile = false }: { value: HistoryRangeKey; onChange: (v: HistoryRangeKey) => void; mobile?: boolean }) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as HistoryRangeKey);
      }}
      aria-label="Date range"
      className={cn('flex items-center', mobile ? 'gap-2 overflow-x-auto px-4 pb-1 pt-3' : 'gap-1.5')}
    >
      {RANGE_KEYS.map((k) => (
        <ToggleGroupPrimitive.Item
          key={k}
          value={k}
          className={cn(
            'flex shrink-0 items-center gap-1.5 border font-wds-sans outline-none transition-[background-color,border-color,color] duration-200 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]',
            mobile ? 'touch-manipulation rounded-[14px] px-3.5 py-[7px] text-[12px]/4' : 'h-7 rounded-wds-sm px-3 py-[5px] text-[13px]/4',
            'data-[state=on]:border-wds-espresso-700 data-[state=on]:bg-wds-espresso-700 data-[state=on]:font-medium data-[state=on]:text-white',
            // Paper draws the selected chip borderless: 30px (mobile) / 26px (desktop) against 32 / 28 for the outlined ones.
            mobile ? 'data-[state=on]:h-[30px]' : 'data-[state=on]:h-[26px]',
            'data-[state=off]:bg-transparent data-[state=off]:text-wds-text-ink data-[state=off]:hover:bg-wds-neutral-100',
            mobile ? 'data-[state=off]:border-wds-border-strong' : 'data-[state=off]:border-wds-border',
          )}
        >
          {k === 'custom' ? (
            <svg width={mobile ? 13 : 14} height={mobile ? 13 : 14} viewBox="0 0 24 24" aria-hidden className="shrink-0">
              <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 10h18M8 2v4M16 2v4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
          {k === 'custom' ? (mobile ? 'Custom' : 'Custom range') : HISTORY_RANGE_LABEL[k]}
          {k === 'custom' && !mobile ? (
            <span className="font-wds-sans text-[10px]/3 font-normal text-wds-text-copy-muted" aria-hidden>
              ▾
            </span>
          ) : null}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

function CustomRangeFields({ from, to, onApply, mobile = false }: { from: string; to: string; onApply: (from: string, to: string) => void; mobile?: boolean }) {
  const [f, setF] = React.useState(from);
  const [t, setT] = React.useState(to);
  const invalid = Boolean(f && t && f > t);
  const tooLong = Boolean(f && t && !invalid && (Date.parse(t) - Date.parse(f)) / 86_400_000 > 92);
  const field =
    'h-7 rounded-wds-sm border border-wds-border bg-wds-surface px-2 font-wds-mono text-[12px]/4 text-wds-text-ink outline-none focus:border-wds-primary focus-visible:shadow-wds-ring aria-[invalid=true]:border-wds-error-fg';
  return (
    <form
      className={cn('flex items-center gap-1.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150', mobile ? 'flex-wrap px-4 pt-2' : 'ml-1')}
      onSubmit={(e) => {
        e.preventDefault();
        if (f && t && !invalid && !tooLong) onApply(f, t);
      }}
    >
      <label className="sr-only" htmlFor="history-from">
        From
      </label>
      <input id="history-from" type="date" value={f} max={todayNairobi()} onChange={(e) => setF(e.target.value)} className={field} aria-invalid={invalid || tooLong} />
      <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">to</span>
      <label className="sr-only" htmlFor="history-to">
        To
      </label>
      <input id="history-to" type="date" value={t} max={todayNairobi()} onChange={(e) => setT(e.target.value)} className={field} aria-invalid={invalid || tooLong} />
      <Button type="submit" variant="secondary" size="sm" className="h-7" disabled={!f || !t || invalid || tooLong}>
        Apply
      </Button>
      {tooLong ? (
        <span role="alert" className="font-wds-sans text-wds-caption text-wds-error-fg">
          Up to 92 days at a time
        </span>
      ) : null}
    </form>
  );
}

/* ------------------------------------------------------------------ rows */

const COL = {
  date: 'w-32 shrink-0',
  by: 'w-40 shrink-0',
  gaps: 'w-20 shrink-0 text-right',
  net: 'w-[140px] shrink-0 text-right',
  status: 'w-[120px] shrink-0',
  chevron: 'w-7 shrink-0 text-right',
};

const headCell = 'font-wds-mono text-[11px]/[14px] font-semibold tracking-[0.04em] text-wds-text-ink';

function StatusCell({ row }: { row: HistoryRow }) {
  const s = historyStatus(row);
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[s.tone])} aria-hidden />
      <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{s.label}</span>
    </span>
  );
}

function DesktopRow({ row, detailHref }: { row: HistoryRow; detailHref: string }) {
  return (
    <Link
      href={detailHref}
      className="group/row flex h-11 shrink-0 items-center gap-4 border-b border-wds-neutral-100 px-4 outline-none transition-colors duration-150 last:border-b-0 hover:bg-wds-neutral-100 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)]"
    >
      <span className={cn(COL.date, 'font-wds-sans text-[13px]/4 font-medium text-wds-text-ink')}>{formatHistoryDate(row.date)}</span>
      <span className={cn(COL.by, 'truncate font-wds-sans text-[13px]/4 text-wds-text-ink')}>{row.closedBy?.name ?? '—'}</span>
      <span className="grow font-wds-sans text-[13px]/4 text-wds-text-copy-muted">
        {row.status === 'CLOSED' ? `${row.departmentsClosed} of ${row.departmentsTotal} closed` : openDayNote(row)}
      </span>
      <span className={cn(COL.gaps, 'font-wds-mono text-[13px]/4', row.gapLines > 0 ? 'text-wds-warning-fg' : 'text-wds-text-faint')}>{row.gapLines}</span>
      <span className={cn(COL.net, 'font-wds-mono text-[13px]/4 text-wds-text-ink')}>{formatNetKes(row.netAdjustmentValue)}</span>
      <span className={COL.status}>
        <StatusCell row={row} />
      </span>
      <span
        className={cn(COL.chevron, 'font-wds-sans text-[14px]/[18px] text-wds-text-faint transition-transform duration-150 ease-out motion-safe:group-hover/row:translate-x-0.5')}
        aria-hidden
      >
        ›
      </span>
    </Link>
  );
}

function MobileRow({ row, detailHref }: { row: HistoryRow; detailHref: string }) {
  const s = historyStatus(row);
  const label = 'font-wds-mono text-[10px]/3 uppercase text-wds-text-copy-muted';
  return (
    <Link
      href={detailHref}
      className="flex flex-col gap-2 border-b border-wds-neutral-200 py-3.5 outline-none transition-colors duration-150 active:bg-wds-neutral-100 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)]"
    >
      <span className="flex min-h-[22px] items-baseline justify-between gap-3">
        <span className="font-wds-sans text-[15px]/[18px] font-semibold text-wds-text-ink">{formatHistoryDate(row.date)}</span>
        <span
          className={cn(
            'flex items-center gap-[5px] rounded-[10px] px-2 py-[3px] font-wds-sans text-[11px]/[14px]',
            s.tone === 'success' ? 'bg-wds-success-bg text-wds-success-fg' : 'bg-wds-warning-bg text-wds-warning-fg',
          )}
        >
          <span className={cn('size-[5px] shrink-0 rounded-full', TONE_DOT[s.tone])} aria-hidden />
          {s.label}
        </span>
      </span>
      <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
        {row.status === 'CLOSED'
          ? `Closed by ${row.closedBy ? row.closedBy.name : '—'} · ${row.departmentsClosed} of ${row.departmentsTotal} departments`
          : openDayNote(row)}
      </span>
      <span className="flex gap-5">
        <span className="flex flex-col gap-0.5">
          <span className={label}>Gaps</span>
          <span className={cn('font-wds-mono text-[13px]/4', row.gapLines > 0 ? 'text-wds-warning-fg' : 'text-wds-text-faint')}>{row.gapLines}</span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className={label}>Net adjustment</span>
          <span className="font-wds-mono text-[13px]/4 text-wds-text-ink">{formatNetKes(row.netAdjustmentValue)}</span>
        </span>
      </span>
    </Link>
  );
}

/* --------------------------------------------------------------- screen */

function listSkeletonRow(i: number, mobile: boolean) {
  return mobile ? (
    <div key={i} className="flex flex-col gap-2.5 border-b border-wds-neutral-200 px-4 py-3.5" aria-hidden>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-56" />
      <Skeleton className="h-3 w-40" />
    </div>
  ) : (
    <TableRowSkeleton key={i} widths={[80, 90, 56]} nameWidth={110} className="px-4" />
  );
}

export function DayHistoryScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [state, update] = useHistoryState();
  const { history, status, reload } = useDayHistory(state.from, state.to);
  const branchName = user?.organizationName ?? 'Branch';
  const query = `?range=${state.range}${state.range === 'custom' ? `&from=${state.from}&to=${state.to}` : ''}`;
  const detailHref = (row: HistoryRow) => `/app/branch/day/history/${row.id}${query}`;
  const days = history?.days ?? [];
  const showMonth = state.range !== 'month';

  if (!hydrated) return null;

  const body = (mobile: boolean) => {
    if (status === 'error' && !history) {
      return (
        <div className={mobile ? 'py-10' : 'py-12'}>
          <StockErrorCard title="Couldn't load day close history" description="Check your connection and try again." onRetry={reload} />
        </div>
      );
    }
    if (!history) {
      return (
        <SkeletonRows count={mobile ? 5 : 6} label="Loading day close history">
          {(i) => listSkeletonRow(i, mobile)}
        </SkeletonRows>
      );
    }
    if (days.length === 0) {
      return (
        <div className="flex justify-center py-12">
          <StockEmptyCard
            title="No closed days in this range"
            description="Days appear here once they're signed and closed."
            actionLabel={showMonth ? 'Show month' : undefined}
            onAction={showMonth ? () => update({ range: 'month' }) : undefined}
          />
        </div>
      );
    }
    return days.map((row) => (mobile ? <MobileRow key={row.id} row={row} detailHref={detailHref(row)} /> : <DesktopRow key={row.id} row={row} detailHref={detailHref(row)} />));
  };

  /* --------------------------------------------------------------- mobile */
  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <header className="flex items-center gap-3 bg-wds-sidebar-top px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={() => router.push('/app/branch/day')}
            aria-label="Back to Today's day"
            className="-m-2 flex size-9 shrink-0 items-center justify-center rounded-wds-sm outline-none transition-transform duration-150 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.92]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <path d="M15 18l-6-6 6-6" fill="none" stroke="var(--wds-sidebar-fg-active)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex min-w-0 grow basis-0 flex-col gap-0.5">
            <h1 className="truncate font-wds-sans text-[17px]/[22px] font-semibold text-wds-sidebar-fg-active">Day close history</h1>
            <p className="truncate font-wds-sans text-wds-caption text-wds-sidebar-fg-item">{branchName} · who, when, why</p>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <RangeToggle value={state.range} onChange={(range) => update({ range, from: state.from, to: state.to })} mobile />
          {state.range === 'custom' ? <CustomRangeFields key={`${state.from}${state.to}`} from={state.from} to={state.to} onApply={(from, to) => update({ range: 'custom', from, to })} mobile /> : null}
          <div className="flex flex-col px-4 pb-4 pt-1">{body(true)}</div>
        </main>
      </div>
    );
  }

  /* -------------------------------------------------------------- desktop */
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: branchName, screen: 'Day' }} className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <Link
            href="/app/branch/day"
            className="w-max font-wds-sans text-[13px]/4 text-wds-text-copy-muted outline-none transition-colors hover:text-wds-text-ink focus-visible:shadow-wds-ring"
          >
            ← Back to Today&apos;s day
          </Link>
          <h1 className="font-wds-sans text-wds-mobile-title tracking-[-0.01em] text-wds-text-ink">Day close history</h1>
          <p className="font-wds-sans text-[14px]/[18px] text-wds-text-copy-muted">
            Every closed day for {branchName} branch. Reopening a day is logged — who, when, why.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 font-wds-sans text-wds-caption text-wds-text-copy-muted">DATE RANGE</span>
          <RangeToggle value={state.range} onChange={(range) => update({ range, from: state.from, to: state.to })} />
          {state.range === 'custom' ? <CustomRangeFields key={`${state.from}${state.to}`} from={state.from} to={state.to} onApply={(from, to) => update({ range: 'custom', from, to })} /> : null}
        </div>
        <div className="flex flex-col rounded-wds-sm border border-wds-border">
          <div className="flex h-[30px] shrink-0 items-center gap-4 border-b border-wds-neutral-800 px-4">
            <span className={cn(COL.date, headCell)}>DATE</span>
            <span className={cn(COL.by, headCell)}>CLOSED BY</span>
            <span className={cn('grow', headCell)}>DEPARTMENTS</span>
            <span className={cn(COL.gaps, headCell)}>GAPS</span>
            <span className={cn(COL.net, headCell)}>NET ADJUSTMENT</span>
            <span className={cn(COL.status, headCell)}>STATUS</span>
            <span className={COL.chevron} aria-hidden />
          </div>
          {body(false)}
        </div>
        <p className="sr-only" aria-live="polite">
          {history ? `${days.length} days` : ''}
        </p>
      </div>
    </div>
  );
}
