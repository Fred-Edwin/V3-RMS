'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui2/select';
import { Skeleton } from '@/components/ui2/skeleton';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { RefLink } from '../../../_shared/components/block2-phone-parts';
import { useLoader } from '../../../_shared/hooks/use-async';
import { ConfirmForDepartmentDrawer } from '../../../dispatch';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_MESSAGES, BRANCH_DAY_STATES_COPY, blockersHeading } from '../../_shared/lib/branch-day-copy';
import type { Blocker, CloseDayResult, Today } from '../../_shared/types/branch-day-contract';
import { useDayAccess, useDayBase } from '../hooks/use-day-access';
import { dayPaths } from '../lib/desk-paths';
import { clock12, kes, longDay, signedUnits } from '../lib/desk-format';
import { branchDayDeskApi } from '../services/branch-day-desk-api';
import { CloseDayDrawer } from './close-drawer';
import { CountForDrawer } from './count-for-drawer';
import { DayTopbar } from './day-topbar';
import { CheckDisc } from './day-parts';
import { BlockerRows, DepartmentCard } from './today-parts';

const BRANCH_PARAM = 'branch';

/**
 * Block 4, desktop: Today (Paper B5, B7, B9, B14, B16). One screen for every desktop role: the Branch Manager's own branch with the Close the
 * day button and the count-on-behalf and confirm-for actions, or a hub role's read-only view with a branch picker and no Close button. The
 * server's table decides which (`useDayAccess`); each response decides what a given day allows (`can`).
 */
export function TodayScreen() {
  const access = useDayAccess();
  if (access.failed) return <ScwStatePanel kind="error" text={BRANCH_DAY_STATES_COPY.today.error} className="m-8" />;
  if (!access.ready) return <TodaySkeleton />;
  if (access.view === 'none') return <ScwStatePanel kind="permission" text={BRANCH_DAY_STATES_COPY.today.permission} className="m-8" />;
  return <TodayView everyBranch={access.view === 'all'} seesMoney={access.seesMoney} canConfirmOnBehalf={access.canConfirmOnBehalf} />;
}

function TodaySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-hidden="true">
      <LoadingAnnouncer text={BRANCH_DAY_STATES_COPY.today.loading} />
      <div className="h-14 shrink-0 border-b border-wds-border bg-wds-gradient-topbar" />
      <div className="flex flex-col gap-5 px-8 pt-7">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[30px] w-32" />
          <Skeleton className="h-[18px] w-72" />
        </div>
        <div className="grid grid-cols-1 gap-3 min-[768px]:grid-cols-3 min-[1280px]:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[232px] w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

function TodayView({ everyBranch, seesMoney, canConfirmOnBehalf }: { everyBranch: boolean; seesMoney: boolean; canConfirmOnBehalf: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const base = useDayBase();
  const paths = dayPaths(base);
  const branchParam = everyBranch ? params.get(BRANCH_PARAM) ?? undefined : undefined;

  const today = useLoader<Today>(`today:${branchParam ?? ''}`, () => branchDayDeskApi.today({ branchId: branchParam }), BRANCH_DAY_STATES_COPY.today.error);
  const { reload } = today;
  const [closeOpen, setCloseOpen] = React.useState(false);
  // The drawers stay mounted while they close (the item is kept, only `open` flips), so focus can go back to the button that opened them.
  const [countFor, setCountFor] = React.useState<{ department: { id: string; name: string }; open: boolean } | null>(null);
  const [confirming, setConfirming] = React.useState<{ blocker: Blocker; open: boolean } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState('');
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const closeButton = React.useRef<HTMLButtonElement>(null);
  const previous = React.useRef<Today | null>(null);
  // The row a drawer was opened from can disappear once the work is done; focus then goes to the next thing to do, not to the page body.
  const returnFocus = React.useRef<'close' | 'title' | null>(null);

  // Contract §8: no socket event; the screen refetches after a write and when the tab comes back into focus.
  React.useEffect(() => {
    const onFocus = (): void => {
      if (document.visibilityState === 'visible') void reload();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [reload]);

  // Say which department has just counted (gap G6) when a reload brings it.
  React.useEffect(() => {
    const now = today.data;
    const before = previous.current;
    previous.current = now;
    if (returnFocus.current && now?.day) {
      const target = returnFocus.current === 'close' && now.day.canClose ? closeButton.current : titleRef.current;
      returnFocus.current = null;
      target?.focus();
    }
    if (!now?.day || !before?.day) return;
    for (const d of now.day.departments) {
      const was = before.day.departments.find((x) => x.departmentId === d.departmentId);
      if (was && was.state === 'NOT_COUNTED' && d.state === 'COUNTED') setAnnounce(`${d.name} has counted`);
    }
  }, [today.data]);

  const setBranch = (value: string): void => {
    const q = new URLSearchParams(params.toString());
    q.set(BRANCH_PARAM, value);
    router.replace(`${pathname}?${q}`, { scroll: false });
  };

  if (today.status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DayTopbar breadcrumb={{ section: everyBranch ? 'Branches' : 'Branch', screen: 'Day' }} />
        <ScwStatePanel kind="error" text={BRANCH_DAY_STATES_COPY.today.error} onRetry={reload} className="m-8" />
      </div>
    );
  }
  const data = today.data;
  if (!data) return <TodaySkeleton />;

  const { branch, day, can } = data;
  const dateLabel = day ? longDay(day.head.date) : '';
  const countedOnDay = day?.departments.length ?? 0;
  const firstBlocking = day ? day.blockers.findIndex((b) => b.severity === 'BLOCKS') : -1;
  const heading = day ? blockersHeading(day.canClose, day.summary.todo, day.summary.toKnow) : null;

  const onClosed = (result: CloseDayResult): void => {
    setCloseOpen(false);
    setNotice(null);
    returnFocus.current = 'title';
    void reload();
    useWdsToastStore.getState().addToast({ variant: 'success', title: 'Day closed', description: `${result.entryCount} usage entries were written to the stock ledger.` });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DayTopbar breadcrumb={{ section: everyBranch ? 'Branches' : 'Branch', screen: 'Day' }} />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pb-10 pt-7">
        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 ref={titleRef} tabIndex={-1} className="m-0 font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink outline-none">
              Today
            </h1>
            <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">
              {branch.name}
              {day ? (
                <>
                  {' '}
                  · {dateLabel} · <RefLink reference={day.head.reference} href={day.head.status === 'OPEN' ? paths.today(everyBranch ? branch.id : undefined) : paths.file(day.head.id)} className="text-[14px]" />
                </>
              ) : null}
            </p>
          </div>
          {everyBranch && data.branches ? (
            <Select value={branch.id} onValueChange={setBranch}>
              <SelectTrigger aria-label="Branch" className="h-9 w-auto gap-2 !rounded-none border-wds-text-ink px-3 text-[14px] leading-[18px]">
                <span>Branch: {branch.name}</span>
              </SelectTrigger>
              <SelectContent>
                {data.branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {!day ? (
          <ScwStatePanel kind="empty" text={everyBranch ? `No open day at ${branch.name} yet.` : BRANCH_DAY_STATES_COPY.today.empty} />
        ) : day.closed ? (
          <ClosedSection
            reference={day.head.reference}
            dayId={day.head.id}
            closed={day.closed}
            usedValueKes={seesMoney ? day.usedValueKes ?? null : null}
            fileHref={paths.file(day.head.id)}
            activityHref={paths.file(day.head.id, 'activity')}
            printHref={paths.print(day.head.id)}
          />
        ) : (
          <>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[768px]:grid-cols-3 min-[1280px]:grid-cols-5" aria-label="Departments">
              {day.departments.map((t) => (
                <DepartmentCard key={t.departmentId} tile={t} showMoney={seesMoney && t.usedValueKes !== undefined} figuresHref={paths.figures(day.head.id, t.departmentId, everyBranch ? branch.id : undefined)} />
              ))}
            </ul>

            <section aria-labelledby="blockers-heading" className="flex flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-wds-text-ink pb-3">
                <div className="flex flex-col gap-0.5">
                  <h2 id="blockers-heading" className="m-0 font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">
                    {heading?.title}
                  </h2>
                  <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{heading?.line}</p>
                </div>
                {can.close ? (
                  <Button
                    ref={closeButton}
                    size="xl"
                    className={cn('shrink-0', !day.canClose && 'opacity-[0.45]')}
                    aria-disabled={!day.canClose ? true : undefined}
                    aria-describedby={!day.canClose && firstBlocking >= 0 ? `blocker-${firstBlocking}` : undefined}
                    onClick={() => {
                      if (day.canClose) {
                        setNotice(null);
                        setCloseOpen(true);
                      }
                    }}
                  >
                    {BRANCH_DAY_BUTTONS.closeDay}
                  </Button>
                ) : null}
              </div>
              {notice ? (
                <p role="alert" className="m-0 border-b border-wds-warning-border bg-wds-warning-bg px-2 py-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">
                  {notice}
                </p>
              ) : null}
              <BlockerRows
                blockers={day.blockers}
                departmentCount={countedOnDay}
                rowIds
                discrepancyHref={paths.discrepancy}
                actions={{
                  countFor: can.countOnBehalf ? (department) => setCountFor({ department, open: true }) : undefined,
                  confirmFor: canConfirmOnBehalf && can.close ? (blocker) => setConfirming({ blocker, open: true }) : undefined,
                }}
              />
            </section>
          </>
        )}
      </main>

      {day && can.close && !day.closed ? (
        <CloseDayDrawer
          dayId={day.head.id}
          branchName={branch.name}
          dateLabel={dateLabel}
          reference={day.head.reference}
          referenceHref={paths.today(everyBranch ? branch.id : undefined)}
          open={closeOpen}
          onOpenChange={setCloseOpen}
          onClosed={onClosed}
          onStale={(message) => {
            setCloseOpen(false);
            setNotice(message);
            void reload();
          }}
        />
      ) : null}
      {can.countOnBehalf ? (
        <CountForDrawer
          department={countFor?.department ?? null}
          open={countFor?.open ?? false}
          onOpenChange={(open) => {
            if (!open) setCountFor((c) => (c ? { ...c, open: false } : c));
          }}
          onSigned={(result, department) => {
            setCountFor((c) => (c ? { ...c, open: false } : c));
            returnFocus.current = 'close';
            void reload();
            useWdsToastStore.getState().addToast({ variant: 'success', title: `${department.name} counted`, description: 'Recorded on behalf of the department, signed with your PIN.' });
          }}
        />
      ) : null}
      {confirming?.blocker.dispatch && confirming.blocker.department ? (
        <ConfirmForDepartmentDrawer
          dispatchId={confirming.blocker.dispatch.id}
          reference={confirming.blocker.dispatch.reference}
          departmentName={confirming.blocker.department.name}
          lineCount={0}
          leftAtLabel={clock12(confirming.blocker.dispatch.signedAt)}
          open={confirming.open}
          onOpenChange={(open) => {
            if (!open) setConfirming((c) => (c ? { ...c, open: false } : c));
          }}
          onConfirmed={(summary) => {
            setConfirming((c) => (c ? { ...c, open: false } : c));
            returnFocus.current = 'close';
            void reload();
            useWdsToastStore.getState().addToast({ variant: 'success', title: 'Delivery confirmed', description: summary });
          }}
        />
      ) : null}
    </div>
  );
}

/** Paper B9: the day is closed. The confirmation, the first usage entries written to the ledger and the note; no cards and no blockers. */
function ClosedSection({ reference, closed, usedValueKes, fileHref, activityHref, printHref }: { reference: string; dayId: string; closed: NonNullable<NonNullable<Today['day']>['closed']>; usedValueKes: string | null; fileHref: string; activityHref: string; printHref: string }) {
  const entries = closed.entryCount === 1 ? 'entry was' : 'entries were';
  return (
    <>
      <section aria-label="Day closed" className="flex items-center gap-3.5 border border-wds-success-border bg-wds-success-bg px-[18px] py-4">
        <CheckDisc size={22} className="shrink-0" />
        <div className="flex min-w-0 grow flex-col gap-0.5" role="status">
          <span className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-success-fg">
            Day closed at {clock12(closed.at)}, signed by the {closed.by.roleLabel === 'Branch Manager' ? 'Branch Manager' : closed.by.name}
          </span>
          <span className="font-wds-sans text-[13px] leading-[18px] text-wds-success-fg">
            {usedValueKes !== null ? `Used today KES ${kes(usedValueKes)}. ` : ''}
            {closed.entryCount} usage {entries} written to the stock ledger, each marked {reference}.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Button asChild size="xl">
            <Link href={fileHref}>{BRANCH_DAY_BUTTONS.openDayFile}</Link>
          </Button>
          <Button asChild variant="flat" size="xl" className="px-[18px]">
            <a href={printHref} target="_blank" rel="noreferrer">
              {BRANCH_DAY_BUTTONS.printSheet}
            </a>
          </Button>
        </div>
      </section>

      <section aria-labelledby="ledger-heading" className="flex flex-col">
        <div className="flex flex-col gap-0.5 pb-2.5">
          <h2 id="ledger-heading" className="m-0 font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">
            Written to the stock ledger
          </h2>
          <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">One usage entry per item. Every entry links back to this day.</p>
        </div>
        <table className="w-full table-fixed border-collapse" aria-label="Usage entries written to the stock ledger">
          <thead>
            <tr className="border-b border-wds-text-ink">
              {[
                ['Time', 'w-[72px] text-left'],
                ['Item', 'text-left'],
                ['Department', 'w-[140px] text-left'],
                ['Used', 'w-[130px] text-right'],
                ['Record', 'w-[150px] text-left pl-5'],
              ].map(([label, cls]) => (
                <th key={label} scope="col" className={cn('px-2 pb-2.5 font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-secondary', cls)}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {closed.entries.map((e) => (
              <tr key={e.id} className="border-b border-wds-border">
                <td className="px-2 py-[11px] font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{clock12(e.at)}</td>
                <td className="px-2 py-[11px] font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{e.itemName}</td>
                <td className="px-2 py-[11px] font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{e.department.name}</td>
                <td className="px-2 py-[11px] text-right font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{signedUnits(e.quantity, e.unit.toLowerCase())}</td>
                <td className="py-[11px] pl-7 pr-2">
                  <RefLink reference={e.reference} href={activityHref} className="text-[13px] leading-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-2 py-3">
          <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
            Showing {closed.entries.length} of {closed.entryCount} entries
          </span>
          <Link href={activityHref} className="font-wds-sans text-[13px] font-medium leading-[18px] text-wds-selected-edge outline-none hover:underline focus-visible:shadow-wds-ring">
            {BRANCH_DAY_BUTTONS.seeAllInDayFile(closed.entryCount)}
          </Link>
        </div>
      </section>
      <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{BRANCH_DAY_MESSAGES.afterClose}</p>
    </>
  );
}
