'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { PhoneColumn, ScwPhoneHeader } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { PHONE_PRIMARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { scwErrorCode, scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { clockLabel, itemsLabel, showQty, todayLabel } from '../../_shared/lib/count-format';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { CountDetail, CountLine } from '../../_shared/types/counting-contract';

const COUNTS = '/app/inventory/stock/counts';

type Tab = 'all' | 'skipped' | 'zero' | 'rechecked';

const isZero = (l: CountLine): boolean => l.countedQty !== null && Number(l.countedQty) === 0;

/**
 * Review before signing (Paper step 5, `1WT5-0`) and the PIN sheet over it (step 6, `1WVE-0`), for the Store Attendant: every
 * counted line with tabs All / Skipped / Zero / Rechecked, a tap on a number takes the person back to that line to change it, and
 * "Sign and submit" asks for the person's own PIN (first use: "Set your signing PIN" first). A wrong PIN shakes the boxes and
 * writes nothing. Signing submits the count; stock changes only when the Manager approves it.
 */
export function ReviewSignScreen({ countId }: { countId: string }) {
  const router = useRouter();
  const detail = useLoader(`count:${countId}`, () => countingApi.detail(countId), COUNTING_STATES_COPY.reviewBeforeSigning.error);
  const [tab, setTab] = React.useState<Tab>('all');
  const [signing, setSigning] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [pinError, setPinError] = React.useState<string | undefined>();
  const idem = useIdempotencyKey();
  const count = detail.data;

  // A count that is not open any more is not for signing: show where it went.
  React.useEffect(() => {
    if (count && count.status !== 'OPEN') router.replace(`${COUNTS}/${count.id}/submitted`);
  }, [count, router]);

  const header = (title: string, subtitle: string) => <ScwPhoneHeader leading="back" onBack={() => router.push(count ? `${COUNTS}/${count.id}/count` : COUNTS)} title={title} subtitle={subtitle} />;

  if (detail.status === 'loading' || (detail.status === 'idle' && !count)) {
    return (
      <PhoneColumn>
        {header('Review and sign', 'Opening your count')}
        <LoadingAnnouncer text={COUNTING_STATES_COPY.reviewBeforeSigning.loading} />
        <div aria-hidden className="flex flex-col">
          <div className="flex h-[58px] border-b border-wds-border bg-wds-surface">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex grow basis-0 flex-col gap-1.5 px-3 py-2.5">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex h-11 items-center gap-3 border-b border-wds-neutral-100 bg-wds-surface px-4">
              <Skeleton className="h-3.5 w-[45%]" />
              <div className="grow" />
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </PhoneColumn>
    );
  }
  if (detail.status === 'error' || !count) {
    return (
      <PhoneColumn>
        {header('Review and sign', '')}
        <ScwStatePanel kind="error" phone text={COUNTING_STATES_COPY.reviewBeforeSigning.error} onRetry={() => void detail.reload()} />
      </PhoneColumn>
    );
  }
  if (!count.can.sign && count.status === 'OPEN') {
    return (
      <PhoneColumn>
        {header('Review and sign', '')}
        <ScwStatePanel kind="permission" phone text={COUNTING_STATES_COPY.reviewBeforeSigning.permission} />
      </PhoneColumn>
    );
  }

  const lines = [...count.lines].sort((a, b) => a.position - b.position);
  const handled = lines.filter((l) => l.countedQty !== null || l.skipped);
  const counts = {
    all: lines.length,
    skipped: lines.filter((l) => l.skipped).length,
    zero: lines.filter(isZero).length,
    rechecked: lines.filter((l) => l.recheck !== 'NONE').length,
  };
  const shown = lines.filter((l) => (tab === 'skipped' ? l.skipped : tab === 'zero' ? isZero(l) : tab === 'rechecked' ? l.recheck !== 'NONE' : true));
  const sectionsText = count.sections.map((s) => s.name).join(', ');
  const nothingCounted = count.progress.counted === 0;

  const sign = async (pin: string): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    setPinError(undefined);
    try {
      await countingApi.sign(count.id, { pin, idempotencyKey: idem.key() });
      router.replace(`${COUNTS}/${count.id}/submitted`);
    } catch (err) {
      setSubmitting(false);
      const code = scwErrorCode(err);
      setPinError(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.signWithPin.error));
      if (code === 'NOTHING_COUNTED') setSigning(false);
    }
  };

  const tabs: { key: Tab; label: string; n: number; warn?: boolean }[] = [
    { key: 'all', label: 'All', n: counts.all },
    { key: 'skipped', label: 'Skipped', n: counts.skipped, warn: counts.skipped > 0 },
    { key: 'zero', label: 'Zero', n: counts.zero },
    { key: 'rechecked', label: 'Rechecked', n: counts.rechecked },
  ];

  return (
    <PhoneColumn>
      {header('Review and sign', `${sectionsText} · ${itemsLabel(handled.length)} · ${todayLabel().replace(/ \d{4}$/, '')}`)}
      <div role="tablist" aria-label="Show lines" className="flex shrink-0 border-b border-wds-border bg-wds-surface">
        {tabs.map((t) => {
          const selected = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex grow basis-0 flex-col items-start gap-px px-3 py-2.5 text-left outline-none transition-colors duration-100 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-ring)]',
                'border-b-2 [@media(hover:hover)]:hover:bg-wds-neutral-50',
                selected ? 'border-wds-text-ink' : 'border-transparent',
              )}
            >
              <span className={cn('font-wds-mono text-[16px] leading-5', t.warn ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{t.n}</span>
              <span className={cn('font-wds-sans text-[11px] leading-[14px]', selected ? 'font-semibold text-wds-text-ink' : 'text-wds-text-secondary')}>{t.label}</span>
            </button>
          );
        })}
      </div>
      <p className="shrink-0 px-4 pb-2 pt-2.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Tap any number to change it before you sign.</p>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-wds-border bg-wds-surface" role="tabpanel">
        {lines.length === 0 || nothingCounted ? (
          <ScwStatePanel kind="empty" phone text={COUNTING_STATES_COPY.reviewBeforeSigning.empty} actionLabel="Back to counting" onAction={() => router.push(`${COUNTS}/${count.id}/count`)} />
        ) : shown.length === 0 ? (
          <p className="px-4 py-6 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">Nothing here. Pick another tab.</p>
        ) : (
          <ul>
            {shown.map((line) => (
              <ReviewRow key={line.id} line={line} onChange={() => router.push(`${COUNTS}/${count.id}/count?line=${line.id}`)} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-wds-border bg-wds-canvas px-4 pb-5 pt-3">
        <button type="button" disabled={nothingCounted} onClick={() => setSigning(true)} title={nothingCounted ? 'Count something first' : undefined} className={cn(PHONE_PRIMARY_BUTTON, 'h-[50px] text-[16px] leading-5')}>
          Sign and submit
        </button>
        <p className="text-center font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Stock only changes when the Store Manager approves this count.</p>
      </div>

      <SignSheetDialog
        layout="sheet"
        open={signing}
        onOpenChange={(open) => {
          setSigning(open);
          if (!open) setPinError(undefined);
        }}
        title="Sign the count"
        subtitle={`${count.counter.name} · ${sectionsText} · ${todayLabel()} · ${clockLabel(new Date().toISOString())}`}
        helperText=""
        confirmLabel="Sign and submit"
        onSubmit={(pin) => void sign(pin)}
        submitting={submitting}
        error={pinError}
      >
        <SignSummary count={count} />
      </SignSheetDialog>
    </PhoneColumn>
  );
}

function ReviewRow({ line, onChange }: { line: CountLine; onChange: () => void }) {
  const skipped = line.skipped;
  return (
    <li className={cn('border-b border-wds-neutral-100', skipped && 'bg-wds-warning-bg')}>
      <button
        type="button"
        onClick={onChange}
        aria-label={`${line.itemName}, ${skipped ? 'skipped. Count it' : `${showQty(line.countedQty)} ${line.unit}. Change the number`}`}
        className="flex h-11 w-full items-center gap-3 px-4 text-left outline-none transition-colors duration-100 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-ring)] enabled:[@media(hover:hover)]:hover:bg-wds-neutral-50 enabled:active:bg-wds-neutral-100"
      >
        <span className="flex min-w-0 grow items-center gap-2">
          <span className="truncate font-wds-sans text-[15px] leading-5 text-wds-text-ink">{line.itemName}</span>
          {line.recheck !== 'NONE' ? <span className="shrink-0 border border-wds-info-border bg-wds-info-bg px-[5px] py-px font-wds-mono text-[9px] uppercase leading-3 tracking-[0.06em] text-wds-info-fg">Rechecked</span> : null}
        </span>
        <span className={cn('font-wds-sans text-[12px] leading-4', skipped ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{skipped ? 'Skipped' : line.unit}</span>
        {skipped ? (
          <span className="flex w-14 shrink-0 justify-end font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge">Count</span>
        ) : (
          <span className="flex w-14 shrink-0 justify-end font-wds-mono text-[16px] leading-5 text-wds-text-ink">{showQty(line.countedQty)}</span>
        )}
      </button>
    </li>
  );
}

/** The three numbers the signer confirms (Paper `1WXL-0`): items, zero, skipped. */
function SignSummary({ count }: { count: CountDetail }) {
  const preview = useLoader(`sign-preview:${count.id}`, () => countingApi.signPreview(count.id), COUNTING_STATES_COUNT_FALLBACK);
  const p = preview.data;
  const cell = (value: number | undefined, label: string, warn = false) => (
    <div className="flex flex-col">
      <span className={cn('font-wds-mono text-[18px] leading-[22px]', warn ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{value ?? '–'}</span>
      <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{label}</span>
    </div>
  );
  return (
    <div className="flex gap-5 border border-wds-border bg-wds-neutral-50 px-3.5 py-3" aria-live="polite">
      {cell(p?.itemCount, 'items')}
      {cell(p?.zero, 'zero')}
      {cell(p?.skipped, 'skipped', (p?.skipped ?? 0) > 0)}
    </div>
  );
}

const COUNTING_STATES_COUNT_FALLBACK = COUNTING_STATES_COPY.signWithPin.error;
