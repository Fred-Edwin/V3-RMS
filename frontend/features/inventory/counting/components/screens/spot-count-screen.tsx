'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui2/button';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { HintTooltip } from '@/components/app/shell/hint-tooltip';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { useCountList, useThresholds } from '../../hooks/use-counts';
import { useDebouncedValue, useStockList } from '../../../stock/hooks/use-stock';
import { spotNeedsReason, spotVariance, useSpotCount, type SpotRow } from '../../hooks/use-spot-count';
import { normalizeCount } from '../../hooks/use-daily-count';
import { listCategories } from '../../../services';
import type { Category } from '../../../types';
import type { CountListItem } from '../../types/count';
import type { StockRow } from '../../../stock/types/stock';
import { CountReasonControl } from '../count-reason';
import { LogWasteDrawer } from '../../../waste/components/log-waste-drawer';
import { PinSheet } from '../pin-sheet';
import { StockMobileHeader } from '../../../stock/components/stock-mobile-header';
import { StockTopbar } from '../../../stock/components/stock-topbar';
import { FormErrorBanner, ListRowSkeleton, SkeletonRows, StockEmptyCard, StockErrorCard } from '../../../_shared/components/stock-states';
import { formatCountDateShort, formatKes, formatNumber, formatQty, formatSignedKes, formatVariance, shortName } from '../../../_shared/components/stock-format';

/**
 * Spot count — the Store Manager counts a few items outside the daily rhythm
 * and adjudicates directly (Milestone Six Session 2). Desktop `1BC1-0`,
 * mobile `1C8Y-0`. Expected is shown (this is the Store Manager, not the
 * blind attendant); above-threshold lines take a reason; one PIN signature
 * saves a VERIFIED count and writes its adjustments in one step.
 */

const HUB_HREF = '/app/inventory/stock';

/* ------------------------------------------------------------------ picker */

function SpotItemPicker({
  excluded,
  onPick,
  mobile,
  categories,
}: {
  excluded: Set<string>;
  onPick: (row: StockRow) => void;
  mobile: boolean;
  categories: Category[];
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<string | undefined>();
  const [active, setActive] = React.useState(0);
  const debounced = useDebouncedValue(q, 250);
  const listId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const { list, status, reload } = useStockList({ search: debounced || undefined, categoryId, pageSize: 8 }, open);
  const results = (list?.rows ?? []).filter((r) => !excluded.has(r.itemId));

  React.useEffect(() => setActive(0), [debounced, categoryId]);

  const pick = (row: StockRow) => {
    onPick(row);
    setQ('');
    setOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-spot-input="${row.itemId}"]`)?.focus());
  };

  return (
    <div ref={rootRef} className="relative flex flex-col gap-3">
      <div
        className={cn(
          'flex items-center gap-2 border bg-wds-surface transition-[border-color,box-shadow] duration-150 focus-within:border-wds-primary focus-within:shadow-wds-ring',
          mobile ? 'h-10 rounded-[4px] border-wds-border-strong px-3' : 'rounded-wds-sm border-wds-border px-3 py-2.5',
        )}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--wds-text-faint)" strokeWidth="2" />
          <path d="M12 8v8M8 12h8" fill="none" stroke="var(--wds-text-faint)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${results[active]!.itemId}` : undefined}
          aria-label="Add an item to spot count"
          autoComplete="off"
          spellCheck={false}
          placeholder="Add an item to spot count…"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onBlur={(e) => {
            if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && open && results[active]) {
              e.preventDefault();
              // The list still shows the previous query until the debounce settles — never pick from it.
              if (q.trim() === debounced.trim() && status !== 'loading') pick(results[active]!);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className="min-w-0 grow bg-transparent font-wds-sans text-[13px]/4 text-wds-text-ink outline-none placeholder:text-wds-text-faint"
        />
      </div>
      {mobile && categories.length > 0 ? (
        <div className="-mt-1 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Category">
          {[{ id: undefined as string | undefined, name: 'All' }, ...categories.map((c) => ({ id: c.id as string | undefined, name: c.name }))].map((c) => (
            <button
              key={c.id ?? 'all'}
              type="button"
              aria-pressed={categoryId === c.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setCategoryId(c.id);
                setOpen(true);
              }}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-[7px] font-wds-sans text-[12px]/4 outline-none transition-[background-color,border-color,color] duration-150 focus-visible:shadow-wds-ring',
                categoryId === c.id ? 'border-wds-espresso-700 bg-wds-espresso-700 font-medium text-wds-primary-fg' : 'border-wds-border-strong text-wds-text-ink',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Items"
          className={cn(
            'z-20 flex max-h-[320px] flex-col overflow-y-auto rounded-wds-sm border border-wds-border bg-wds-surface shadow-wds-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150',
            mobile ? '' : 'absolute inset-x-0 top-full mt-1',
          )}
        >
          {status === 'loading' ? (
            <li className="px-3 py-2.5 font-wds-sans text-[12px]/4 text-wds-text-copy-muted">Loading items…</li>
          ) : status === 'error' ? (
            <li className="flex items-center justify-between gap-3 px-3 py-2.5 font-wds-sans text-[12px]/4 text-wds-error-fg">
              Couldn&apos;t load items
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void reload()} className="font-medium underline">
                Retry
              </button>
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2.5 font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
              {debounced ? `No item matches “${debounced}”.` : 'No more items to add.'}
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.itemId}
                id={`${listId}-${r.itemId}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r)}
                className={cn('flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 font-wds-sans text-[13px]/4 text-wds-text-ink', i === active && 'bg-wds-neutral-100')}
              >
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 font-wds-mono text-[11px]/[14px] text-wds-text-faint">{formatQty(r.onHand, r.usageUnit)} expected</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ rows */

function CountedBox({ row, onChange, onEnter, mobile }: { row: SpotRow; onChange: (raw: string) => void; onEnter: () => void; mobile: boolean }) {
  const filled = normalizeCount(row.counted) !== null;
  return (
    <input
      data-spot-input={row.itemId}
      type="text"
      inputMode="decimal"
      enterKeyHint="next"
      autoComplete="off"
      placeholder="—"
      value={row.counted}
      aria-label={`${row.name} counted, ${row.usageUnit}`}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter();
        }
      }}
      className={cn(
        'border bg-wds-surface text-center font-wds-mono text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-wds-text-faint focus:border-wds-primary focus:shadow-wds-ring',
        mobile ? 'h-9 w-[70px] rounded-[4px] text-[14px]/[18px]' : 'w-[80px] rounded-wds-sm py-1.5 text-[14px]/[18px]',
        filled ? 'border-wds-border-strong text-wds-text-ink' : 'border-wds-border text-wds-text-ink',
      )}
    />
  );
}

function RemoveButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remove ${name}`}
      className="flex size-7 shrink-0 items-center justify-center rounded-wds-sm font-wds-sans text-[16px]/5 text-wds-text-faint outline-none transition-[color,background-color,transform] duration-150 hover:bg-wds-neutral-100 hover:text-wds-text-ink focus-visible:shadow-wds-ring motion-safe:active:scale-[0.92]"
    >
      <span aria-hidden>×</span>
    </button>
  );
}

function RecentSpotCounts({ counts, status, onRetry }: { counts: CountListItem[]; status: 'loading' | 'error' | 'ready'; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[4px] bg-wds-neutral-50 p-4 md:rounded-[2px]">
      <span className="font-wds-sans text-[14px]/[18px] font-semibold text-wds-text-ink">Recent spot counts</span>
      {status === 'loading' ? (
        <SkeletonRows count={2} label="Loading recent spot counts">
          {(i) => <ListRowSkeleton key={i} className="h-11 px-0" />}
        </SkeletonRows>
      ) : status === 'error' ? (
        <div className="flex items-center justify-between gap-2 font-wds-sans text-[12px]/4 text-wds-error-fg">
          Couldn&apos;t load recent spot counts
          <button type="button" onClick={onRetry} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : counts.length === 0 ? (
        <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">No spot counts yet.</span>
      ) : (
        counts.map((c, i) => (
          <Link
            key={c.id}
            href={`/app/inventory/stock/counts?id=${c.id}`}
            className={cn('flex flex-col gap-[3px] rounded-wds-sm outline-none focus-visible:shadow-wds-ring', i < counts.length - 1 && 'border-b border-wds-border pb-2.5')}
          >
            <span className="font-wds-sans text-[13px]/4 text-wds-text-ink">
              {formatCountDateShort(c.countDate)} · {c.itemCount} {c.itemCount === 1 ? 'item' : 'items'} · signed {shortName(c.verifierName ?? c.counterName)}
            </span>
            <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
              {c.adjustmentCount === 0
                ? 'No adjustments needed'
                : `${c.adjustmentCount} ${c.adjustmentCount === 1 ? 'adjustment' : 'adjustments'} · ${formatSignedKes(c.netVarianceValue)}`}
            </span>
          </Link>
        ))
      )}
      <Link href="/app/inventory/stock/counts" className="rounded-wds-sm font-wds-sans text-[13px]/4 text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring">
        View all spot counts →
      </Link>
    </div>
  );
}

/* ---------------------------------------------------------------- screen */

export function SpotCountScreen() {
  const router = useRouter();
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const addToast = useWdsToastStore((s) => s.addToast);
  const { thresholds, status: thresholdsStatus, reload: reloadThresholds } = useThresholds(true);
  const threshold = thresholds?.reasonRequiredKes ?? null;
  const spot = useSpotCount(threshold);
  const { list: recent, status: recentStatus, reload: reloadRecent } = useCountList('SPOT', 3);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [wasteOpen, setWasteOpen] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    listCategories()
      .then((c) => alive && setCategories(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Nothing is written before the signature — warn before a reload / tab close throws away typed counts.
  React.useEffect(() => {
    if (spot.rows.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [spot.rows.length]);

  const excluded = React.useMemo(() => new Set(spot.rows.map((r) => r.itemId)), [spot.rows]);
  const focusNext = (index: number) => {
    const next = spot.rows[index + 1];
    if (next) document.querySelector<HTMLInputElement>(`[data-spot-input="${next.itemId}"]`)?.focus();
    else document.querySelector<HTMLInputElement>('input[aria-label="Add an item to spot count"]')?.focus();
  };

  const onSign = async (pin: string) => {
    const result = await spot.submit(pin);
    if (result) {
      setPinOpen(false);
      addToast({
        variant: 'success',
        title: 'Spot count saved',
        description:
          result.adjustmentsWritten === 0
            ? `${result.count.lines.length} ${result.count.lines.length === 1 ? 'item' : 'items'} matched the ledger — no adjustments needed.`
            : `${result.adjustmentsWritten} ${result.adjustmentsWritten === 1 ? 'adjustment' : 'adjustments'} written · net ${formatSignedKes(result.netAdjustmentValue)}${result.directorNotified ? ' · a Director was alerted.' : '.'}`,
      });
      spot.reset();
      void reloadRecent();
    }
  };

  if (!hydrated) return null;

  const blockers: string[] = [];
  if (spot.rows.length === 0) blockers.push('Add an item to spot count');
  else {
    if (spot.uncounted > 0) blockers.push(`${spot.uncounted} ${spot.uncounted === 1 ? 'item has' : 'items have'} no count yet`);
    if (spot.missingReasons.length > 0) blockers.push(`${spot.missingReasons.length} ${spot.missingReasons.length === 1 ? 'line needs' : 'lines need'} a reason`);
  }
  if (thresholdsStatus === 'error') blockers.push("Couldn't load the reason threshold");

  const signButton = (mobile: boolean) => {
    const disabled = !spot.canSign || spot.submitting;
    const btn = (describedBy?: string) => (
      <button
        type="button"
        onClick={disabled ? undefined : () => setPinOpen(true)}
        aria-disabled={disabled || undefined}
        aria-describedby={describedBy}
        className={cn(
          'flex items-center justify-center font-wds-sans outline-none transition-[transform,filter,background-color] duration-150 ease-out focus-visible:shadow-wds-ring',
          mobile ? 'w-full rounded-[4px] p-[13px] text-[15px]/[18px] font-medium' : 'rounded-wds-sm px-5 py-2.5 text-[14px]/[18px] font-medium',
          disabled ? 'cursor-not-allowed bg-wds-neutral-300 text-wds-neutral-600' : 'bg-wds-espresso-700 text-white hover:brightness-110 motion-safe:active:scale-[0.98]',
        )}
      >
        Sign &amp; save spot count
      </button>
    );
    return blockers.length > 0 && disabled ? (
      <HintTooltip hint={blockers[0]!} side="top" align={mobile ? 'center' : 'end'} className={mobile ? 'flex w-full' : 'flex'}>
        {(d) => btn(d)}
      </HintTooltip>
    ) : (
      btn()
    );
  };

  const reasonLine = (r: SpotRow, mobile: boolean) => {
    const v = spotVariance(r) ?? 0;
    return (
      <CountReasonControl
        key={r.itemId}
        mobile={mobile}
        labelTone="warning"
        label={`REASON — ${r.name} (${formatVariance(String(v), r.usageUnit)}, above threshold)`}
        ariaLabel={`Reason for ${r.name}`}
        reason={r.reason}
        note={r.reasonNote}
        onChange={(reason, note) => spot.setReason(r.itemId, reason, note)}
      />
    );
  };

  const pin = (
    <PinSheet
      open={pinOpen}
      onOpenChange={(open) => {
        setPinOpen(open);
        if (!open) spot.clearError();
      }}
      title="Sign this spot count"
      subtitle={`${spot.counted.length} ${spot.counted.length === 1 ? 'item' : 'items'} · Central Store. Enter your PIN.`}
      note="Each variance posts to the ledger with an ADJ number as soon as you sign."
      confirmLabel="Sign"
      submitting={spot.submitting}
      error={spot.error}
      onSubmit={(p) => void onSign(p)}
    />
  );

  const banner = spot.error?.kind === 'other' && !pinOpen ? (
    <FormErrorBanner title="Couldn't save the spot count" description="Your counts and reasons are kept. Try again." />
  ) : null;

  const emptyRows = (
    <div className="flex justify-center py-8">
      <StockEmptyCard title="No items added yet" description="Search above to add the items you want to spot count." />
    </div>
  );

  /* ---------------- mobile ---------------- */
  if (!isDesktop) {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar className="bg-wds-sidebar-top" />
        <StockMobileHeader title="Spot count" subtitle="A few items, outside the daily rhythm" onBack={() => router.push(HUB_HREF)} trailingLabel="Cancel" onTrailing={() => router.push(HUB_HREF)} />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-3 px-4 pt-3.5">
            <SpotItemPicker excluded={excluded} onPick={spot.addItem} mobile categories={categories} />
            {banner}
          </div>
          <div className="flex flex-col px-4 pt-2">
            {spot.rows.length > 0 ? (
              <>
                <div className="flex items-center gap-3 border-b border-wds-border py-2">
                  <span className="grow font-wds-mono text-[11px]/[14px] uppercase tracking-[0.04em] text-wds-text-copy-muted">Item</span>
                  <span className="w-[70px] shrink-0 text-right font-wds-mono text-[11px]/[14px] uppercase tracking-[0.04em] text-wds-text-copy-muted">Expected</span>
                  <span className="w-[70px] shrink-0 text-right font-wds-mono text-[11px]/[14px] uppercase tracking-[0.04em] text-wds-text-copy-muted">Counted</span>
                  <span className="w-7 shrink-0" />
                </div>
                {spot.rows.map((r, i) => (
                  <div key={r.itemId} className="flex items-center gap-3 border-b border-wds-neutral-200 py-3.5">
                    <span className="flex grow basis-0 flex-col gap-0.5">
                      <span className="font-wds-sans text-[14px]/[18px] font-medium text-wds-text-ink">{r.name}</span>
                      <span className="font-wds-sans text-[12px]/4 text-wds-text-faint">{r.usageUnit}</span>
                    </span>
                    <span className="w-[70px] shrink-0 text-right font-wds-mono text-[14px]/[18px] text-wds-text-ink">{formatNumber(r.expected)}</span>
                    <CountedBox row={r} mobile onChange={(raw) => spot.setCounted(r.itemId, raw)} onEnter={() => focusNext(i)} />
                    <RemoveButton name={r.name} onClick={() => spot.removeItem(r.itemId)} />
                  </div>
                ))}
              </>
            ) : (
              emptyRows
            )}
          </div>
          <div className="mt-4 px-4">
            <RecentSpotCounts counts={recent?.counts ?? []} status={recentStatus} onRetry={() => void reloadRecent()} />
          </div>
          {spot.needReason.length > 0 ? <div className="mt-4 flex flex-col gap-4 px-4 pb-4">{spot.needReason.map((r) => reasonLine(r, true))}</div> : null}
          <div className="grow" />
        </div>
        <div className="shrink-0 border-t border-wds-border bg-wds-surface px-4 pb-6 pt-3.5">{signButton(true)}</div>
        {pin}
      </div>
    );
  }

  /* ---------------- desktop ---------------- */
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <StockTopbar screen="Spot count" showHubCrumb onLogWaste={() => setWasteOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <Link href={HUB_HREF} className="w-fit rounded-wds-sm font-wds-sans text-[13px]/4 text-wds-text-copy-muted outline-none hover:text-wds-text-ink focus-visible:shadow-wds-ring">
            ← Back to Stock &amp; counts
          </Link>
          <h1 className="font-wds-sans text-[24px]/[30px] font-semibold tracking-[-0.01em] text-wds-text-ink">Spot count</h1>
          <p className="font-wds-sans text-[14px]/[18px] text-wds-text-copy-muted">A few items, outside the daily rhythm. Expected is shown — you&apos;re adjudicating directly.</p>
        </div>
        {banner}
        <div className="flex max-w-[1140px] gap-6">
          <div className="flex w-[740px] shrink-0 flex-col gap-3">
            <SpotItemPicker excluded={excluded} onPick={spot.addItem} mobile={false} categories={categories} />
            <div className="flex flex-col rounded-wds-sm border border-wds-border">
              <div className="flex border-b border-wds-border px-4 py-2.5">
                <span className="w-[340px] shrink-0 font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Item</span>
                <span className="w-[150px] shrink-0 text-right font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Expected</span>
                <span className="w-[150px] shrink-0 text-right font-wds-sans text-[11px]/[14px] font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Counted</span>
              </div>
              {spot.rows.length === 0 ? (
                emptyRows
              ) : (
                spot.rows.map((r, i) => (
                  <div key={r.itemId} className={cn('flex items-center px-4 py-3.5', i < spot.rows.length - 1 && 'border-b border-wds-border')}>
                    <span className="flex w-[340px] shrink-0 flex-col gap-0.5">
                      <span className="font-wds-sans text-[14px]/[18px] text-wds-text-ink">{r.name}</span>
                      <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">{r.usageUnit}</span>
                    </span>
                    <span className="w-[150px] shrink-0 text-right font-wds-mono text-[14px]/[18px] text-wds-text-ink">{formatNumber(r.expected)}</span>
                    <span className="flex w-[150px] shrink-0 justify-end">
                      <CountedBox row={r} mobile={false} onChange={(raw) => spot.setCounted(r.itemId, raw)} onEnter={() => focusNext(i)} />
                    </span>
                    <RemoveButton name={r.name} onClick={() => spot.removeItem(r.itemId)} />
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="self-start" style={{ width: 376 }}>
            <RecentSpotCounts counts={recent?.counts ?? []} status={recentStatus} onRetry={() => void reloadRecent()} />
          </div>
        </div>
        {thresholdsStatus === 'error' ? (
          <StockErrorCard title="Couldn't load thresholds" description="The reason threshold decides which lines need a reason. Check your connection and try again." onRetry={() => void reloadThresholds()} />
        ) : null}
        <div className="flex max-w-[1140px] flex-col gap-2.5 border-t border-wds-border pt-4">
          {spot.needReason.map((r) => reasonLine(r, false))}
          <div className="flex justify-end">{signButton(false)}</div>
        </div>
      </main>
      {pin}
      <LogWasteDrawer open={wasteOpen} onOpenChange={setWasteOpen} locationLabel="the Central Store" />
    </div>
  );
}

export { Button, formatKes, spotNeedsReason };
