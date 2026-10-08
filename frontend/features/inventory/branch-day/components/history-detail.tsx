'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { Topbar } from '@/components/app/shell/topbar';
import { roleLabel } from '@/components/app/shell/role-label';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useWdsToastStore } from '@/store/wdsToastStore';
import {
  ListRowSkeleton,
  SkeletonRows,
  StockErrorCard,
  formatClock,
  formatCountDateFull,
  formatCountDateLong,
  formatDayMonthClock,
} from '@/features/inventory';
import { useDayActions, useDayDetail, useSavedDepartmentCount } from '../hooks/use-branch-day';
import { formatHistoryDate, formatNetKes, TONE_DOT } from '../lib/branch-day-format';
import { DepartmentRailRow } from './day-parts';
import { DepartmentListMobile, DepartmentPane, DetailSkeleton } from './department-count';
import { ReopenDay } from './reopen-day';
import type { BranchDayDetail, DepartmentTag } from '../types/branch-day';

const TAGS: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];
const isTag = (v: string | null): v is DepartmentTag => v !== null && (TAGS as string[]).includes(v);

/* ----------------------------------------------------------------- parts */

function DayStatusPill({ day, mobile = false }: { day: BranchDayDetail; mobile?: boolean }) {
  const closed = day.status === 'CLOSED';
  const label = closed ? (day.reopenCount > 0 ? (day.reopenCount === 1 ? 'Closed · reopened once' : `Closed · reopened ${day.reopenCount} times`) : 'Closed') : day.reopenCount > 0 ? 'Reopened · open' : 'Open';
  return (
    <span
      className={cn(
        'flex w-max shrink-0 items-center font-wds-sans',
        mobile ? 'gap-1.5 rounded-[12px] border px-2.5 py-1 text-[12px]/4' : 'gap-[5px] rounded-wds-sm px-2 py-[3px] text-[12px]/4',
        closed ? 'border-wds-success-border bg-wds-success-bg text-wds-success-fg' : 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
      )}
    >
      <span className={cn('size-[5px] shrink-0 rounded-full', closed ? TONE_DOT.success : TONE_DOT.warning)} aria-hidden />
      {label}
    </span>
  );
}

function subtitleFor(day: BranchDayDetail): string {
  if (day.status !== 'CLOSED') return `${day.branchName} branch · ${day.reopenCount > 0 ? 'reopened, not closed again yet' : 'never closed'}`;
  const closer = day.closedBy ? ` by ${day.closedBy.name}` : '';
  return `${day.branchName} branch · closed ${day.closedAt ? formatClock(day.closedAt) : ''}${closer} · all ${day.kpis.departmentsTotal} departments`;
}

const kpiLabel = 'font-mono text-[10px]/3 tracking-[0.06em] text-wds-text-copy-muted';

function KpiStrip({ day }: { day: BranchDayDetail }) {
  const k = day.kpis;
  const cells: { label: string; value: string; tone: string }[] = [
    { label: 'DEPARTMENTS CLOSED', value: `${k.departmentsClosed} / ${k.departmentsTotal}`, tone: k.departmentsClosed === k.departmentsTotal ? 'text-wds-success-fg' : 'text-wds-warning-fg' },
    { label: 'TOTAL GAPS', value: String(k.totalGaps), tone: k.totalGaps > 0 ? 'text-wds-error-fg' : 'text-wds-text-ink' },
    { label: 'NET ADJUSTMENT', value: formatNetKes(k.netAdjustmentValue), tone: 'text-wds-text-ink' },
    { label: 'REOPENS', value: String(k.reopens), tone: 'text-wds-text-ink' },
  ];
  return (
    <div className="flex shrink-0 overflow-hidden border-y border-wds-border">
      {cells.map((c, i) => (
        <div key={c.label} className={cn('flex h-[52px] grow basis-0 flex-col items-start justify-center gap-[5px] px-5 py-4', i < cells.length - 1 && 'border-r border-wds-border')}>
          <span className={cn(kpiLabel, 'font-wds-mono')}>{c.label}</span>
          <span className={cn('font-wds-mono text-[18px]/[22px] font-medium', c.tone)}>{c.value}</span>
        </div>
      ))}
    </div>
  );
}

function KpiGrid({ day }: { day: BranchDayDetail }) {
  const k = day.kpis;
  const cells: { label: string; value: string; tone: string }[] = [
    { label: 'DEPARTMENTS', value: `${k.departmentsClosed} / ${k.departmentsTotal}`, tone: k.departmentsClosed === k.departmentsTotal ? 'text-wds-success-fg' : 'text-wds-warning-fg' },
    { label: 'TOTAL GAPS', value: String(k.totalGaps), tone: k.totalGaps > 0 ? 'text-wds-error-fg' : 'text-wds-text-ink' },
    { label: 'NET ADJ.', value: formatNetKes(k.netAdjustmentValue), tone: 'text-wds-text-ink' },
    { label: 'REOPENS', value: String(k.reopens), tone: 'text-wds-text-ink' },
  ];
  return (
    <div className="mt-3 grid grid-cols-2 border-y border-wds-border bg-wds-surface">
      {cells.map((c, i) => (
        <div key={c.label} className={cn('flex flex-col gap-1 px-4 py-3', i % 2 === 0 && 'border-r border-wds-border', i < 2 && 'border-b border-wds-border')}>
          <span className="font-wds-mono text-[10px]/3 uppercase tracking-[0.06em] text-wds-text-copy-muted">{c.label}</span>
          <span className={cn('font-wds-mono text-[16px]/5 font-medium', c.tone)}>{c.value}</span>
        </div>
      ))}
    </div>
  );
}

/** The signed-document band (`1CSL-0`) — the document link, and Reopen only while the day is closed. */
function SignedBand({ day, onReopen, mobile = false }: { day: BranchDayDetail; onReopen: () => void; mobile?: boolean }) {
  const closed = day.status === 'CLOSED';
  const signedLine =
    closed && day.closedBy && day.closedAt
      ? `${day.closedBy.name} · PIN verified ${formatDayMonthClock(day.closedAt).replace(' · ', ' ')} · covers all ${day.kpis.departmentsTotal} departments`
      : (day.reopenCount > 0 ? 'Reopened — there is no signed document until it is closed again.' : 'This day was never closed, so there is no signed document.');
  const link = 'font-wds-sans text-[13px]/4 font-medium text-wds-primary outline-none transition-colors hover:text-wds-primary-hover focus-visible:shadow-wds-ring';
  if (mobile) {
    return (
      <div className="mx-4 mt-4 flex flex-col gap-2 border border-wds-border bg-wds-neutral-50 p-3.5">
        <div className="flex flex-col gap-2">
          <span className="font-wds-sans text-[14px]/[18px] font-medium text-wds-text-ink">{closed ? 'Signed day-close document' : day.reopenCount > 0 ? 'Reopened' : 'Not closed'}</span>
          <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">{signedLine}</span>
        </div>
        {closed ? (
          <Link href={`/app/branch/day/document/${day.id}`} className={cn(link, 'flex w-max items-center gap-1.5')}>
            View signed document <span aria-hidden>→</span>
          </Link>
        ) : (
          <Link href={`/app/branch/day?day=${day.id}`} className={cn(link, 'w-max')}>
            Continue this day →
          </Link>
        )}
        {closed ? (
          <Button variant="secondary" className="h-11 w-full shrink-0 !rounded-[4px] text-[15px]/[18px] font-medium" onClick={onReopen}>
            Reopen day
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-5 border border-wds-border bg-wds-neutral-50 px-5 py-4">
      <div className="flex grow basis-0 flex-col gap-0.5">
        <span className="font-wds-sans text-[14px]/[18px] font-medium text-wds-text-ink">{closed ? 'Signed day-close document' : day.reopenCount > 0 ? 'Reopened' : 'Not closed'}</span>
        <span className="font-wds-sans text-[13px]/4 text-wds-text-copy-muted">{signedLine}</span>
      </div>
      {closed ? (
        <Link href={`/app/branch/day/document/${day.id}`} className={cn(link, 'flex shrink-0 items-center gap-1.5')}>
          View signed document <span aria-hidden>→</span>
        </Link>
      ) : (
        <Link href={`/app/branch/day?day=${day.id}`} className={cn(link, 'flex shrink-0 items-center gap-1.5')}>
          Continue this day <span aria-hidden>→</span>
        </Link>
      )}
      {closed ? (
        <Button variant="secondary" className="h-8 shrink-0 !px-3.5 text-[13px]/4" onClick={onReopen}>
          Reopen day
        </Button>
      ) : null}
    </div>
  );
}

/** Reopen audit trail (`1CST-0`): who, when, why — append-only, oldest first. */
function AuditTrail({ day, mobile = false }: { day: BranchDayDetail; mobile?: boolean }) {
  return (
    <section className={cn('flex flex-col gap-2', mobile && 'mx-4 mt-4')} aria-label="Reopen audit trail">
      <h2 className={cn('font-wds-mono uppercase tracking-[0.06em] text-wds-text-copy-muted', mobile ? 'text-[10px]/[14px]' : 'text-[11px]/[14px]')}>Reopen audit trail</h2>
      {day.reopens.length === 0 ? (
        <div className={cn('flex flex-col gap-1 border border-wds-border', mobile ? 'p-3.5' : 'px-5 py-4')}>
          <p className={cn('font-wds-sans text-wds-text-copy-muted', mobile ? 'text-[12px]/[17px]' : 'text-[13px]/[18px]')}>
            {day.status === 'CLOSED' ? 'This day was closed once and has not been reopened — nothing to show here.' : 'This day has not been reopened — nothing to show here.'}
          </p>
          <p className={cn('font-wds-sans text-wds-text-faint', mobile ? 'text-[11px]/[15px]' : 'text-[12px]/4')}>
            If reopened, each entry records who, when, and why — re-closing recomputes adjustments and reverses superseded ones with linked ledger entries.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col border border-wds-border">
          {day.reopens.map((r) => (
            <li key={r.id} className={cn('flex flex-col gap-1 border-b border-wds-border last:border-b-0', mobile ? 'p-3.5' : 'px-5 py-3.5')}>
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-wds-sans text-[13px]/4 font-medium text-wds-text-ink">Reopened by {r.reopenedBy.name}</span>
                <span className="shrink-0 font-wds-mono text-[12px]/4 text-wds-text-copy-muted">{formatDayMonthClock(r.reopenedAt)}</span>
              </span>
              <span className="font-wds-sans text-[13px]/[18px] text-wds-text-copy-muted">{r.reason}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function BackHeader({ title, subtitle, onBack, label }: { title: string; subtitle: string; onBack: () => void; label: string }) {
  return (
    <header className="flex items-center gap-3 bg-wds-sidebar-top px-4 pb-4 pt-3">
      <button
        type="button"
        onClick={onBack}
        aria-label={label}
        className="-m-2 flex size-9 shrink-0 items-center justify-center rounded-wds-sm outline-none transition-transform duration-150 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.92]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path d="M15 18l-6-6 6-6" fill="none" stroke="var(--wds-sidebar-fg-active)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="flex min-w-0 grow basis-0 flex-col gap-0.5">
        <h1 className="truncate font-wds-sans text-[17px]/[22px] font-semibold text-wds-sidebar-fg-active">{title}</h1>
        <p className="truncate font-wds-sans text-wds-caption text-wds-sidebar-fg-item">{subtitle}</p>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- screen */

export function DayHistoryDetailScreen({ dayId }: { dayId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const user = useAuthStore((s) => s.user);
  const addToast = useWdsToastStore((s) => s.addToast);

  const { detail, status, reload } = useDayDetail(dayId);
  const deptParam = params.get('dept');
  const selectedTag: DepartmentTag | null = isTag(deptParam) ? deptParam : isDesktop ? (detail?.departments[0]?.summary.tag ?? null) : null;
  const saved = useSavedDepartmentCount(detail, selectedTag, status, reload);

  const [reopenOpen, setReopenOpen] = React.useState(false);
  const afterReopen = React.useCallback(async () => undefined, []);
  const actions = useDayActions(dayId, afterReopen);

  // Carry the list's filter back with the user (`?range=…`), never the department drill-in.
  const listQuery = React.useMemo(() => {
    const q = new URLSearchParams();
    for (const key of ['range', 'from', 'to']) {
      const v = params.get(key);
      if (v) q.set(key, v);
    }
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [params]);
  const listHref = `/app/branch/day/history${listQuery}`;

  const select = React.useCallback(
    (tag: DepartmentTag) => {
      const q = new URLSearchParams(params.toString());
      q.set('dept', tag);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [router, pathname, params],
  );
  const backToDay = React.useCallback(() => {
    const q = new URLSearchParams(params.toString());
    q.delete('dept');
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [router, pathname, params]);

  const onReopen = React.useCallback(
    async (reason: string) => {
      const ok = await actions.reopen(reason);
      if (ok) {
        addToast({ variant: 'success', title: 'Day reopened', description: 'Counts are editable again. Re-signing recomputes the adjustments.' });
        // A reopened past day is recounted and re-closed on the day screen, pointed at this day.
        router.push(`/app/branch/day?day=${dayId}`);
      }
      return ok;
    },
    [actions, addToast, router, dayId],
  );

  if (!hydrated) return null;

  const branchName = detail?.branchName ?? user?.organizationName ?? 'Branch';
  const actor = { name: user?.name ?? 'Branch Manager', roleLabel: roleLabel(user?.role) };
  const dateLong = detail ? formatCountDateLong(detail.date) : '';
  const summary = detail?.departments.find((d) => d.summary.tag === selectedTag)?.summary ?? null;

  const reopen = detail ? (
    <ReopenDay
      open={reopenOpen}
      onOpenChange={(o) => {
        setReopenOpen(o);
        if (!o) actions.clearError();
      }}
      variant={isDesktop ? 'desktop' : 'mobile'}
      today={detail}
      actor={actor}
      busy={actions.busy === 'reopen'}
      error={actions.error?.message ?? null}
      onSubmit={onReopen}
    />
  ) : null;

  const errorCard = (
    <StockErrorCard title="Couldn't load this day" description="Check your connection and try again." onRetry={reload} />
  );

  /* --------------------------------------------------------------- mobile */
  if (!isDesktop) {
    if (detail && summary && selectedTag) {
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
          <BackHeader
            title={`${summary.name} · end-of-day count`}
            subtitle={`${summary.countedBy ? `${summary.countedBy.name} · ` : ''}counted ${summary.countedAt ? formatClock(summary.countedAt) : '—'} · ${dateLong}`}
            onBack={backToDay}
            label={`Back to ${dateLong}`}
          />
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <DepartmentListMobile today={detail} summary={summary} count={saved} />
          </main>
          <div className="shrink-0 border-t border-wds-border bg-wds-surface px-4 pb-6 pt-3.5">
            <Button variant="secondary" className="h-[46px] w-full !rounded-[4px] text-[15px]/[18px]" onClick={() => router.push(listHref)}>
              Done — back to Day close history
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <BackHeader
          title={detail ? formatCountDateFull(detail.date) : 'Day close history'}
          subtitle={detail ? subtitleFor(detail).replace(' · all 5 departments', '') : branchName}
          onBack={() => router.push(listHref)}
          label="Back to Day close history"
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-6">
          {status === 'error' && !detail ? (
            <div className="py-10">{errorCard}</div>
          ) : !detail ? (
            <div aria-hidden className="flex flex-col gap-4 p-4" role="status">
              <span className="sr-only">Loading this day</span>
              <Skeleton className="h-6 w-20 rounded-[12px]" />
              <div className="grid grid-cols-2 gap-px">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
              <SkeletonRows count={5} label="Loading departments">
                {(i) => <ListRowSkeleton key={i} className="h-[68px]" />}
              </SkeletonRows>
            </div>
          ) : (
            <>
              <div className="px-4 pt-3">
                <DayStatusPill day={detail} mobile />
              </div>
              <KpiGrid day={detail} />
              <div className="flex flex-col gap-2 px-4 pt-4">
                <div className="border-b border-wds-border px-4 py-3">
                  <span className="block font-wds-mono text-[11px]/[14px] tracking-[0.04em] text-wds-text-copy-muted">DEPARTMENTS</span>
                </div>
                {detail.departments.map((d) => (
                  <DepartmentRailRow key={d.summary.tag} department={d.summary} mobile selected={false} onSelect={() => select(d.summary.tag)} />
                ))}
              </div>
              <SignedBand day={detail} mobile onReopen={() => setReopenOpen(true)} />
              <AuditTrail day={detail} mobile />
            </>
          )}
        </main>
        {reopen}
      </div>
    );
  }

  /* -------------------------------------------------------------- desktop */
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ root: `${branchName} / Day`, section: 'Day close history', sectionHref: listHref, screen: detail ? formatHistoryDate(detail.date) : '…' }}
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pb-10 pt-7">
        <div className="flex shrink-0 flex-col gap-1.5">
          <Link
            href={listHref}
            className="w-max font-wds-sans text-[13px]/4 text-wds-text-copy-muted outline-none transition-colors hover:text-wds-text-ink focus-visible:shadow-wds-ring"
          >
            ← Back to Day close history
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-wds-sans text-wds-mobile-title tracking-[-0.01em] text-wds-text-ink">{detail ? formatCountDateFull(detail.date) : <Skeleton className="h-7 w-56" />}</h1>
            {detail ? <DayStatusPill day={detail} /> : null}
          </div>
          <p className="font-wds-sans text-[14px]/[18px] text-wds-text-copy-muted">{detail ? subtitleFor(detail) : <Skeleton className="h-4 w-96" />}</p>
        </div>

        {status === 'error' && !detail ? (
          <div className="flex flex-1 items-center justify-center border-t border-wds-neutral-800">{errorCard}</div>
        ) : (
          <>
            {detail ? (
              <KpiStrip day={detail} />
            ) : (
              <div className="flex h-[54px] border-y border-wds-border" role="status" aria-live="polite">
                <span className="sr-only">Loading this day</span>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={cn('flex grow basis-0 flex-col justify-center gap-1.5 px-5', i < 3 && 'border-r border-wds-border')} aria-hidden>
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            )}
            <div className="flex min-h-[420px] shrink-0 border-t border-wds-neutral-800 bg-wds-surface">
              <div className="flex w-[380px] shrink-0 flex-col border-r border-wds-neutral-800" aria-label="Departments">
                <div className="flex items-center justify-between border-b border-wds-border px-5 py-3.5">
                  <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Departments</span>
                </div>
                <div className="flex grow flex-col">
                  {detail ? (
                    detail.departments.map((d) => (
                      <DepartmentRailRow key={d.summary.tag} department={d.summary} selected={d.summary.tag === selectedTag} onSelect={() => select(d.summary.tag)} />
                    ))
                  ) : (
                    <SkeletonRows count={5} label="Loading departments">
                      {(i) => <ListRowSkeleton key={i} className="h-[68px] px-5" />}
                    </SkeletonRows>
                  )}
                </div>
              </div>
              {detail && summary ? <DepartmentPane today={detail} summary={summary} count={saved} /> : <DetailSkeleton />}
            </div>
            {detail ? (
              <>
                <SignedBand day={detail} onReopen={() => setReopenOpen(true)} />
                <AuditTrail day={detail} />
              </>
            ) : null}
          </>
        )}
      </div>
      {reopen}
    </div>
  );
}
