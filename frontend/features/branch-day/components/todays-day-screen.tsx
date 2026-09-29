'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { Topbar } from '@/components/app/shell/topbar';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { roleLabel } from '@/components/app/shell/role-label';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { ListRowSkeleton, PinSheet, SkeletonRows, StockErrorCard, formatClock, formatCountDateLong } from '@/features/inventory';
import { useBranchDayToday, useDayActions, useDepartmentCount } from '../hooks/use-branch-day';
import { todayNairobi } from '../lib/branch-day-format';
import { BranchThresholdsDrawer } from './branch-thresholds-drawer';
import { DayFooter, DayKpiGrid, DayKpiStrip, DepartmentRailRow } from './day-parts';
import { DepartmentListMobile, DepartmentPane, DetailSkeleton } from './department-count';
import { ReopenDay } from './reopen-day';
import type { DepartmentTag } from '../types/branch-day';

const TAGS: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];
const isTag = (v: string | null): v is DepartmentTag => v !== null && (TAGS as string[]).includes(v);

function KpiSkeleton() {
  return (
    <div className="mx-6 mb-5 flex shrink-0 overflow-hidden rounded-wds-md border border-wds-border" role="status" aria-live="polite">
      <span className="sr-only">Loading today&apos;s day</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={cn('flex grow basis-0 flex-col gap-1.5 p-4', i > 0 && 'border-l border-wds-border')} aria-hidden>
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Mobile overview header (`1CDC-0`): back · title + subtitle · Thresholds · History. */
function OverviewHeader({ title, subtitle, onBack, onThresholds }: { title: string; subtitle: string; onBack: () => void; onThresholds: () => void }) {
  return (
    <header className="flex items-center gap-3 bg-wds-sidebar-top px-4 pb-4 pt-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
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
      <div className="flex shrink-0 items-center gap-4">
        <button
          type="button"
          onClick={onThresholds}
          className="shrink-0 rounded-wds-sm py-1 font-wds-sans text-[13px]/4 text-wds-sidebar-fg-item outline-none transition-colors hover:text-wds-sidebar-fg-active focus-visible:shadow-wds-ring"
        >
          Thresholds
        </button>
        <Link
          href="/app/branch/day/history"
          className="shrink-0 rounded-wds-sm py-1 font-wds-sans text-[13px]/4 text-wds-sidebar-fg-item outline-none transition-colors hover:text-wds-sidebar-fg-active focus-visible:shadow-wds-ring"
        >
          History
        </Link>
      </div>
    </header>
  );
}

export function TodaysDayScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const user = useAuthStore((s) => s.user);
  const addToast = useWdsToastStore((s) => s.addToast);

  // `?day=<id>` points the screen at one of the branch's own past days — how a reopened day is recounted and re-closed.
  const dayParam = params.get('day');
  const { today, status, reload } = useBranchDayToday(dayParam);
  const deptParam = params.get('dept');
  const selectedTag: DepartmentTag | null = isTag(deptParam) ? deptParam : isDesktop ? (today?.departments[0]?.tag ?? null) : null;
  const selectedSummary = today?.departments.find((d) => d.tag === selectedTag) ?? null;

  const refreshToday = React.useCallback(() => void reload(), [reload]);
  const count = useDepartmentCount(today?.id ?? null, selectedSummary ? selectedTag : null, refreshToday);

  const [signOpen, setSignOpen] = React.useState(false);
  const [reopenOpen, setReopenOpen] = React.useState(false);
  const [thresholdsOpen, setThresholdsOpen] = React.useState(false);

  const afterAction = React.useCallback(async () => {
    await Promise.all([reload(), count.reload()]);
  }, [reload, count]);
  const actions = useDayActions(today?.id ?? null, afterAction);

  const dayQuery = dayParam ? `day=${dayParam}&` : '';
  const select = React.useCallback((tag: DepartmentTag) => router.replace(`${pathname}?${dayQuery}dept=${tag}`, { scroll: false }), [router, pathname, dayQuery]);
  const backToOverview = React.useCallback(() => router.replace(dayParam ? `${pathname}?day=${dayParam}` : pathname, { scroll: false }), [router, pathname, dayParam]);

  // Any typing not yet sent is saved before the day can be signed — the button reads server state.
  const openSign = React.useCallback(async () => {
    await count.flush();
    await reload();
    setSignOpen(true);
  }, [count, reload]);

  const onSign = React.useCallback(
    async (pin: string) => {
      const ok = await actions.close(pin);
      if (ok) {
        setSignOpen(false);
        addToast({
          variant: 'success',
          title: 'Day closed',
          description: 'The count is signed and the adjustments are posted to each department’s ledger.',
        });
      }
    },
    [actions, addToast],
  );

  const onReopen = React.useCallback(
    async (reason: string) => {
      const ok = await actions.reopen(reason);
      if (ok)
        addToast({
          variant: 'success',
          title: 'Day reopened',
          description: 'Counts are editable again. Re-signing recomputes the adjustments.',
        });
      return ok;
    },
    [actions, addToast],
  );

  if (!hydrated) return null;

  const branchName = today?.branchName ?? user?.organizationName ?? 'Branch';
  const actor = {
    name: user?.name ?? 'Branch Manager',
    roleLabel: roleLabel(user?.role),
  };
  const dateLong = today ? formatCountDateLong(today.date) : '';
  // Today's own day keeps its name; any other day is named by its date so a reopened past day is never mistaken for today.
  const isOtherDay = Boolean(dayParam && today && today.date !== todayNairobi());
  const dayTitle = isOtherDay ? dateLong : "Today's day";

  const overlays = today ? (
    <>
      <PinSheet
        open={signOpen}
        onOpenChange={(o) => {
          setSignOpen(o);
          if (!o) actions.clearError();
        }}
        title="Sign & close day"
        subtitle={`${branchName} · ${dateLong}`}
        note="Signing closes all departments and posts each gap as an adjustment. You can reopen the day if a count needs correcting."
        confirmLabel="Sign & close"
        submitting={actions.busy === 'close'}
        error={actions.error}
        onSubmit={(pin) => void onSign(pin)}
      />
      <ReopenDay
        open={reopenOpen}
        onOpenChange={(o) => {
          setReopenOpen(o);
          if (!o) actions.clearError();
        }}
        variant={isDesktop ? 'desktop' : 'mobile'}
        today={today}
        actor={actor}
        busy={actions.busy === 'reopen'}
        error={actions.error?.message ?? null}
        onSubmit={onReopen}
      />
    </>
  ) : null;
  const thresholds = (
    <BranchThresholdsDrawer
      open={thresholdsOpen}
      onOpenChange={setThresholdsOpen}
      variant={isDesktop ? 'desktop' : 'mobile'}
      branchName={branchName}
      onSaved={refreshToday}
    />
  );

  /* --------------------------------------------------------------- mobile */
  if (!isDesktop) {
    if (selectedTag && selectedSummary && today) {
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
          <MobileStatusBar className="bg-wds-sidebar-top" />
          <header className="flex items-center gap-3 bg-wds-sidebar-top px-4 pb-4 pt-3">
            <button
              type="button"
              onClick={backToOverview}
              aria-label="Back to Today's day"
              className="-m-2 flex size-9 shrink-0 items-center justify-center rounded-wds-sm outline-none transition-transform duration-150 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.92]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                <path d="M15 18l-6-6 6-6" fill="none" stroke="var(--wds-sidebar-fg-active)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex min-w-0 grow basis-0 flex-col gap-0.5">
              <h1 className="truncate font-wds-sans text-[17px]/[22px] font-semibold text-wds-sidebar-fg-active">{selectedSummary.name} · end-of-day count</h1>
              <p className="truncate font-wds-sans text-wds-caption text-wds-sidebar-fg-item">
                {today.status === 'CLOSED'
                  ? 'Read-only — the day is closed'
                  : selectedSummary.status === 'COUNTED' && selectedSummary.countedBy
                    ? `${selectedSummary.countedBy.name} · counted ${selectedSummary.countedAt ? formatClock(selectedSummary.countedAt) : ''}`
                    : `Enter what's on the shelf · ${count.progress.counted} of ${count.progress.total} counted`}
              </p>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <DepartmentListMobile today={today} summary={selectedSummary} count={count} />
          </main>
          <div className="shrink-0 border-t border-wds-border bg-wds-surface px-4 pb-6 pt-3.5">
            <Button variant="secondary" className="h-[46px] w-full !rounded-[4px] text-[15px]/[18px]" onClick={backToOverview}>
              Done — back to Today&apos;s day
            </Button>
          </div>
          {overlays}
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar className="bg-wds-sidebar-top" />
        <OverviewHeader title={dayTitle} subtitle={`${branchName} · count and close`} onBack={() => router.back()} onThresholds={() => setThresholdsOpen(true)} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {status === 'error' && !today ? (
            <div className="py-10">
              <StockErrorCard
                title="Couldn't load today's day"
                description="Check your connection and try again. Counts already entered are saved."
                onRetry={reload}
              />
            </div>
          ) : !today ? (
            <>
              <div className="grid grid-cols-2 border-b border-wds-border" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-1.5 border-wds-border px-4 py-3">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
              <SkeletonRows count={5} label="Loading departments">
                {(i) => <ListRowSkeleton key={i} className="h-[68px] px-4" />}
              </SkeletonRows>
            </>
          ) : (
            <>
              <DayKpiGrid today={today} />
              <div className="border-b border-wds-border px-4 py-3">
                <span className="font-wds-mono text-[11px]/[14px] tracking-[0.04em] text-wds-text-copy-muted">DEPARTMENTS</span>
              </div>
              {today.departments.map((d) => (
                <DepartmentRailRow key={d.tag} department={d} mobile selected={false} onSelect={() => select(d.tag)} />
              ))}
              <div className="min-h-4 grow" />
            </>
          )}
        </main>
        {today ? <DayFooter today={today} mobile onSign={() => void openSign()} onReopen={() => setReopenOpen(true)} /> : null}
        {overlays}
        {thresholds}
      </div>
    );
  }

  /* -------------------------------------------------------------- desktop */
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: branchName, screen: 'Day' }}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/branch/day/history">History</Link>
            </Button>
            <Button variant="secondary" onClick={() => setThresholdsOpen(true)}>
              Thresholds
            </Button>
          </>
        }
        className="shrink-0"
      />
      <div className="flex shrink-0 flex-col gap-1 px-6 pb-5 pt-6">
        <h1 className="font-wds-sans text-wds-mobile-title text-wds-text-ink">{dayTitle}</h1>
        <p className="font-wds-sans text-[14px]/[18px] text-wds-text-copy-muted">
          All five departments — count and close status, at a glance. Any department blocked by an unconfirmed dispatch is flagged.
        </p>
      </div>

      {status === 'error' && !today ? (
        <div className="flex min-h-0 flex-1 items-center justify-center border-t border-wds-neutral-800">
          <StockErrorCard
            title="Couldn't load today's day"
            description="Check your connection and try again. Counts already entered are saved."
            onRetry={reload}
          />
        </div>
      ) : (
        <>
          {today ? <DayKpiStrip today={today} /> : <KpiSkeleton />}
          <div className="flex min-h-0 flex-1 border-t border-wds-neutral-800 bg-wds-surface">
            <div className="flex w-[380px] shrink-0 flex-col border-r border-wds-neutral-800" aria-label="Departments">
              <div className="flex items-center justify-between border-b border-wds-border px-5 py-3.5">
                <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Departments</span>
              </div>
              <div className="flex min-h-0 grow flex-col overflow-y-auto">
                {today ? (
                  today.departments.map((d) => <DepartmentRailRow key={d.tag} department={d} selected={d.tag === selectedTag} onSelect={() => select(d.tag)} />)
                ) : (
                  <SkeletonRows count={5} label="Loading departments">
                    {(i) => <ListRowSkeleton key={i} className="h-[68px] px-5" />}
                  </SkeletonRows>
                )}
              </div>
              {today ? <DayFooter today={today} onSign={() => void openSign()} onReopen={() => setReopenOpen(true)} /> : null}
            </div>
            {today && selectedSummary ? <DepartmentPane today={today} summary={selectedSummary} count={count} /> : <DetailSkeleton />}
          </div>
        </>
      )}
      {overlays}
      {thresholds}
    </div>
  );
}
