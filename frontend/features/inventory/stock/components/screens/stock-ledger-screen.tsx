'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';

import { cn } from '@/lib/cn';
import { TablePager } from '@/components/ui2/data-table/table-pager';
import { DEFAULT_PER_PAGE, normalizePerPage } from '@/components/ui2/data-table/table-query';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { useDebouncedValue, useStockLedger, useStockList, useStockSummary } from '../../hooks/use-stock';
import { listItems } from '../../../services';
import type { InventoryTransactionTypeValue, LedgerQuery, LedgerRow, LedgerSummary, StockSummary } from '../../types/stock';
import { StockTopbar } from '../stock-topbar';
import { LogWasteDrawer } from '../../../waste/components/log-waste-drawer';
import { DropdownFilter } from '../stock-table';
import {
  KpiValueSkeleton,
  ListRowSkeleton,
  MobileMovementRowSkeleton,
  SkeletonRows,
  StockEmptyCard,
  StockErrorCard,
} from '../../../_shared/components/stock-states';
import {
  DEPARTMENT_LABEL,
  formatDayMonth,
  formatDayMonthYear,
  formatKes,
  formatNumber,
  formatQty,
  formatShortDate,
  formatSignedQty,
  TRANSACTION_TYPE_LABEL,
  TRANSACTION_TYPE_TONE,
} from '../../../_shared/components/stock-format';

/**
 * Stock ledger — Milestone Six Session 1.
 *  - Item selected: `197U-0` (Store Manager, Central Store, desktop) /
 *    `1BPY-0` (Department Head, own department, mobile).
 *  - No item selected: `1F7B-0` / `1FDY-0` — search + recently viewed.
 * Rows come from `GET /inventory/stock/items/:itemId/ledger`; the running
 * on-hand is the API's window-function column, never recomputed here. The
 * server resolves the location from the actor (SM → Central Store, DH → own
 * department). Range, type, page and `highlight` live in the URL.
 */

export type LedgerScope = 'store' | 'department';

const ledgerBase = (scope: LedgerScope) => (scope === 'store' ? '/app/inventory/stock/ledger' : '/app/branch/ledger');

/* ============================================================ range + URL */

type RangeKey = '7' | '30' | '90' | 'all' | 'custom';
const RANGE_KEYS: RangeKey[] = ['7', '30', '90', 'all', 'custom'];
const RANGE_LABEL: Record<Exclude<RangeKey, 'custom'>, { desktop: string; mobile: string; prose: string }> = {
  '7': { desktop: 'Last 7 days', mobile: '7d', prose: '7 days' },
  '30': { desktop: '30 days', mobile: '30d', prose: '30 days' },
  '90': { desktop: '90 days', mobile: '90d', prose: '90 days' },
  all: { desktop: 'All time', mobile: 'All', prose: 'all time' },
};

const MOVEMENT_TYPES: InventoryTransactionTypeValue[] = [
  'RECEIVE',
  'MARKET_RECEIVE',
  'DISPATCH_OUT',
  'DISPATCH_IN',
  'PREP_CONSUME',
  'PREP_PRODUCE',
  'WASTE',
  'ADJUSTMENT',
  'SALE',
];

interface LedgerUrlState {
  range: RangeKey;
  from?: string; // yyyy-mm-dd, custom only
  to?: string;
  type?: InventoryTransactionTypeValue;
  page: number;
  /** Rows per page: 25, 50 or 100 (§4a). */
  perPage: number;
  highlight?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readLedgerState(params: URLSearchParams): LedgerUrlState {
  const range = params.get('range') as RangeKey | null;
  const type = params.get('type') as InventoryTransactionTypeValue | null;
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  const from = params.get('from');
  const to = params.get('to');
  return {
    range: range && RANGE_KEYS.includes(range) ? range : '7',
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    type: type && MOVEMENT_TYPES.includes(type) ? type : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    perPage: normalizePerPage(Number.parseInt(params.get('perPage') ?? '', 10)),
    highlight: params.get('highlight') ?? undefined,
  };
}

function writeLedgerState(s: LedgerUrlState): string {
  const p = new URLSearchParams();
  if (s.range !== '7') p.set('range', s.range);
  if (s.range === 'custom') {
    if (s.from) p.set('from', s.from);
    if (s.to) p.set('to', s.to);
  }
  if (s.type) p.set('type', s.type);
  if (s.page > 1) p.set('page', String(s.page));
  if (s.perPage !== DEFAULT_PER_PAGE) p.set('perPage', String(s.perPage));
  if (s.highlight) p.set('highlight', s.highlight);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

/** Local midnight `days` ago, as ISO — stable for the whole day, so the request key doesn't churn. */
function startOfDayAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function localDayBound(date: string, end: boolean): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
  return at.toISOString();
}

function toLedgerQuery(s: LedgerUrlState): LedgerQuery {
  const q: LedgerQuery = { page: s.page, pageSize: s.perPage, type: s.type };
  if (s.range === '7' || s.range === '30' || s.range === '90') q.from = startOfDayAgo(Number(s.range));
  if (s.range === 'custom') {
    if (s.from) q.from = localDayBound(s.from, false);
    if (s.to) q.to = localDayBound(s.to, true);
  }
  return q;
}

function useLedgerUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = React.useMemo(() => readLedgerState(new URLSearchParams(params.toString())), [params]);
  const update = React.useCallback(
    (patch: Partial<LedgerUrlState>) => {
      const next = { ...state, ...patch };
      if (!('page' in patch)) next.page = 1;
      // A new range or type is a new question — the deep-link highlight has done its job.
      if ('range' in patch || 'type' in patch) next.highlight = undefined;
      router.replace(`${pathname}${writeLedgerState(next)}`, { scroll: false });
    },
    [state, pathname, router],
  );
  return { state, update };
}

/* ============================================================ recently viewed */

interface RecentItem {
  itemId: string;
  name: string;
  categoryName: string | null;
}

const RECENT_MAX = 6;
const recentKey = (scope: LedgerScope, userId: string | undefined) => `wendo:ledger-recent:${scope}:${userId ?? 'anon'}`;

/** Per-viewer convenience only — storage can throw or be empty (private mode); the screen works without it. */
function readRecent(key: string): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((r): r is RecentItem => typeof r === 'object' && r !== null && typeof (r as RecentItem).itemId === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeRecent(key: string, item: RecentItem) {
  try {
    const next = [item, ...readRecent(key).filter((r) => r.itemId !== item.itemId)].slice(0, RECENT_MAX);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore — recently viewed is a convenience.
  }
}

/* ============================================================ shared bits */

function useDepartmentContext() {
  const user = useAuthStore((s) => s.user);
  const tag = user?.departmentTag ?? null;
  return {
    user,
    departmentTag: tag,
    departmentLabel: tag ? DEPARTMENT_LABEL[tag] : null,
    branchName: user?.organizationName ?? null,
  };
}

function locationLineFor(scope: LedgerScope, summary: LedgerSummary | null, fallbackDept: string | null, fallbackBranch: string | null) {
  if (scope === 'store') return 'Central Store';
  const dept = summary?.location.departmentTag ? DEPARTMENT_LABEL[summary.location.departmentTag] : fallbackDept;
  const branch = summary?.location.branchName ?? fallbackBranch;
  return [dept, branch].filter(Boolean).join(' · ');
}

/** "kg" → "kg", "pcs" → "pc" — the per-unit cost label ("KES 145/pc"). */
function unitSingular(unit: string): string {
  return unit === 'pcs' ? 'pc' : unit;
}

function TypeDot({ type }: { type: InventoryTransactionTypeValue }) {
  const tone = TRANSACTION_TYPE_TONE[type];
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={cn('size-1.5 shrink-0 rounded-full', tone.dot)} aria-hidden />
      <span className={cn('truncate font-wds-sans text-[13px]/4', tone.text)}>{TRANSACTION_TYPE_LABEL[type]}</span>
    </span>
  );
}

function highlightSource(row: LedgerRow): string {
  return row.reference ?? `the ${TRANSACTION_TYPE_LABEL[row.type].toLowerCase()} on ${formatShortDate(row.at)}`;
}

/**
 * The `?highlight=` row: scrolled into view once; the row itself plays a
 * one-time fade from caramel into the resting espresso-50 tint (§4.3,
 * `ledger-highlight` keyframes in globals). Reduced motion: no scroll
 * animation, resting tint only.
 */
function useHighlightScroll(highlightId: string | undefined) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const done = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!highlightId || done.current === highlightId || !ref.current) return;
    done.current = highlightId;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [highlightId]);
  return ref;
}

const HIGHLIGHT_ROW = 'bg-wds-espresso-50 motion-safe:animate-[ledger-highlight_1400ms_cubic-bezier(0.23,1,0.32,1)_1]';

function emptyTitle(state: LedgerUrlState): string {
  if (state.range === 'all') return 'No movements yet';
  if (state.range === 'custom') return 'No movements in this range';
  return `No movements in the last ${RANGE_LABEL[state.range].prose}`;
}

function emptyBody(itemName: string, lastMovementAt: string | null): string {
  return lastMovementAt
    ? `${itemName} hasn’t been received, dispatched, wasted or adjusted since ${formatDayMonthYear(lastMovementAt)}. Try a longer range.`
    : `${itemName} has no movements at this location yet.`;
}

/** Branch-style light header — `1BPY-0` / `1FDY-0` ("Branch mobile header"): 58px, back chevron, title 17/19 + faint 12/14 subtitle. */
function LedgerMobileHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-wds-border px-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="-m-2 flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-wds-sm outline-none transition-transform duration-150 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.92]"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M12.5 15L7.5 10L12.5 5" stroke="var(--wds-text-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <h1 className="truncate font-wds-sans text-[17px]/[19px] font-semibold text-wds-text-ink">{title}</h1>
        <p className="truncate font-wds-sans text-[12px]/[14px] text-wds-text-faint">{subtitle}</p>
      </div>
    </header>
  );
}

/* ============================================================ range controls */

function RangeToggle({
  value,
  onChange,
  mobile = false,
  labelledBy,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
  mobile?: boolean;
  labelledBy?: string;
}) {
  const keys: RangeKey[] = mobile ? ['7', '30', '90', 'all'] : ['7', '30', '90', 'all', 'custom'];
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as RangeKey);
      }}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : 'Date range'}
      className={cn('flex gap-1.5', mobile && 'px-4 pt-1')}
    >
      {keys.map((k) => (
        <ToggleGroupPrimitive.Item
          key={k}
          value={k}
          className={cn(
            'shrink-0 rounded-wds-sm border font-wds-sans outline-none transition-[background-color,border-color,color] duration-200 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]',
            mobile ? 'touch-manipulation px-2.5 py-[5px] text-[12px]/4' : 'px-3 py-[5px] text-[13px]/4',
            'data-[state=on]:border-wds-espresso-700 data-[state=on]:bg-wds-espresso-700 data-[state=on]:font-medium data-[state=on]:text-white',
            'data-[state=off]:border-wds-border data-[state=off]:bg-transparent data-[state=off]:text-wds-text-ink data-[state=off]:hover:bg-wds-neutral-100',
          )}
        >
          {k === 'custom' ? 'Custom range…' : mobile ? RANGE_LABEL[k].mobile : RANGE_LABEL[k].desktop}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

function CustomRangeFields({ from, to, onApply }: { from?: string; to?: string; onApply: (from?: string, to?: string) => void }) {
  const [f, setF] = React.useState(from ?? '');
  const [t, setT] = React.useState(to ?? '');
  const invalid = Boolean(f && t && f > t);
  const field =
    'h-7 rounded-wds-sm border border-wds-border bg-wds-surface px-2 font-wds-mono text-[12px]/4 text-wds-text-ink outline-none focus:border-wds-primary focus-visible:shadow-wds-ring aria-[invalid=true]:border-wds-error-fg';
  return (
    <form
      className="ml-2 flex items-center gap-1.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) onApply(f || undefined, t || undefined);
      }}
    >
      <label className="sr-only" htmlFor="ledger-from">
        From
      </label>
      <input id="ledger-from" name="from" type="date" value={f} onChange={(e) => setF(e.target.value)} className={field} aria-invalid={invalid} />
      <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">to</span>
      <label className="sr-only" htmlFor="ledger-to">
        To
      </label>
      <input id="ledger-to" name="to" type="date" value={t} onChange={(e) => setT(e.target.value)} className={field} aria-invalid={invalid} />
      <Button type="submit" variant="secondary" size="sm" className="h-7" disabled={invalid}>
        Apply
      </Button>
    </form>
  );
}

function LedgerRowSkeleton() {
  return (
    <div className="flex h-[41px] items-center gap-4 border-b border-wds-neutral-200" aria-hidden>
      <Skeleton className="h-3 w-14 shrink-0" />
      <span className="flex grow basis-0">
        <Skeleton className="h-3 w-24" />
      </span>
      <span className="flex grow-[1.4] basis-0">
        <Skeleton className="h-3 w-40" />
      </span>
      <span className="flex w-[110px] shrink-0 justify-end">
        <Skeleton className="h-3 w-12" />
      </span>
      <span className="flex w-[130px] shrink-0 justify-end">
        <Skeleton className="h-3 w-12" />
      </span>
    </div>
  );
}

/* ============================================================ item selected */

export function StockLedgerScreen({ itemId, scope }: { itemId: string; scope: LedgerScope }) {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const { state, update } = useLedgerUrlState();
  const query = React.useMemo(() => toLedgerQuery(state), [state]);
  const { ledger, status, refreshing, reload } = useStockLedger(itemId, query);
  const dept = useDepartmentContext();
  const summary = ledger?.summary ?? null;
  const rows = ledger?.rows ?? [];
  const highlightRow = state.highlight ? rows.find((r) => r.id === state.highlight) : undefined;
  const highlightRef = useHighlightScroll(highlightRow?.id);
  const [wasteOpen, setWasteOpen] = React.useState(false);

  // Recently viewed (per viewer, per scope) — written when a ledger opens.
  const recentStorageKey = recentKey(scope, dept.user?.id);
  React.useEffect(() => {
    if (!summary) return;
    writeRecent(recentStorageKey, { itemId, name: summary.itemName, categoryName: summary.categoryName });
  }, [summary, itemId, recentStorageKey]);

  if (!hydrated) return null;

  const empty = status === 'ready' && rows.length === 0;
  const widen = () => update({ range: state.range === '30' ? 'all' : '30' });
  const emptyAction = state.range === '30' ? 'Show all time' : 'Show 30 days';
  const itemName = summary?.itemName ?? '';
  const unit = summary?.usageUnit ?? '';
  const locationLine = locationLineFor(scope, summary, dept.departmentLabel, dept.branchName);

  const emptyCard = (
    <StockEmptyCard title={emptyTitle(state)} description={emptyBody(itemName, summary?.lastMovementAt ?? null)} actionLabel={emptyAction} onAction={widen} />
  );
  const errorCard = (
    <StockErrorCard
      title="Couldn't load the ledger"
      description="Check your connection and try again. The ledger itself is safe — nothing was changed."
      onRetry={reload}
    />
  );

  /* ------------------------------------------------------------ mobile (DH always; SM on a phone) */
  if (!isDesktop || scope === 'department') {
    const back = () => {
      if (window.history.length > 1) router.back();
      else router.push(scope === 'store' ? '/app/inventory/stock' : '/app/requisitions');
    };
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas lg:mx-auto lg:w-full lg:max-w-[480px] lg:border-x lg:border-wds-border">
        <MobileStatusBar />
        <LedgerMobileHeader title="Stock ledger" subtitle={locationLine} onBack={back} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [&>*]:shrink-0">
          {highlightRow ? (
            <div className="mx-4 mt-3 rounded-wds-sm border border-wds-espresso-200 bg-wds-espresso-50 px-3 py-2 font-wds-mono text-[12px]/4 text-wds-primary">
              Opened from {highlightSource(highlightRow)}
            </div>
          ) : null}
          <div className="flex flex-col gap-3.5 p-4">
            <div className="flex min-h-7 items-center py-1.5 font-wds-sans text-[13px]/4 text-wds-text-copy-muted">
              {summary ? itemName : status === 'error' ? null : <Skeleton className="h-3 w-40" />}
            </div>

            <div className="flex flex-col rounded-wds-sm border border-wds-border bg-wds-surface">
              <div className="flex flex-col gap-1 p-3.5">
                <span className="font-wds-sans text-wds-table-label uppercase text-wds-text-copy-muted">On hand now</span>
                {summary ? (
                  <span className={cn('font-wds-mono text-[28px]/[34px] font-medium', Number(summary.onHand) < 0 ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
                    {formatQty(summary.onHand, unit)}
                  </span>
                ) : (
                  <span className="font-wds-mono text-[28px]/[34px] font-medium text-wds-text-faint">—</span>
                )}
                <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">{locationLine}</span>
              </div>
              <div className="flex border-t border-wds-border">
                <div className="flex grow basis-0 flex-col gap-[3px] border-r border-wds-border px-3.5 py-3">
                  <span className="font-wds-sans text-[10px]/3 font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Current cost</span>
                  <span className={cn('font-wds-mono text-[15px]/[18px] font-medium', summary ? 'text-wds-text-ink' : 'text-wds-text-faint')}>
                    {summary ? `${formatKes(summary.currentCost)}/${unitSingular(unit)}` : '—'}
                  </span>
                </div>
                <div className="flex grow basis-0 flex-col gap-[3px] px-3.5 py-3">
                  <span className="font-wds-sans text-[10px]/3 font-semibold uppercase tracking-[0.04em] text-wds-text-copy-muted">Stock value</span>
                  <span className={cn('font-wds-mono text-[15px]/[18px] font-medium', summary ? 'text-wds-text-ink' : 'text-wds-text-faint')}>
                    {summary ? formatKes(summary.value) : '—'}
                  </span>
                </div>
              </div>
            </div>

            <RangeToggle mobile value={state.range === 'custom' ? '7' : state.range} onChange={(range) => update({ range })} />

            {status === 'loading' ? (
              <SkeletonRows count={4} label="Loading movements">
                {(i) => <MobileMovementRowSkeleton key={i} />}
              </SkeletonRows>
            ) : status === 'error' ? (
              errorCard
            ) : empty ? (
              emptyCard
            ) : (
              <div className={cn('flex flex-col transition-opacity duration-150', refreshing && 'opacity-60')} aria-busy={refreshing}>
                {rows.map((row) => {
                  const lit = row.id === highlightRow?.id;
                  return (
                    <div
                      key={row.id}
                      ref={lit ? highlightRef : undefined}
                      className={cn('flex flex-col gap-[3px] border-b border-wds-border py-3', lit && cn('-ml-4 border-l-[3px] border-l-wds-primary pl-[13px]', HIGHLIGHT_ROW))}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <TypeDot type={row.type} />
                        <span className="shrink-0 font-wds-mono text-[13px]/4 text-wds-text-ink">{formatSignedQty(row.qty, unit)}</span>
                      </div>
                      <span className="truncate font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
                        {formatDayMonth(row.at)} · {row.counterparty}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {ledger && ledger.total > 0 ? (
              <TablePager
                className="mt-1 border-t border-wds-border"
                page={state.page}
                perPage={state.perPage}
                shown={rows.length}
                total={ledger.total}
                onPageChange={(page) => update({ page })}
                onPerPageChange={(perPage) => update({ perPage })}
              />
            ) : null}
          </div>
        </main>
      </div>
    );
  }

  /* ------------------------------------------------------------ desktop (SM) */
  const kpiCell = 'flex grow basis-0 flex-col gap-1.5 bg-wds-gradient-surface-raise p-4';
  const kpiLabel = 'font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted';
  const kpiValue = 'font-wds-mono text-[28px]/[34px] font-medium';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <StockTopbar
        screen={summary ? `${itemName} · ledger` : 'Stock ledger'}
        showHubCrumb
       
        onLogWaste={() => setWasteOpen(true)}
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-10 [&>*]:shrink-0">
        <div className="flex flex-col gap-1 px-8 pb-4 pt-6">
          <h1 className="font-wds-sans text-[24px]/[30px] font-semibold text-wds-text-ink">
            {summary ? `${itemName} — stock ledger` : status === 'error' ? 'Stock ledger' : <Skeleton className="my-1.5 h-5 w-72" />}
          </h1>
          <p className="font-wds-sans text-[14px]/[18px] text-wds-text-copy-muted">
            {summary
              ? `Every movement that changed the Central Store’s ${itemName.toLowerCase()} — append-only; on-hand is derived from it.`
              : 'Every movement that changed this item at the Central Store — append-only; on-hand is derived from it.'}
          </p>
        </div>

        {highlightRow ? (
          <div className="mx-8 mb-3 flex items-center rounded-wds-sm border border-wds-espresso-200 bg-wds-espresso-50 px-2.5 py-1 font-wds-mono text-[12px]/4 text-wds-primary">
            Opened from {highlightSource(highlightRow)} — row highlighted below
          </div>
        ) : null}

        <div className="mx-8 mb-5 flex overflow-hidden rounded-wds-md border border-wds-border">
          <div className={cn(kpiCell, 'border-r border-wds-neutral-800')}>
            <span className={kpiLabel}>On hand now</span>
            {summary ? (
              <>
                <span className={cn(kpiValue, Number(summary.onHand) < 0 ? 'text-wds-error-fg' : 'text-wds-text-ink')}>{formatQty(summary.onHand, unit)}</span>
                <span className={cn('font-wds-sans text-wds-caption', summary.isLow ? 'text-wds-warning-fg' : 'text-wds-text-copy-muted')}>
                  {summary.restockLevel
                    ? summary.isLow
                      ? `below restock level (${formatQty(summary.restockLevel, unit)})`
                      : `restock level ${formatQty(summary.restockLevel, unit)}`
                    : 'no restock level set'}
                </span>
              </>
            ) : (
              <KpiValueSkeleton static={status === 'error'} />
            )}
          </div>
          <div className={cn(kpiCell, 'border-r border-wds-neutral-800')}>
            <span className={kpiLabel}>Current cost</span>
            {summary ? (
              <>
                <span className={cn(kpiValue, 'text-wds-text-ink')}>
                  {formatKes(summary.currentCost)}/{unitSingular(unit)}
                </span>
                <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
                  {summary.currentCostSince ? `latest-price, set ${formatShortDate(summary.currentCostSince)}` : 'latest-price'}
                </span>
              </>
            ) : (
              <KpiValueSkeleton static={status === 'error'} />
            )}
          </div>
          <div className={cn(kpiCell, 'border-r border-wds-neutral-800')}>
            <span className={kpiLabel}>Stock value</span>
            {summary ? (
              <>
                <span className={cn(kpiValue, Number(summary.value) < 0 ? 'text-wds-error-fg' : 'text-wds-text-ink')}>{formatKes(summary.value)}</span>
                <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">at current cost</span>
              </>
            ) : (
              <KpiValueSkeleton static={status === 'error'} />
            )}
          </div>
          <div className={kpiCell}>
            <span className={kpiLabel}>Location</span>
            {/* The location is known before the response — it stays real while loading (§0.1). */}
            <span className="font-wds-sans text-[16px]/5 font-semibold text-wds-text-ink">Central Store</span>
            {summary ? (
              <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{summary.categoryName ?? 'Uncategorised'}</span>
            ) : status === 'error' ? (
              <span className="h-4" aria-hidden />
            ) : (
              <Skeleton className="my-[3px] h-2.5 w-20" />
            )}
          </div>
        </div>

        <div className="mx-8 mb-4 flex items-center justify-between gap-4 border-b border-wds-border pb-3">
          <div className="flex items-center gap-1.5">
            <span className="mr-1 font-wds-sans text-wds-caption text-wds-text-copy-muted" id="ledger-range-label">
              DATE RANGE
            </span>
            <RangeToggle value={state.range} onChange={(range) => update({ range })} labelledBy="ledger-range-label" />
            {state.range === 'custom' ? (
              <CustomRangeFields from={state.from} to={state.to} onApply={(from, to) => update({ range: 'custom', from, to })} />
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">TYPE</span>
            <DropdownFilter
              size="md"
              label="All movements"
              allLabel="All movements"
              value={state.type}
              options={MOVEMENT_TYPES.map((t) => ({ value: t, label: TRANSACTION_TYPE_LABEL[t] }))}
              onChange={(type) => update({ type })}
            />
          </div>
        </div>

        <section aria-label="Movements" className="mx-8 flex flex-col">
          <div className="flex items-center gap-4 border-b border-wds-neutral-800 pb-2.5" role="presentation">
            <span className="w-[110px] shrink-0 font-wds-sans text-wds-table-label uppercase text-wds-text-copy-muted">Date</span>
            <span className="grow basis-0 font-wds-sans text-wds-table-label uppercase text-wds-text-copy-muted">Type</span>
            <span className="grow-[1.4] basis-0 font-wds-sans text-wds-table-label uppercase text-wds-text-copy-muted">Counterparty</span>
            <span className="w-[110px] shrink-0 text-right font-wds-sans text-wds-table-label uppercase text-wds-text-copy-muted">Qty ±</span>
            <span className="w-[130px] shrink-0 text-right font-wds-sans text-wds-table-label uppercase text-wds-text-copy-muted">Running on-hand</span>
          </div>
          {status === 'loading' ? (
            <SkeletonRows count={4} label="Loading movements">
              {(i) => <LedgerRowSkeleton key={i} />}
            </SkeletonRows>
          ) : status === 'error' ? (
            <div className="py-8">{errorCard}</div>
          ) : empty ? (
            <div className="flex justify-center py-8">{emptyCard}</div>
          ) : (
            <div className={cn('transition-opacity duration-150', refreshing && 'opacity-60')} aria-busy={refreshing}>
              {rows.map((row) => {
                const lit = row.id === highlightRow?.id;
                return (
                  <div key={row.id} ref={lit ? highlightRef : undefined} className={cn('flex items-center gap-4 border-b border-wds-neutral-200 py-3', lit && HIGHLIGHT_ROW)}>
                    <span className="w-[110px] shrink-0 font-wds-mono text-[13px]/4 text-wds-text-copy-muted">{formatDayMonth(row.at)}</span>
                    <span className="flex min-w-0 grow basis-0">
                      <TypeDot type={row.type} />
                    </span>
                    <span className="min-w-0 grow-[1.4] basis-0 truncate font-wds-sans text-[13px]/4 text-wds-text-copy-muted">{row.counterparty}</span>
                    <span className="w-[110px] shrink-0 text-right font-wds-mono text-[13px]/4 text-wds-text-copy-muted">{formatSignedQty(row.qty, unit)}</span>
                    <span className={cn('w-[130px] shrink-0 text-right font-wds-mono text-[13px]/4', Number(row.runningOnHand) < 0 ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
                      {formatQty(row.runningOnHand, unit)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {ledger && ledger.total > 0 ? (
          <TablePager
            className="mx-8 mt-4 border-t border-wds-border"
            page={state.page}
            perPage={state.perPage}
            shown={rows.length}
            total={ledger.total}
            onPageChange={(page) => update({ page })}
            onPerPageChange={(perPage) => update({ perPage })}
          />
        ) : null}
      </main>

      <LogWasteDrawer open={wasteOpen} onOpenChange={setWasteOpen} locationLabel="the Central Store" onLogged={() => void reload()} />
    </div>
  );
}

/* ============================================================ no item selected */

interface PickerRow {
  itemId: string;
  name: string;
  categoryName: string | null;
}

function PickerList({ heading, rows, scope, mobile }: { heading: string; rows: PickerRow[]; scope: LedgerScope; mobile: boolean }) {
  return (
    <div className="flex flex-col">
      <div className="border-b border-wds-neutral-800 pb-2">
        <h2 className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">{heading}</h2>
      </div>
      {rows.map((r, i) => (
        <Link
          key={r.itemId}
          href={`${ledgerBase(scope)}/${r.itemId}`}
          className={cn(
            'group/row flex items-center gap-3 outline-none transition-colors duration-150 hover:bg-wds-neutral-100 focus-visible:bg-wds-neutral-100 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)] active:bg-wds-neutral-100',
            mobile ? 'touch-manipulation py-3.5' : 'py-3',
            i < rows.length - 1 && 'border-b border-wds-border',
          )}
        >
          <span className={cn('min-w-0 grow truncate font-wds-sans text-wds-text-ink', mobile ? 'text-[14px]/[18px]' : 'text-[13px]/4')}>{r.name}</span>
          {!mobile ? <span className="w-[120px] shrink-0 truncate font-wds-sans text-wds-caption text-wds-text-copy-muted">{r.categoryName ?? '—'}</span> : null}
          <span
            className={cn(
              'w-4 shrink-0 text-right font-wds-sans text-wds-text-faint transition-transform duration-150 ease-out group-hover/row:translate-x-0.5',
              mobile ? 'text-[14px]/[18px]' : 'text-[13px]/4',
            )}
            aria-hidden
          >
            ›
          </span>
        </Link>
      ))}
    </div>
  );
}

type PickerStatus = 'loading' | 'error' | 'ready';

/** Search results for the picker: SM → `listStock({search})`; DH → the catalog filtered to their department (the existing items endpoint). */
function usePickerResults(scope: LedgerScope, search: string, departmentTag: ReturnType<typeof useDepartmentContext>['departmentTag']) {
  const storeList = useStockList({ search, pageSize: 8 }, scope === 'store' && search.length > 0);
  const [dept, setDept] = React.useState<{ rows: PickerRow[]; total: number | null; status: PickerStatus }>({ rows: [], total: null, status: 'loading' });
  const [deptReload, setDeptReload] = React.useState(0);

  React.useEffect(() => {
    if (scope !== 'department' || !departmentTag) return;
    let live = true;
    setDept((d) => ({ ...d, status: 'loading' }));
    listItems({ departmentTag, search: search || undefined, perPage: 8 })
      .then((res) => {
        if (!live) return;
        setDept((d) => ({
          rows: res.data.map((it) => ({ itemId: it.id, name: it.name, categoryName: it.category?.name ?? null })),
          // The count in the placeholder is the unfiltered department total.
          total: search ? d.total : res.pagination.total,
          status: 'ready',
        }));
      })
      .catch(() => {
        if (live) setDept((d) => ({ ...d, status: 'error' }));
      });
    return () => {
      live = false;
    };
  }, [scope, departmentTag, search, deptReload]);

  if (scope === 'store') {
    return {
      rows: (storeList.list?.rows ?? []).map((r) => ({ itemId: r.itemId, name: r.name, categoryName: r.category?.name ?? null })),
      status: (search ? storeList.status : 'ready') as PickerStatus,
      reload: () => void storeList.reload(),
      deptTotal: null,
    };
  }
  return { rows: dept.rows, status: dept.status, reload: () => setDeptReload((n) => n + 1), deptTotal: dept.total };
}

export function StockLedgerPickerScreen({ scope }: { scope: LedgerScope }) {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const dept = useDepartmentContext();
  const [query, setQuery] = React.useState('');
  const search = useDebouncedValue(query.trim(), 250);
  const results = usePickerResults(scope, search, dept.departmentTag);
  const { summary: rawSummary } = useStockSummary(scope === 'store');
  const storeSummary = scope === 'store' && rawSummary && 'onHandValue' in rawSummary ? (rawSummary as StockSummary) : null;
  const [recent, setRecent] = React.useState<RecentItem[] | null>(null);
  const [wasteOpen, setWasteOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const recentStorageKey = recentKey(scope, dept.user?.id);

  React.useEffect(() => {
    setRecent(readRecent(recentStorageKey));
  }, [recentStorageKey]);

  // Search focused on load (§4.3 "Ledger (no item)") — it's the page's single purpose.
  React.useEffect(() => {
    if (hydrated) inputRef.current?.focus({ preventScroll: true });
  }, [hydrated, isDesktop]);

  if (!hydrated) return null;

  const mobile = !isDesktop || scope === 'department';
  const count = scope === 'store' ? (storeSummary?.itemCount ?? null) : results.deptTotal;
  const placeholder =
    scope === 'store'
      ? count === null
        ? 'Search items by name…'
        : `Search ${formatNumber(count)} items by name…`
      : count === null || !dept.departmentLabel
        ? 'Search your items…'
        : `Search ${formatNumber(count)} ${dept.departmentLabel} items…`;

  const searchBox = (
    <div
      className={cn(
        'flex h-11 shrink-0 items-center gap-2.5 border border-wds-border-strong bg-wds-surface px-3.5 transition-[border-color,box-shadow] duration-150 focus-within:border-wds-espresso-700 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--wds-espresso-700)_15%,transparent)]',
        mobile ? 'rounded-wds-md' : 'rounded-wds-sm',
      )}
    >
      <span className="size-3.5 shrink-0 rounded-full border-[1.5px] border-wds-text-faint" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        name="ledger-item-search"
        autoComplete="off"
        spellCheck={false}
        aria-label="Search an item"
        value={query}
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && search && results.rows[0]) router.push(`${ledgerBase(scope)}/${results.rows[0].itemId}`);
          if (e.key === 'Escape' && query) {
            e.preventDefault();
            setQuery('');
          }
        }}
        className="min-w-0 grow bg-transparent font-wds-sans text-[14px]/[18px] text-wds-text-ink outline-none placeholder:text-wds-text-faint [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  );

  const list = search ? (
    results.status === 'loading' ? (
      <SkeletonRows count={4} label="Searching items">
        {(i) => <ListRowSkeleton key={i} className="px-0" />}
      </SkeletonRows>
    ) : results.status === 'error' ? (
      <StockErrorCard title="Couldn't load items" description="Check your connection and try again." onRetry={results.reload} />
    ) : results.rows.length === 0 ? (
      <StockEmptyCard title={`Nothing called “${search}”`} description="Try another name." />
    ) : (
      <PickerList heading="Results" rows={results.rows} scope={scope} mobile={mobile} />
    )
  ) : recent === null ? (
    <SkeletonRows count={4} label="Loading recently viewed">
      {(i) => <ListRowSkeleton key={i} className="px-0" />}
    </SkeletonRows>
  ) : recent.length === 0 ? (
    <StockEmptyCard title="No items viewed yet" description="Search above to open an item’s ledger." />
  ) : (
    <PickerList heading="Recently viewed" rows={recent.slice(0, 4)} scope={scope} mobile={mobile} />
  );

  if (mobile) {
    const back = () => router.push(scope === 'store' ? '/app/inventory/stock' : '/app/requisitions');
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wds-canvas lg:mx-auto lg:w-full lg:max-w-[480px] lg:border-x lg:border-wds-border">
        <MobileStatusBar />
        <LedgerMobileHeader title="Stock ledger" subtitle={locationLineFor(scope, null, dept.departmentLabel, dept.branchName)} onBack={back} />
        <main className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overscroll-contain p-4 [&>*]:shrink-0">
          <p className="font-wds-sans text-[13px]/[18px] text-wds-text-copy-muted">
            {scope === 'store'
              ? 'Pick an item to see every movement that changed its on-hand at the Central Store.'
              : `Pick an item to see every movement that changed its on-hand in ${dept.departmentLabel ?? 'your department'}.`}
          </p>
          {searchBox}
          {list}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <StockTopbar screen="Stock ledger" showHubCrumb onLogWaste={() => setWasteOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto [&>*]:shrink-0">
        <div className="flex flex-col gap-1 px-8 pb-4 pt-6">
          <h1 className="font-wds-sans text-[24px]/[30px] font-semibold text-wds-text-ink">Stock ledger</h1>
          <p className="font-wds-sans text-[14px]/[18px] text-wds-text-copy-muted">
            Every movement that changed an item’s on-hand at the Central Store. Pick an item to see its ledger.
          </p>
        </div>
        <div className="px-8 pb-10">
          <div className="flex w-[640px] flex-col gap-5 rounded-wds-md border border-wds-border bg-wds-surface p-6">
            {searchBox}
            {list}
          </div>
        </div>
      </main>
      <LogWasteDrawer open={wasteOpen} onOpenChange={setWasteOpen} locationLabel="the Central Store" />
    </div>
  );
}
