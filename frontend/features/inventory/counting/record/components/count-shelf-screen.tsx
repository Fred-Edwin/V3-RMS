'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Keypad } from '@/components/ui2/keypad';
import { cn } from '@/lib/cn';
import { PhoneColumn, ScwPhoneHeader } from '../../../_shared/components/phone-column';
import { PHONE_PRIMARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { clockLabel } from '../../_shared/lib/count-format';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import type { CountDetail } from '../../_shared/types/counting-contract';
import { useShelf } from '../hooks/use-shelf';
import { MoveItemSheet } from './move-item-sheet';
import { SectionCheckSheet } from './section-check-sheet';
import { ShelfKeyframes, ShelfRow } from './shelf-row';

const COUNTS = '/app/inventory/stock/counts';

/**
 * Count the shelf, for the Store Attendant (Paper steps 2, 3, 4 and 41: `1WIL-0`, `1WM9-0`, `1WQJ-0`, `247B-0`). A phone-width
 * column at every width with no stock figure in sight. The key beside the number pad is the one action and its label follows the
 * box: a number reads Next, an empty box reads Skip (and 0 is a real zero). On a computer keyboard digits type, Enter saves and
 * moves on, Tab skips. Numbers save quietly ("Saved 07:19"); a failed save keeps the number on this device and offers Try again.
 * When a section's last line is handled the server names the items that look different (by name and the typed number only) and
 * a second look is offered once.
 */
export function CountShelfScreen({ initial, focusLineId }: { initial: CountDetail; focusLineId?: string | null }) {
  const router = useRouter();
  const shelf = useShelf(initial, focusLineId);
  const { autosave } = shelf;
  const [moving, setMoving] = React.useState<{ itemId: string; name: string; unit: string; sectionName: string | null } | null>(null);
  const [notice, setNotice] = React.useState('');
  const activeRef = React.useRef<HTMLLIElement>(null);
  const capture = React.useRef<HTMLInputElement>(null);
  const sheetOpen = shelf.check !== null || moving !== null;

  const active = shelf.lines.find((l) => l.id === shelf.activeId) ?? null;
  const recount = shelf.mode.kind === 'recount';
  const recountLines = shelf.mode.kind === 'recount' ? shelf.mode.queue.map((id) => shelf.lines.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => Boolean(l)) : [];
  const sectionName = active?.sectionName ?? shelf.lines[0]?.sectionName ?? initial.sections[0]?.name ?? 'Count';

  // Done: every line handled and the section checks are over, so on to signing.
  React.useEffect(() => {
    if (shelf.ended) router.push(`${COUNTS}/${initial.id}/sign`);
  }, [shelf.ended, router, initial.id]);

  // The row being counted slides into view (instant under reduced motion), and the hidden capture field takes the keyboard.
  React.useEffect(() => {
    if (!shelf.activeId) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    if (!sheetOpen) capture.current?.focus({ preventScroll: true });
  }, [shelf.activeId, sheetOpen]);

  const { type, backspace, advance } = shelf;
  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) type(event.key);
      else if (event.key === '.' || event.key === ',') type('.');
      else if (event.key === 'Backspace') backspace();
      else if (event.key === 'Enter') void advance();
      else if (event.key === 'Tab' && !event.shiftKey) void advance();
      else if (event.key === 'Escape') (event.target as HTMLElement).blur();
      else return;
      if (event.key !== 'Escape') event.preventDefault();
    },
    [type, backspace, advance],
  );

  const goBack = async (): Promise<void> => {
    await autosave.flush();
    router.push(COUNTS);
  };

  const pctDone = shelf.progress.total === 0 ? 0 : Math.round((shelf.progress.counted / shelf.progress.total) * 100);
  const recountIndex = shelf.mode.kind === 'recount' ? shelf.mode.index : 0;
  const stripLabel = recount
    ? `Recount · ${recountIndex + 1} of ${shelf.mode.kind === 'recount' ? shelf.mode.queue.length : 0}`
    : `Section ${shelf.sectionPosition.index} of ${shelf.sectionPosition.of}${shelf.progress.skipped > 0 ? ` · ${shelf.progress.skipped} skipped` : ''}`;
  const stripPct = recount && shelf.mode.kind === 'recount' ? Math.round(((recountIndex + 1) / shelf.mode.queue.length) * 100) : pctDone;
  const headerSubtitle = recount ? `${sectionName} · ${recountIndex + 1} of ${recountLines.length} items` : shelf.progress.total === 0 ? '' : `${shelf.progress.counted} of ${shelf.progress.total} counted`;

  const actionLabel = recount && shelf.draft === '' ? 'Keep' : shelf.draft === '' ? 'Skip' : 'Next';
  const keepDetail = recount && active ? `${active.counted} ${active.unit}` : undefined;
  const busy = shelf.checking;

  return (
    <PhoneColumn>
      <ShelfKeyframes />
      <ScwPhoneHeader leading="back" onBack={() => void goBack()} title={recount ? 'Recount' : sectionName} subtitle={headerSubtitle} />
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-wds-border bg-wds-surface px-4 py-3">
        <div className="flex justify-between">
          <span className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-muted">{stripLabel}</span>
          <span role="status" aria-live="polite" className="font-wds-mono text-[11px] leading-[14px] text-wds-text-muted">
            {autosave.status === 'failed' ? (
              <span className="text-wds-error-fg">
                Not saved ·{' '}
                <button type="button" onClick={() => void autosave.retry()} className="font-medium underline underline-offset-2 outline-none focus-visible:shadow-wds-ring">
                  Try again
                </button>
              </span>
            ) : autosave.status === 'saving' ? (
              'Saving…'
            ) : autosave.savedAt ? (
              `Saved ${clockLabel(autosave.savedAt)}`
            ) : null}
          </span>
        </div>
        <div className="flex h-1 shrink-0 bg-wds-neutral-100" role="progressbar" aria-label="Count progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stripPct}>
          <div className="bg-wds-selected-edge motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out" style={{ width: `${stripPct}%` }} />
        </div>
      </div>

      {autosave.status === 'failed' && autosave.error ? (
        <p role="alert" className="border-b border-wds-error-border bg-wds-error-bg px-4 py-2 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {autosave.error}
        </p>
      ) : null}
      {shelf.checkFailed ? (
        <p role="alert" className="flex items-center justify-between gap-3 border-b border-wds-warning-border bg-wds-warning-bg px-4 py-2 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">
          {COUNTING_STATES_COPY.sectionCheck.error}
          <button type="button" onClick={() => void shelf.retryCheck()} className="shrink-0 font-medium underline underline-offset-2 outline-none focus-visible:shadow-wds-ring">
            Try again
          </button>
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto bg-wds-surface" aria-busy={busy}>
        {shelf.lines.length === 0 ? (
          <p className="px-4 py-6 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">{COUNTING_STATES_COPY.countShelf.empty}</p>
        ) : recount ? (
          <>
            <ul>
              {recountLines.map((line, i) => {
                const isActive = line.id === shelf.activeId;
                return (
                  <li key={line.id} ref={isActive ? activeRef : undefined}>
                    <ShelfRow line={line} active={isActive} draft={shelf.draft} recount upNext={!isActive && i > recountIndex} onSelect={() => undefined} />
                  </li>
                );
              })}
            </ul>
            <p className="px-4 py-3.5 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">Count it again as you see it. We keep your new number, and nobody asks a second time.</p>
          </>
        ) : (
          <ul>
            {shelf.lines.map((line) => {
              const isActive = line.id === shelf.activeId;
              return (
                <li key={line.id} ref={isActive ? activeRef : undefined}>
                  <ShelfRow
                    line={line}
                    active={isActive}
                    draft={shelf.draft}
                    onSelect={() => shelf.select(line.id)}
                    onMove={() => setMoving({ itemId: line.itemId, name: line.name, unit: line.unit, sectionName: line.sectionName })}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <div role="status" aria-live="polite" className="sr-only">
          {notice}
        </div>
        {notice ? <p className="border-t border-wds-border bg-wds-success-bg px-4 py-2 font-wds-sans text-[12px] leading-4 text-wds-success-fg motion-safe:animate-in motion-safe:fade-in-0">{notice}</p> : null}
      </div>

      {/* Captures the computer keyboard while a row is being counted; the number pad below is for touch. */}
      <input
        ref={capture}
        readOnly
        inputMode="none"
        aria-label={active ? `${active.name}, ${active.unit}. Type the number. Enter saves, Tab skips.` : 'Count'}
        value={shelf.draft}
        onKeyDown={onKeyDown}
        className="sr-only"
        tabIndex={active ? 0 : -1}
      />
      {active || busy ? (
        <Keypad
          disabled={!active || busy}
          onDigit={(d) => {
            shelf.type(d);
            capture.current?.focus({ preventScroll: true });
          }}
          onBackspace={shelf.backspace}
          action={{
            label: actionLabel,
            detail: actionLabel === 'Keep' ? keepDetail : undefined,
            tone: actionLabel === 'Next' ? 'primary' : 'neutral',
            disabled: !active || busy,
            disabledReason: busy ? 'Checking your numbers' : 'Every item is handled',
            onPress: () => {
              void shelf.advance();
              capture.current?.focus({ preventScroll: true });
            },
          }}
        />
      ) : (
        <div className="flex shrink-0 flex-col gap-2 border-t border-wds-border bg-wds-canvas px-4 pb-5 pt-3">
          <button type="button" onClick={() => router.push(`${COUNTS}/${initial.id}/sign`)} className={cn(PHONE_PRIMARY_BUTTON, 'h-[50px] text-[16px] leading-5')}>
            Review and sign
          </button>
          <p className="text-center font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Every item is counted or skipped. Tap a number above to change it.</p>
        </div>
      )}

      <SectionCheckSheet check={shelf.check} onRecount={shelf.startRecount} onContinue={shelf.continueAsCounted} />
      <MoveItemSheet item={moving} onClose={() => setMoving(null)} onMoved={setNotice} />
    </PhoneColumn>
  );
}
