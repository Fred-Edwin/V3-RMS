'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { REQUISITIONS_KIT_COPY } from '../../_shared/lib/states-copy';
import { errorCodeOf, headErrorMessage, headStatusText, WORK_COPY } from '../../_shared/lib/phone-words';
import { CYCLE_TEXT, REQUISITION_CYCLES, type Home, type RequisitionCycle, type RequisitionStatus, type SectionStatus } from '../../_shared/types/requisitions-contract';
import { useHeadHome, useHistoryMine } from '../../hooks/use-head-requisitions';
import { REQ_HISTORY, reqFile } from '../../lib/routes';
import { longDateText, shortDateText, timeText } from '../../lib/time';
import { requisitionsApi } from '../../services/requisitions-phone-api';
import { HeadPhoneHeader } from './head-phone-parts';

const parseCycle = (raw: string | null): RequisitionCycle | null => REQUISITION_CYCLES.find((c) => c === raw) ?? null;

/** One of today's three requisitions as this head sees it. */
interface CycleRow {
  cycle: RequisitionCycle;
  requisitionId: string | null;
  reference: string | null;
  /** The state of THIS head's list in words ("Sent, waiting for approval"). */
  state: string;
  /** One word for the switcher: "Not started", "Draft", "Sent", "Approved". */
  short: string;
  /** Items in the head's list, 0 when there is none. */
  lineCount: number;
  /** When the requisition was opened, when R7 says so (only for the open one). */
  startedAt: string | null;
  /** When this head sent their list. */
  sentAt: string | null;
  /** Lines the Branch Manager changed (only for the open one). */
  changedCount: number;
  tone: 'none' | 'draft' | 'waiting' | 'good';
}

/** Today's rows, built from what R7 already returns: the open one, the others of today, and which requisition each cycle has. */
function cycleRows(data: Home): CycleRow[] {
  const byId = new Map<string, { reference: string; status: RequisitionStatus; statusText: string; sectionStatus: SectionStatus; lineCount: number; startedAt: string | null; sentAt: string | null; changedCount: number }>();
  if (data.open) {
    byId.set(data.open.requisitionId, {
      reference: data.open.reference,
      status: data.open.status,
      statusText: data.open.statusText,
      sectionStatus: data.open.section.status,
      lineCount: data.open.section.lineCount,
      startedAt: data.open.openedAt,
      sentAt: data.open.section.sentAt,
      changedCount: data.open.section.changedCount,
    });
  }
  for (const r of data.earlierToday) byId.set(r.requisitionId, { reference: r.reference, status: r.status, statusText: r.statusText, sectionStatus: r.sectionStatus, lineCount: r.lineCount, startedAt: null, sentAt: r.sentAt, changedCount: 0 });
  return REQUISITION_CYCLES.map((cycle) => {
    const entry = data.openByCycle[cycle];
    const info = entry ? byId.get(entry.requisitionId) : undefined;
    if (!entry || !info) return { cycle, requisitionId: null, reference: null, state: 'Not started', short: 'Not started', lineCount: 0, startedAt: null, sentAt: null, changedCount: 0, tone: 'none' };
    const base = { cycle, requisitionId: entry.requisitionId, reference: info.reference, lineCount: info.lineCount, startedAt: info.startedAt, sentAt: info.sentAt, changedCount: info.changedCount };
    const open = info.status === 'OPEN' && (info.sectionStatus === 'NOT_STARTED' || info.sectionStatus === 'DRAFT');
    // A section nobody has touched is "not started", even when the requisition (opened by another head) already exists.
    if (open && info.sectionStatus === 'NOT_STARTED' && info.lineCount === 0) return { ...base, state: 'Not started', short: 'Not started', tone: 'none' };
    if (open) return { ...base, state: 'Not sent yet', short: 'Draft', tone: 'draft' };
    const good = info.status === 'APPROVED' || info.status === 'CLOSED';
    return { ...base, state: headStatusText(info.status, info.statusText, info.sectionStatus), short: good ? 'Approved' : 'Sent', tone: good ? 'good' : 'waiting' };
  });
}

/** "Good morning", "Good afternoon", "Good evening" in Nairobi time. */
function greeting(iso: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: 'numeric', hourCycle: 'h23' }).format(new Date(iso)));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

const items = (n: number): string => (n === 1 ? 'item' : 'items');

/**
 * The Department Head's Requisitions home, drawn in Paper "Chapter 13" (steps 1, 2, 8, 9; owner decision and premium redraw, 11 Oct
 * 2026): a Morning | Afternoon | Extra switcher that only chooses which cycle the dark card shows, the card (time, state, greeting,
 * the number that matters, one button, the reference), a "Branch Manager changed" notice, then Earlier and a link to History.
 * A requisition is created only when the head taps Start (or arrives with `?cycle=`), never by just opening the home.
 */
export function HeadHomeScreen() {
  const router = useRouter();
  const wanted = parseCycle(useSearchParams().get('cycle'));
  const home = useHeadHome();
  const past = useHistoryMine({ page: 1, pageSize: 25 });
  const idem = useIdempotencyKey();
  const firstName = useAuthStore((s) => s.user?.name.split(' ')[0] ?? '');
  const [busy, setBusy] = React.useState<RequisitionCycle | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<RequisitionCycle | null>(null);
  const autoFor = React.useRef<RequisitionCycle | null>(null);

  React.useEffect(() => {
    setNow(new Date().toISOString());
  }, []);

  const data = home.data;
  const rows = React.useMemo(() => (data ? cycleRows(data) : []), [data]);

  /** Opens the cycle's requisition, or starts it when there is none. */
  const go = React.useCallback(
    async (cycle: RequisitionCycle): Promise<void> => {
      if (busy || !data) return;
      const existing = data.openByCycle[cycle];
      if (existing) {
        router.push(reqFile(existing.requisitionId));
        return;
      }
      setBusy(cycle);
      setFailure(null);
      try {
        const result = await requisitionsApi.start({ cycle, idempotencyKey: idem.key() });
        idem.renew();
        router.push(reqFile(result.requisitionId));
      } catch (err) {
        setFailure(headErrorMessage(err));
        setBusy(null);
        if (errorCodeOf(err) === 'REQUISITION_ALREADY_OPEN') void home.reload();
      }
    },
    [busy, data, router, idem, home],
  );

  // Arriving with `?cycle=` (the switcher on the working screen) is an explicit choice: open or start that cycle straight away.
  React.useEffect(() => {
    if (!data || !wanted || autoFor.current === wanted) return;
    autoFor.current = wanted;
    void go(wanted);
  }, [data, wanted, go]);

  const todayIds = new Set(rows.flatMap((r) => (r.requisitionId ? [r.requisitionId] : [])));
  const earlier = (past.data?.rows ?? []).filter((r) => !todayIds.has(r.requisitionId)).slice(0, 5);
  const chosen = picked ?? data?.suggestedCycle ?? 'MORNING';
  const card = rows.find((r) => r.cycle === chosen) ?? null;
  const arriving = Boolean(wanted) && !failure;
  // The Branch Manager's changes, from the open requisition's own section.
  const changed = rows.find((r) => r.tone === 'good' && r.changedCount > 0 && r.requisitionId === data?.open?.requisitionId) ?? null;

  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="menu" title="Requisitions" subtitle={data ? `${data.department.name}${now ? ` · ${longDateText(now)}` : ''}` : 'Asking the Central Store'} />
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto bg-wds-canvas px-5 pb-8 pt-5">
        {home.status === 'error' ? (
          <div role="alert">
            <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => void home.reload()} />
          </div>
        ) : !data || arriving ? (
          <>
            <LoadingAnnouncer text={WORK_COPY.starting} />
            <div className="flex flex-col gap-4" aria-hidden="true">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </>
        ) : (
          <>
            {failure ? (
              <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
                {failure}
              </p>
            ) : null}

            <TrackSwitcher rows={rows} value={chosen} onChange={setPicked} />

            {card ? (
              <HeroCard
                row={card}
                now={now}
                firstName={firstName}
                belowLevel={card.cycle === data.suggestedCycle ? data.suggestedLineCount : null}
                busy={busy === card.cycle}
                disabled={busy !== null}
                onGo={() => void go(card.cycle)}
              />
            ) : null}

            {changed && changed.requisitionId ? (
              <div className="flex items-start justify-between gap-4 border-l-[3px] border-l-wds-caramel-500 py-0.5 pl-3.5">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">The Branch Manager changed {changed.changedCount} {changed.changedCount === 1 ? 'line' : 'lines'}</p>
                  <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{CYCLE_TEXT[changed.cycle]} · open it to see what you asked for and what was approved.</p>
                </div>
                <Link href={reqFile(changed.requisitionId)} className="-my-2 flex min-h-11 shrink-0 items-center rounded-wds-sm px-1 font-wds-sans text-[15px] font-semibold text-wds-espresso-700 outline-none focus-visible:shadow-wds-ring active:opacity-70">
                  View
                </Link>
              </div>
            ) : null}

            <section className="flex flex-col" aria-label="Earlier requisitions">
              <div className="flex items-center justify-between gap-3 pb-2">
                <h2 className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">Earlier</h2>
                <Link href={REQ_HISTORY} className="-my-3 flex min-h-11 items-center rounded-wds-sm px-1 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-espresso-700 outline-none hover:text-wds-espresso-800 focus-visible:shadow-wds-ring active:opacity-70">
                  See all history
                </Link>
              </div>
              {past.status === 'loading' && !past.data ? (
                <Skeleton className="h-[56px] w-full" />
              ) : earlier.length === 0 ? (
                <p className="border-t border-wds-border py-3 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Nothing before today yet.</p>
              ) : (
                <ul className="flex flex-col border-t border-wds-border">
                  {earlier.map((row) => {
                    const good = row.status === 'APPROVED' || row.status === 'CLOSED';
                    return (
                      <li key={row.requisitionId} className="border-b border-wds-border">
                        <Link href={reqFile(row.requisitionId)} className="flex min-h-14 items-center justify-between gap-3 py-3 outline-none focus-visible:shadow-wds-ring active:bg-wds-neutral-50">
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink">
                              {row.cycleLabel.split(' · ')[0]} · {shortDateText(row.openedAt)}
                            </span>
                            <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">
                              {row.reference} · {row.lineCount} {items(row.lineCount)}
                            </span>
                          </span>
                          <span className={cn('flex shrink-0 items-center gap-2 font-wds-sans text-[13px] leading-4', good ? 'text-wds-success-fg' : 'text-wds-text-secondary')}>
                            <span aria-hidden className={cn('size-1.5 rounded-full', good ? 'bg-wds-success-fg' : 'bg-wds-caramel-500')} />
                            {headStatusText(row.status, row.statusText, row.sectionStatus)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </PhoneColumn>
  );
}

/** Morning | Afternoon | Extra as one soft track with a raised tile on the chosen one, each with its state under the name. */
function TrackSwitcher({ rows, value, onChange }: { rows: CycleRow[]; value: RequisitionCycle; onChange: (cycle: RequisitionCycle) => void }) {
  return (
    <div role="radiogroup" aria-label="Which requisition" className="flex gap-1 bg-wds-neutral-100 p-1">
      {rows.map((row, i) => {
        const selected = row.cycle === value;
        return (
          <button
            key={row.cycle}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(row.cycle)}
            onKeyDown={(e) => {
              const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = rows[(i + step + rows.length) % rows.length];
              if (!next) return;
              onChange(next.cycle);
              (e.currentTarget.parentElement?.querySelectorAll('[role=radio]')[rows.indexOf(next)] as HTMLElement | undefined)?.focus();
            }}
            className={cn(
              'flex min-h-[60px] min-w-0 grow basis-0 flex-col items-center justify-center gap-1 px-1 outline-none transition-colors focus-visible:shadow-wds-ring',
              selected ? 'bg-wds-surface shadow-wds-sm' : 'hover:bg-wds-neutral-50 active:bg-wds-neutral-50',
            )}
          >
            <span className={cn('font-wds-sans text-[17px] leading-[22px]', selected ? 'font-semibold text-wds-espresso-800' : 'text-wds-text-secondary')}>{CYCLE_TEXT[row.cycle]}</span>
            <span className={cn('flex items-center gap-1.5 font-wds-sans text-[13px] leading-4', selected ? 'text-wds-text-ink' : 'text-wds-text-secondary')}>
              {row.tone === 'none' ? null : <span aria-hidden className={cn('size-1.5 rounded-full', row.tone === 'good' ? 'bg-wds-success-fg' : 'bg-wds-caramel-600')} />}
              {row.short}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The one strong block on the page: the chosen cycle on espresso. Four drawn states: a list not started (the number of items running
 * low), Extra not started ("Need something extra?"), a draft (the number on the list and how many are below level) and a list sent
 * (the number sent, the time, and "See what you sent").
 */
function HeroCard({ row, now, firstName, belowLevel, busy, disabled, onGo }: { row: CycleRow; now: string | null; firstName: string; belowLevel: number | null; busy: boolean; disabled: boolean; onGo: () => void }) {
  const word = CYCLE_TEXT[row.cycle].toLowerCase();
  const hello = now ? `${greeting(now)}${firstName ? `, ${firstName}` : ''}` : '';
  const clock = now ? timeText(now).toUpperCase() : '';
  const eyebrow = row.cycle === 'EXTRA' && row.tone === 'none' ? 'EXTRA · WHEN SOMETHING COMES UP' : `${CYCLE_TEXT[row.cycle].toUpperCase()}${clock ? ` · ${clock}` : ''}`;
  const dot = row.tone === 'draft' ? 'Not sent yet' : row.tone === 'waiting' ? 'Waiting for approval' : row.tone === 'good' ? 'Approved' : null;
  const loading = busy ? 'Starting…' : null;

  let body: React.ReactNode;
  let button: string;
  let foot: string | null = null;
  let primary = true;

  if (row.tone === 'none' && row.cycle === 'EXTRA') {
    body = (
      <>
        <h2 id="req-hero" className="font-wds-sans text-[34px] font-semibold leading-[40px] tracking-[-0.02em] text-wds-espresso-50">Need something extra?</h2>
        <p className="font-wds-sans text-[16px] leading-6 text-wds-espresso-100">It starts with the items below their restock level. Add what else you need, then send it to the Branch Manager.</p>
      </>
    );
    button = 'Start an Extra list';
  } else if (row.tone === 'none') {
    body =
      belowLevel !== null && belowLevel > 0 ? (
        <>
          <Greeting id="req-hero" text={hello} />
          <BigNumber n={belowLevel} line={`${belowLevel === 1 ? 'item is' : 'items are'} running low`} sub="Below their restock level" />
          <p className="font-wds-sans text-[16px] leading-6 text-wds-espresso-100">We fill them in for you. You check the list and change what you need before anything is sent.</p>
        </>
      ) : (
        <>
          <Greeting id="req-hero" text={hello} />
          <p className="font-wds-sans text-[22px] font-semibold leading-7 text-wds-espresso-50">{belowLevel === 0 ? 'Nothing is running low.' : `Ready for the ${word} list?`}</p>
          <p className="font-wds-sans text-[16px] leading-6 text-wds-espresso-100">It starts with the items below their restock level. Add what else you need before anything is sent.</p>
        </>
      );
    button = `Start the ${word} list`;
  } else if (row.tone === 'draft') {
    body = (
      <>
        <Greeting id="req-hero" text={hello} />
        {row.lineCount > 0 ? (
          <BigNumber n={row.lineCount} line={`${items(row.lineCount)} on your list`} sub={belowLevel !== null && belowLevel > 0 ? `${belowLevel} are below restock level` : undefined} />
        ) : (
          <p className="font-wds-sans text-[22px] font-semibold leading-7 text-wds-espresso-50">Your list is started.</p>
        )}
      </>
    );
    button = `Continue the ${word} list`;
    foot = `${row.reference ?? ''}${row.startedAt ? ` · started ${timeText(row.startedAt)}` : ''}`;
  } else {
    const sentWords = row.tone === 'good' ? 'items approved' : row.sentAt ? `${items(row.lineCount)} sent at ${timeText(row.sentAt)}` : `${items(row.lineCount)} sent`;
    body = (
      <>
        <Greeting id="req-hero" text={`${row.tone === 'good' ? 'Approved' : 'All sent'}${firstName ? `, ${firstName}` : ''}`} />
        {row.lineCount > 0 ? <BigNumber n={row.lineCount} line={sentWords} sub={row.tone === 'waiting' ? "You'll be told when it is approved" : row.state} /> : <p className="font-wds-sans text-[22px] font-semibold leading-7 text-wds-espresso-50">{row.state}</p>}
      </>
    );
    button = 'See what you sent';
    primary = false;
    foot = `${row.reference ?? ''}${row.tone === 'waiting' ? ' · you can recall until it is approved' : ''}`;
  }

  return (
    <section aria-labelledby="req-hero" className="flex flex-col gap-5 bg-wds-espresso-900 px-5 pb-5 pt-5 text-wds-espresso-50">
      <div className="flex items-start justify-between gap-3">
        <p className="font-wds-mono text-[12px] uppercase leading-4 tracking-[0.08em] text-wds-caramel-500">{eyebrow}</p>
        {dot ? (
          <p className="flex shrink-0 items-center gap-1.5 font-wds-sans text-[13px] leading-4 text-wds-espresso-100">
            <span aria-hidden className={cn('size-1.5 rounded-full', row.tone === 'good' ? 'bg-wds-success-fg' : 'bg-wds-caramel-500')} />
            {dot}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">{body}</div>
      <button
        type="button"
        onClick={onGo}
        disabled={disabled}
        aria-busy={busy}
        className={cn(
          'flex h-[52px] w-full items-center justify-center font-wds-sans text-[16px] font-semibold outline-none transition-opacity focus-visible:shadow-[0_0_0_3px_var(--wds-caramel-300)] active:opacity-80 disabled:opacity-60',
          primary ? 'bg-wds-caramel-500 text-wds-espresso-900' : 'border border-wds-espresso-100/60 text-wds-espresso-50',
        )}
      >
        {loading ?? button}
      </button>
      {foot ? <p className="text-center font-wds-mono text-[12px] leading-4 text-wds-caramel-600">{foot}</p> : null}
    </section>
  );
}

function Greeting({ id, text }: { id: string; text: string }) {
  return (
    <h2 id={id} className="font-wds-sans text-[16px] leading-5 text-wds-espresso-100" suppressHydrationWarning>
      {text || ' '}
    </h2>
  );
}

/** The big mono number with a line and a quieter line beside it, as drawn ("28  items on your list / 12 are below restock level"). */
function BigNumber({ n, line, sub }: { n: number; line: string; sub?: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="shrink-0 whitespace-nowrap font-wds-sans text-[88px] font-medium leading-[88px] tracking-[-0.04em] text-wds-espresso-50">{n}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-wds-sans text-[17px] font-medium leading-6 text-wds-espresso-50">{line}</span>
        {sub ? <span className="font-wds-sans text-[14px] leading-5 text-wds-espresso-100/80">{sub}</span> : null}
      </span>
    </div>
  );
}

/** The status chip. `plain` is the History list's (Paper G1): text only, no dot. */
export function StatusChip({ status, text, plain = false }: { status: string; text: string; plain?: boolean }) {
  const good = status === 'APPROVED' || status === 'CLOSED';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 border px-2 font-wds-sans text-[12px]',
        plain ? 'py-0.5 leading-4' : 'py-[3px] leading-[14px]',
        good ? 'border-wds-success-border bg-wds-success-bg text-wds-success-fg' : 'border-wds-border-strong bg-wds-neutral-100 text-wds-neutral-700',
      )}
    >
      {good && !plain ? <span className="size-1.5 rounded-full bg-wds-success-fg" aria-hidden="true" /> : null}
      {text}
    </span>
  );
}
