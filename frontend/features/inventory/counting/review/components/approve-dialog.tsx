'use client';

import * as React from 'react';

import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { useLoader } from '../../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { scwErrorCode, scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { signedKes, signedMoney } from '../../_shared/lib/count-format';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { CountDetail } from '../../_shared/types/counting-contract';

/**
 * Approve and sign (Paper step 11, `1XV7-0`): every adjustment that will be written (item · cause · KES), the within-range lines
 * accepted together, the net, whether the Director is alerted, what is not counted, and the Manager's own PIN. Uses the shell sign
 * dialog (first use asks the person to set a PIN, then signs). Nothing is written until the PIN is accepted.
 */
export function ApproveDialog({
  count,
  open,
  onOpenChange,
  onApproved,
  onLinesUndecided,
}: {
  count: CountDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: (detail: CountDetail) => void;
  onLinesUndecided: () => void;
}) {
  const preview = useLoader(open ? `approve-preview:${count.id}` : null, () => countingApi.approvePreview(count.id), COUNTING_STATES_COPY.approveAndSign.error);
  const idem = useIdempotencyKey();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (open) setError(undefined);
  }, [open]);

  const submit = async (pin: string): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const detail = await countingApi.approve(count.id, { pin, idempotencyKey: idem.key() });
      idem.renew();
      onApproved(detail);
      onOpenChange(false);
    } catch (err) {
      setError(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.approveAndSign.error));
      if (scwErrorCode(err) === 'LINES_UNDECIDED') {
        onOpenChange(false);
        onLinesUndecided();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const p = preview.data;
  return (
    <SignSheetDialog
      layout="wide"
      open={open}
      onOpenChange={onOpenChange}
      title={`Approve count ${count.reference}`}
      subtitle={`${count.sections.map((s) => s.name).join(', ')} · counted by ${count.counter.name}. This is what will be written to the stock record.`}
      helperText=""
      confirmLabel="Approve and sign"
      onSubmit={(pin) => void submit(pin)}
      submitting={submitting}
      error={error}
      confirmBlockedReason={preview.status === 'error' ? COUNTING_STATES_COPY.approveAndSign.error : p ? undefined : 'Getting the adjustments'}
    >
      {preview.status === 'error' ? (
        <p role="alert" className="font-wds-sans text-[13px] leading-[19px] text-wds-error-fg">
          {COUNTING_STATES_COPY.approveAndSign.error}{' '}
          <button type="button" onClick={() => void preview.reload()} className="font-medium underline underline-offset-2">
            Try again
          </button>
        </p>
      ) : !p ? (
        <div aria-hidden className="flex flex-col border-t border-wds-text-ink">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex h-10 items-center justify-between border-b border-wds-neutral-100">
              <Skeleton className="h-3 w-[45%]" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <ul className="flex flex-col border-t border-wds-text-ink">
            {p.rows.map((row) => (
              <li key={row.lineId ?? row.label} className="flex h-10 items-center border-b border-wds-neutral-100">
                <span className="grow font-wds-sans text-[13px] leading-4 text-wds-text-ink">{row.label}</span>
                <span className="font-wds-mono text-[13px] leading-4 text-wds-error-fg">{signedMoney(row.valueKes)}</span>
              </li>
            ))}
            {p.withinRange ? (
              <li className="flex h-10 items-center border-b border-wds-neutral-100">
                <span className="grow font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{p.withinRange.count} within range · accepted together</span>
                <span className={cn('font-wds-mono text-[13px] leading-4', Number(p.withinRange.netKes) < 0 ? 'text-wds-error-fg' : 'text-wds-text-ink')}>{signedMoney(p.withinRange.netKes)}</span>
              </li>
            ) : null}
            <li className="flex h-11 items-center">
              <span className="grow font-wds-sans text-[14px] font-semibold leading-5 text-wds-text-ink">
                Net difference, {p.adjustments} adjustment{p.adjustments === 1 ? '' : 's'}
              </span>
              <span className="font-wds-mono text-[15px] font-semibold leading-5 text-wds-text-ink">{signedKes(p.netKes)}</span>
            </li>
          </ul>
          <div className="flex flex-col gap-1.5 border border-wds-border bg-wds-neutral-50 px-3.5 py-3">
            <p className="font-wds-sans text-[12px] leading-[17px] text-wds-neutral-700">{p.directorNote}</p>
            {p.notCountedNote ? <p className="font-wds-sans text-[12px] leading-[17px] text-wds-neutral-700">{p.notCountedNote}</p> : null}
          </div>
        </>
      )}
    </SignSheetDialog>
  );
}
