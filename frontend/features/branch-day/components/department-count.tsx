'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import {
  CountReasonControl,
  FormErrorBanner,
  Reveal,
  SkeletonRows,
  StatCell,
  StatusDot,
  StockErrorCard,
  TableRowSkeleton,
  formatClock,
  formatCountDateLong,
} from '@/features/inventory';
import { formatGap, formatNetKes, GAP_REASON_OPTIONS, GAP_REASON_LABEL, trimQty } from '../lib/branch-day-format';
import type { useDepartmentCount } from '../hooks/use-branch-day';
import type { BranchDayToday, DepartmentDaySummary, GapReasonValue } from '../types/branch-day';

type Count = ReturnType<typeof useDepartmentCount>;
/** What these panes read from the day — the live day and a saved (history) day both provide it. */
type DayRef = Pick<BranchDayToday, 'status' | 'date' | 'closedAt'>;
type Row = Count['rows'][number];

/* ------------------------------------------------------------- inputs */

/** Paper's 96×30 count box (`1E13-0`): right-aligned figure + unit, primary border + ring on focus. */
export function CountInput({ row, onChange, disabled, mobile = false }: { row: Row; onChange: (raw: string) => void; disabled: boolean; mobile?: boolean }) {
  const value = row.counted ?? '';
  return (
    <label
      className={cn(
        'flex shrink-0 items-center justify-end gap-1 border bg-wds-surface transition-[border-color,box-shadow] duration-150 focus-within:border-wds-primary focus-within:shadow-wds-ring',
        mobile ? 'h-9 w-[104px] rounded-[4px] px-2.5' : 'h-[30px] w-24 rounded-wds-sm px-2',
        disabled ? 'cursor-not-allowed border-wds-border bg-wds-neutral-50' : 'border-wds-border-strong hover:border-wds-neutral-400',
      )}
    >
      <input
        data-count-input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        disabled={disabled}
        placeholder="—"
        aria-label={`Counted ${row.line.name}`}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          // Enter moves to the next count field on count screens (§4.2).
          const scope = e.currentTarget.closest('[data-count-list]');
          const inputs = Array.from(scope?.querySelectorAll<HTMLInputElement>('[data-count-input]:not(:disabled)') ?? []);
          const next = inputs[inputs.indexOf(e.currentTarget) + 1];
          if (next) next.focus();
          else e.currentTarget.blur();
        }}
        className={cn(
          'min-w-0 grow bg-transparent text-right font-wds-mono outline-none placeholder:text-wds-text-faint disabled:cursor-not-allowed',
          mobile ? 'text-[15px]/5' : 'text-[13px]/4',
          'text-wds-text-ink',
        )}
      />
      <span className="shrink-0 font-wds-mono text-wds-caption text-wds-text-faint">{row.line.usageUnit}</span>
    </label>
  );
}

function GapCell({ row, className, mobile = false }: { row: Row; className?: string; mobile?: boolean }) {
  const { gap, reasonRequired } = row.live;
  if (gap === null) return <span className={cn('font-wds-mono text-[13px]/4 text-wds-text-faint', className)} />;
  if (gap === 0) return <span className={cn(mobile ? 'font-wds-sans text-[12px]/4' : 'font-wds-mono text-[13px]/4', 'text-right text-wds-text-faint', className)}>—</span>;
  return (
    <span className={cn('flex items-center justify-end gap-[5px]', className)}>
      <StatusDot tone={reasonRequired ? 'error' : 'warning'} />
      <span className={cn('font-wds-mono text-[13px]/4', reasonRequired ? 'font-semibold text-wds-error-fg' : 'text-wds-warning-fg')}>
        {formatGap(gap, row.line.usageUnit)}
      </span>
    </span>
  );
}

/** `1E13-0` / `1E8C-0`: the required-reason control appears under the row when the gap reaches the threshold. */
function ReasonBlock({ row, onChange, mobile }: { row: Row; onChange: Count['setReason']; mobile?: boolean }) {
  return (
    <Reveal>
      <div className={cn(mobile ? 'pb-1' : 'pb-3')}>
        <CountReasonControl<GapReasonValue>
          mobile={mobile}
          options={GAP_REASON_OPTIONS}
          reason={row.reason}
          note={row.note}
          label={mobile ? 'REASON — REQUIRED' : 'REASON — required'}
          labelFont={mobile ? 'mono' : 'sans'}
          ariaLabel={`Reason for ${row.line.name}`}
          invalid
          flagEmpty={false}
          compact
          onChange={(reason, note) => onChange(row.line.inventoryItemId, reason, note)}
        />
      </div>
    </Reveal>
  );
}

function ReasonReadOnly({ row, mobile = false }: { row: Row; mobile?: boolean }) {
  const text = row.reason ? (row.reason === 'OTHER' && row.note ? row.note : GAP_REASON_LABEL[row.reason]) : '—';
  return (
    <div className={cn('flex flex-col gap-1.5', !mobile && 'pb-3')}>
      {/* Paper `1D36-0` (mobile) sets the label in regular mono at label tracking; the desktop pane keeps its sans label. */}
      <span
        className={cn(
          'text-[11px]/[14px] uppercase text-wds-text-copy-muted',
          mobile ? 'font-wds-mono tracking-[0.04em]' : 'font-wds-sans font-semibold',
        )}
      >
        Reason
      </span>
      <span className="font-wds-sans text-[13px]/4 text-wds-text-ink">{text}</span>
    </div>
  );
}

/* ------------------------------------------------------- desktop rows */

function DesktopRow({
  row,
  editable,
  last,
  onCount,
  onReason,
}: {
  row: Row;
  editable: boolean;
  last: boolean;
  onCount: Count['setCount'];
  onReason: Count['setReason'];
}) {
  const { line, counted } = row;
  const needsReason = row.live.reasonRequired;
  return (
    <div className={cn('flex flex-col', !last && 'border-b border-wds-neutral-200')}>
      <div className="flex items-center gap-4 py-2.5">
        <span className="min-w-0 grow-[2] basis-0 truncate font-wds-sans text-[13px]/4 text-wds-text-ink">{line.name}</span>
        <span className="grow basis-0 text-right font-wds-mono text-[13px]/4 text-wds-text-copy-muted">
          {trimQty(line.expectedQty)} {line.usageUnit}
        </span>
        <span className="flex grow basis-0 justify-end">
          {editable ? (
            <CountInput row={row} disabled={false} onChange={(raw) => onCount(line.inventoryItemId, raw)} />
          ) : (
            <span className="ml-auto w-20 rounded-wds-sm px-2 py-1 text-right font-wds-mono text-[13px]/4 text-wds-text-copy-muted">
              {counted === null ? '—' : `${trimQty(counted)} ${line.usageUnit}`}
            </span>
          )}
        </span>
        <GapCell row={row} className="grow basis-0" />
      </div>
      {needsReason ? editable ? <ReasonBlock row={row} onChange={onReason} /> : <ReasonReadOnly row={row} /> : null}
    </div>
  );
}

/* ---------------------------------------------------------- pane parts */

function paneStatus(summary: DepartmentDaySummary, count: Count): { label: string; tone: 'success' | 'warning' | 'error' | 'ink' } {
  if (summary.status === 'CLOSED') return { label: 'Closed', tone: 'success' };
  if (summary.status === 'BLOCKED') return { label: 'Blocked', tone: 'error' };
  if (summary.status === 'COUNTED' || (count.progress.total > 0 && count.progress.counted === count.progress.total))
    return { label: 'Counted', tone: 'warning' };
  if (count.progress.counted > 0) return { label: 'Counting', tone: 'warning' };
  return { label: 'Not started', tone: 'warning' };
}

const statusTone = {
  success: 'text-wds-success-fg',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
  ink: 'text-wds-text-ink',
};

export function SaveIndicator({ state, onRetry }: { state: Count['saveState']; onRetry: () => void }) {
  if (state.kind === 'idle') return null;
  return (
    <span className="font-wds-sans text-wds-caption text-wds-text-faint" role="status" aria-live="polite">
      {state.kind === 'saving' ? 'Saving…' : state.kind === 'saved' ? `Saved ${formatClock(state.at)}` : null}
      {state.kind === 'error' ? (
        <>
          <span className="text-wds-error-fg">Couldn&apos;t save — your counts are kept.</span>{' '}
          <button type="button" onClick={onRetry} className="text-wds-primary underline underline-offset-2 outline-none focus-visible:shadow-wds-ring">
            Retry
          </button>
        </>
      ) : null}
    </span>
  );
}

function DayPill({ today, mobile = false }: { today: DayRef; mobile?: boolean }) {
  const closed = today.status === 'CLOSED';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 border px-2.5 font-wds-sans text-[12px]/4',
        mobile ? 'rounded-[12px] py-1' : 'rounded-wds-sm py-1.5 font-medium',
        closed ? 'border-wds-success-border bg-wds-success-bg text-wds-success-fg' : 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
      )}
    >
      <span className={cn('size-1.5 rounded-full', closed ? 'bg-wds-success-fg' : 'bg-wds-warning-fg')} aria-hidden />
      {closed ? 'Closed' : 'Day open'}
    </span>
  );
}

function subtitle(summary: DepartmentDaySummary, today: DayRef, threshold: number): string {
  const kes = `KES ${threshold.toLocaleString('en-US')}`;
  const by = summary.countedBy ? `${summary.countedBy.name} · counted ${summary.countedAt ? formatClock(summary.countedAt) : ''}. ` : '';
  if (summary.status === 'CLOSED')
    return `${by}Closed with the branch day at ${today.closedAt ? formatClock(today.closedAt) : ''} — counts and reasons are read-only.`;
  if (summary.status === 'BLOCKED') return 'This department has an unconfirmed dispatch. Confirm it first — stock still in the van can’t be counted.';
  if (summary.status === 'COUNTED') return `${by}Expected vs counted per item; a reason is required for any gap above threshold.`;
  return `Enter what's on the shelf. The gap fills in as you type — lines over ${kes} need a reason before the day can close.`;
}

export function DetailSkeleton() {
  return (
    <div className="flex min-w-0 grow basis-0 flex-col px-8 py-7" role="status" aria-live="polite">
      <span className="sr-only">Loading department</span>
      <div className="mb-4 flex flex-col gap-2" aria-hidden>
        <Skeleton className="h-6 w-[380px]" />
        <Skeleton className="h-3.5 w-[520px]" />
      </div>
      <div className="mb-5 flex border-y border-wds-border" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('flex h-[52px] grow basis-0 flex-col justify-center gap-1.5 px-5', i < 3 && 'border-r border-wds-border')}>
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
      <div className="border border-wds-border px-4 pb-3" aria-hidden>
        <SkeletonRows count={8} label="Loading items">
          {(i) => <TableRowSkeleton key={i} widths={[60, 60, 48]} nameWidth={160} className="py-2.5" />}
        </SkeletonRows>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- desktop */

export function DepartmentPane({ today, summary, count }: { today: DayRef; summary: DepartmentDaySummary; count: Count }) {
  const { detail } = count;
  if (count.status === 'error' && !detail) {
    return (
      <div className="flex min-w-0 grow basis-0 items-center justify-center px-8">
        <StockErrorCard
          title="Couldn't load this department"
          description="Check your connection and try again. Counts already entered are saved."
          onRetry={count.reload}
        />
      </div>
    );
  }
  if (!detail) return <DetailSkeleton />;

  const editable = today.status === 'OPEN' && summary.status !== 'BLOCKED';
  const status = paneStatus(summary, count);
  const closed = today.status === 'CLOSED';
  const fullyCounted = count.progress.total > 0 && count.progress.counted === count.progress.total;
  const stats = [
    {
      label: closed || fullyCounted || summary.status === 'COUNTED' ? 'ITEMS' : 'ITEMS COUNTED',
      value: closed || fullyCounted || summary.status === 'COUNTED' ? String(count.progress.total) : `${count.progress.counted} of ${count.progress.total}`,
      tone: undefined,
    },
    {
      label: 'GAPS ABOVE THRESHOLD',
      value: String(count.progress.gaps),
      tone: undefined,
    },
    { label: 'STATUS', value: status.label, tone: statusTone[status.tone] },
    {
      label: closed || fullyCounted ? 'NET ADJUSTMENT VALUE' : 'NET ADJ. SO FAR',
      value: formatNetKes(count.progress.net),
      tone: undefined,
    },
  ];

  return (
    <div className="flex min-w-0 grow basis-0 flex-col overflow-y-auto px-8 py-7" data-count-list>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-wds-sans text-[20px]/6 font-semibold text-wds-text-ink">
            {summary.name} · end-of-day count · {formatCountDateLong(today.date)}
          </h2>
          <p className="font-wds-sans text-[13px]/4 text-wds-text-copy-muted">{subtitle(summary, today, detail.reasonRequiredKes)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <DayPill today={today} />
          {editable ? <SaveIndicator state={count.saveState} onRetry={() => void count.retrySave()} /> : null}
        </div>
      </div>

      <div className="mb-5 flex shrink-0 overflow-hidden border-y border-wds-border">
        {stats.map((s, i) => (
          <StatCell key={s.label} label={s.label} value={s.value} tone={s.tone} last={i === stats.length - 1} />
        ))}
      </div>

      {count.saveState.kind === 'error' ? (
        <FormErrorBanner
          className="mb-4"
          title="Couldn't save — your counts are kept"
          description="What you've typed is still on screen and counts saved earlier are safe on the server. Try again."
        />
      ) : null}

      <div className="flex flex-col border border-wds-border px-4 pb-3">
        <div className="flex items-center gap-4 border-b border-wds-neutral-800 pb-2.5 pt-3">
          <span className="grow-[2] basis-0 font-wds-sans text-wds-table-label uppercase text-wds-text-copy-muted">Item</span>
          <span className="grow basis-0 text-right font-wds-sans text-wds-table-label uppercase text-wds-text-copy-muted">Expected</span>
          <span className="grow basis-0 text-right font-wds-sans text-wds-table-label uppercase text-wds-text-copy-muted">Counted</span>
          <span className="grow basis-0 text-right font-wds-sans text-wds-table-label uppercase text-wds-text-copy-muted">Gap</span>
        </div>
        {count.rows.length === 0 ? (
          <p className="py-6 text-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted">No items to count — this department is done for the day.</p>
        ) : (
          count.rows.map((row, i) => (
            <DesktopRow
              key={row.line.inventoryItemId}
              row={row}
              editable={editable}
              last={i === count.rows.length - 1}
              onCount={count.setCount}
              onReason={count.setReason}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- mobile */

function MobileCard({ row, editable, onCount, onReason }: { row: Row; editable: boolean; onCount: Count['setCount']; onReason: Count['setReason'] }) {
  const { line } = row;
  const label = 'font-wds-mono text-[10px]/3 uppercase text-wds-text-copy-muted';
  return (
    <div className={cn('flex flex-col border-b border-wds-neutral-200 py-3.5', row.live.reasonRequired ? 'gap-2.5' : 'gap-2')}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-wds-sans text-[14px]/[18px] font-medium text-wds-text-ink">{line.name}</span>
        <GapCell row={row} mobile className="shrink-0" />
      </div>
      <div className="flex gap-4">
        <div className="flex flex-col gap-0.5">
          <span className={label}>Expected</span>
          <span className="font-wds-mono text-[13px]/4 text-wds-text-copy-muted">
            {trimQty(line.expectedQty)} {line.usageUnit}
          </span>
        </div>
        <div className={cn('flex w-[104px] shrink-0 flex-col', editable ? 'gap-1' : 'gap-0.5')}>
          <span className={label}>Counted</span>
          {editable ? (
            <CountInput row={row} mobile disabled={false} onChange={(raw) => onCount(line.inventoryItemId, raw)} />
          ) : (
            <span className="font-wds-mono text-[13px]/4 text-wds-text-ink">{row.counted === null ? '—' : `${trimQty(row.counted)} ${line.usageUnit}`}</span>
          )}
        </div>
      </div>
      {row.live.reasonRequired ? editable ? <ReasonBlock row={row} onChange={onReason} mobile /> : <ReasonReadOnly row={row} mobile /> : null}
    </div>
  );
}

/** The four mobile stat cells (`1EC1-0`): 10/12 labels, 16/20 mono values, and a sans 14/18 semibold status. */
function MobileStats({ stats }: { stats: { label: string; value: string; tone?: string; sans?: boolean }[] }) {
  return (
    <div className="mt-0 flex border-y border-wds-border">
      {stats.map((s, i) => (
        <div key={s.label} className={cn('flex min-w-0 grow basis-0 flex-col gap-1 p-3', i < stats.length - 1 && 'border-r border-wds-border')}>
          <span className="font-wds-mono text-[10px]/3 uppercase tracking-[0.04em] text-wds-text-copy-muted">{s.label}</span>
          <span
            className={cn(s.sans ? 'font-wds-sans text-[14px]/[18px] font-semibold' : 'font-wds-mono text-[16px]/5 font-medium', s.tone ?? 'text-wds-text-ink')}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Mobile department count (`1CFK-0` review · `1E8C-0` entry): pill, 4-cell stats, one card per item, save note, "Done" row. */
export function DepartmentListMobile({ today, summary, count }: { today: DayRef; summary: DepartmentDaySummary; count: Count }) {
  const { detail } = count;
  if (count.status === 'error' && !detail) {
    return (
      <div className="flex justify-center py-8">
        <StockErrorCard
          title="Couldn't load this department"
          description="Check your connection and try again. Counts already entered are saved."
          onRetry={count.reload}
        />
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex flex-col" role="status" aria-live="polite">
        <span className="sr-only">Loading department</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-2 border-b border-wds-neutral-200 px-4 py-3.5" aria-hidden>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-40" />
          </div>
        ))}
      </div>
    );
  }
  const editable = today.status === 'OPEN' && summary.status !== 'BLOCKED';
  const status = paneStatus(summary, count);
  const closed = today.status === 'CLOSED';
  const full = closed || summary.status === 'COUNTED' || (count.progress.total > 0 && count.progress.counted === count.progress.total);
  const stats = [
    {
      label: 'ITEMS',
      value: full ? String(count.progress.total) : `${count.progress.counted} / ${count.progress.total}`,
      tone: undefined,
    },
    {
      label: 'GAPS > THR.',
      value: String(count.progress.gaps),
      tone: count.progress.gaps > 0 ? 'text-wds-error-fg' : undefined,
    },
    {
      label: 'STATUS',
      value: status.label,
      tone: statusTone[status.tone],
      sans: true,
    },
    {
      label: 'NET ADJ.',
      value: formatNetKes(count.progress.net),
      tone: undefined,
    },
  ];
  return (
    <div className="flex flex-col" data-count-list>
      <div className="flex items-center justify-between px-4 py-3">
        <DayPill today={today} mobile />
        {editable ? <SaveIndicator state={count.saveState} onRetry={() => void count.retrySave()} /> : null}
      </div>
      <MobileStats stats={stats} />
      {count.saveState.kind === 'error' ? (
        <div className="px-4 pt-3">
          <FormErrorBanner title="Couldn't save — your counts are kept" description="Try again." />
        </div>
      ) : null}
      {summary.status === 'BLOCKED' ? (
        <p className="px-4 pt-3 font-wds-sans text-[13px]/[18px] text-wds-error-fg">{subtitle(summary, today, detail.reasonRequiredKes)}</p>
      ) : null}
      <div className="flex flex-col px-4 pt-1">
        {count.rows.map((row) => (
          <MobileCard key={row.line.inventoryItemId} row={row} editable={editable} onCount={count.setCount} onReason={count.setReason} />
        ))}
      </div>
      {count.rows.length === 0 ? (
        <p className="px-4 py-6 text-center font-wds-sans text-[13px]/[18px] text-wds-text-copy-muted">
          No items to count — this department is done for the day.
        </p>
      ) : null}
      {today.status === 'CLOSED' ? (
        <p className="mx-4 mb-4 mt-3.5 rounded-[4px] bg-wds-neutral-50 p-3 font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
          Gaps posted as an adjustment at {summary.name}&apos;s location — the branch day was signed and closed {today.closedAt ? formatClock(today.closedAt) : ''}.
        </p>
      ) : editable ? (
        <p className="mx-4 mb-4 mt-3.5 rounded-[4px] bg-wds-neutral-50 p-3 font-wds-sans text-[12px]/4 text-wds-text-copy-muted">
          {full ? '' : 'Counts save as you type. '}Gaps post as an adjustment at {summary.name}&apos;s location once the whole branch day is signed and closed.
        </p>
      ) : null}
    </div>
  );
}
