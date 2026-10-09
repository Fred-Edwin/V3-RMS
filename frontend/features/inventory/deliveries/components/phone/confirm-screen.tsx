'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { useAuthStore } from '@/store/authStore';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2ErrorNote, B2Header, B2PrimaryButton, PinField, ReadField, SectionLabel } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { block2ErrorMessage, couldNotLoad, differenceText, errorCodeOf, itemWord, OFFLINE_COUNT_MESSAGE } from '../../../_shared/lib/block2-words';
import { formatQty } from '../../../requisitions/lib/qty';
import { COUNT_REASON_TEXT } from '../../../dispatch/_shared/types/dispatch-contract';
import { useConfirmPreview } from '../../hooks/use-deliveries';
import { deliveryCount, deliveryDone } from '../../lib/delivery-routes';
import { rememberConfirmed } from '../../lib/confirm-session';
import { deliveriesApi } from '../../services/deliveries-phone-api';

/** Confirm with your PIN (Paper D11): the summary where the sent figure finally shows, then the PIN. */
export function ConfirmScreen({ id }: { id: string }) {
  const router = useRouter();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const isHead = useAuthStore((s) => s.isDepartmentHead);
  const preview = useConfirmPreview(id);
  const data = preview.data;
  const idem = useIdempotencyKey();
  const [pin, setPin] = React.useState('');
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const pinRef = React.useRef<HTMLInputElement>(null);
  const back = (): void => router.push(deliveryCount(id));

  if (preview.status === 'error' && !data) {
    return (
      <PhoneColumn>
        <B2Header title="Confirm the delivery" subtitle="" leading="back" onBack={back} place={orgName} />
        <div role="alert" className="p-5">
          <MobileErrorState title="Could not load the summary" description={preview.error ?? couldNotLoad('the summary')} onRetry={() => void preview.reload()} />
        </div>
      </PhoneColumn>
    );
  }
  if (!data) {
    return (
      <PhoneColumn>
        <B2Header title="Confirm the delivery" subtitle="" leading="back" onBack={back} place={orgName} />
        <LoadingAnnouncer text="Loading the summary" />
        <div className="flex flex-1 flex-col gap-4 bg-wds-canvas p-5" aria-hidden="true">
          <Skeleton className="h-[170px] w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </PhoneColumn>
    );
  }

  const diff = data.differingLines;
  const mismatch = diff.length;
  const sum = (n: number): string => formatQty(Math.abs(n));
  const shorts = diff.filter((l) => l.direction === 'SHORT');
  const firstShort = shorts[0];
  const heldNote = !firstShort
    ? 'What you counted goes into your stock.'
    : shorts.length === 1
      ? `What you counted goes into your stock. The ${sum(Number(firstShort.gapQty))} ${itemWord(firstShort.itemName)} are held until the Store Manager finds out what happened.`
      : 'What you counted goes into your stock. The missing items are held until the Store Manager finds out what happened.';
  const canConfirm = data.canConfirm && pin.length === 4 && !submitting;

  const confirm = async (): Promise<void> => {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    setPinError(null);
    try {
      const result = await deliveriesApi.confirm(id, { pin, idempotencyKey: idem.key() });
      rememberConfirmed(result);
      idem.renew();
      router.replace(deliveryDone(id));
    } catch (err) {
      const code = errorCodeOf(err);
      const words = block2ErrorMessage(err, { offline: OFFLINE_COUNT_MESSAGE });
      if (code === 'INVALID_PIN') {
        setPinError(words);
        setPin('');
        pinRef.current?.focus();
      } else {
        setError(words);
      }
      setSubmitting(false);
    }
  };

  return (
    <PhoneColumn>
      <B2Header title="Confirm the delivery" subtitle={`${data.reference} · ${data.department.name}`} mono leading="back" onBack={back} place={orgName} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-wds-canvas p-5">
        <section aria-label="What you counted" className="flex flex-col border border-wds-text-ink bg-wds-surface">
          <div className="flex items-start justify-between border-b border-wds-text-ink p-3.5">
            <div className="flex flex-col gap-0.5">
              <SectionLabel>You counted</SectionLabel>
              <p className="font-wds-sans text-[30px] font-semibold leading-9 tracking-[-0.02em] text-wds-text-ink">
                {data.lineCount} {data.lineCount === 1 ? 'line' : 'lines'}
              </p>
            </div>
            {mismatch > 0 ? <span className="mt-1 border border-wds-warning-border bg-wds-warning-bg px-2 py-[3px] font-wds-sans text-[12px] leading-4 text-wds-warning-fg">{differenceText(diff.map((l) => l.direction))}</span> : null}
          </div>
          <div className="flex items-start justify-between gap-3 border-b border-wds-border px-3.5 py-3">
            <div className="flex min-w-0 flex-col gap-px">
              <p className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{mismatch === 0 ? `All ${data.lineCount} lines match` : `${data.matchingLines.length} ${data.matchingLines.length === 1 ? 'line matches' : 'lines match'}`}</p>
              {mismatch > 0 && data.matchingLines.length > 0 ? <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{data.matchingLines.map((l) => l.itemName).join(', ')}</p> : null}
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 shrink-0">
              <path d="M3 8.5L6.5 12L13 4.5" fill="none" stroke="var(--wds-success-fg)" strokeWidth="1.8" />
            </svg>
          </div>
          {diff.map((l) => (
            <div key={l.lineId} className="flex flex-col gap-[3px] border-b border-wds-border bg-wds-warning-bg px-3.5 py-3 last:border-b-0">
              <p className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{l.itemName}</p>
              <p className="font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">
                You counted {formatQty(l.countedQty)}, {formatQty(l.sentQty)} were sent.
                {l.direction === 'EXTRA' ? ` The Store Manager will say what happened to the ${sum(Number(l.gapQty))} extra.` : ''}
              </p>
              {l.reason ? <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Reason: {COUNT_REASON_TEXT[l.reason].toLowerCase()}{l.photoCount > 0 ? ` · ${l.photoCount} ${l.photoCount === 1 ? 'photo' : 'photos'}` : ''}</p> : null}
            </div>
          ))}
        </section>
        <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{heldNote}</p>
        <ReadField label="Signed by" value={`${data.department.name} Department ${isHead ? 'Head' : 'Member'}`} />
        <PinField id="confirm-pin" inputRef={pinRef} value={pin} onChange={(v) => { setPin(v); setPinError(null); }} onSubmit={() => void confirm()} error={pinError} disabled={submitting} />
        {error ? <B2ErrorNote>{error}</B2ErrorNote> : null}
        {/* Paper D11: the main button sits at the foot of the content (no bordered footer bar). */}
        <div className="mt-auto">
          <B2PrimaryButton disabled={!canConfirm} onClick={() => void confirm()}>
            {submitting ? 'Confirming…' : 'Confirm the delivery'}
          </B2PrimaryButton>
        </div>
      </div>
    </PhoneColumn>
  );
}
