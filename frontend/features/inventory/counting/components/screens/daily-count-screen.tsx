'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { HintTooltip } from '@/components/app/shell/hint-tooltip';
import { useDailyCount, normalizeCount } from '../../hooks/use-daily-count';
import type { AttendantCountLine, AttendantCountView } from '../../types/count';
import { PinSheet } from '../pin-sheet';
import { StockMobileHeader } from '../../../stock/components/stock-mobile-header';
import { FormErrorBanner, MobileListRowSkeleton, SkeletonRows, StockEmptyCard, StockErrorCard } from '../../../_shared/components/stock-states';
import { formatClock, formatCountDateLong, formatDayMonthClock, formatWeekdayDate } from '../../../_shared/components/stock-format';
import { Skeleton } from '@/components/ui2/skeleton';

/**
 * Daily count — the Store Attendant's blind count (Milestone Six, Session 2).
 *  - Blind entry `18KU-0` · PIN `18MQ-0` (in `PinSheet`) · Submitted `18P9-0` ·
 *    Returned for recount `1F4N-0`.
 * The server never sends this screen an expected quantity, variance or
 * on-hand (`AttendantCountView`) — there is nothing here to hide.
 */

const HUB_HREF = '/app/inventory/stock';

/* ------------------------------------------------------------ pieces */

function BlindStrip() {
  return (
    <div className="flex gap-[9px] border-b border-wds-info-border bg-wds-info-bg px-4 py-3">
      <svg width="16" height="16" viewBox="0 0 24 24" className="mt-px shrink-0" aria-hidden>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" fill="none" stroke="var(--wds-info-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="var(--wds-info-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 3l18 18" fill="none" stroke="var(--wds-info-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="font-wds-sans text-[12px]/[17px] text-wds-info-fg">
        Blind count — the system total is hidden. Enter what you physically count. The Store Manager reconciles against the ledger afterwards.
      </p>
    </div>
  );
}

function CountTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: string; name: string; counted: number; total: number }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.key === active);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    if (next) {
      onSelect(next.key);
      requestAnimationFrame(() => document.getElementById(`count-tab-${next.key}`)?.focus());
    }
  };
  return (
    <div
      role="tablist"
      aria-label="Categories"
      onKeyDown={onKeyDown}
      className="flex shrink-0 items-center gap-2 overflow-x-auto overscroll-x-contain border-b border-wds-border px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        const complete = tab.total > 0 && tab.counted === tab.total;
        return (
          <button
            key={tab.key}
            id={`count-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="count-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.key)}
            className={cn(
              'flex shrink-0 touch-manipulation flex-col items-center gap-0.5 rounded-wds-sm border px-3 py-1.5 outline-none transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.97]',
              selected ? 'border-wds-espresso-700 bg-wds-espresso-700' : 'border-wds-border bg-wds-surface hover:bg-wds-neutral-50',
            )}
          >
            <span className={cn('font-wds-sans text-[13px]/4', selected ? 'font-medium text-white' : 'text-wds-text-ink')}>{tab.name}</span>
            <span
              className={cn(
                'font-wds-mono text-[10px]/3',
                selected ? 'text-wds-caramel-300' : complete ? 'text-wds-success-fg' : 'text-wds-text-faint',
              )}
            >
              {tab.counted}/{tab.total}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CountRow({
  line,
  value,
  onChange,
  onEnter,
  last,
}: {
  line: AttendantCountLine;
  value: string;
  onChange: (raw: string) => void;
  onEnter: (input: HTMLInputElement) => void;
  last: boolean;
}) {
  const filled = normalizeCount(value) !== null;
  return (
    <label className={cn('flex cursor-text items-center gap-3 px-4 py-3', !last && 'border-b border-wds-border')}>
      <span className="flex min-w-0 grow basis-0 flex-col gap-px">
        <span className="font-wds-sans text-[14px]/[18px] text-wds-text-ink">{line.name}</span>
        <span className="font-wds-sans text-[11px]/[14px] text-wds-text-faint">{line.usageUnit}</span>
      </span>
      <span
        className={cn(
          'flex items-center overflow-clip rounded-[4px] border bg-wds-surface transition-[border-color,box-shadow] duration-150 focus-within:border-wds-primary focus-within:shadow-wds-ring',
          // Paper `18KU-0`: a counted box reads by its ink figure (empty = faint "—"); the espresso border is the focus ring.
          filled ? 'border-wds-border-strong bg-wds-surface' : 'border-wds-border-strong',
          !line.editable && 'opacity-60',
        )}
      >
        <input
          data-count-input
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          value={value}
          placeholder="—"
          disabled={!line.editable}
          aria-label={`${line.name} counted, ${line.usageUnit}`}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter(e.currentTarget);
            }
          }}
          className="w-[60px] min-w-[60px] bg-transparent px-3 py-[9px] text-center font-wds-mono text-[15px]/[18px] text-wds-text-ink outline-none placeholder:text-wds-text-faint"
        />
      </span>
    </label>
  );
}

function SubmitFooter({
  counted,
  remaining,
  onSign,
  disabled,
  label,
  status,
  caption,
  hint,
}: {
  counted: number;
  remaining: number | null;
  onSign: () => void;
  disabled: boolean;
  label: string;
  status: string;
  caption: string;
  hint: string;
}) {
  const button = (describedBy?: string) => (
    <button
      type="button"
      onClick={disabled ? undefined : onSign}
      aria-disabled={disabled || undefined}
      aria-describedby={describedBy}
      className={cn(
        'flex w-full touch-manipulation items-center justify-center rounded-[4px] p-3.5 font-wds-sans text-[15px]/[18px] font-medium outline-none transition-[transform,filter,background-color] duration-150 ease-out focus-visible:shadow-wds-ring',
        disabled
          ? 'cursor-not-allowed bg-wds-neutral-300 text-wds-neutral-600'
          : 'bg-wds-gradient-primary text-wds-primary-fg shadow-wds-sheen hover:brightness-110 motion-safe:active:scale-[0.98]',
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-wds-border bg-wds-surface px-4 pb-5 pt-3.5">
      <span className="font-wds-mono text-[11px]/[14px] text-wds-text-copy-muted" aria-live="polite">
        {status}
      </span>
      {disabled && counted === 0 ? (
        <HintTooltip hint={hint} side="top" align="center" className="flex w-full">
          {(describedBy) => button(describedBy)}
        </HintTooltip>
      ) : (
        button()
      )}
      <span className="text-center font-wds-sans text-[11px]/[14px] text-wds-text-copy-muted">{caption}</span>
      <span className="sr-only">{remaining === null ? '' : `${remaining} to go`}</span>
    </div>
  );
}

function SavedIndicator({ state, onRetry }: { state: ReturnType<typeof useDailyCount>['saveState']; onRetry: () => void }) {
  if (state.kind === 'saving') return <span className="font-wds-mono text-[12px]/4 text-wds-text-faint">Saving…</span>;
  if (state.kind === 'saved') return <span className="font-wds-mono text-[12px]/4 text-wds-text-faint">Saved {formatClock(state.at)}</span>;
  if (state.kind === 'error') {
    return (
      <button type="button" onClick={onRetry} className="rounded-wds-sm font-wds-mono text-[12px]/4 text-wds-error-fg underline outline-none focus-visible:shadow-wds-ring">
        Not saved · retry
      </button>
    );
  }
  return null;
}

/* ------------------------------------------------------------ states */

function CountFrame({
  title,
  subtitle,
  children,
  onBack,
  trailingLabel = 'Cancel',
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onBack: () => void;
  trailingLabel?: string;
}) {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col overflow-hidden bg-wds-canvas">
      <MobileStatusBar className="bg-wds-sidebar-top" />
      <StockMobileHeader title={title} subtitle={subtitle} onBack={onBack} trailingLabel={trailingLabel} onTrailing={onBack} />
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <>
      <div className="flex shrink-0 gap-2 border-b border-wds-border px-4 py-2.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[42px] w-[76px] shrink-0 rounded-wds-sm" />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <BlindStrip />
        <SkeletonRows count={5} label="Loading today's count sheet">
          {(i) => <MobileListRowSkeleton key={i} className="px-4" />}
        </SkeletonRows>
      </div>
    </>
  );
}

function SubmittedState({ view, onDone }: { view: AttendantCountView; onDone: () => void }) {
  const verified = view.status === 'VERIFIED';
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-8 py-16">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-wds-success-border bg-wds-success-bg motion-safe:animate-in motion-safe:zoom-in-90 motion-safe:fade-in-0 motion-safe:duration-200">
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
          <path d="M20 6 9 17l-5-5" fill="none" stroke="var(--wds-success-fg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <h2 className="font-wds-sans text-[18px]/[22px] font-semibold text-wds-text-ink">{verified ? 'Count verified' : 'Count submitted'}</h2>
        <p className="max-w-[300px] font-wds-sans text-[13px]/[18px] text-wds-text-copy-muted">
          {verified
            ? `${view.totals.counted} items were signed and verified by the Store Manager.`
            : `${view.totals.counted} items signed and sent to the Store Manager for verification. No adjustment has posted yet.`}
        </p>
      </div>
      <dl className="mt-2 flex w-full flex-col gap-1 border border-wds-border bg-wds-neutral-50 px-[18px] py-3.5">
        <div className="flex justify-between">
          <dt className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">Counted by</dt>
          <dd className="font-wds-sans text-[12px]/4 font-medium text-wds-text-ink">{view.counterName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">Signed</dt>
          <dd className="font-wds-mono text-[12px]/4 text-wds-text-ink">{view.submittedAt ? formatDayMonthClock(view.submittedAt) : '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">Status</dt>
          <dd className={cn('font-wds-mono text-[12px]/4', verified ? 'text-wds-success-fg' : 'text-wds-warning-fg')}>
            {verified ? 'Verified' : 'Awaiting verification'}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onDone}
        className="mt-1 flex w-full touch-manipulation items-center justify-center rounded-wds-sm bg-wds-neutral-50 px-6 py-3 font-wds-sans text-[14px]/[18px] font-semibold text-wds-text-ink outline-none transition-[transform,background-color] duration-150 ease-out hover:bg-wds-neutral-100 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]"
      >
        Back to Stock &amp; counts
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ screen */

export function DailyCountScreen() {
  const router = useRouter();
  const count = useDailyCount();
  const { view } = count;
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [pinOpen, setPinOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const focusFirstOnTab = React.useRef(false);

  const leave = React.useCallback(async () => {
    await count.retrySave();
    router.push(HUB_HREF);
  }, [count, router]);

  const returned = view?.status === 'RETURNED';
  const tabs = React.useMemo(() => {
    if (!view || returned) return [];
    return view.categories.map((c) => {
      const key = c.id ?? 'none';
      const p = count.progress.byCategory.get(key);
      return { key, name: c.name, counted: p?.counted ?? c.counted, total: p?.total ?? c.total };
    });
  }, [view, returned, count.progress.byCategory]);

  // Land where the counting left off: a tab in progress, else the first unfinished one.
  // (Judged on the server's counts — the local draft is seeded a render later.)
  const serverTabs = (view?.categories ?? []).map((c) => ({ key: c.id ?? 'none', counted: c.counted, total: c.total }));
  const defaultKey =
    (serverTabs.find((t) => t.counted > 0 && t.counted < t.total) ?? serverTabs.find((t) => t.counted < t.total) ?? serverTabs[0])?.key ?? null;
  const [initialKey, setInitialKey] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (initialKey === null && defaultKey !== null) setInitialKey(defaultKey);
  }, [initialKey, defaultKey]);
  const currentKey = activeKey && tabs.some((t) => t.key === activeKey) ? activeKey : (initialKey ?? defaultKey);
  const currentTab = tabs.find((t) => t.key === currentKey);
  const lines = React.useMemo(() => {
    if (!view) return [];
    if (returned) return view.lines;
    return view.lines.filter((l) => (l.categoryId ?? 'none') === currentKey);
  }, [view, returned, currentKey]);

  // After Enter on a tab's last field, land on the next tab's first field.
  React.useEffect(() => {
    if (!focusFirstOnTab.current) return;
    focusFirstOnTab.current = false;
    listRef.current?.querySelector<HTMLInputElement>('input[data-count-input]')?.focus();
  }, [currentKey]);

  const onEnter = (input: HTMLInputElement) => {
    const inputs = Array.from(listRef.current?.querySelectorAll<HTMLInputElement>('input[data-count-input]:not(:disabled)') ?? []);
    const i = inputs.indexOf(input);
    const next = inputs[i + 1];
    if (next) {
      next.focus();
      return;
    }
    const tabIndex = tabs.findIndex((t) => t.key === currentKey);
    const nextTab = tabs[tabIndex + 1];
    if (nextTab) {
      focusFirstOnTab.current = true;
      setActiveKey(nextTab.key);
    } else {
      input.blur();
    }
  };

  // Loading / error — chrome stays.
  if (count.status === 'loading' || (count.status === 'ready' && !view)) {
    return (
      <CountFrame title="Daily count" subtitle="Count what's on the shelf — enter the number you see" onBack={() => router.push(HUB_HREF)}>
        <LoadingState />
      </CountFrame>
    );
  }
  if (count.status === 'error' && !view) {
    return (
      <CountFrame title="Daily count" subtitle="Count what's on the shelf — enter the number you see" onBack={() => router.push(HUB_HREF)}>
        <div className="flex flex-1 items-start justify-center p-6">
          <StockErrorCard
            title="Couldn't load today's count sheet"
            description="Check your connection and try again."
            onRetry={count.reload}
          />
        </div>
      </CountFrame>
    );
  }
  if (!view) return null;

  if (view.status === 'SUBMITTED' || view.status === 'VERIFIED') {
    return (
      <CountFrame title="Daily count" subtitle="Count what's on the shelf — enter the number you see" onBack={() => router.push(HUB_HREF)}>
        <SubmittedState view={view} onDone={() => router.push(HUB_HREF)} />
      </CountFrame>
    );
  }

  const { counted, total } = count.progress;
  const canSign = counted > 0 && !count.submitting;
  const title = returned ? 'Daily count · recount' : 'Daily count';
  const subtitle = returned
    ? `${formatCountDateLong(view.countDate)} · returned by ${view.returnedByName ?? 'the Store Manager'}`
    : "Count what's on the shelf — enter the number you see";

  return (
    <CountFrame title={title} subtitle={subtitle} onBack={leave}>
      {returned ? (
        <div className="flex p-4">
          <div className="flex grow flex-col gap-1.5 rounded-[4px] border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
            <span className="font-wds-sans text-[13px]/4 font-semibold text-wds-warning-fg">
              Returned for recount · {view.lines.length} {view.lines.length === 1 ? 'line' : 'lines'}
            </span>
            {view.returnNote ? (
              <span className="font-wds-sans text-[12px]/[17px] text-wds-warning-fg">
                {view.returnedByName ?? 'Store Manager'}
                {view.returnedAt ? `, ${formatClock(view.returnedAt)}` : ''} — “{view.returnNote}”
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <CountTabs tabs={tabs} active={currentKey ?? ''} onSelect={setActiveKey} />
      )}

      <div id="count-panel" role={returned ? undefined : 'tabpanel'} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <BlindStrip />
        {count.saveState.kind === 'error' ? (
          <div className="px-4 pt-3">
            <FormErrorBanner
              title="Couldn't save — your counts are kept"
              description="What you've typed is still on screen and counts saved earlier are safe on the server. Try again."
            />
          </div>
        ) : null}
        <div className="flex items-center justify-between border-b border-wds-border px-4 py-3">
          <span className="font-wds-sans text-[13px]/4 font-semibold text-wds-text-ink">{returned ? 'Recount' : (currentTab?.name ?? 'Count')}</span>
          <span className="flex items-center gap-2.5">
            <SavedIndicator state={count.saveState} onRetry={() => void count.retrySave()} />
            <span className="font-wds-mono text-[12px]/4 text-wds-text-copy-muted" aria-live="polite">
              {returned ? `${counted} of ${total} recounted` : `${currentTab?.counted ?? 0} of ${currentTab?.total ?? 0} counted`}
            </span>
          </span>
        </div>
        <div ref={listRef} className="flex flex-col py-2">
          {lines.length === 0 ? (
            <StockEmptyCard title={`No ${currentTab?.name ?? ''} items to count`.replace('  ', ' ')} description="Pick another category." className="my-6" />
          ) : (
            lines.map((line, i) => (
              <React.Fragment key={line.inventoryItemId}>
                <CountRow
                  line={line}
                  value={count.draft[line.inventoryItemId] ?? ''}
                  onChange={(raw) => count.setValue(line.inventoryItemId, raw)}
                  onEnter={onEnter}
                  last={i === lines.length - 1 && !(returned && line.queryNote)}
                />
                {returned && line.queryNote ? (
                  <div className="flex gap-2 border-b border-wds-border bg-wds-info-bg px-4 py-3">
                    <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-wds-info-fg" aria-hidden />
                    <span className="font-wds-sans text-[12px]/[17px] text-wds-info-fg">{line.queryNote}</span>
                  </div>
                ) : null}
              </React.Fragment>
            ))
          )}
        </div>
      </div>

      <SubmitFooter
        counted={counted}
        remaining={returned ? null : total - counted}
        onSign={() => {
          void count.retrySave();
          setPinOpen(true);
        }}
        disabled={!canSign}
        label={returned ? 'Sign & resubmit' : 'Sign & submit count'}
        hint={returned ? 'Recount the queried line to sign' : 'Count at least one item to sign'}
        status={
          returned
            ? 'Only the queried line — still blind'
            : `${counted} counted · ${total - counted} to go — you can submit a partial count`
        }
        caption={
          returned
            ? `On sign: goes back to ${view.returnedByName ?? 'the Store Manager'} for verification. No adjustment is written yet.`
            : 'On sign: status becomes Submitted — awaiting verification. No adjustment is written yet.'
        }
      />

      <PinSheet
        open={pinOpen}
        onOpenChange={(open) => {
          setPinOpen(open);
          if (!open) count.clearSubmitError();
        }}
        title={returned ? 'Sign this recount' : 'Sign this count'}
        subtitle={`${returned ? total : counted} ${(returned ? total : counted) === 1 ? 'item' : 'items'} counted · Central Store · ${formatWeekdayDate(view.countDate)}. Enter your PIN.`}
        note="No variance is shown to you. The Store Manager sees counted vs ledger and resolves any gap."
        confirmLabel="Sign"
        submitting={count.submitting}
        error={count.submitError}
        onSubmit={async (pin) => {
          const ok = await count.submit(pin);
          if (ok) setPinOpen(false);
        }}
      />
    </CountFrame>
  );
}
