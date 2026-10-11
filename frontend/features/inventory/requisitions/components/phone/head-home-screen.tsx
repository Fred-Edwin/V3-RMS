'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { REQUISITIONS_KIT_COPY } from '../../_shared/lib/states-copy';
import { errorCodeOf, headErrorMessage, headStatusText, HOME_COPY, WORK_COPY } from '../../_shared/lib/phone-words';
import { CYCLE_TEXT, REQUISITION_CYCLES, type Home, type RequisitionCycle, type RequisitionStatus, type SectionStatus } from '../../_shared/types/requisitions-contract';
import { useHeadHome, useHistoryMine } from '../../hooks/use-head-requisitions';
import { REQ_HISTORY, reqFile } from '../../lib/routes';
import { longDateText, shortDateText, timeText } from '../../lib/time';
import { requisitionsApi } from '../../services/requisitions-phone-api';
import { HeadPhoneHeader, HeadPrimaryButton } from './head-phone-parts';

const parseCycle = (raw: string | null): RequisitionCycle | null => REQUISITION_CYCLES.find((c) => c === raw) ?? null;

/** One of today's three requisitions as this head sees it. */
interface CycleRow {
  cycle: RequisitionCycle;
  requisitionId: string | null;
  reference: string | null;
  /** The state of THIS head's list, in words ("Not started", "Draft · 12 items", "Sent, waiting for approval"). */
  state: string;
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
    if (!entry || !info) return { cycle, requisitionId: null, reference: null, state: 'Not started', tone: 'none' };
    const open = info.status === 'OPEN' && (info.sectionStatus === 'NOT_STARTED' || info.sectionStatus === 'DRAFT');
    if (open) return { cycle, requisitionId: entry.requisitionId, reference: info.reference, state: info.lineCount > 0 ? `Draft · ${info.lineCount} ${info.lineCount === 1 ? 'item' : 'items'}` : 'Not sent yet', tone: 'draft' };
    const text = headStatusText(info.status, info.statusText, info.sectionStatus);
    const good = info.status === 'APPROVED' || info.status === 'CLOSED';
    return { cycle, requisitionId: entry.requisitionId, reference: info.reference, state: text, tone: good ? 'good' : 'waiting' };
  });
}

/**
 * The Department Head's Requisitions home (owner decision, 11 Oct 2026, replacing Paper steps 1 and 18): today's Morning, Afternoon
 * and Extra with the state of the head's own list, the one for the time of day on top with a big button, then "Earlier" and a link
 * to the full History. A requisition is created only when the head taps Start or Open on a row (or arrives with `?cycle=` from the
 * switcher on the working screen), never by just opening the home.
 */
export function HeadHomeScreen() {
  const router = useRouter();
  const wanted = parseCycle(useSearchParams().get('cycle'));
  const home = useHeadHome();
  const past = useHistoryMine({ page: 1, pageSize: 25 });
  const idem = useIdempotencyKey();
  const [busy, setBusy] = React.useState<RequisitionCycle | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<string | null>(null);
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
  const nowRow = rows.find((r) => r.cycle === data?.suggestedCycle) ?? null;
  const otherRows = rows.filter((r) => r !== nowRow);
  const arriving = Boolean(wanted) && !failure;

  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="menu" title="Requisitions" subtitle={data ? subtitle : 'Asking the Central Store'} />
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto bg-wds-canvas px-5 py-5">
        {home.status === 'error' ? (
          <div role="alert">
            <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => void home.reload()} />
          </div>
        ) : !data || arriving ? (
          <>
            <LoadingAnnouncer text={WORK_COPY.starting} />
            <div className="flex flex-col gap-4 border border-wds-border bg-wds-surface p-5" aria-hidden="true">
              <Skeleton className="h-4 w-[55%]" />
              <Skeleton className="h-8 w-[85%]" />
              <Skeleton className="h-11 w-full" />
            </div>
          </>
        ) : (
          <>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary" suppressHydrationWarning>
              {now ? `${longDateText(now)} · ${timeText(now)}` : ' '}
            </p>
            {failure ? (
              <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
                {failure}
              </p>
            ) : null}

            {nowRow ? (
              <section className="flex flex-col gap-4 border border-wds-selected-edge bg-wds-surface p-5" aria-labelledby="req-now">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-selected-edge">Now</p>
                    <h2 id="req-now" className="font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.01em] text-wds-text-ink">
                      {CYCLE_TEXT[nowRow.cycle]}
                    </h2>
                  </div>
                  <StateChip row={nowRow} />
                </div>
                {nowRow.reference ? <p className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{nowRow.reference}</p> : null}
                <HeadPrimaryButton onClick={() => void go(nowRow.cycle)} disabled={busy !== null} aria-busy={busy === nowRow.cycle}>
                  {busy === nowRow.cycle ? 'Starting…' : actionLabel(nowRow)}
                </HeadPrimaryButton>
              </section>
            ) : null}

            <section className="flex flex-col gap-3" aria-label="Other requisitions today">
              <h2 className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">Also today</h2>
              <ul className="flex flex-col gap-2.5">
                {otherRows.map((row) => (
                  <li key={row.cycle}>
                    <button
                      type="button"
                      onClick={() => void go(row.cycle)}
                      disabled={busy !== null}
                      className="flex min-h-[64px] w-full items-center justify-between gap-3 border border-wds-border bg-wds-surface px-4 py-3 text-left outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring active:bg-wds-neutral-100 disabled:opacity-60"
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink">{CYCLE_TEXT[row.cycle]}</span>
                        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{busy === row.cycle ? 'Starting…' : actionLabel(row)}</span>
                      </span>
                      <StateChip row={row} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3" aria-label={HOME_COPY.earlierToday}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">Earlier</h2>
                <Link href={REQ_HISTORY} className="-my-3 flex min-h-11 items-center rounded-wds-sm px-1 font-wds-sans text-[14px] font-medium leading-[18px] text-wds-selected-edge outline-none hover:bg-wds-caramel-100 focus-visible:shadow-wds-ring active:opacity-70">
                  See all history
                </Link>
              </div>
              {past.status === 'loading' && !past.data ? (
                <Skeleton className="h-[64px] w-full" />
              ) : earlier.length === 0 ? (
                <p className="font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Nothing before today yet.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {earlier.map((row) => (
                    <li key={row.requisitionId} className="flex items-center justify-between gap-3 border border-wds-border bg-wds-surface px-4 py-3">
                      <span className="flex min-w-0 flex-col gap-1">
                        <Link
                          href={reqFile(row.requisitionId)}
                          className="rounded-wds-sm font-wds-mono text-[13px] leading-4 text-[#1F5BAE] underline underline-offset-2 outline-none transition-colors hover:text-[#174A8E] focus-visible:shadow-wds-ring active:opacity-70"
                        >
                          {row.reference} · {row.cycleLabel.split(' · ')[0]}
                        </Link>
                        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{shortDateText(row.openedAt)}</span>
                      </span>
                      <StatusChip status={row.status} text={headStatusText(row.status, row.statusText, row.sectionStatus)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </PhoneColumn>
  );
}

/** The words on the button of a row: Start for none, Open (or Continue) for one that exists. */
function actionLabel(row: CycleRow): string {
  const word = CYCLE_TEXT[row.cycle].toLowerCase();
  if (row.tone === 'none') return `Start the ${word} list`;
  if (row.tone === 'draft') return `Continue the ${word} list`;
  return `Open the ${word} list`;
}

/** The state of the head's own list on a row. */
function StateChip({ row }: { row: CycleRow }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 border px-2 py-[3px] font-wds-sans text-[12px] leading-[14px]',
        row.tone === 'good' && 'border-wds-success-border bg-wds-success-bg text-wds-success-fg',
        row.tone === 'waiting' && 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
        row.tone === 'draft' && 'border-wds-border-strong bg-wds-caramel-100 text-wds-selected-edge',
        row.tone === 'none' && 'border-wds-border-strong bg-wds-neutral-100 text-wds-neutral-700',
      )}
    >
      {row.state}
    </span>
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
