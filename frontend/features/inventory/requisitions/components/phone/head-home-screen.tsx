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
import { errorCodeOf, headErrorMessage, headStatusText, HOME_COPY, homeHeadline, homeLine, startLabel, URGENT_SWITCH, WORK_COPY } from '../../_shared/lib/phone-words';
import { REQUISITION_CYCLES, type RequisitionCycle } from '../../_shared/types/requisitions-contract';
import { useHeadHome } from '../../hooks/use-head-requisitions';
import { reqFile } from '../../lib/routes';
import { longDateText, timeText } from '../../lib/time';
import { requisitionsApi } from '../../services/requisitions-phone-api';
import { CycleSwitcher, HeadPhoneHeader, HeadPrimaryButton } from './head-phone-parts';

const parseCycle = (raw: string | null): RequisitionCycle | null => REQUISITION_CYCLES.find((c) => c === raw) ?? null;

/**
 * The Department Head's way in (owner decision, 11 Oct 2026). Morning and Afternoon need no screen of their own: the menu link
 * opens the cycle for the time of day (or the one in `?cycle=`), starts its requisition quietly if there is none (the list is
 * filled in from the restock levels) and goes straight to the working list. Only an Extra keeps a small card, because it can be
 * marked urgent and is the exception, not the routine.
 */
export function HeadHomeScreen() {
  const router = useRouter();
  const wanted = parseCycle(useSearchParams().get('cycle'));
  const home = useHeadHome();
  const idem = useIdempotencyKey();
  const [picked, setPicked] = React.useState<RequisitionCycle | null>(null);
  const [urgent, setUrgent] = React.useState(false);
  const [urgentNote, setUrgentNote] = React.useState('');
  const [starting, setStarting] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<string | null>(null);
  const startedFor = React.useRef<RequisitionCycle | null>(null);

  React.useEffect(() => {
    setNow(new Date().toISOString());
  }, []);

  const data = home.data;
  const cycle: RequisitionCycle = picked ?? wanted ?? data?.suggestedCycle ?? 'AFTERNOON';
  const openForCycle = data?.openByCycle[cycle] ?? null;
  const routine = cycle !== 'EXTRA';
  const showUrgent = cycle === 'EXTRA' && !openForCycle;

  const start = React.useCallback(async (): Promise<void> => {
    if (starting) return;
    setStarting(true);
    setFailure(null);
    try {
      const result = await requisitionsApi.start({
        cycle,
        ...(showUrgent && urgent ? { urgent: true, ...(urgentNote.trim() ? { urgentNote: urgentNote.trim() } : {}) } : {}),
        idempotencyKey: idem.key(),
      });
      idem.renew();
      router.replace(reqFile(result.requisitionId));
    } catch (err) {
      setFailure(headErrorMessage(err));
      setStarting(false);
      if (errorCodeOf(err) === 'REQUISITION_ALREADY_OPEN') {
        startedFor.current = null;
        void home.reload();
      }
    }
  }, [starting, cycle, showUrgent, urgent, urgentNote, idem, router, home]);

  // Open the cycle's requisition if there is one, otherwise start the routine cycles quietly (once per cycle per visit).
  React.useEffect(() => {
    if (!data) return;
    if (openForCycle) {
      router.replace(reqFile(openForCycle.requisitionId));
      return;
    }
    if (routine && startedFor.current !== cycle) {
      startedFor.current = cycle;
      void start();
    }
  }, [data, openForCycle, routine, cycle, router, start]);

  const retry = (): void => {
    startedFor.current = null;
    setFailure(null);
    void home.reload();
  };

  const subtitle = HOME_COPY.subtitle(data?.department.name ?? '');
  const redirecting = Boolean(data) && (Boolean(openForCycle) || (routine && !failure));

  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="menu" title="Requisitions" subtitle={data ? subtitle : 'Asking the Central Store'} />
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto bg-wds-canvas px-5 py-5">
        {home.status === 'error' ? (
          <div role="alert">
            <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => void home.reload()} />
          </div>
        ) : !data || redirecting ? (
          <>
            <LoadingAnnouncer text={WORK_COPY.starting} />
            <div className="flex flex-col gap-4 border border-wds-border bg-wds-surface p-5" aria-hidden="true">
              <Skeleton className="h-4 w-[55%]" />
              <Skeleton className="h-8 w-[85%]" />
              <Skeleton className="h-3 w-[40%]" />
              <Skeleton className="h-11 w-full" />
            </div>
          </>
        ) : (
          <>
            <section className="flex flex-col gap-4 border border-wds-border bg-wds-surface p-5" aria-labelledby="req-headline">
              <div className="flex flex-col gap-1">
                <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary" suppressHydrationWarning>
                  {now ? `${longDateText(now)} · ${timeText(now)}` : ' '}
                </p>
                <h2 id="req-headline" className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">
                  {homeHeadline(cycle, Boolean(data.openByCycle.AFTERNOON))}
                </h2>
              </div>
              <div className="flex flex-col gap-2">
                <p id="req-which" className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">
                  {HOME_COPY.whichRequisition}
                </p>
                <CycleSwitcher value={cycle} onChange={setPicked} open={data.openByCycle} labelledBy="req-which" />
              </div>
              {showUrgent ? <UrgentSwitch on={urgent} onChange={setUrgent} note={urgentNote} onNote={setUrgentNote} /> : null}
              {routine ? null : <p className="font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{homeLine(data.department.name, data.suggestedLineCount)}</p>}
              {failure ? (
                <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
                  {failure}
                </p>
              ) : null}
              {routine ? (
                <HeadPrimaryButton onClick={retry}>{WORK_COPY.retry}</HeadPrimaryButton>
              ) : (
                <HeadPrimaryButton onClick={() => void start()} disabled={starting} aria-busy={starting}>
                  {starting ? 'Starting…' : startLabel(cycle, showUrgent && urgent)}
                </HeadPrimaryButton>
              )}
            </section>

            {data.earlierToday.length > 0 ? (
              <section className="flex flex-col gap-3" aria-label={HOME_COPY.earlierToday}>
                <h2 className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">{HOME_COPY.earlierToday}</h2>
                <ul className="flex flex-col gap-2.5">
                  {data.earlierToday.map((row) => (
                    <li key={row.requisitionId} className="flex flex-col gap-1.5 border border-wds-border bg-wds-surface px-4 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={reqFile(row.requisitionId)}
                          className="rounded-wds-sm font-wds-mono text-[13px] leading-4 text-[#1F5BAE] underline underline-offset-2 outline-none transition-colors hover:text-[#174A8E] focus-visible:shadow-wds-ring active:opacity-70"
                        >
                          {row.reference} · {row.cycleLabel.split(' · ')[0]}
                        </Link>
                        <StatusChip status={row.status} text={headStatusText(row.status, row.statusText, row.sectionStatus)} />
                      </div>
                      <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                        {data.department.name} asked for {row.lineCount} {row.lineCount === 1 ? 'line' : 'lines'}
                        {row.sentAt ? ` · sent at ${timeText(row.sentAt)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </PhoneColumn>
  );
}

/** Paper step 18: the red card with the switch. The note is Amendment 2's optional "why", up to 200 characters. */
function UrgentSwitch({ on, onChange, note, onNote }: { on: boolean; onChange: (v: boolean) => void; note: string; onNote: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={cn('flex items-start gap-3.5 border px-4 py-3.5 transition-colors', on ? 'border-wds-error-border bg-wds-error-bg' : 'border-wds-border bg-wds-surface')}>
        <div className="flex min-w-0 grow basis-0 flex-col gap-1">
          <p id="req-urgent-title" className={cn('font-wds-sans text-[15px] font-semibold leading-5', on ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
            {URGENT_SWITCH.title}
          </p>
          <p id="req-urgent-body" className="max-w-[230px] font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
            {URGENT_SWITCH.body}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="req-urgent-title"
          aria-describedby="req-urgent-body"
          onClick={() => onChange(!on)}
          className={cn(
            'relative flex h-7 w-12 shrink-0 items-center rounded-full px-[3px] outline-none before:absolute before:-inset-y-2 before:inset-x-0 before:content-[""] transition-[background-color,filter] duration-150 hover:brightness-95 focus-visible:shadow-wds-ring active:brightness-90',
            on ? 'bg-wds-error-fg' : 'bg-wds-border-strong',
          )}
        >
          <span aria-hidden="true" className={cn('block size-[22px] rounded-full bg-wds-surface transition-transform duration-150 motion-reduce:transition-none', on ? 'translate-x-5' : 'translate-x-0')} />
        </button>
      </div>
      {on ? (
        <label className="flex flex-col gap-2">
          <span className="sr-only">{URGENT_SWITCH.noteLabel}</span>
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value.slice(0, URGENT_SWITCH.noteMax))}
            maxLength={URGENT_SWITCH.noteMax}
            rows={2}
            placeholder={URGENT_SWITCH.notePlaceholder}
            className="w-full resize-none border border-wds-border-strong bg-wds-surface px-3.5 py-3 font-wds-sans text-[15px] leading-5 text-wds-text-ink outline-none placeholder:text-wds-text-secondary focus-visible:border-wds-selected-edge focus-visible:shadow-wds-ring"
          />
        </label>
      ) : null}
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
