'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui2/button';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { HintTooltip } from '@/components/app/shell/hint-tooltip';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { useCountList } from '../../../counting/hooks/use-counts';
import { useStockList, useStockSummary, useWasteList } from '../../hooks/use-stock';
import type { CountListItem } from '../../../counting/types/count';
import type { InventoryItemTypeValue, StockSummary, TodaysCount } from '../../types/stock';
import type { WasteEntry } from '../../../waste/types/waste';
import { StockTopbar } from '../stock-topbar';
import { HubKpiStrip } from '../hub-kpi-strip';
import { ThresholdsDrawer } from '../../../counting/components/thresholds-drawer';
import { LogWasteDrawer, LogWasteMobile } from '../../../waste/components/log-waste-drawer';
import { HighlightOnChange } from '../highlight-on-change';
import { FilterChip, LEDGER_HREF, StockTableHeader, StockTableRow, TypeFilter } from '../stock-table';
import {
  KpiValueSkeleton,
  ListRowSkeleton,
  MobileListRowSkeleton,
  ShortRowSkeleton,
  SkeletonRows,
  StatusCardSkeleton,
  StockEmptyCard,
  StockErrorCard,
  TableRowSkeleton,
} from '../../../_shared/components/stock-states';
import {
  formatKes,
  formatClock,
  formatCountDateShort,
  formatKesCompact,
  formatNumber,
  formatQty,
  ITEM_TYPE_LABEL,
  shortName,
  wasteReasonShort,
} from '../../../_shared/components/stock-format';

/**
 * Stock & counts hub — Milestone Six Session 1.
 *  - Store Manager desktop: `1AYW-0` (loading example `1FG7-0`).
 *  - Store Manager mobile: `1J43-0` (drawn 2026-09-25, replacing the
 *    "use the hidden REMOVED (A1) layers" instruction in decision 2).
 *  - Store Attendant mobile: `188X-0` (empty example `1G39-0`) — blind
 *    count: no on-hand anywhere; the attendant's summary response has no
 *    such fields to begin with.
 * Counting is Session 2: the Counts card, Today's count, Daily/Spot count
 * and Thresholds render in their "no count yet" / disabled state.
 */

const ATTENTION_PAGE_SIZE = 7;

function isFullSummary(s: unknown): s is StockSummary {
  return typeof s === 'object' && s !== null && 'onHandValue' in s;
}

function OnHandBand({
  itemCount,
  onRefreshRef,
}: {
  itemCount: number | null;
  onRefreshRef: React.MutableRefObject<(() => void) | null>;
}) {
  const [type, setType] = React.useState<InventoryItemTypeValue | undefined>();
  const [belowRestock, setBelowRestock] = React.useState(false);
  const [negative, setNegative] = React.useState(false);
  const { list, status, reload } = useStockList({
    attention: true,
    type,
    belowRestock: belowRestock || undefined,
    negative: negative || undefined,
    pageSize: ATTENTION_PAGE_SIZE,
  });
  onRefreshRef.current = reload;
  const filtered = Boolean(type || belowRestock || negative);
  const clear = () => {
    setType(undefined);
    setBelowRestock(false);
    setNegative(false);
  };

  return (
    <section aria-labelledby="on-hand-heading" className="flex shrink-0 flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-4">
        <h2 id="on-hand-heading" className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">
          On hand
        </h2>
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-wds-sm bg-wds-neutral-50 px-[5px] font-wds-mono text-wds-field-label text-wds-text-copy-muted">
          {itemCount === null ? '–' : itemCount}
        </span>
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">derived live — click a row for its ledger</span>
        <div className="ml-auto flex gap-1.5">
          <TypeFilter value={type} onChange={setType} />
          <FilterChip pressed={belowRestock} onClick={() => setBelowRestock((v) => !v)}>
            Below restock level
          </FilterChip>
          <FilterChip pressed={negative} onClick={() => setNegative((v) => !v)}>
            Negative
          </FilterChip>
        </div>
      </div>
      <StockTableHeader />
      {status === 'loading' ? (
        <SkeletonRows count={ATTENTION_PAGE_SIZE} label="Loading stock position">
          {(i) => <TableRowSkeleton key={i} widths={[96, 64, 48, 56, 90]} />}
        </SkeletonRows>
      ) : status === 'error' ? (
        <div className="py-8">
          <StockErrorCard
            title="Couldn't load the stock position"
            description="Check your connection and try again. Nothing has changed at the Central Store."
            onRetry={reload}
          />
        </div>
      ) : list && list.rows.length === 0 ? (
        <div className="flex justify-center py-8">
          {filtered ? (
            <StockEmptyCard
              title="No items match these filters"
              description="Nothing at the Central Store needs attention with these filters. Clear them to see the full attention list."
              actionLabel="Clear filters"
              onAction={clear}
            />
          ) : (
            <StockEmptyCard title="Nothing needs attention" description="No item is negative or has a restock level yet. Set restock levels to start flagging low stock." />
          )}
        </div>
      ) : (
        <div>
          {list?.rows.map((row, i) => <StockTableRow key={row.itemId} row={row} last={i === list.rows.length - 1} />)}
        </div>
      )}
      <div className="flex h-[38px] shrink-0 items-center justify-between border-t border-wds-border bg-wds-neutral-50 px-4">
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted" aria-live="polite">
          {status === 'loading'
            ? 'Loading stock position…'
            : list
              ? `Showing ${list.rows.length} of ${itemCount ?? list.total} — filtered to attention items`
              : ''}
        </span>
        <Link
          href="/app/inventory/stock/items"
          className="group/link rounded-wds-sm font-wds-sans text-wds-caption font-medium text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring"
        >
          View all items <span className="inline-block transition-transform duration-150 group-hover/link:translate-x-0.5">→</span>
        </Link>
      </div>
    </section>
  );
}

function CountRowDot({ tone }: { tone: 'warning' | 'neutral' }) {
  return <span className={cn('size-1.5 shrink-0 rounded-full', tone === 'warning' ? 'bg-wds-warning-fg' : 'bg-wds-neutral-400')} aria-hidden />;
}

function countRowCopy(c: CountListItem): { title: string; detail: string; pending: boolean } {
  const date = formatCountDateShort(c.countDate);
  if (c.kind === 'SPOT') {
    return {
      title: `Spot count · ${date}`,
      detail: `${c.itemCount} ${c.itemCount === 1 ? 'item' : 'items'} · signed ${shortName(c.verifierName ?? c.counterName)}`,
      pending: false,
    };
  }
  if (c.status === 'SUBMITTED') {
    return {
      title: `Daily count · ${date}`,
      detail: `submitted ${c.counterSignedAt ? formatClock(c.counterSignedAt) : ''} by ${shortName(c.counterName)} · blind`,
      pending: true,
    };
  }
  if (c.status === 'RETURNED') return { title: `Daily count · ${date}`, detail: 'sent back for a recount', pending: true };
  return {
    title: `Daily count · ${date}`,
    detail: `counter ${shortName(c.counterName)} · verifier ${shortName(c.verifierName ?? '')}`,
    pending: false,
  };
}

function CountsBand() {
  const { list, status, reload } = useCountList(undefined, 3);
  const rows = list?.counts.slice(0, 2) ?? [];
  return (
    <section aria-labelledby="counts-heading" className="flex grow basis-0 flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-4">
        <h2 id="counts-heading" className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">
          Counts
        </h2>
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">the daily rhythm</span>
        <Link
          href="/app/inventory/stock/counts"
          className="group/link ml-auto rounded-wds-sm font-wds-sans text-wds-body-sm font-medium text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring"
        >
          View all counts <span className="inline-block transition-transform duration-150 group-hover/link:translate-x-0.5">→</span>
        </Link>
      </div>
      {status === 'loading' ? (
        <SkeletonRows count={2} label="Loading counts">
          {(i) => <ListRowSkeleton key={i} />}
        </SkeletonRows>
      ) : status === 'error' ? (
        <div className="flex flex-col items-center gap-2 px-6 py-6 text-center" role="alert">
          <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">Couldn&apos;t load counts</span>
          <button type="button" onClick={() => void reload()} className="font-wds-sans text-wds-caption font-medium text-wds-primary hover:underline">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-8 text-center">
          <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">No count yet today</span>
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">The attendant&apos;s daily count will appear here once submitted.</span>
        </div>
      ) : (
        rows.map((c, i) => {
          const copy = countRowCopy(c);
          return (
            <Link
              key={c.id}
              href={`/app/inventory/stock/counts?id=${c.id}`}
              className={cn(
                'group/row flex h-[52px] shrink-0 items-center gap-3 px-4 outline-none transition-colors duration-150 hover:bg-wds-neutral-100 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)]',
                i < rows.length - 1 && 'border-b border-wds-neutral-100',
              )}
            >
              <CountRowDot tone={copy.pending ? 'warning' : 'neutral'} />
              <span className="flex min-w-0 grow flex-col gap-px">
                <span className="truncate font-wds-sans text-wds-body-sm font-medium leading-4 text-wds-text-ink">{copy.title}</span>
                <span className="truncate font-wds-sans text-wds-caption text-wds-text-copy-muted">{copy.detail}</span>
              </span>
              {copy.pending && c.status === 'SUBMITTED' ? (
                <span className="flex h-7 items-center rounded-wds-sm bg-wds-gradient-primary px-3 font-wds-sans text-wds-caption font-medium text-wds-primary-fg shadow-wds-sheen transition-[filter] duration-150 group-hover/row:brightness-110">
                  Verify
                </span>
              ) : (
                <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">View</span>
              )}
            </Link>
          );
        })
      )}
    </section>
  );
}

function WasteBand({
  entries,
  totalValue,
  status,
  onRetry,
  onLogWaste,
}: {
  entries: WasteEntry[];
  totalValue: string | null;
  status: 'loading' | 'error' | 'ready';
  onRetry: () => void;
  onLogWaste: () => void;
}) {
  const top = entries.slice(0, 3);
  return (
    <section aria-labelledby="waste-heading" className="flex grow basis-0 flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-wds-border px-4">
        <h2 id="waste-heading" className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">
          Waste
        </h2>
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
          last 7 days
          {status === 'ready' && totalValue !== null ? (
            <>
              {' · '}
              <HighlightOnChange value={totalValue}>{formatKes(totalValue)}</HighlightOnChange>
            </>
          ) : null}
        </span>
        <button
          type="button"
          onClick={onLogWaste}
          className="ml-auto rounded-wds-sm font-wds-sans text-wds-caption font-medium text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring"
        >
          Log waste
        </button>
      </div>
      {status === 'loading' ? (
        <SkeletonRows count={3} label="Loading waste">
          {(i) => <ShortRowSkeleton key={i} />}
        </SkeletonRows>
      ) : status === 'error' ? (
        <div className="flex flex-col items-center gap-2 px-6 py-6 text-center" role="alert">
          <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">Couldn&apos;t load waste</span>
          <button type="button" onClick={onRetry} className="font-wds-sans text-wds-caption font-medium text-wds-primary hover:underline">
            Retry
          </button>
        </div>
      ) : top.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-8 text-center">
          <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">No waste logged in the last 7 days</span>
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Anything spoiled, expired or damaged goes through Log waste.</span>
        </div>
      ) : (
        top.map((e, i) => (
          <div key={e.id} className={cn('flex h-11 shrink-0 items-center px-4', i < top.length - 1 && 'border-b border-wds-neutral-100')}>
            <span className="min-w-0 grow truncate font-wds-sans text-wds-body-sm text-wds-text-ink">
              {e.itemName} · {formatQty(e.quantity, e.usageUnit)}
            </span>
            <span className="w-[120px] shrink-0 font-wds-sans text-wds-caption text-wds-text-copy-muted">{wasteReasonShort(e.reason)}</span>
            <span className="w-[90px] shrink-0 text-right font-wds-mono text-wds-caption text-wds-text-ink">{formatKes(e.value)}</span>
          </div>
        ))
      )}
    </section>
  );
}

/* ================================================================= mobile */

function MobileActionButton({
  children,
  primary = false,
  onClick,
  href,
  disabledHint,
  columns = 2,
  hintAlign = 'center',
}: {
  children: React.ReactNode;
  primary?: boolean;
  onClick?: () => void;
  href?: string;
  disabledHint?: string;
  /** Attendant `188X-0` = one row of three (basis 0); SM `1J43-0` = 2×2. */
  columns?: 2 | 3;
  /** `end` for a right-column button so its hint stays on screen. */
  hintAlign?: 'start' | 'center' | 'end';
}) {
  const basis = columns === 3 ? 'basis-0' : 'basis-[40%]';
  const cls = cn(
    'flex min-h-12 w-full touch-manipulation items-center justify-center rounded-wds-md p-3 text-center font-wds-sans text-wds-body-sm font-medium leading-4 outline-none transition-[transform,background-color,filter] duration-150 ease-out focus-visible:shadow-wds-ring',
    primary
      ? 'bg-wds-gradient-primary text-wds-primary-fg shadow-wds-sheen hover:brightness-110'
      : 'border border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-50',
  );
  if (disabledHint) {
    return (
      <HintTooltip hint={disabledHint} side="bottom" align={hintAlign} className={cn('flex min-w-0 grow', basis)}>
        {(describedBy) => (
          <button type="button" aria-disabled="true" aria-describedby={describedBy} onClick={(e) => e.preventDefault()} className={cn(cls, 'cursor-not-allowed')}>
            {children}
          </button>
        )}
      </HintTooltip>
    );
  }
  const live = cn(cls, 'min-w-0 grow active:bg-wds-neutral-100 motion-safe:active:scale-[0.98]', basis);
  if (href) {
    return (
      <Link href={href} className={live}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={live}>
      {children}
    </button>
  );
}

/** Mobile "Today's count" card (`1J5Y-0` SM, `18AG-0` attendant, `1G39-0` empty). */
function mobileCountCopy(count: TodaysCount | undefined, attendant: boolean): { text: string; warning: boolean } {
  if (!count || count.status === 'NOT_STARTED') {
    return { text: attendant ? 'No count yet today — tap Daily count to start.' : "No count yet today — the attendant hasn't started.", warning: false };
  }
  if (count.status === 'DRAFT') {
    const progress = `${count.countedLines ?? 0} of ${count.totalLines ?? 0} counted`;
    return { text: attendant ? `In progress — ${progress}. Tap Daily count to continue.` : `In progress — ${progress} so far.`, warning: false };
  }
  if (count.status === 'SUBMITTED') {
    const at = count.submittedAt ? formatClock(count.submittedAt) : '';
    return {
      text: attendant
        ? `Submitted ${at} · blind · awaiting Store Manager verification`
        : `Submitted ${at}${count.submittedByName ? ` by ${shortName(count.submittedByName)}` : ''} · blind · waiting for your verification`,
      warning: true,
    };
  }
  if (count.status === 'RETURNED') {
    return {
      text: attendant
        ? 'Sent back for a recount — tap Daily count to recount the queried lines.'
        : `Sent back for a recount — waiting on ${count.submittedByName ? shortName(count.submittedByName) : 'the attendant'}.`,
      warning: true,
    };
  }
  return { text: 'Verified — today’s count is signed.', warning: false };
}

function MobileTodaysCountCard({ count, attendant }: { count: TodaysCount | undefined; attendant: boolean }) {
  const c = mobileCountCopy(count, attendant);
  const cls = cn('flex flex-col gap-2 rounded-wds-md border p-3.5', c.warning ? 'border-wds-warning-border bg-wds-warning-bg' : 'border-wds-border bg-wds-surface');
  const body = (
    <>
      <span className={cn('font-wds-sans text-wds-body-sm font-semibold', c.warning ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>Today&apos;s count</span>
      <span className={cn('font-wds-sans text-wds-caption', c.warning ? 'text-wds-warning-fg' : 'text-wds-text-copy-muted')}>{c.text}</span>
    </>
  );
  // The Store Manager's warning card is the way in to verify.
  if (!attendant && count?.countId && count.status !== 'DRAFT' && count.status !== 'NOT_STARTED') {
    return (
      <Link href={`/app/inventory/stock/counts?id=${count.countId}`} className={cn(cls, 'outline-none transition-[filter] duration-150 focus-visible:shadow-wds-ring active:brightness-95')}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

function MobileWasteCard({ waste, status, onRetry }: { waste: { entries: WasteEntry[]; totalValue: string } | null; status: 'loading' | 'error' | 'ready'; onRetry: () => void }) {
  return (
    <section aria-labelledby="m-waste-heading" className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
      <div className="flex items-center justify-between border-b border-wds-border px-3.5 py-3">
        <h2 id="m-waste-heading" className="font-wds-sans text-wds-body-sm font-semibold leading-4 text-wds-text-ink">
          Waste — last 7 days
        </h2>
        {waste ? (
          <HighlightOnChange value={waste.totalValue} className="font-wds-mono text-wds-caption text-wds-text-copy-muted">
            {formatKes(waste.totalValue)}
          </HighlightOnChange>
        ) : null}
      </div>
      {status === 'loading' ? (
        <SkeletonRows count={4} label="Loading waste">
          {(i) => <ShortRowSkeleton key={i} className="px-3.5" />}
        </SkeletonRows>
      ) : status === 'error' ? (
        <div className="p-3.5">
          <StockErrorCard title="Couldn't load today's count and waste" description="Check your connection and try again. You can still log waste." onRetry={onRetry} />
        </div>
      ) : !waste || waste.entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 px-6 py-7 text-center">
          <span className="size-9 rounded-[6px] border-[1.5px] border-dashed border-wds-border-strong" aria-hidden />
          <span className="font-wds-sans text-wds-body-sm font-medium text-wds-text-ink">No waste logged in the last 7 days</span>
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Anything spoiled, expired or damaged goes through Log waste.</span>
        </div>
      ) : (
        waste.entries.map((e, i) => (
          <div key={e.id} className={cn('flex items-center gap-2.5 px-3.5 py-[11px]', i < waste.entries.length - 1 && 'border-b border-wds-border')}>
            <span className="min-w-0 grow basis-0 truncate font-wds-sans text-wds-body-sm leading-4 text-wds-text-ink">
              {e.itemName} · {formatQty(e.quantity, e.usageUnit)}
            </span>
            <span className="w-16 shrink-0 text-right font-wds-sans text-wds-field-label text-wds-text-copy-muted">{wasteReasonShort(e.reason)}</span>
            <span className="w-[60px] shrink-0 text-right font-wds-mono text-wds-field-label text-wds-text-ink">{formatKes(e.value)}</span>
          </div>
        ))
      )}
    </section>
  );
}

function MobileOnHandCard({ itemCount, refreshSignal }: { itemCount: number; refreshSignal: number }) {
  const { list, status, error, reload } = useStockList({ attention: true, pageSize: 4 });
  const firstSignal = React.useRef(refreshSignal);
  React.useEffect(() => {
    if (refreshSignal !== firstSignal.current) void reload();
    // `reload` is stable (useCallback in useResource); only a new signal refetches.
  }, [refreshSignal, reload]);
  return (
    <section aria-labelledby="m-onhand-heading" className="flex flex-col overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
      <div className="flex items-center gap-2 border-b border-wds-border px-3.5 py-3">
        <h2 id="m-onhand-heading" className="font-wds-sans text-wds-body-sm font-semibold text-wds-text-ink">
          On hand
        </h2>
        <span className="rounded-full bg-wds-neutral-50 px-[7px] py-px font-wds-mono text-wds-field-label text-wds-text-copy-muted">{itemCount}</span>
        <span className="grow basis-0 text-right font-wds-sans text-wds-field-label text-wds-text-copy-muted">tap a row for its ledger</span>
      </div>
      {status === 'loading' ? (
        <SkeletonRows count={4} label="Loading stock position">
          {(i) => <MobileListRowSkeleton key={i} className="px-3.5" />}
        </SkeletonRows>
      ) : status === 'error' ? (
        <div className="p-3.5">
          <StockErrorCard title="Couldn't load the stock position" description={error ?? 'Check your connection and try again.'} onRetry={reload} />
        </div>
      ) : (
        list?.rows.map((row) => (
          <Link
            key={row.itemId}
            href={LEDGER_HREF(row.itemId)}
            className="flex items-center gap-2.5 border-b border-wds-border px-3.5 py-[11px] outline-none transition-colors duration-150 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)] active:bg-wds-neutral-100"
          >
            <span className="flex min-w-0 grow basis-0 flex-col gap-px">
              <span className="truncate font-wds-sans text-wds-body-sm text-wds-text-ink">{row.name}</span>
              <span className="truncate font-wds-sans text-wds-field-label text-wds-text-faint">
                {row.type === 'RAW_INGREDIENT' ? 'Raw' : ITEM_TYPE_LABEL[row.type]}
                {row.category ? ` · ${row.category.name}` : ''}
              </span>
            </span>
            <span className={cn('font-wds-mono text-wds-body-sm', row.isNegative ? 'text-wds-error-fg' : row.isLow ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>
              {formatQty(row.onHand, row.usageUnit)}
            </span>
            <span className="shrink-0 font-wds-mono text-wds-field-label text-wds-text-faint">
              {row.restockLevel ? `restock ${formatNumber(row.restockLevel)}` : 'no restock'}
            </span>
          </Link>
        ))
      )}
      <Link href="/app/inventory/stock/items" className="flex items-center justify-center p-[11px] font-wds-sans text-wds-caption text-wds-primary outline-none focus-visible:shadow-wds-ring active:bg-wds-neutral-100">
        View all {itemCount} items →
      </Link>
    </section>
  );
}

/* ================================================================= screen */

export function StockHubScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const { open: openMobileNav } = useMobileNavDrawer();
  const user = useAuthStore((s) => s.user);
  const isAttendant = user?.role === 'STORE_ATTENDANT';
  const { summary: rawSummary, status: summaryStatus, reload: reloadSummary } = useStockSummary();
  const summary = isFullSummary(rawSummary) ? rawSummary : null;
  const todaysCount = rawSummary?.todaysCount;
  const { waste, status: wasteStatus, reload: reloadWaste } = useWasteList(7);
  const [wasteOpen, setWasteOpen] = React.useState(false);
  const [thresholdsOpen, setThresholdsOpen] = React.useState(false);
  const refreshTableRef = React.useRef<(() => void) | null>(null);
  const [refreshSignal, setRefreshSignal] = React.useState(0);

  const refreshAfterWaste = React.useCallback(() => {
    void reloadSummary();
    void reloadWaste();
    refreshTableRef.current?.();
    setRefreshSignal((n) => n + 1);
  }, [reloadSummary, reloadWaste]);

  if (!hydrated) return null;
  const initials = user?.name ? user.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') : '—';

  if (!isDesktop) {
    const itemCount = summary?.itemCount ?? 0;
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas">
        <MobileStatusBar />
        <MobileHubHeader
          title="Stock & counts"
          subtitle={
            isAttendant
              ? 'Central Store · counts and waste'
              : summary
                ? `Central Store · ${formatKesCompact(summary.onHandValue)} on hand · ${formatNumber(summary.itemCount)} items`
                : 'Central Store'
          }
          userInitials={initials}
          onMenuClick={openMobileNav}
        />
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 [&>*]:shrink-0">
          <div className={cn('flex gap-2', !isAttendant && 'flex-wrap')}>
            {isAttendant ? (
              <>
                <MobileActionButton primary columns={3} href="/app/inventory/stock/daily-count">
                  Daily count
                </MobileActionButton>
                <MobileActionButton columns={3} onClick={() => setWasteOpen(true)}>
                  Log waste
                </MobileActionButton>
                <MobileActionButton columns={3} hintAlign="end" disabledHint="Set by the Store Manager">
                  Restock levels
                </MobileActionButton>
              </>
            ) : (
              <>
                <MobileActionButton primary href="/app/inventory/stock/spot-count">
                  Spot count
                </MobileActionButton>
                <MobileActionButton onClick={() => setWasteOpen(true)}>Log waste</MobileActionButton>
                <MobileActionButton href="/app/inventory/stock/restock-levels">Restock levels</MobileActionButton>
                <MobileActionButton onClick={() => setThresholdsOpen(true)}>
                  Thresholds
                </MobileActionButton>
              </>
            )}
          </div>

          {summaryStatus === 'loading' ? (
            <StatusCardSkeleton />
          ) : summaryStatus === 'error' ? (
            <StockErrorCard
              title={isAttendant ? "Couldn't load today's count and waste" : "Couldn't load the stock position"}
              description={
                isAttendant
                  ? 'Check your connection and try again. You can still log waste.'
                  : 'Check your connection and try again. Nothing has changed at the Central Store.'
              }
              onRetry={reloadSummary}
            />
          ) : (
            <MobileTodaysCountCard count={todaysCount} attendant={isAttendant} />
          )}

          {!isAttendant && summary ? (
            <>
              <div className="flex">
                <Link
                  href="/app/inventory/stock/items?belowRestock=true"
                  className="flex grow basis-0 flex-col gap-[3px] rounded-wds-md border border-wds-neutral-400 bg-wds-neutral-50 p-3 outline-none focus-visible:shadow-wds-ring active:bg-wds-neutral-100"
                >
                  <span className="font-wds-mono text-[10px]/3 uppercase text-wds-text-copy-muted">Low stock</span>
                  <HighlightOnChange value={summary.lowCount} className="font-wds-mono text-[20px]/6 font-medium text-wds-warning-fg" />
                  <span className="font-wds-sans text-wds-field-label text-wds-text-copy-muted">below restock level</span>
                </Link>
                <Link
                  href="/app/inventory/stock/items?negative=true"
                  className="flex grow basis-0 flex-col gap-[3px] rounded-wds-md border border-wds-neutral-400 bg-wds-neutral-50 p-3 outline-none focus-visible:shadow-wds-ring active:bg-wds-neutral-100"
                >
                  <span className="font-wds-mono text-[10px]/3 uppercase text-wds-text-copy-muted">Negative</span>
                  <HighlightOnChange value={summary.negativeCount} className="font-wds-mono text-[20px]/6 font-medium text-wds-error-fg" />
                  <span className="font-wds-sans text-wds-field-label text-wds-text-copy-muted">need a spot count</span>
                </Link>
              </div>
              <MobileOnHandCard itemCount={itemCount} refreshSignal={refreshSignal} />
            </>
          ) : null}

          <MobileWasteCard waste={waste} status={wasteStatus} onRetry={reloadWaste} />
        </main>

        {wasteOpen ? (
          <LogWasteMobile locationLabel="the Central Store" onClose={() => setWasteOpen(false)} onLogged={refreshAfterWaste} />
        ) : null}
        {!isAttendant ? <ThresholdsDrawer open={thresholdsOpen} onOpenChange={setThresholdsOpen} variant="mobile" /> : null}
      </div>
    );
  }

  if (isAttendant) {
    // The attendant's hub is designed for mobile only (`188X-0`); on a wide
    // screen it keeps the same blind content in the desktop chrome.
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-wds-border bg-wds-gradient-topbar px-6">
          <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">Central Store</span>
          <span className="font-wds-sans text-wds-caption text-wds-text-faint">/</span>
          <span className="font-wds-sans text-wds-caption font-medium text-wds-text-ink">Stock &amp; counts</span>
          <div className="ml-auto flex gap-2">
            <Button asChild>
              <Link href="/app/inventory/stock/daily-count">Daily count</Link>
            </Button>
          </div>
        </div>
        <main className="mx-auto flex w-full max-w-[640px] flex-col gap-4 overflow-y-auto px-8 py-7 [&>*]:shrink-0">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Stock &amp; counts</h1>
          <MobileTodaysCountCard count={todaysCount} attendant />
          <MobileWasteCard waste={waste} status={wasteStatus} onRetry={reloadWaste} />
          <button type="button" onClick={() => setWasteOpen(true)} className="self-start font-wds-sans text-wds-body-sm font-medium text-wds-primary hover:underline">
            Log waste
          </button>
        </main>
        <LogWasteDrawer open={wasteOpen} onOpenChange={setWasteOpen} locationLabel="the Central Store" onLogged={refreshAfterWaste} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <StockTopbar screen="Stock & counts" onLogWaste={() => setWasteOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">Stock &amp; counts</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            The live position at the Central Store, derived from the ledger — plus the count rhythm and recent waste.
          </p>
        </div>

        {summaryStatus === 'error' ? (
          <>
            <HubKpiStrip summary={null} loading errored />
            <StockErrorCard
              className="py-6"
              title="Couldn't load the stock position"
              description="Check your connection and try again. Nothing has changed at the Central Store."
              onRetry={() => {
                void reloadSummary();
                refreshTableRef.current?.();
              }}
            />
          </>
        ) : (
          <>
            <HubKpiStrip summary={summary} loading={summaryStatus === 'loading'} />
            <OnHandBand itemCount={summary?.itemCount ?? null} onRefreshRef={refreshTableRef} />
          </>
        )}

        <div className="flex shrink-0 gap-5">
          <CountsBand />
          <WasteBand
            entries={waste?.entries ?? []}
            totalValue={waste?.totalValue ?? null}
            status={wasteStatus}
            onRetry={reloadWaste}
            onLogWaste={() => setWasteOpen(true)}
          />
        </div>
      </main>

      <LogWasteDrawer open={wasteOpen} onOpenChange={setWasteOpen} locationLabel="the Central Store" onLogged={refreshAfterWaste} />
    </div>
  );
}
