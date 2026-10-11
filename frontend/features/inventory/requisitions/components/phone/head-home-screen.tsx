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
import { errorCodeOf, headErrorMessage, headStatusText, HOME_COPY, WORK_COPY } from '../../_shared/lib/phone-words';
import { CYCLE_TEXT, REQUISITION_CYCLES, type Home, type RequisitionCycle, type RequisitionStatus, type SectionStatus } from '../../_shared/types/requisitions-contract';
import { useHeadHome, useHistoryMine } from '../../hooks/use-head-requisitions';
import { REQ_HISTORY, reqFile } from '../../lib/routes';
import { shortDateText } from '../../lib/time';
import { requisitionsApi } from '../../services/requisitions-phone-api';
import { HeadPhoneHeader } from './head-phone-parts';

const parseCycle = (raw: string | null): RequisitionCycle | null => REQUISITION_CYCLES.find((c) => c === raw) ?? null;

/** One of today's three requisitions as this head sees it. */
interface CycleRow {
  cycle: RequisitionCycle;
  requisitionId: string | null;
  reference: string | null;
  /** The state of THIS head's list, in words ("Not started", "Draft · 12 items", "Sent, waiting for approval"). */
  state: string;
  /** One word for the switcher: "Not started", "Draft", "Sent", "Approved". */
  short: string;
  /** Items in the head's list, 0 when there is none. */
  lineCount: number;
  tone: 'none' | 'draft' | 'waiting' | 'good';
}

/** Today's rows, built from what R7 already returns: the open one, the others of today, and which requisition each cycle has. */
function cycleRows(data: Home): CycleRow[] {
  const byId = new Map<string, { reference: string; status: RequisitionStatus; statusText: string; sectionStatus: SectionStatus; lineCount: number }>();
  if (data.open) byId.set(data.open.requisitionId, { reference: data.open.reference, status: data.open.status, statusText: data.open.statusText, sectionStatus: data.open.section.status, lineCount: data.open.section.lineCount });
  for (const r of data.earlierToday) byId.set(r.requisitionId, { reference: r.reference, status: r.status, statusText: r.statusText, sectionStatus: r.sectionStatus, lineCount: r.lineCount });
  return REQUISITION_CYCLES.map((cycle) => {
    const entry = data.openByCycle[cycle];
    const info = entry ? byId.get(entry.requisitionId) : undefined;
    if (!entry || !info) return { cycle, requisitionId: null, reference: null, state: 'Not started', short: 'Not started', lineCount: 0, tone: 'none' };
    const open = info.status === 'OPEN' && (info.sectionStatus === 'NOT_STARTED' || info.sectionStatus === 'DRAFT');
    if (open) return { cycle, requisitionId: entry.requisitionId, reference: info.reference, state: info.lineCount > 0 ? `Draft · ${info.lineCount} ${info.lineCount === 1 ? 'item' : 'items'}` : 'Not sent yet', short: 'Draft', lineCount: info.lineCount, tone: 'draft' };
    const text = headStatusText(info.status, info.statusText, info.sectionStatus);
    const good = info.status === 'APPROVED' || info.status === 'CLOSED';
    return { cycle, requisitionId: entry.requisitionId, reference: info.reference, state: text, short: good ? 'Approved' : 'Sent', lineCount: info.lineCount, tone: good ? 'good' : 'waiting' };
  });
}

/** "Good morning", "Good afternoon", "Good evening" in Nairobi time. */
function greeting(iso: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: 'numeric', hourCycle: 'h23' }).format(new Date(iso)));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * The Department Head's Requisitions home (owner decision, 11 Oct 2026, replacing Paper steps 1 and 18; premium redraw approved the
 * same day): a greeting, a Morning | Afternoon | Extra switcher, one dark card for the chosen cycle with its one button, then
 * "Earlier" and a link to the full History. The switcher only chooses which cycle the card shows. A requisition is created only when
 * the head taps Start (or arrives with `?cycle=` from the switcher on the working screen), never by just opening the home.
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
  const subtitle = HOME_COPY.subtitle(data?.department.name ?? '');
  const chosen = picked ?? data?.suggestedCycle ?? 'MORNING';
  const card = rows.find((r) => r.cycle === chosen) ?? null;
  const arriving = Boolean(wanted) && !failure;

  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="menu" title="Requisitions" subtitle={data ? subtitle : 'Asking the Central Store'} />
      <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto bg-wds-canvas px-5 pb-8 pt-6">
        {home.status === 'error' ? (
          <div role="alert">
            <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => void home.reload()} />
          </div>
        ) : !data || arriving ? (
          <>
            <LoadingAnnouncer text={WORK_COPY.starting} />
            <div className="flex flex-col gap-4" aria-hidden="true">
              <Skeleton className="h-6 w-[60%]" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          </>
        ) : (
          <>
            <h2 className="font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.01em] text-wds-text-ink" suppressHydrationWarning>
              {now ? `${greeting(now)}${firstName ? `, ${firstName}` : ''}` : ' '}
            </h2>
            {failure ? (
              <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
                {failure}
              </p>
            ) : null}

            <TrackSwitcher rows={rows} value={chosen} onChange={setPicked} />

            {card ? <HeroCard row={card} suggested={card.cycle === data.suggestedCycle ? data.suggestedLineCount : null} busy={busy === card.cycle} disabled={busy !== null} onGo={() => void go(card.cycle)} /> : null}

            <section className="flex flex-col" aria-label="Earlier requisitions">
              <div className="flex items-center justify-between gap-3 pb-1">
                <h2 className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">Earlier</h2>
                <Link href={REQ_HISTORY} className="-my-3 flex min-h-11 items-center rounded-wds-sm px-1 font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink underline underline-offset-4 outline-none hover:text-wds-primary focus-visible:shadow-wds-ring active:opacity-70">
                  See all history
                </Link>
              </div>
              {past.status === 'loading' && !past.data ? (
                <Skeleton className="h-[56px] w-full" />
              ) : earlier.length === 0 ? (
                <p className="py-3 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Nothing before today yet.</p>
              ) : (
                <ul className="flex flex-col">
                  {earlier.map((row) => {
                    const good = row.status === 'APPROVED' || row.status === 'CLOSED';
                    return (
                      <li key={row.requisitionId} className="border-b border-wds-border last:border-b-0">
                        <Link href={reqFile(row.requisitionId)} className="flex min-h-14 items-center justify-between gap-3 py-3 outline-none focus-visible:shadow-wds-ring active:bg-wds-neutral-50">
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{row.cycleLabel.split(' · ')[0]}</span>
                            <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{row.reference} · {shortDateText(row.openedAt)}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
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

/** Morning | Afternoon | Extra as one soft track with a raised tile on the chosen one, each with a dot and one word of state. */
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
              'flex min-h-[52px] min-w-0 grow basis-0 flex-col items-center justify-center gap-0.5 px-1 outline-none transition-colors focus-visible:shadow-wds-ring',
              selected ? 'bg-wds-surface shadow-wds-sm' : 'hover:bg-wds-neutral-50 active:bg-wds-neutral-50',
            )}
          >
            <span className={cn('font-wds-sans text-[14px] leading-[18px]', selected ? 'font-semibold text-wds-text-ink' : 'text-wds-text-secondary')}>{CYCLE_TEXT[row.cycle]}</span>
            <span className="flex items-center gap-1 font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">
              <span aria-hidden className={cn('size-1.5 rounded-full', row.tone === 'good' ? 'bg-wds-success-fg' : row.tone === 'none' ? 'border border-wds-text-secondary' : 'bg-wds-caramel-500')} />
              {row.short}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The one strong block on the page: the chosen cycle on espresso, the number that matters and one button. */
function HeroCard({ row, suggested, busy, disabled, onGo }: { row: CycleRow; suggested: number | null; busy: boolean; disabled: boolean; onGo: () => void }) {
  const word = CYCLE_TEXT[row.cycle].toLowerCase();
  const number = row.tone === 'draft' ? row.lineCount || null : row.tone === 'none' ? suggested : null;
  const headline =
    row.tone === 'none'
      ? number
        ? `${number === 1 ? 'item is' : 'items are'} running low`
        : suggested === 0
          ? `Nothing is running low. Start the ${word} list when you are ready.`
          : `Not started yet. Start the ${word} list when you need something.`
      : row.tone === 'draft'
        ? number
          ? `${number === 1 ? 'item' : 'items'} in your list, not sent yet`
          : 'Your list is started and not sent yet.'
        : row.state;
  const label = busy ? 'Starting…' : row.tone === 'none' ? `Start the ${word} list` : row.tone === 'draft' ? `Continue the ${word} list` : `Open the ${word} list`;
  const primary = row.tone === 'none' || row.tone === 'draft';
  return (
    <section aria-labelledby="req-hero" className="flex flex-col gap-5 bg-wds-espresso-900 px-5 pb-5 pt-5 text-wds-espresso-50">
      <div className="flex flex-col gap-2">
        <p className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.08em] text-wds-caramel-500">{CYCLE_TEXT[row.cycle]}{row.reference ? ` · ${row.reference}` : ''}</p>
        <h2 id="req-hero" className="flex items-baseline gap-3">
          {number ? <span className="shrink-0 whitespace-nowrap font-wds-mono text-[56px] font-medium leading-[56px] tracking-[-0.03em] text-wds-caramel-300">{number}</span> : null}
          <span className={cn('font-wds-sans text-wds-espresso-50', number ? 'text-[17px] leading-6' : 'text-[20px] font-semibold leading-7')}>{headline}</span>
        </h2>
      </div>
      <button
        type="button"
        onClick={onGo}
        disabled={disabled}
        aria-busy={busy}
        className={cn(
          'flex h-[52px] w-full items-center justify-center font-wds-sans text-[16px] font-semibold outline-none transition-opacity focus-visible:shadow-[0_0_0_3px_var(--wds-caramel-300)] active:opacity-80 disabled:opacity-60',
          primary ? 'bg-wds-caramel-500 text-wds-espresso-900' : 'border border-wds-caramel-500 text-wds-caramel-300',
        )}
      >
        {label}
      </button>
    </section>
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
