'use client';

import * as React from 'react';

import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { useLoader } from '../../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { scwErrorCode, scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { CauseChips } from '../../_shared/components/count-chips';
import { signedKes, signedMoney, signedQty } from '../../_shared/lib/count-format';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { CountCause, CountDetail } from '../../_shared/types/counting-contract';

/**
 * Sign your count (Paper step 14, `1YWV-0`), for a person whose count applies at signing (the Manager's own). Shows what is applied
 * when she signs (the lines within the range, needing no approval), the lines outside the range that are flagged to the Director
 * with a cause each (the same five chips, required before "Sign and apply": needs owner decision N1, the default applied), the net
 * difference, and her own PIN through the shell sign dialog. Nothing is written until the PIN is accepted.
 */
export function SignOwnDialog({
  count,
  open,
  onOpenChange,
  onSigned,
}: {
  count: CountDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSigned: (detail: CountDetail) => void;
}) {
  const preview = useLoader(open ? `sign-preview:${count.id}` : null, () => countingApi.signPreview(count.id), COUNTING_STATES_COPY.signWithPin.error);
  const idem = useIdempotencyKey();
  const [causes, setCauses] = React.useState<Record<string, CountCause>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (open) setError(undefined);
  }, [open]);

  const p = preview.data;
  const fig = p?.figures;
  const missing = fig ? fig.outside.filter((o) => !causes[o.lineId]).length : 0;

  const submit = async (pin: string): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const detail = await countingApi.sign(count.id, {
        pin,
        causes: Object.entries(causes).map(([lineId, cause]) => ({ lineId, cause })),
        idempotencyKey: idem.key(),
      });
      idem.renew();
      onSigned(detail);
    } catch (err) {
      setError(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.signWithPin.error));
      if (scwErrorCode(err) === 'COUNT_NOT_OPEN') onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  // The count on screen was loaded before the typing; the preview is read at sign time, so it wins once it arrives.
  const total = p ? p.itemCount : count.progress.total;
  const skipped = p ? p.skipped : count.progress.skipped;
  const counted = p ? p.itemCount - p.skipped : count.progress.counted;
  return (
    <SignSheetDialog
      layout="wide"
      wideWidth={580}
      open={open}
      onOpenChange={onOpenChange}
      title={`Sign your count ${count.reference}`}
      subtitle={`${count.sections.map((s) => s.name).join(', ')} · ${counted} of ${total} counted${skipped > 0 ? ` · ${skipped} skipped` : ''}`}
      helperText=""
      confirmLabel="Sign and apply"
      onSubmit={(pin) => void submit(pin)}
      submitting={submitting}
      error={error}
      confirmBlockedReason={!fig ? 'Getting the summary' : missing > 0 ? 'Pick a cause for every line outside the range' : undefined}
    >
      {preview.status === 'error' ? (
        <p role="alert" className="font-wds-sans text-[13px] leading-[19px] text-wds-error-fg">
          {COUNTING_STATES_COPY.signWithPin.error}{' '}
          <button type="button" onClick={() => void preview.reload()} className="font-medium underline underline-offset-2">
            Try again
          </button>
        </p>
      ) : !fig ? (
        <div aria-hidden className="flex flex-col gap-3">
          <Skeleton className="h-[72px] w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 border border-wds-success-border bg-wds-success-bg px-4 py-3.5">
            <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-success-fg">Applied when you sign · needs no approval</span>
            <span className="flex items-center justify-between">
              <span className="font-wds-sans text-[14px] leading-5 text-wds-text-ink">
                {fig.appliedLines} line{fig.appliedLines === 1 ? '' : 's'} within the range
              </span>
              <span className="font-wds-mono text-[13px] leading-4 text-wds-text-ink">{signedKes(fig.appliedNetKes)}</span>
            </span>
          </div>
          {fig.outside.length > 0 ? (
            <div className="flex flex-col">
              <span className="pb-2 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-error-fg">
                Outside the range · flagged to the Director · {fig.outside.length} line{fig.outside.length === 1 ? '' : 's'}
              </span>
              <ul className="border-t border-wds-text-ink">
                {fig.outside.map((o) => (
                  <li key={o.lineId} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-wds-neutral-100 py-2.5">
                    <span className={cn('grow font-wds-sans text-[13px] leading-4', causes[o.lineId] ? 'text-wds-text-ink' : 'text-wds-text-secondary')}>
                      {o.itemName} · {signedQty(o.difference, o.unit)}
                    </span>
                    <span className="w-16 shrink-0 text-right font-wds-mono text-[13px] leading-4 text-wds-error-fg">{signedMoney(o.differenceValueKes)}</span>
                    <CauseChips
                      className="basis-full [&_button]:h-[26px] [&_button]:px-2.5 [&_button]:text-[12px]"
                      value={causes[o.lineId] ?? null}
                      label={`Cause for ${o.itemName}`}
                      disabled={submitting}
                      onChange={(cause) => setCauses((c) => ({ ...c, [o.lineId]: cause }))}
                    />
                  </li>
                ))}
              </ul>
              <p className="pt-2.5 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{fig.directorNote}</p>
            </div>
          ) : (
            <p className="font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{fig.directorNote}</p>
          )}
          <div className="flex h-11 shrink-0 items-center justify-between border-t border-wds-text-ink">
            <span className="font-wds-sans text-[14px] font-semibold leading-5 text-wds-text-ink">Net difference</span>
            <span className="font-wds-mono text-[15px] font-semibold leading-5 text-wds-text-ink">{signedKes(fig.netKes)}</span>
          </div>
        </>
      )}
    </SignSheetDialog>
  );
}
