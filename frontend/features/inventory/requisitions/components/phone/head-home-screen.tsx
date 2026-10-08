'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { REQUISITIONS_KIT_COPY } from '../../_shared/lib/states-copy';
import { errorCodeOf, headErrorMessage, HOME_COPY, homeHeadline, homeLine, startLabel, URGENT_SWITCH } from '../../_shared/lib/phone-words';
import { CYCLE_TEXT, REQUISITION_CYCLES, type Home, type RequisitionCycle } from '../../_shared/types/requisitions-contract';
import { useHeadHome } from '../../hooks/use-head-requisitions';
import { reqFile } from '../../lib/routes';
import { longDateText, timeText } from '../../lib/time';
import { requisitionsApi } from '../../services/requisitions-phone-api';
import { HeadPrimaryButton, HeadPhoneHeader } from './head-phone-parts';

/**
 * The Department Head's Requisitions home (Paper step 1, and step 18 for the urgent Extra): pick the cycle, start it (the list is
 * filled in from the restock levels), and see what was asked earlier today. A cycle that already has a requisition today shows
 * "Open" instead of "Start" (the one open requisition per cycle rule), so the second start in a cycle is not offered; if it
 * happens anyway the server's 409 is shown inline.
 */
export function HeadHomeScreen() {
  const router = useRouter();
  const home = useHeadHome();
  const idem = useIdempotencyKey();
  const [picked, setPicked] = React.useState<RequisitionCycle | null>(null);
  const [urgent, setUrgent] = React.useState(false);
  const [urgentNote, setUrgentNote] = React.useState('');
  const [starting, setStarting] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNow(new Date().toISOString());
  }, []);

  const data = home.data;
  const cycle: RequisitionCycle = picked ?? data?.suggestedCycle ?? 'AFTERNOON';
  const openForCycle = data?.openByCycle[cycle] ?? null;
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
      router.push(reqFile(result.requisitionId));
    } catch (err) {
      setFailure(headErrorMessage(err));
      setStarting(false);
      if (errorCodeOf(err) === 'REQUISITION_ALREADY_OPEN') void home.reload();
    }
  }, [starting, cycle, showUrgent, urgent, urgentNote, idem, router, home]);

  const subtitle = HOME_COPY.subtitle(data?.department.name ?? '');

  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="menu" title="Requisitions" subtitle={data ? subtitle : 'Asking the Central Store'} />
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto bg-wds-canvas px-5 py-5">
        {home.status === 'error' ? (
          <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => void home.reload()} />
        ) : !data ? (
          <>
            <LoadingAnnouncer text={HOME_COPY.loading} />
            <div className="flex flex-col gap-4 border border-wds-border bg-wds-surface p-5" aria-hidden="true">
              <Skeleton className="h-4 w-[55%]" />
              <Skeleton className="h-8 w-[85%]" />
              <Skeleton className="h-3 w-[40%]" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
            <div className="flex flex-col gap-3" aria-hidden="true">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-[72px] w-full" />
            </div>
          </>
        ) : (
          <>
            <section className="flex flex-col gap-4 border border-wds-border bg-wds-surface p-5" aria-labelledby="req-headline">
              <p className="font-wds-sans text-[15px] leading-5 text-wds-text-secondary" suppressHydrationWarning>
                {now ? `${longDateText(now)} · ${timeText(now)}` : ' '}
              </p>
              <h2 id="req-headline" className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">
                {openForCycle ? `${CYCLE_TEXT[cycle]} requisition` : homeHeadline(cycle, Boolean(data.openByCycle.AFTERNOON))}
              </h2>
              <CyclePicker value={cycle} onChange={setPicked} open={data.openByCycle} />
              {openForCycle ? (
                <>
                  <p className="font-wds-sans text-[15px] leading-5 text-wds-text-secondary">
                    {HOME_COPY.cycleOpenHint}. {statusLine(data, cycle)}
                  </p>
                  <HeadPrimaryButton onClick={() => router.push(reqFile(openForCycle.requisitionId))}>{HOME_COPY.openCycle(CYCLE_TEXT[cycle].toLowerCase())}</HeadPrimaryButton>
                </>
              ) : (
                <>
                  {showUrgent ? <UrgentSwitch on={urgent} onChange={setUrgent} note={urgentNote} onNote={setUrgentNote} /> : null}
                  <p className="font-wds-sans text-[15px] leading-5 text-wds-text-secondary">{homeLine(data.department.name, data.suggestedLineCount)}</p>
                  {failure ? (
                    <p role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
                      {failure}
                    </p>
                  ) : null}
                  <HeadPrimaryButton onClick={() => void start()} disabled={starting} aria-busy={starting}>
                    {starting ? 'Starting…' : startLabel(cycle, showUrgent && urgent)}
                  </HeadPrimaryButton>
                </>
              )}
            </section>

            {data.earlierToday.length > 0 ? (
              <section className="flex flex-col gap-3" aria-label={HOME_COPY.earlierToday}>
                <h2 className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">{HOME_COPY.earlierToday}</h2>
                <ul className="flex flex-col gap-2">
                  {data.earlierToday.map((row) => (
                    <li key={row.requisitionId} className="flex flex-col gap-1.5 border border-wds-border bg-wds-surface px-4 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={reqFile(row.requisitionId)}
                          className="rounded-wds-sm font-wds-mono text-[14px] leading-5 text-[#1F5BAE] underline underline-offset-2 outline-none transition-colors hover:text-[#174A8E] focus-visible:shadow-wds-ring active:opacity-70"
                        >
                          {row.reference} · {row.cycleLabel.split(' · ')[0]}
                        </Link>
                        <StatusChip status={row.status} text={row.statusText} />
                      </div>
                      <p className="font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">
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

function statusLine(data: Home, cycle: RequisitionCycle): string {
  const open = data.open;
  if (open && open.cycle === cycle) return `${open.reference} · ${open.statusText}`;
  return data.openByCycle[cycle] ? 'Open it to see where it is.' : '';
}

/** Morning, Afternoon, Extra: three joined segments. The picked one is caramel with a 2 px primary underline. */
function CyclePicker({ value, onChange, open }: { value: RequisitionCycle; onChange: (c: RequisitionCycle) => void; open: Home['openByCycle'] }) {
  return (
    <div className="flex flex-col gap-2">
      <p id="req-which" className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">
        {HOME_COPY.whichRequisition}
      </p>
      <div role="radiogroup" aria-labelledby="req-which" className="flex border border-wds-border-strong">
        {REQUISITION_CYCLES.map((c, i) => {
          const selected = c === value;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(c)}
              className={cn(
                'relative flex h-11 min-w-0 grow basis-0 items-center justify-center gap-1.5 font-wds-sans text-[16px] leading-5 outline-none transition-colors focus-visible:z-10 focus-visible:shadow-wds-ring',
                i > 0 && 'border-l border-wds-border-strong',
                'active:bg-wds-caramel-100/70 motion-safe:active:scale-[0.99]',
                selected ? 'border-b-2 border-b-wds-selected-edge bg-wds-caramel-100 font-medium text-wds-selected-edge' : 'bg-wds-surface text-wds-text-secondary hover:bg-wds-neutral-50 hover:text-wds-text-ink',
              )}
            >
              {CYCLE_TEXT[c]}
              {open[c] ? <span className="size-1.5 rounded-full bg-wds-success-fg" role="img" aria-label="already started" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Paper step 18: the red card with the switch. The note is Amendment 2's optional "why", up to 200 characters. */
function UrgentSwitch({ on, onChange, note, onNote }: { on: boolean; onChange: (v: boolean) => void; note: string; onNote: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={cn('flex items-start gap-4 border p-4 transition-colors', on ? 'border-wds-error-border bg-wds-error-bg' : 'border-wds-border bg-wds-surface')}>
        <div className="flex min-w-0 grow flex-col gap-1.5">
          <p id="req-urgent-title" className={cn('font-wds-sans text-[17px] font-semibold leading-[22px]', on ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
            {URGENT_SWITCH.title}
          </p>
          <p id="req-urgent-body" className="font-wds-sans text-[14px] leading-5 text-wds-text-ink">
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
            'relative -m-1 h-7 w-12 shrink-0 rounded-full p-1 outline-none transition-[background-color,filter] duration-150 hover:brightness-95 focus-visible:shadow-wds-ring active:brightness-90',
            on ? 'bg-wds-error-fg' : 'bg-wds-border-strong',
          )}
        >
          <span aria-hidden="true" className={cn('block size-5 rounded-full bg-wds-surface transition-transform duration-150 motion-reduce:transition-none', on ? 'translate-x-5' : 'translate-x-0')} />
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

export function StatusChip({ status, text }: { status: string; text: string }) {
  const good = status === 'APPROVED' || status === 'CLOSED';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1 font-wds-sans text-[14px] leading-[18px]',
        good ? 'border-wds-success-border bg-wds-success-bg text-wds-success-fg' : 'border-wds-border-strong bg-wds-neutral-100 text-wds-text-ink',
      )}
    >
      {good ? <span className="size-1.5 rounded-full bg-wds-success-fg" aria-hidden="true" /> : null}
      {text}
    </span>
  );
}
