'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2ErrorNote, B2Footer, B2Header, B2PrimaryButton } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { block2ErrorMessage, couldNotLoad, errorCodeOf, OFFLINE_COUNT_MESSAGE } from '../../../_shared/lib/block2-words';
import type { CountLine, CountView } from '../../_shared/types/deliveries-contract';
import { useCountView } from '../../hooks/use-deliveries';
import { DELIVERIES_HOME, deliveryConfirm } from '../../lib/delivery-routes';
import { countFooterNote, isFlagged, reasonPosition, validCount } from '../../lib/count-logic';
import { deliveriesApi } from '../../services/deliveries-phone-api';
import { ReasonSheet } from './reason-sheet';

const SAVE_DELAY_MS = 600;

/** Count what arrived (Paper D8), "This doesn't match: count again" (D9) and the reason sheet (D10). The sent figure is never on this screen. */
export function CountScreen({ id }: { id: string }) {
  const router = useRouter();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const loader = useCountView(id);
  const view = loader.data;

  const [typed, setTyped] = React.useState<Record<string, string>>({});
  const [recounted, setRecounted] = React.useState<ReadonlySet<string>>(new Set());
  const [firstCounts, setFirstCounts] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [queue, setQueue] = React.useState<string[]>([]);
  const seeded = React.useRef(false);

  // Counts the person typed earlier come back (autosave); nothing else is ever pre-filled.
  React.useEffect(() => {
    if (!view || seeded.current) return;
    seeded.current = true;
    setTyped(Object.fromEntries(view.lines.filter((l) => l.countedQty !== null).map((l) => [l.lineId, l.countedQty ?? ''])));
    setFirstCounts(Object.fromEntries(view.lines.filter((l) => l.state === 'COUNT_AGAIN' && l.countedQty !== null).map((l) => [l.lineId, l.countedQty ?? ''])));
  }, [view]);

  // --- Autosave: typed counts go to the server a moment after the last key; "Check and sign" waits for it. ---
  const dirty = React.useRef<Set<string>>(new Set());
  const timer = React.useRef<number | undefined>(undefined);
  const latestTyped = React.useRef(typed);
  React.useEffect(() => {
    latestTyped.current = typed;
  });

  const flush = React.useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    const ids = Array.from(dirty.current);
    if (ids.length === 0) return true;
    const counts = ids.filter((lineId) => validCount(latestTyped.current[lineId] ?? '')).map((lineId) => ({ lineId, countedQty: (latestTyped.current[lineId] ?? '').trim() }));
    if (counts.length === 0) {
      dirty.current.clear();
      return true;
    }
    try {
      const updated = await deliveriesApi.saveCount(id, { counts });
      for (const c of counts) dirty.current.delete(c.lineId);
      loader.setData(updated);
      setError(null);
      return true;
    } catch (err) {
      const code = errorCodeOf(err);
      if (code === 'RECOUNT_USED') {
        // The second count is final: put back what the server holds.
        await loader.reload();
        for (const c of counts) dirty.current.delete(c.lineId);
        seeded.current = false;
      }
      setError(block2ErrorMessage(err, { offline: OFFLINE_COUNT_MESSAGE }));
      return false;
    }
  }, [id, loader]);

  // On unmount only: a count typed a moment ago is still saved when the person leaves. Reads the newest `flush` through a ref.
  const flushRef = React.useRef(flush);
  React.useEffect(() => {
    flushRef.current = flush;
  });
  React.useEffect(
    () => () => {
      if (dirty.current.size > 0) void flushRef.current();
    },
    [],
  );

  const onType = (line: CountLine, raw: string): void => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    setTyped((prev) => ({ ...prev, [line.lineId]: cleaned }));
    setRecounted((prev) => new Set(prev).add(line.lineId));
    dirty.current.add(line.lineId);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  };
  const onBlurLine = (line: CountLine): void => {
    // Leaving a flagged box counts as having looked again: the count is final on the next check either way.
    if (line.state === 'COUNT_AGAIN') setRecounted((prev) => new Set(prev).add(line.lineId));
  };

  const lines = view?.lines ?? [];
  const counted = lines.filter((l) => validCount(typed[l.lineId] ?? '')).length;
  const flagged = lines.filter((l) => isFlagged(l, recounted));
  const total = lines.length;
  const left = total - counted;
  const canCheck = view !== null && total > 0 && left === 0 && flagged.length === 0 && !busy;

  const openReasons = (v: CountView): boolean => {
    const need = v.lines.filter((l) => (l.state === 'SHORT' || l.state === 'EXTRA') && !l.reason).map((l) => l.lineId);
    if (need.length === 0) return false;
    setQueue(need);
    return true;
  };

  const checkAndSign = async (): Promise<void> => {
    if (!canCheck) return;
    setBusy(true);
    setError(null);
    try {
      if (!(await flush())) return;
      const result = await deliveriesApi.check(id);
      loader.setData(result.view);
      const again = result.differing.filter((d) => d.state === 'COUNT_AGAIN');
      if (again.length > 0) {
        setFirstCounts((prev) => ({ ...prev, ...Object.fromEntries(again.map((d) => [d.lineId, d.countedQty])) }));
        setRecounted((prev) => new Set(Array.from(prev).filter((lineId) => !again.some((d) => d.lineId === lineId))));
        return;
      }
      if (!openReasons(result.view)) router.push(deliveryConfirm(id));
    } catch (err) {
      setError(block2ErrorMessage(err, { offline: OFFLINE_COUNT_MESSAGE }));
    } finally {
      setBusy(false);
    }
  };

  const sheetLine = view?.lines.find((l) => l.lineId === queue[0]) ?? null;
  const back = (): void => router.push(DELIVERIES_HOME);

  if (loader.status === 'error' && !view) {
    const gone = loader.error;
    return (
      <PhoneColumn>
        <B2Header title="Count the delivery" subtitle="" leading="back" onBack={back} place={orgName} />
        <div role="alert" className="p-5">
          <MobileErrorState title="Could not load this delivery" description={gone ?? couldNotLoad('this delivery')} onRetry={() => void loader.reload()} />
        </div>
      </PhoneColumn>
    );
  }
  if (!view) {
    return (
      <PhoneColumn>
        <B2Header title="Count the delivery" subtitle="" leading="back" onBack={back} place={orgName} />
        <LoadingAnnouncer text="Loading this delivery" />
        <div className="flex flex-1 flex-col bg-wds-canvas" aria-hidden="true">
          <div className="border-b border-wds-text-ink bg-wds-surface px-5 py-3.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-1 w-full" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b border-wds-border bg-wds-surface px-5 py-3.5">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-10 w-16" />
            </div>
          ))}
        </div>
      </PhoneColumn>
    );
  }

  const pct = total === 0 ? 0 : Math.round((counted / total) * 100);
  return (
    <PhoneColumn>
      <B2Header title="Count the delivery" subtitle={`${view.reference} · ${view.department.name} · ${total} ${total === 1 ? 'line' : 'lines'}`} mono leading="back" onBack={back} place={orgName} />
      <div className="flex shrink-0 flex-col gap-2 border-b border-wds-text-ink bg-wds-surface px-5 pb-3 pt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink" aria-live="polite">
            {counted} of {total} counted
          </p>
          {flagged.length > 0 ? (
            <p role="status" className="font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
              {flagged.length} {flagged.length === 1 ? 'line' : 'lines'} to count again
            </p>
          ) : (
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Count each item as you find it</p>
          )}
        </div>
        <div className="h-1 w-full bg-wds-neutral-100" role="progressbar" aria-label="Lines counted" aria-valuemin={0} aria-valuemax={total} aria-valuenow={counted}>
          <div className="h-1 bg-wds-text-ink transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-surface">
        {error ? (
          <div className="px-5 pt-3">
            <B2ErrorNote>{error}</B2ErrorNote>
          </div>
        ) : null}
        <ul>
          {view.lines.map((line) => (
            <CountRow key={line.lineId} line={line} value={typed[line.lineId] ?? ''} flagged={isFlagged(line, recounted)} onChange={(raw) => onType(line, raw)} onBlur={() => onBlurLine(line)} />
          ))}
        </ul>
      </div>
      <B2Footer note={countFooterNote(left, view.lines.filter((l) => isFlagged(l, recounted)).map((l) => l.itemName))}>
        <B2PrimaryButton disabled={!canCheck} onClick={() => void checkAndSign()}>
          {busy ? 'Checking…' : 'Check and sign'}
        </B2PrimaryButton>
      </B2Footer>
      <ReasonSheet
        deliveryId={id}
        line={sheetLine}
        position={reasonPosition(view.lines.filter((l) => l.state === 'SHORT' || l.state === 'EXTRA').map((l) => l.lineId), sheetLine?.lineId)}
        firstCount={sheetLine ? (firstCounts[sheetLine.lineId] ?? null) : null}
        onClose={() => setQueue([])}
        onSaved={(updated) => {
          loader.setData({ ...view, lines: view.lines.map((l) => (l.lineId === updated.lineId ? { ...l, reason: updated.reason, photos: updated.photos } : l)) });
          const rest = queue.slice(1);
          setQueue(rest);
          if (rest.length === 0) router.push(deliveryConfirm(id));
        }}
      />
    </PhoneColumn>
  );
}

function CountRow({ line, value, flagged, onChange, onBlur }: { line: CountLine; value: string; flagged: boolean; onChange: (raw: string) => void; onBlur: () => void }) {
  const [focused, setFocused] = React.useState(false);
  const empty = value.trim() === '';
  return (
    <li
      className={cn(
        'relative flex flex-col gap-2 border-b px-5 py-[11px] transition-colors duration-100',
        flagged ? 'border-wds-error-border bg-wds-error-bg' : focused && empty ? 'border-wds-border bg-wds-caramel-100' : 'border-wds-border bg-wds-surface',
      )}
    >
      {flagged ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-wds-error-fg" /> : focused && empty ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-[var(--wds-primary-btn-start)]" /> : null}
      <div className="flex items-center gap-3">
        <label htmlFor={`count-${line.lineId}`} className="flex min-w-0 grow basis-0 flex-col gap-px py-1">
          <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{line.itemName}</span>
          <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Count in {line.unit}</span>
        </label>
        <input
          id={`count-${line.lineId}`}
          value={value}
          inputMode="decimal"
          autoComplete="off"
          placeholder="–"
          aria-invalid={flagged ? true : undefined}
          aria-describedby={flagged ? `count-${line.lineId}-flag` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className={cn(
            // Paper D8: a 64 x 40 box with a 16/20 number; the whole row is the tap target through its label.
            'h-10 w-16 shrink-0 border bg-white text-center font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink outline-none transition-shadow duration-100 placeholder:text-[#8D8982]',
            flagged ? 'border-wds-error-fg shadow-[0_0_0_3px_var(--wds-error-border)]' : focused ? 'border-[var(--wds-primary-btn-start)] shadow-[0_0_0_3px_var(--wds-caramel-100)]' : 'border-wds-border-strong',
          )}
        />
      </div>
      {flagged ? (
        <p id={`count-${line.lineId}-flag`} role="alert" className="flex items-start gap-2 font-wds-sans text-[13px] font-medium leading-5 text-wds-error-fg">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-wds-error-fg" aria-hidden="true" />
          This doesn&apos;t match what was sent. Count again.
        </p>
      ) : null}
    </li>
  );
}
