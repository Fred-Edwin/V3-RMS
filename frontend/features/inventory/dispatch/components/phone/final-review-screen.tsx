'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { CarrierChoice, type CarrierPick } from './carrier-choice';
import { Skeleton } from '@/components/ui2/skeleton';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2ErrorNote, B2Header, B2PrimaryButton, PinField, ReadField, SectionLabel, TextAction } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { block2ErrorMessage, couldNotLoad, errorCodeOf, linesText, plainName } from '../../../_shared/lib/block2-words';
import type { ReviewDepartment } from '../../_shared/types/dispatch-contract';
import { usePackReview } from '../../hooks/use-phone-dispatch';
import { deliveryNotesText, reviewTotals, shortSummary, signLabel } from '../../lib/pack-logic';
import { getLastCarrier, getLeftOut, rememberSent, setLastCarrier, setLeftOut } from '../../lib/pack-session';
import { packOverview, packReviewLines, packSent } from '../../lib/phone-routes';
import { dispatchPhoneApi } from '../../services/dispatch-phone-api';

/** The final review (Paper D5, and chapter 10's not-ready and left-out variants): one signature for every department that ships now. */
export function FinalReviewScreen({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const review = usePackReview(requisitionId);
  const data = review.data;
  const idem = useIdempotencyKey();

  const [leftOut, setLeftOutState] = React.useState<ReadonlySet<string>>(() => new Set());
  const [pick, setPick] = React.useState<CarrierPick>({ mode: 'carrier', carrierId: '' });
  const carrierId = pick.mode === 'carrier' ? pick.carrierId : '';
  const [pin, setPin] = React.useState('');
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [stockChanged, setStockChanged] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const pinRef = React.useRef<HTMLInputElement>(null);

  // The leave-out choice survives the trip to "every line" and back (kept on the device until it is signed).
  React.useEffect(() => {
    setLeftOutState(getLeftOut(requisitionId));
  }, [requisitionId]);

  // Only departments that are still fully ticked can be left out; a stale id from an earlier visit is dropped.
  const validLeftOut = React.useMemo(() => {
    const ready = new Set((data?.departments ?? []).filter((d) => d.canLeaveOut).map((d) => d.departmentId));
    return new Set(Array.from(leftOut).filter((id) => ready.has(id)));
  }, [data, leftOut]);

  const carriers = data?.carriers ?? [];
  React.useEffect(() => {
    if (!data || pick.mode === 'staff' || carrierId) return;
    const last = getLastCarrier();
    if (last && data.carriers.some((c) => c.id === last)) setPick({ mode: 'carrier', carrierId: last });
    else if (data.carriers.length === 1) setPick({ mode: 'carrier', carrierId: data.carriers[0].id });
  }, [data, carrierId, pick.mode]);

  const change = (next: Set<string>): void => {
    setLeftOutState(next);
    setLeftOut(requisitionId, next);
    setError(null);
  };

  if (review.status === 'error' && !data) {
    return (
      <PhoneColumn>
        <B2Header title="Final review" subtitle="" leading="back" onBack={() => router.push(packOverview(requisitionId))} place="CENTRAL STORE" />
        <div role="alert" className="p-5">
          <MobileErrorState title="Could not load the review" description={couldNotLoad('the review')} onRetry={() => void review.reload()} />
        </div>
      </PhoneColumn>
    );
  }
  if (!data) {
    return (
      <PhoneColumn>
        <B2Header title="Final review" subtitle="" leading="back" onBack={() => router.push(packOverview(requisitionId))} place="CENTRAL STORE" />
        <LoadingAnnouncer text="Loading the review" />
        <div className="flex flex-1 flex-col gap-3.5 bg-wds-canvas px-5 pt-4" aria-hidden="true">
          <Skeleton className="h-[220px] w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </PhoneColumn>
    );
  }

  const totals = reviewTotals(data, validLeftOut);
  const allShipping = data.departments.every((d) => d.allTicked) && validLeftOut.size === 0;
  const hasCarrier = pick.mode === 'staff' || carrierId !== '';
  const canSign = totals.canSend && hasCarrier && pin.length === 4 && !submitting;

  // `pinValue` is the PIN just typed: the fourth digit signs before the state has caught up.
  const sign = async (pinValue: string = pin): Promise<void> => {
    if (!(totals.canSend && hasCarrier && pinValue.length === 4 && !submitting)) return;
    setSubmitting(true);
    setError(null);
    setPinError(null);
    setStockChanged(false);
    try {
      // A department that is not fully ticked stays in To pack: the API wants it named with the ones left out on purpose.
      const staying = Array.from(validLeftOut).concat(data.departments.filter((d) => !d.allTicked).map((d) => d.departmentId));
      const result = await dispatchPhoneApi.sign(requisitionId, { ...(pick.mode === 'staff' ? { carrierUserId: pick.userId } : { carrierId }), pin: pinValue, idempotencyKey: idem.key(), ...(staying.length > 0 ? { leaveOut: staying } : {}) });
      if (pick.mode === 'carrier') setLastCarrier(carrierId);
      rememberSent(result);
      idem.renew();
      router.replace(packSent(requisitionId));
    } catch (err) {
      const code = errorCodeOf(err);
      const words = block2ErrorMessage(err, { offline: 'No connection. Your ticks are kept; try again when you are back online.' });
      if (code === 'INVALID_PIN') {
        setPinError(words);
        setPin('');
        pinRef.current?.focus();
      } else {
        setError(words);
        if (code === 'STOCK_CHANGED') setStockChanged(true);
        if (code === 'ALREADY_SIGNED') idem.renew();
      }
      setSubmitting(false);
    }
  };

  // The data refetches under us once the store has signed; keep to one plain word until the sent screen takes over (F20).
  if (submitting) {
    return (
      <PhoneColumn>
        <B2Header title="Final review" subtitle={`${data.reference} · ${data.branch.name}`} mono leading="back" onBack={() => undefined} place="CENTRAL STORE" />
        <div role="status" className="flex flex-1 items-center justify-center bg-wds-canvas px-5">
          <p className="font-wds-sans text-[15px] leading-5 text-wds-text-secondary">Signing…</p>
        </div>
      </PhoneColumn>
    );
  }

  return (
    <PhoneColumn>
      <B2Header title="Final review" subtitle={`${data.reference} · ${data.branch.name}`} mono leading="back" onBack={() => router.push(packOverview(requisitionId))} place="CENTRAL STORE" />
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto bg-wds-canvas px-5 pb-5 pt-4">
        <section aria-label="You are sending" className="flex flex-col border border-wds-text-ink bg-wds-surface">
          <div className="flex items-start justify-between border-b border-wds-text-ink px-3.5 py-3">
            <div className="flex flex-col gap-0.5">
              <SectionLabel>You are sending</SectionLabel>
              <p className="font-wds-sans text-[30px] font-semibold leading-9 tracking-[-0.02em] text-wds-text-ink" aria-live="polite">
                {totals.lineCount} {totals.lineCount === 1 ? 'line' : 'lines'}
              </p>
            </div>
            {totals.shortCount > 0 ? <span className="mt-1 border border-wds-warning-border bg-wds-warning-bg px-2 py-[3px] font-wds-sans text-[12px] leading-4 text-wds-warning-fg">{totals.shortCount} short</span> : null}
          </div>
          <ul>
            {data.departments.map((d) => (
              <DepartmentRow key={d.departmentId} department={d} left={validLeftOut.has(d.departmentId)} onLeaveOut={() => change(new Set(Array.from(validLeftOut).concat(d.departmentId)))} onPutBack={() => change(new Set(Array.from(validLeftOut).filter((id) => id !== d.departmentId)))} />
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 bg-wds-neutral-50 px-3.5 py-2.5">
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{totals.shipping.length === 0 ? 'Nothing to send yet' : `${deliveryNotesText(totals.shipping.length)}, one per department`}</p>
            <Link href={packReviewLines(requisitionId)} className="-my-3 flex min-h-11 shrink-0 items-center rounded-wds-sm px-1 font-wds-sans text-[13px] font-medium leading-[18px] text-[var(--wds-primary-btn-start)] outline-none hover:bg-wds-caramel-100 focus-visible:shadow-wds-ring">
              See every line
            </Link>
          </div>
        </section>

        <div className="flex gap-3">
          <ReadField label="Packed by" value={`${plainName(data.packedBy.name)} · ${data.packedBy.roleLabel}`} className="grow basis-0" />
          <ReadField label="Signed by" value={`${plainName(data.signedBy.name)} · ${data.signedBy.roleLabel}`} className="grow basis-0" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">Carried by</span>
          <CarrierChoice
            carriers={carriers}
            value={pick}
            onChange={(next) => {
              setPick(next);
              setError(null);
            }}
            disabled={submitting}
          />
        </div>

        <PinField id="dispatch-pin" inputRef={pinRef} value={pin} onChange={(v) => { setPin(v); setPinError(null); }} onSubmit={() => void sign()} onComplete={(v) => void sign(v)} error={pinError} disabled={submitting} />

        {error ? (
          <div className="flex flex-col gap-1">
            <B2ErrorNote>{error}</B2ErrorNote>
            {stockChanged ? (
              <TextAction onClick={() => router.push(packOverview(requisitionId))} className="self-start">
                Check the departments
              </TextAction>
            ) : null}
          </div>
        ) : null}

        {/* Paper D5: the button sits at the foot of the content (no bordered footer bar). */}
        <div className="mt-auto flex flex-col gap-2">
          <B2PrimaryButton disabled={!canSign} onClick={() => void sign()}>
            {submitting ? 'Signing…' : signLabel(data.branch.name, totals, allShipping)}
          </B2PrimaryButton>
          {totals.canSend ? null : <p className="text-center font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Leave at least one department in.</p>}
        </div>
      </div>
    </PhoneColumn>
  );
}

function DepartmentRow({ department: d, left, onLeaveOut, onPutBack }: { department: ReviewDepartment; left: boolean; onLeaveOut: () => void; onPutBack: () => void }) {
  const summary = shortSummary(d);
  if (!d.allTicked) {
    return (
      <li className="flex items-center justify-between gap-3 border-b border-wds-border bg-wds-neutral-50 px-3.5 py-2.5">
        <div className="flex min-w-0 flex-col gap-px">
          <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-secondary">{d.departmentName}</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-warning-fg">Not ready · stays in To pack</span>
        </div>
        <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{linesText(d.lineCount)}</span>
      </li>
    );
  }
  if (left) {
    return (
      <li className="flex items-center justify-between gap-3 border-b border-wds-border bg-wds-neutral-50 px-3.5 py-2.5">
        <div className="flex min-w-0 flex-col gap-px">
          <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-secondary">{d.departmentName}</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Left out · ships later</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{linesText(d.lineCount)}</span>
          <TextAction onClick={onPutBack} aria-label={`Put ${d.departmentName} back`}>
            Put back
          </TextAction>
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-2.5">
      <span className="shrink-0 font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{d.departmentName}</span>
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn('min-w-0 truncate font-wds-sans text-[13px] leading-[18px]', summary.short ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{summary.text}</span>
        {d.canLeaveOut ? (
          <TextAction onClick={onLeaveOut} aria-label={`Leave ${d.departmentName} out`} className="shrink-0">
            Leave out
          </TextAction>
        ) : null}
      </div>
    </li>
  );
}
