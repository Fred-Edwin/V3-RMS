'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { PhoneColumn, ScwPhoneHeader } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { PHONE_PRIMARY_BUTTON, PHONE_SECONDARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { clockLabel, todayLabel } from '../../_shared/lib/count-format';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { CountDetail } from '../../_shared/types/counting-contract';

const COUNTS = '/app/inventory/stock/counts';
const STEP_LABEL = { COUNTED: 'Counted', SUBMITTED: 'Submitted', CHECKED: 'Checked', APPROVED: 'Approved' } as const;

/**
 * Submitted, then count again (Paper step 7, `1WYG-0`), for the Store Attendant: the count's reference, who it is waiting for,
 * and the tracker Counted → Submitted → Checked → Approved. Nothing here is a stock figure. "Count another section" goes back to
 * Pick a section (the person can start a new count at once); "Log waste" opens the waste flow.
 */
export function SubmittedScreen({ countId }: { countId: string }) {
  const router = useRouter();
  const detail = useLoader(`count:${countId}`, () => countingApi.detail(countId), COUNTING_STATES_COPY.submitted.error);
  const count = detail.data;

  React.useEffect(() => {
    if (count?.status === 'OPEN') router.replace(`${COUNTS}/${count.id}/count`);
  }, [count, router]);

  const header = <ScwPhoneHeader leading="back" onBack={() => router.push(COUNTS)} title="Stock & counts" subtitle={`${todayLabel()} · Central Store`} />;

  if (detail.status === 'error') {
    return (
      <PhoneColumn>
        {header}
        <ScwStatePanel kind="error" phone text={COUNTING_STATES_COPY.submitted.error} onRetry={() => void detail.reload()} />
      </PhoneColumn>
    );
  }
  if (!count) {
    return (
      <PhoneColumn>
        {header}
        <LoadingAnnouncer text="Getting your count" />
        <div aria-hidden className="flex flex-col gap-3 px-4 pt-4">
          <div className="flex flex-col gap-3.5 border border-wds-border bg-wds-surface p-4">
            <Skeleton className="h-3 w-[40%]" />
            <Skeleton className="h-7 w-[45%]" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[70%]" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-[130px] w-full" />
        </div>
      </PhoneColumn>
    );
  }

  return (
    <PhoneColumn>
      {header}
      <SubmittedBody count={count} onAnother={() => router.push(COUNTS)} onWaste={() => router.push('/app/inventory/stock/waste/new')} />
    </PhoneColumn>
  );
}

function SubmittedBody({ count, onAnother, onWaste }: { count: CountDetail; onAnother: () => void; onWaste: () => void }) {
  const approved = count.status === 'APPROVED';
  const sectionsText = count.sections.map((s) => s.name).join(', ');
  const signed = count.signedAt ? clockLabel(count.signedAt) : '';
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-4">
      <section className="flex flex-col gap-3.5 border border-wds-border bg-wds-surface p-4" aria-labelledby="submitted-title">
        <div className="flex justify-between">
          <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{sectionsText} · Count</span>
          <span className="flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-[3px]', approved ? 'bg-wds-success-fg' : 'bg-wds-selected-edge')} aria-hidden />
            <span className={cn('font-wds-sans text-[12px] leading-4', approved ? 'text-wds-success-fg' : 'text-wds-warning-fg')}>{approved ? 'Approved' : 'Waiting for the Store Manager'}</span>
          </span>
        </div>
        <h2 id="submitted-title" className="font-wds-sans text-wds-mobile-title text-wds-text-ink">
          {approved ? 'Approved' : 'Submitted'}
        </h2>
        <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
          {approved
            ? `Signed by you at ${signed}. The Store Manager approved it and stock is up to date.`
            : `Signed by you at ${signed}. The Store Manager will check it and let you know if anything needs a look.`}
        </p>
        <ol className="flex items-start justify-between px-1.5 pt-1" aria-label="Where this count is">
          {count.tracker.steps.map((step) => (
            <li key={step.key} className="flex w-[60px] shrink-0 flex-col items-center gap-1.5" aria-current={step.state === 'CURRENT' ? 'step' : undefined}>
              <span
                className={cn(
                  'size-[18px] shrink-0 rounded-[9px]',
                  step.state === 'DONE' && 'bg-wds-success-fg',
                  step.state === 'CURRENT' && 'border-4 border-wds-selected-edge',
                  step.state === 'TODO' && 'border-[1.5px] border-wds-border-strong',
                )}
                aria-hidden
              />
              <span className={cn('font-wds-sans text-[11px] leading-[14px]', step.state === 'TODO' ? 'text-wds-neutral-500' : 'text-wds-text-ink')}>
                {STEP_LABEL[step.key]}
                <span className="sr-only">{step.state === 'DONE' ? ', done' : step.state === 'CURRENT' ? ', now' : ', not yet'}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <dl className="flex flex-col border border-wds-border bg-wds-surface">
        <Fact label="Reference" value={count.reference} />
        <Fact label="Counted" value={`${sectionsText} · ${count.progress.counted} of ${count.progress.total}`} />
        <Fact label="Counted between" value={count.signedAt ? `${clockLabel(count.startedAt)} – ${signed}` : clockLabel(count.startedAt)} last />
      </dl>
      <div className="grow" />
      <div className="flex flex-col gap-2 pb-5">
        <button type="button" onClick={onAnother} className={cn(PHONE_PRIMARY_BUTTON, 'h-[50px] text-[16px] leading-5')}>
          Count another section
        </button>
        <button type="button" onClick={onWaste} className={PHONE_SECONDARY_BUTTON}>
          Log waste
        </button>
      </div>
    </div>
  );
}

function Fact({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3 px-3.5 py-3', !last && 'border-b border-wds-neutral-100')}>
      <dt className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{label}</dt>
      <dd className="text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink">{value}</dd>
    </div>
  );
}
